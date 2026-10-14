import { Router, Response } from 'express';
import { operatorCatalogImport } from '../data/operatorCatalogImport.ts';
import crypto from 'crypto';
import {
  requireCoordinatorAuth,
  AuthenticatedStaffRequest,
  verifyPassword,
  createStaffAuthToken,
} from '../middleware/auth.ts';
import { recordEventSafely } from '../services/attribution.ts';
import { deleteReservationById } from '../lib/reservation-deletion.ts';
import {
  getFirestoreDb,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocById,
  setDocById,
  updateDocById,
  deleteDocById,
  getCollectionDocs,
  where,
  getTombstones,
  recordTombstone,
} from '../lib/firestore.ts';
import {
  getAllCoordinatorVariantsForProduct,
  createCoordinatorVariant,
  updateCoordinatorVariant,
  toggleVariantActiveState,
} from '../services/variantCatalog.ts';

const router = Router();

// POST /api/coordinator/login - Staff authentication backed by Firestore users
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'CREDENTIALS_REQUIRED', message: 'Email and password required' });
      return;
    }

    // Explicitly reject mock bypass tokens
    if (['mock-token', 'bypass', 'admin-bypass'].includes(password.toLowerCase())) {
      res.status(403).json({
        error: 'MOCK_LOGIN_REJECTED',
        message: 'Mock or bypass authentication tokens are strictly prohibited.',
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const allUsers = await getCollectionDocs<any>('users');
    const user = allUsers.find(
      (u) => u.email?.trim().toLowerCase() === cleanEmail && Boolean(u.isActive)
    );

    if (!user) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid staff email or password' });
      return;
    }

    // Verify password against stored hash in Firestore using secure verification
    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid staff credentials' });
      return;
    }

    const token = createStaffAuthToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Coordinator login error:', error);
    res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

// GET /api/coordinator/me - Current staff user
router.get('/me', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  res.json({ user: req.staffUser });
});

// GET /api/coordinator/leads - Leads with First Touch & Last Touch
router.get('/leads', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const leads = await getCollectionDocs<any>('leads');
    leads.sort((a, b) => new Date(b.lastTouchTimestamp || 0).getTime() - new Date(a.lastTouchTimestamp || 0).getTime());

    const guests = await getCollectionDocs<any>('guests');
    const guestMap = new Map(guests.map((g) => [g.id, g]));

    const enriched = leads.map((l) => ({
      ...l,
      guest: guestMap.get(l.guestId) || null,
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error loading leads:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_LEADS' });
  }
});

// GET /api/coordinator/reservations - All reservation requests from Firestore
router.get('/reservations', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allReservations = await getCollectionDocs<any>('reservation_requests');
    const reservations = allReservations
      .filter((r) => !tombstones.has(`reservation_requests_${r.id}`))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const guests = await getCollectionDocs<any>('guests');
    const guestMap = new Map(guests.map((g) => [g.id, g]));

    const items = await getCollectionDocs<any>('reservation_items');
    const tokens = await getCollectionDocs<any>('guest_access_tokens');
    const notes = await getCollectionDocs<any>('coordinator_notes');

    const enriched = reservations.map((r) => {
      const resItems = items.filter((i) => i.reservationRequestId === r.id);
      const resToken = tokens.find((t) => t.reservationRequestId === r.id && !t.isRevoked);
      const resNotes = notes.filter((n) => n.targetId === r.id);
      return {
        ...r,
        guest: guestMap.get(r.guestId) || null,
        items: resItems,
        guestToken: resToken ? resToken.id : (r.guestToken || null),
        coordinatorNotes: resNotes,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error loading reservations:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_RESERVATIONS' });
  }
});

// GET /api/coordinator/reservations/:id - Single detailed reservation
router.get('/reservations/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tombstones = await getTombstones();
    if (tombstones.has(`reservation_requests_${id}`)) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const r = await getDocById<any>('reservation_requests', id);
    if (!r) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const guest = r.guestId ? await getDocById<any>('guests', r.guestId) : null;
    const items = await getCollectionDocs<any>('reservation_items', where('reservationRequestId', '==', id));
    const tokens = await getCollectionDocs<any>('guest_access_tokens', where('reservationRequestId', '==', id));
    const notes = await getCollectionDocs<any>('coordinator_notes', where('targetId', '==', id));

    res.json({
      ...r,
      guest,
      items,
      guestToken: tokens[0]?.id || r.guestToken || null,
      coordinatorNotes: notes,
    });
  } catch (error) {
    console.error('Error loading single reservation detail:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_RESERVATION' });
  }
});

// PATCH & POST /api/coordinator/reservations/:id/status - Update reservation status in Firestore (Idempotent)
const handleStatusUpdate = async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, internalNote } = req.body;

    const validStatuses = [
      'NEW',
      'REVIEWED',
      'CONTACTED',
      'PARTNER_CONTACTED',
      'QUOTED',
      'CONFIRMED',
      'DECLINED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'INVALID_STATUS', validStatuses });
      return;
    }

    const current = await getDocById<any>('reservation_requests', id);
    if (!current) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const nowIso = new Date().toISOString();

    // Idempotency: If already in target status, do NOT re-generate communications
    if (current.status === status) {
      if (internalNote) {
        const noteId = 'note_' + crypto.randomBytes(12).toString('hex');
        await setDocById('coordinator_notes', noteId, {
          id: noteId,
          targetType: 'reservation',
          targetId: id,
          authorStaffId: req.staffUser!.id,
          authorName: req.staffUser!.name,
          content: internalNote,
          createdAt: nowIso,
        });
      }
      res.json({
        success: true,
        message: `Reservation is already in status ${status}`,
        unchanged: true,
      });
      return;
    }

    // Update in Cloud Firestore
    await updateDocById('reservation_requests', id, {
      status,
      assignedStaffId: req.staffUser!.id,
      updatedAt: nowIso,
    });

    // Safely record conversion analytics event
    await recordEventSafely({
      visitorId: current.visitorId || 'vis_coordinator',
      sessionId: 'ses_coordinator',
      eventType: status === 'CONFIRMED' ? 'RESERVATION_CONFIRMED' : 'RESERVATION_STATUS_CHANGED',
      reservationId: id,
      reservationReference: current.referenceNumber,
      metadata: {
        previousStatus: current.status,
        newStatus: status,
        staffId: req.staffUser!.id,
      },
    });

    if (internalNote) {
      const noteId = 'note_' + crypto.randomBytes(12).toString('hex');
      await setDocById('coordinator_notes', noteId, {
        id: noteId,
        targetType: 'reservation',
        targetId: id,
        authorStaffId: req.staffUser!.id,
        authorName: req.staffUser!.name,
        content: internalNote,
        createdAt: nowIso,
      });
    }

    // Add automated message to guest thread with duplicate prevention
    let statusMessage = `Status update: Your reservation request status is now marked as ${status}.`;
    if (status === 'CONFIRMED') {
      statusMessage = `Great news! Your Victoria Falls reservation request has been officially CONFIRMED by our local partner operators. Our desk coordinator will be in touch with final arrival details.`;
    } else if (status === 'CONTACTED' || status === 'PARTNER_CONTACTED') {
      statusMessage = `Our Reservations Desk has contacted the relevant local operators to hold your dates. We will update you as soon as confirmation arrives.`;
    } else if (status === 'QUOTED') {
      statusMessage = `Your reservation request has been quoted with authoritative partner tariffs. Please review the details with our desk coordinator.`;
    } else if (status === 'CANCELLED') {
      statusMessage = `Your reservation request has been cancelled. Please contact our coordinator if you wish to reinstate.`;
    }

    const existingMsgs = await getCollectionDocs<any>(
      'guest_messages',
      where('reservationRequestId', '==', id)
    );
    const hasExisting = existingMsgs.some((m) => m.messageText === statusMessage);

    if (!hasExisting) {
      const msgId = 'msg_' + crypto.randomBytes(12).toString('hex');
      await setDocById('guest_messages', msgId, {
        id: msgId,
        reservationRequestId: id,
        senderType: 'coordinator',
        senderName: req.staffUser!.name,
        messageText: statusMessage,
        createdAt: nowIso,
      });
    }

    res.json({ success: true, message: `Reservation status updated to ${status}` });
  } catch (error) {
    console.error('Error updating status in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_UPDATE_STATUS' });
  }
};
router.patch('/reservations/:id/status', requireCoordinatorAuth, handleStatusUpdate);
router.post('/reservations/:id/status', requireCoordinatorAuth, handleStatusUpdate);

// GET /api/coordinator/reservations/:id/messages
router.get('/reservations/:id/messages', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const messages = await getCollectionDocs<any>(
      'guest_messages',
      where('reservationRequestId', '==', id)
    );
    messages.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_MESSAGES' });
  }
});

// DELETE /api/coordinator/reservations/:id - Admin-only permanent deletion
router.delete('/reservations/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const result = await deleteReservationById(req.staffUser, req.params.id);
    res.json(result);
  } catch (error: any) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) {
      console.error('Error deleting reservation:', error);
    }
    res.status(status).json({
      error: error?.code || 'FAILED_TO_DELETE_RESERVATION',
      message: status >= 500 ? 'Failed to delete reservation' : error?.message,
    });
  }
});

// POST /api/coordinator/messages - Send reply to guest
router.post('/messages', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { reservationRequestId, messageText } = req.body;

    if (!reservationRequestId || !messageText) {
      res.status(400).json({ error: 'RESERVATION_ID_AND_TEXT_REQUIRED' });
      return;
    }

    const msgId = 'msg_' + crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();
    const msgRecord = {
      id: msgId,
      reservationRequestId,
      guestSessionId: 'ses_coordinator_' + req.staffUser!.id,
      senderType: 'coordinator',
      senderName: req.staffUser!.name,
      messageText: messageText.trim(),
      createdAt: nowIso,
    };

    await setDocById('guest_messages', msgId, msgRecord);

    res.json({ success: true, messageId: msgId });
  } catch (error) {
    console.error('Error posting coordinator message:', error);
    res.status(500).json({ error: 'FAILED_TO_SEND_MESSAGE' });
  }
});

// POST /api/coordinator/notes - Add internal note
router.post('/notes', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { targetType, targetId, content } = req.body;

    if (!targetType || !targetId || !content) {
      res.status(400).json({ error: 'FIELDS_REQUIRED' });
      return;
    }

    const noteId = 'note_' + crypto.randomBytes(12).toString('hex');
    await setDocById('coordinator_notes', noteId, {
      id: noteId,
      targetType,
      targetId,
      authorStaffId: req.staffUser!.id,
      authorName: req.staffUser!.name,
      content,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, noteId });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_SAVE_NOTE' });
  }
});

// POST /api/coordinator/catalog/import-operator-pricelists
// Explicit, authenticated, idempotent draft-only import. Never publishes imported products.
router.post('/catalog/import-operator-pricelists', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const operators = await getCollectionDocs<any>('operators');
    const normalize = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const aliases: Record<string, string[]> = {
      'Wild Horizons': ['wild horizons', 'wild horizons victoria falls', 'wild horizons zimbabwe'],
      'Shearwater': ['shearwater', 'shearwater victoria falls'],
    };
    const operatorIds: Record<string, string> = {};

    for (const canonicalName of ['Wild Horizons', 'Shearwater']) {
      const accepted = new Set((aliases[canonicalName] || []).map(normalize));
      const matches = operators.filter((operator) => accepted.has(normalize(operator.name)));
      if (matches.length !== 1 || !matches[0]?.id) {
        res.status(409).json({
          error: 'OPERATOR_MAPPING_NOT_UNAMBIGUOUS',
          message: `Expected exactly one canonical operator record for "${canonicalName}", found ${matches.length}. No products were imported. Resolve operator records first.`,
          operator: canonicalName,
          matches: matches.map((operator) => ({ id: operator.id, name: operator.name })),
        });
        return;
      }
      operatorIds[canonicalName] = matches[0].id;
    }

    const existingProducts = await getCollectionDocs<any>('products');
    const tombstones = await getTombstones();
    const activeExisting = existingProducts.filter((p) => !tombstones.has(`products_${p.id}`));
    const existingKeys = new Set(activeExisting.map((p) => p.catalogImportKey).filter(Boolean));
    const results = { created: 0, alreadyImported: 0, existingNeedsManualReview: 0, errors: [] as string[], skipped: [] as Array<{ name: string; operator: string; reason: string }> };
    const now = new Date().toISOString();

    for (const item of operatorCatalogImport) {
      const operatorId = operatorIds[item.operatorName];
      const importKey = `operator-pricelist-v1:${normalize(item.operatorName).replace(/ /g, '-') }:${normalize(item.name).replace(/ /g, '-')}`;
      if (existingKeys.has(importKey)) {
        results.alreadyImported++;
        continue;
      }

      // Same-name products under the same operator may be legacy catalog entries.
      // Never overwrite them or silently create a second listing.
      const sameOperatorName = activeExisting.find((p) =>
        p.operatorId === operatorId && normalize(p.name) === normalize(item.name)
      );
      if (sameOperatorName) {
        results.existingNeedsManualReview++;
        results.skipped.push({ name: item.name, operator: item.operatorName, reason: `Existing product ${sameOperatorName.id} requires manual source/rate reconciliation; no overwrite performed.` });
        continue;
      }

      const productId = 'imp_' + crypto.createHash('sha256').update(importKey).digest('hex').slice(0, 24);
      if (activeExisting.some((p) => p.id === productId)) {
        results.errors.push(`Deterministic ID collision for ${item.operatorName}: ${item.name}`);
        continue;
      }

      const newProduct = {
        id: productId,
        slug: `${normalize(item.name).replace(/ /g, '-')}-${productId.slice(-6)}`,
        name: item.name,
        productType: 'activity',
        catalogItemType: item.productType,
        categorySlug: item.categorySlug,
        operatorId,
        propertyId: null,
        shortDescription: item.shortDescription,
        description: item.shortDescription,
        location: 'Victoria Falls, Zimbabwe',
        duration: null,
        basePrice: String(item.basePrice),
        currency: 'USD',
        priceBasis: item.priceBasis,
        inclusions: item.inclusions,
        exclusions: item.exclusions,
        mandatoryFees: item.mandatoryFees,
        sourceReference: item.sourceReference,
        catalogImportKey: importKey,
        catalogImportStatus: 'DRAFT_NEEDS_VERIFICATION',
        verificationNotes: item.verificationNotes,
        isPublished: false,
        isFeatured: false,
        availabilityNote: 'Subject to operator confirmation; draft import not bookable until verified.',
        primaryMediaId: null,
        videoUrl: null,
        evidenceStatus: 'NEEDS_VERIFICATION',
        createdAt: now,
        updatedAt: now,
        importedByStaffId: req.staffUser!.id,
      };

      try {
        await setDocById('products', productId, newProduct, false);
        const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
        await setDocById('product_revisions', revId, {
          id: revId,
          productId,
          modifiedByStaffId: req.staffUser!.id,
          previousSnapshot: null,
          changeSummary: `Draft operator price-list import: ${item.operatorName} — ${item.name}`,
          createdAt: now,
        });
        existingKeys.add(importKey);
        activeExisting.push(newProduct);
        results.created++;
      } catch (error: any) {
        results.errors.push(`${item.operatorName} — ${item.name}: ${error?.message || 'write failed'}`);
      }
    }

    res.status(results.errors.length ? 207 : 200).json({
      success: results.errors.length === 0,
      message: 'Operator catalog import completed. Imported products remain unpublished drafts.',
      operatorMapping: operatorIds,
      totalSourceRecords: operatorCatalogImport.length,
      ...results,
    });
  } catch (error: any) {
    console.error('Operator catalog import failed:', error);
    res.status(500).json({ error: 'OPERATOR_CATALOG_IMPORT_FAILED', message: error?.message || 'Unknown error' });
  }
});

// GET /api/coordinator/products - All products from Firestore (including unpublished/draft)
router.get('/products', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allProducts = await getCollectionDocs<any>('products');
    const products = allProducts
      .filter((p) => !tombstones.has(`products_${p.id}`))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const operators = await getCollectionDocs<any>('operators');
    const operatorMap = new Map(operators.map((o) => [o.id, o]));

    const allMedia = await getCollectionDocs<any>('media_assets');
    const mediaList = allMedia.filter((m) => !tombstones.has(`media_assets_${m.id}`));

    const enriched = products.map((p) => {
      const op = p.operatorId ? operatorMap.get(p.operatorId) : null;
      const productMedia = mediaList.filter((m) => m.ownerId === p.id);
      const primaryMedia =
        (p.primaryMediaId ? productMedia.find((m) => m.id === p.primaryMediaId) : null) ||
        productMedia.find((m) => m.isPrimary) ||
        productMedia[0];

      return {
        ...p,
        operatorName: op?.name || 'Syntuc Partner',
        primaryImageUrl: primaryMedia?.url || null,
        mediaCount: productMedia.length,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching coordinator products:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCTS' });
  }
});

// POST /api/coordinator/products - Create new product directly in Firestore
router.post('/products', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const {
      name,
      productType = 'activity',
      categorySlug = 'adventure',
      operatorId,
      propertyId,
      shortDescription,
      description,
      location = 'Victoria Falls, Zimbabwe',
      duration,
      basePrice,
      currency = 'USD',
      priceBasis = 'per_person',
      inclusions = [],
      exclusions = [],
      suitability = [],
      isPublished = false,
      isFeatured = false,
      videoUrl,
      availabilityNote = 'Subject to partner confirmation',
      primaryMediaId,
    } = req.body;

    if (!name || !basePrice) {
      res.status(400).json({ error: 'NAME_AND_PRICE_REQUIRED', message: 'Product name and base price are required' });
      return;
    }

    const cleanSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const productId = `prod_${cleanSlug.slice(0, 20)}_${crypto.randomBytes(4).toString('hex')}`;
    const slug = `${cleanSlug}-${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const newProduct = {
      id: productId,
      name: name.trim(),
      slug,
      productType: productType === 'accommodation' ? 'accommodation' : 'activity',
      categorySlug: categorySlug || (productType === 'accommodation' ? 'lodges-hotels' : 'adventure'),
      operatorId: operatorId || null,
      propertyId: propertyId || null,
      shortDescription: shortDescription?.trim() || `${name} in Victoria Falls, Zimbabwe.`,
      description: description?.trim() || `${name} offers an authentic Victoria Falls experience.`,
      location: location || 'Victoria Falls, Zimbabwe',
      duration: duration || null,
      basePrice: String(Number(basePrice) || 0),
      currency: currency || 'USD',
      priceBasis: priceBasis || (productType === 'accommodation' ? 'per_room_night' : 'per_person'),
      inclusions: Array.isArray(inclusions) ? inclusions : [],
      exclusions: Array.isArray(exclusions) ? exclusions : [],
      suitability: Array.isArray(suitability) ? suitability : [],
      isPublished: Boolean(isPublished),
      isFeatured: Boolean(isFeatured),
      availabilityNote: availabilityNote || 'Subject to partner confirmation',
      primaryMediaId: primaryMediaId || null,
      videoUrl: videoUrl?.trim() || null,
      evidenceStatus: 'ESTABLISHED',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDocById('products', productId, newProduct);

    // Record audit revision
    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: null,
      changeSummary: `Product created by ${req.staffUser!.name}: ${name} (${isPublished ? 'Published' : 'Draft'})`,
      createdAt: nowIso,
    });

    res.status(201).json({
      success: true,
      product: newProduct,
      message: `Product successfully created as ${isPublished ? 'PUBLISHED' : 'DRAFT'}`,
    });
  } catch (error: any) {
    console.error('Error creating product in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_CREATE_PRODUCT', message: error.message });
  }
});

// PUT /api/coordinator/products/:id - Edit product directly in Firestore
router.put('/products/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      productType,
      categorySlug,
      operatorId,
      propertyId,
      shortDescription,
      description,
      location,
      duration,
      basePrice,
      currency,
      priceBasis,
      inclusions,
      exclusions,
      suitability,
      isPublished,
      isFeatured,
      videoUrl,
      availabilityNote,
      primaryMediaId,
    } = req.body;

    const current = await getDocById<any>('products', id);
    if (!current) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const nowIso = new Date().toISOString();

    // Record revision history in Firestore
    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId: id,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: current,
      changeSummary: `Product updated by ${req.staffUser!.name}: ${name || current.name}`,
      createdAt: nowIso,
    });

    const updatedData: any = {
      updatedAt: nowIso,
    };
    if (name !== undefined) updatedData.name = name.trim();
    if (productType !== undefined) updatedData.productType = productType;
    if (categorySlug !== undefined) updatedData.categorySlug = categorySlug;
    if (operatorId !== undefined) updatedData.operatorId = operatorId || null;
    if (propertyId !== undefined) updatedData.propertyId = propertyId || null;
    if (shortDescription !== undefined) updatedData.shortDescription = shortDescription.trim();
    if (description !== undefined) updatedData.description = description.trim();
    if (location !== undefined) updatedData.location = location.trim();
    if (duration !== undefined) updatedData.duration = duration;
    if (basePrice !== undefined) updatedData.basePrice = String(basePrice);
    if (currency !== undefined) updatedData.currency = currency;
    if (priceBasis !== undefined) updatedData.priceBasis = priceBasis;
    if (inclusions !== undefined) updatedData.inclusions = inclusions;
    if (exclusions !== undefined) updatedData.exclusions = exclusions;
    if (suitability !== undefined) updatedData.suitability = suitability;
    if (isPublished !== undefined) updatedData.isPublished = Boolean(isPublished);
    if (isFeatured !== undefined) updatedData.isFeatured = Boolean(isFeatured);
    if (videoUrl !== undefined) updatedData.videoUrl = videoUrl ? videoUrl.trim() : null;
    if (availabilityNote !== undefined) updatedData.availabilityNote = availabilityNote;
    if (primaryMediaId !== undefined) updatedData.primaryMediaId = primaryMediaId || null;

    await updateDocById('products', id, updatedData);

    const updated = await getDocById<any>('products', id);

    res.json({ success: true, product: updated, message: 'Product updated and revision recorded' });
  } catch (error) {
    console.error('Error updating product in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_UPDATE_PRODUCT' });
  }
});

// PATCH /api/coordinator/products/:id/publish - Publish or unpublish product in Firestore
router.patch('/products/:id/publish', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const current = await getDocById<any>('products', id);
    if (!current) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const newStatus = isPublished !== undefined ? Boolean(isPublished) : !current.isPublished;
    const nowIso = new Date().toISOString();

    await updateDocById('products', id, {
      isPublished: newStatus,
      updatedAt: nowIso,
    });

    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId: id,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: current,
      changeSummary: `Product publication status changed to ${newStatus ? 'PUBLISHED' : 'UNPUBLISHED'} by ${req.staffUser!.name}`,
      createdAt: nowIso,
    });

    res.json({
      success: true,
      isPublished: newStatus,
      message: `Product is now ${newStatus ? 'PUBLISHED' : 'UNPUBLISHED'}`,
    });
  } catch (error) {
    console.error('Error toggling product publish state:', error);
    res.status(500).json({ error: 'FAILED_TO_TOGGLE_PUBLISH' });
  }
});

// DELETE /api/coordinator/products/:id - Permanently delete catalog product and record durable tombstone
router.delete('/products/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await getDocById<any>('products', id);

    if (!existing) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    // 1. Record durable deletion tombstone in Cloud Firestore
    await recordTombstone('products', id);

    // 2. Delete product from Cloud Firestore
    await deleteDocById('products', id);

    res.json({
      success: true,
      message: `Product ${id} permanently deleted and deletion tombstoned in Cloud Firestore.`,
    });
  } catch (error: any) {
    console.error('Error deleting product from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_DELETE_PRODUCT', message: error.message });
  }
});

// ==========================================
// COORDINATOR PRODUCT VARIANT MANAGEMENT
// ==========================================

// GET /api/coordinator/products/:productId/variants - Get all variants for coordinator editor
router.get('/products/:productId/variants', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await getDocById<any>('products', productId);
    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Product ${productId} does not exist.` });
      return;
    }

    const variants = await getAllCoordinatorVariantsForProduct(productId);
    res.json(variants);
  } catch (error: any) {
    console.error(`Error loading coordinator variants for ${req.params.productId}:`, error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_VARIANTS', message: error.message });
  }
});

// POST /api/coordinator/products/:productId/variants - Create new variant with strict validation
router.post('/products/:productId/variants', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await getDocById<any>('products', productId);
    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Product ${productId} does not exist.` });
      return;
    }

    const {
      name,
      description,
      price,
      currency = 'USD',
      priceBasis = 'per_person',
      category,
      duration,
      compulsoryFees,
      childRate,
      supplierNote,
      isActive = true,
    } = req.body;

    const createdVariant = await createCoordinatorVariant(productId, {
      name,
      description,
      price,
      currency,
      priceBasis,
      category,
      duration,
      compulsoryFees,
      childRate,
      supplierNote,
      isActive,
    });

    // Record revision in product_revisions for audit tracking
    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: null,
      changeSummary: `Variant "${createdVariant.name}" (${createdVariant.id}) created by ${req.staffUser!.name}`,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      variant: createdVariant,
      message: 'Product variant successfully created in Firestore.',
    });
  } catch (error: any) {
    console.error('Error creating product variant:', error);
    const statusCode = error.message?.includes('DUPLICATE_VARIANT_NAME') ||
      error.message?.includes('INVALID_VARIANT_PRICE') ||
      error.message?.includes('VARIANT_NAME_REQUIRED') ? 400 : 500;
    res.status(statusCode).json({ error: 'FAILED_TO_CREATE_VARIANT', message: error.message });
  }
});

// PUT /api/coordinator/products/:productId/variants/:variantId - Edit variant without altering product defaults
router.put('/products/:productId/variants/:variantId', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { productId, variantId } = req.params;
    const product = await getDocById<any>('products', productId);
    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Product ${productId} does not exist.` });
      return;
    }

    const {
      name,
      description,
      price,
      currency,
      priceBasis,
      category,
      duration,
      compulsoryFees,
      childRate,
      supplierNote,
      isActive,
    } = req.body;

    const updatedVariant = await updateCoordinatorVariant(productId, variantId, {
      name,
      description,
      price,
      currency,
      priceBasis,
      category,
      duration,
      compulsoryFees,
      childRate,
      supplierNote,
      isActive,
    });

    // Record revision in product_revisions for audit tracking
    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: null,
      changeSummary: `Variant "${updatedVariant.name}" (${variantId}) updated by ${req.staffUser!.name}`,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      variant: updatedVariant,
      message: 'Product variant updated successfully in Firestore.',
    });
  } catch (error: any) {
    console.error('Error updating product variant:', error);
    const statusCode = error.message?.includes('DUPLICATE_VARIANT_NAME') ||
      error.message?.includes('INVALID_VARIANT_PRICE') ||
      error.message?.includes('VARIANT_NAME_REQUIRED') ? 400 :
      error.message?.includes('SECURITY_VIOLATION') ? 403 :
      error.message?.includes('VARIANT_NOT_FOUND') ? 404 : 500;
    res.status(statusCode).json({ error: 'FAILED_TO_UPDATE_VARIANT', message: error.message });
  }
});

// PATCH /api/coordinator/products/:productId/variants/:variantId/toggle-active - Toggle active/inactive
router.patch('/products/:productId/variants/:variantId/toggle-active', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { productId, variantId } = req.params;
    const { isActive } = req.body;

    const updatedVariant = await toggleVariantActiveState(productId, variantId, isActive);

    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: null,
      changeSummary: `Variant "${updatedVariant.name}" (${variantId}) ${updatedVariant.isActive ? 'ACTIVATED' : 'DEACTIVATED'} by ${req.staffUser!.name}`,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      variant: updatedVariant,
      message: `Variant is now ${updatedVariant.isActive ? 'ACTIVE' : 'INACTIVE'}.`,
    });
  } catch (error: any) {
    console.error('Error toggling variant state:', error);
    res.status(500).json({ error: 'FAILED_TO_TOGGLE_VARIANT', message: error.message });
  }
});

// DELETE /api/coordinator/products/:productId/variants/:variantId - Safe deactivation to preserve reservation history
router.delete('/products/:productId/variants/:variantId', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { productId, variantId } = req.params;

    // Soft-deactivate variant to ensure integrity of existing reservation snapshots
    const deactivated = await toggleVariantActiveState(productId, variantId, false);

    const revId = 'rev_' + crypto.randomBytes(12).toString('hex');
    await setDocById('product_revisions', revId, {
      id: revId,
      productId,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: null,
      changeSummary: `Variant "${deactivated.name}" (${variantId}) safely deactivated by ${req.staffUser!.name}`,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      variant: deactivated,
      message: `Variant "${deactivated.name}" safely deactivated. Historical references preserved.`,
    });
  } catch (error: any) {
    console.error('Error deactivating variant:', error);
    res.status(500).json({ error: 'FAILED_TO_DEACTIVATE_VARIANT', message: error.message });
  }
});

// GET /api/coordinator/operators - Operators list from Firestore
router.get('/operators', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const operators = await getCollectionDocs<any>('operators');
    operators.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(operators);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_OPERATORS' });
  }
});

// GET /api/coordinator/properties - Properties list from Firestore
router.get('/properties', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const properties = await getCollectionDocs<any>('properties');
    properties.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_PROPERTIES' });
  }
});

// GET /api/coordinator/packages - All packages for coordinator workbench from Firestore
router.get('/packages', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const pkgs = await getCollectionDocs<any>('packages');
    pkgs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(pkgs);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_PACKAGES' });
  }
});

// POST /api/coordinator/packages - Create package directly in Firestore
router.post('/packages', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const {
      name,
      tagline,
      description,
      durationDays = 3,
      durationNights = 2,
      pricePerPerson,
      currency = 'USD',
      highlights = [],
      inclusions = [],
      exclusions = [],
      primaryImageUrl,
      videoUrl,
      isPublished = true,
    } = req.body;

    if (!name || !pricePerPerson || !primaryImageUrl) {
      res.status(400).json({ error: 'MISSING_FIELDS', message: 'Name, price, and primary image URL required' });
      return;
    }

    const cleanSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const pkgId = `pkg_${cleanSlug.slice(0, 20)}_${crypto.randomBytes(4).toString('hex')}`;
    const slug = `${cleanSlug}-${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const newPkg = {
      id: pkgId,
      name: name.trim(),
      slug,
      tagline: tagline || `${durationNights} Nights / ${durationDays} Days in Victoria Falls`,
      description: description || name,
      durationDays: Number(durationDays),
      durationNights: Number(durationNights),
      pricePerPerson: String(Number(pricePerPerson) || 0),
      currency,
      highlights: Array.isArray(highlights) ? highlights : [],
      inclusions: Array.isArray(inclusions) ? inclusions : [],
      exclusions: Array.isArray(exclusions) ? exclusions : [],
      primaryImageUrl,
      videoUrl: videoUrl ? videoUrl.trim() : null,
      isPublished: Boolean(isPublished),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDocById('packages', pkgId, newPkg);

    res.status(201).json({ success: true, package: newPkg });
  } catch (error: any) {
    res.status(500).json({ error: 'FAILED_TO_CREATE_PACKAGE', message: error.message });
  }
});

// PUT /api/coordinator/packages/:id - Update package directly in Firestore
router.put('/packages/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      tagline,
      description,
      durationDays,
      durationNights,
      pricePerPerson,
      currency,
      highlights,
      inclusions,
      exclusions,
      primaryImageUrl,
      videoUrl,
      isPublished,
    } = req.body;

    const current = await getDocById<any>('packages', id);
    if (!current) {
      res.status(404).json({ error: 'PACKAGE_NOT_FOUND' });
      return;
    }

    const updatedData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (name !== undefined) updatedData.name = name.trim();
    if (tagline !== undefined) updatedData.tagline = tagline;
    if (description !== undefined) updatedData.description = description;
    if (durationDays !== undefined) updatedData.durationDays = Number(durationDays);
    if (durationNights !== undefined) updatedData.durationNights = Number(durationNights);
    if (pricePerPerson !== undefined) updatedData.pricePerPerson = String(pricePerPerson);
    if (currency !== undefined) updatedData.currency = currency;
    if (highlights !== undefined) updatedData.highlights = highlights;
    if (inclusions !== undefined) updatedData.inclusions = inclusions;
    if (exclusions !== undefined) updatedData.exclusions = exclusions;
    if (primaryImageUrl !== undefined) updatedData.primaryImageUrl = primaryImageUrl;
    if (videoUrl !== undefined) updatedData.videoUrl = videoUrl ? videoUrl.trim() : null;
    if (isPublished !== undefined) updatedData.isPublished = Boolean(isPublished);

    await updateDocById('packages', id, updatedData);

    const updated = await getDocById<any>('packages', id);

    res.json({ success: true, package: updated });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_PACKAGE' });
  }
});

// GET /api/coordinator/knowledge-sources
router.get('/knowledge-sources', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const sources = await getCollectionDocs<any>('knowledge_sources');
    sources.sort((a, b) => new Date(b.lastVerified || 0).getTime() - new Date(a.lastVerified || 0).getTime());
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_SOURCES' });
  }
});

// POST /api/coordinator/knowledge-sources
router.post('/knowledge-sources', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { name, sourceUrl, sourceType, evidenceStatus, notes } = req.body;

    if (!name || !sourceType) {
      res.status(400).json({ error: 'NAME_AND_TYPE_REQUIRED' });
      return;
    }

    const ksId = 'ks_' + crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();
    await setDocById('knowledge_sources', ksId, {
      id: ksId,
      name,
      sourceUrl: sourceUrl || null,
      sourceType,
      evidenceStatus: evidenceStatus || 'ESTABLISHED',
      notes: notes || null,
      lastVerified: nowIso,
      createdAt: nowIso,
    });

    res.json({ success: true, id: ksId });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_CREATE_SOURCE' });
  }
});

// GET /api/coordinator/staff-users - Administrator Staff Management
router.get('/staff-users', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    if (req.staffUser?.role !== 'admin') {
      res.status(403).json({ error: 'ADMIN_REQUIRED', message: 'Administrator authorization required' });
      return;
    }

    const allUsers = await getCollectionDocs<any>('users');
    const sanitized = allUsers
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_STAFF_USERS' });
  }
});

// PATCH /api/coordinator/staff-users/:id/toggle-active - Activate/Deactivate staff account
router.patch('/staff-users/:id/toggle-active', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    if (req.staffUser?.role !== 'admin') {
      res.status(403).json({ error: 'ADMIN_REQUIRED', message: 'Administrator authorization required' });
      return;
    }

    const { id } = req.params;
    const targetUser = await getDocById<any>('users', id);
    if (!targetUser) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    const newActiveState = !targetUser.isActive;
    await updateDocById('users', id, {
      isActive: newActiveState,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, id, isActive: newActiveState });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_USER_STATUS' });
  }
});

// POST /api/coordinator/logout - Explicit server-side session termination
router.post('/logout', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  res.json({ success: true, message: 'Coordinator session successfully terminated' });
});

export default router;
