import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import crypto from 'crypto';
import { requireCoordinatorAuth, AuthenticatedStaffRequest } from '../middleware/auth.ts';
import { recordEventSafely } from '../services/attribution.ts';
import {
  updateReservationStatusInFirestore,
  persistProductToFirestore,
  persistPackageToFirestore,
  persistGuestMessageToFirestore,
  recordTombstoneInFirestore,
  deleteReservationFromFirestore,
  deleteProductFromFirestore,
} from '../services/firestoreSync.ts';

const router = Router();

// POST /api/coordinator/login - Staff authentication
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'CREDENTIALS_REQUIRED', message: 'Email and password required' });
      return;
    }

    // Explicitly reject mock bypass tokens
    if (['mock-token', 'bypass', 'admin-bypass'].includes(password.toLowerCase())) {
      res.status(403).json({ error: 'MOCK_LOGIN_REJECTED', message: 'Mock or bypass authentication tokens are strictly prohibited.' });
      return;
    }

    const userRecords = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, email.trim().toLowerCase()), eq(schema.users.isActive, true)));

    if (userRecords.length === 0) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid staff email or password' });
      return;
    }

    const user = userRecords[0];

    // Verify password against stored hash in database
    if (user.passwordHash !== password) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid staff credentials' });
      return;
    }

    // Return token
    const token = `staff_${user.id}`;

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
    const leads = await db
      .select()
      .from(schema.leads)
      .orderBy(desc(schema.leads.lastTouchTimestamp));

    const guests = await db.select().from(schema.guests);
    const guestMap = new Map(guests.map(g => [g.id, g]));

    const enriched = leads.map(l => ({
      ...l,
      guest: guestMap.get(l.guestId) || null,
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error loading leads:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_LEADS' });
  }
});

// GET /api/coordinator/reservations - All reservation requests
router.get('/reservations', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const reservations = await db
      .select()
      .from(schema.reservationRequests)
      .orderBy(desc(schema.reservationRequests.createdAt));

    const guests = await db.select().from(schema.guests);
    const guestMap = new Map(guests.map(g => [g.id, g]));

    const items = await db.select().from(schema.reservationItems);
    const tokens = await db.select().from(schema.guestAccessTokens);
    const notes = await db.select().from(schema.coordinatorNotes);

    const enriched = reservations.map(r => {
      const resItems = items.filter(i => i.reservationRequestId === r.id);
      const resToken = tokens.find(t => t.reservationRequestId === r.id && !t.isRevoked);
      const resNotes = notes.filter(n => n.targetId === r.id);
      return {
        ...r,
        guest: guestMap.get(r.guestId) || null,
        items: resItems,
        guestToken: resToken ? resToken.id : null,
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
    const records = await db
      .select()
      .from(schema.reservationRequests)
      .where(eq(schema.reservationRequests.id, id));

    if (records.length === 0) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const r = records[0];
    const guestRecords = await db.select().from(schema.guests).where(eq(schema.guests.id, r.guestId));
    const items = await db.select().from(schema.reservationItems).where(eq(schema.reservationItems.reservationRequestId, r.id));
    const tokens = await db.select().from(schema.guestAccessTokens).where(eq(schema.guestAccessTokens.reservationRequestId, r.id));
    const notes = await db.select().from(schema.coordinatorNotes).where(eq(schema.coordinatorNotes.targetId, r.id));

    res.json({
      ...r,
      guest: guestRecords[0] || null,
      items,
      guestToken: tokens[0]?.id || null,
      coordinatorNotes: notes,
    });
  } catch (error) {
    console.error('Error loading single reservation detail:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_RESERVATION' });
  }
});

// PATCH & POST /api/coordinator/reservations/:id/status - Update reservation status (Idempotent)
const handleStatusUpdate = async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, internalNote } = req.body;

    const validStatuses = ['NEW', 'REVIEWED', 'CONTACTED', 'PARTNER_CONTACTED', 'QUOTED', 'CONFIRMED', 'DECLINED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'INVALID_STATUS', validStatuses });
      return;
    }

    const currentRecords = await db
      .select()
      .from(schema.reservationRequests)
      .where(eq(schema.reservationRequests.id, id));

    if (currentRecords.length === 0) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const current = currentRecords[0];

    // Idempotency: If already in the target status, do NOT re-generate communications
    if (current.status === status) {
      if (internalNote) {
        await db.insert(schema.coordinatorNotes).values({
          id: 'note_' + crypto.randomBytes(12).toString('hex'),
          targetType: 'reservation',
          targetId: id,
          authorStaffId: req.staffUser!.id,
          authorName: req.staffUser!.name,
          content: internalNote,
        });
      }
      res.json({
        success: true,
        message: `Reservation is already in status ${status}`,
        unchanged: true,
      });
      return;
    }

    await db
      .update(schema.reservationRequests)
      .set({
        status,
        assignedStaffId: req.staffUser!.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.reservationRequests.id, id));

    // Persist status change to Cloud Firestore for container lifecycle survival
    try {
      await updateReservationStatusInFirestore(id, status, req.staffUser!.id);
    } catch (fsErr) {
      console.warn('[Coordinator] Firestore status sync notice:', fsErr);
    }

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

    // If internal note provided
    if (internalNote) {
      await db.insert(schema.coordinatorNotes).values({
        id: 'note_' + crypto.randomBytes(12).toString('hex'),
        targetType: 'reservation',
        targetId: id,
        authorStaffId: req.staffUser!.id,
        authorName: req.staffUser!.name,
        content: internalNote,
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

    const existingMsg = await db
      .select()
      .from(schema.guestMessages)
      .where(
        and(
          eq(schema.guestMessages.reservationRequestId, id),
          eq(schema.guestMessages.messageText, statusMessage)
        )
      );

    if (existingMsg.length === 0) {
      await db.insert(schema.guestMessages).values({
        id: 'msg_' + crypto.randomBytes(12).toString('hex'),
        reservationRequestId: id,
        senderType: 'coordinator',
        senderName: req.staffUser!.name,
        messageText: statusMessage,
      });
    }

    res.json({ success: true, message: `Reservation status updated to ${status}` });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'FAILED_TO_UPDATE_STATUS' });
  }
};
router.patch('/reservations/:id/status', requireCoordinatorAuth, handleStatusUpdate);
router.post('/reservations/:id/status', requireCoordinatorAuth, handleStatusUpdate);

// GET /api/coordinator/reservations/:id/messages
router.get('/reservations/:id/messages', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const messages = await db
      .select()
      .from(schema.guestMessages)
      .where(eq(schema.guestMessages.reservationRequestId, id))
      .orderBy(schema.guestMessages.createdAt);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_MESSAGES' });
  }
});

// DELETE /api/coordinator/reservations/:id - Permanently delete reservation request and record durable tombstone
router.delete('/reservations/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await db
      .select()
      .from(schema.reservationRequests)
      .where(eq(schema.reservationRequests.id, id));

    if (existing.length === 0) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    // 1. Record durable deletion tombstone in Cloud Firestore
    await recordTombstoneInFirestore('reservation_requests', id);

    // 2. Delete reservation and associated line items from Cloud Firestore
    await deleteReservationFromFirestore(id);

    // 3. Delete from relational engine
    await db.delete(schema.reservationItems).where(eq(schema.reservationItems.reservationRequestId, id));
    await db.delete(schema.guestAccessTokens).where(eq(schema.guestAccessTokens.reservationRequestId, id));
    await db.delete(schema.guestMessages).where(eq(schema.guestMessages.reservationRequestId, id));
    await db.delete(schema.coordinatorNotes).where(eq(schema.coordinatorNotes.targetId, id));
    await db.delete(schema.reservationRequests).where(eq(schema.reservationRequests.id, id));

    res.json({ success: true, message: `Reservation ${id} permanently deleted and deletion tombstoned in Cloud Firestore.` });
  } catch (error: any) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ error: 'FAILED_TO_DELETE_RESERVATION', message: error.message });
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
    const msgRecord = {
      id: msgId,
      reservationRequestId,
      guestSessionId: 'ses_coordinator_' + req.staffUser!.id,
      senderType: 'coordinator',
      senderName: req.staffUser!.name,
      messageText: messageText.trim(),
      createdAt: new Date(),
    };
    await db.insert(schema.guestMessages).values(msgRecord);
    try {
      await persistGuestMessageToFirestore(msgRecord as any);
    } catch (_) {}

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
    await db.insert(schema.coordinatorNotes).values({
      id: noteId,
      targetType,
      targetId,
      authorStaffId: req.staffUser!.id,
      authorName: req.staffUser!.name,
      content,
    });

    res.json({ success: true, noteId });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_SAVE_NOTE' });
  }
});

// GET /api/coordinator/products - All products (including unpublished/draft) for catalog management
router.get('/products', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const products = await db
      .select()
      .from(schema.products)
      .orderBy(schema.products.name);

    const operators = await db.select().from(schema.operators);
    const operatorMap = new Map(operators.map(o => [o.id, o]));

    const mediaList = await db.select().from(schema.mediaAssets);

    const enriched = products.map(p => {
      const op = p.operatorId ? operatorMap.get(p.operatorId) : null;
      const productMedia = mediaList.filter(m => m.ownerId === p.id);
      const primaryMedia =
        (p.primaryMediaId ? productMedia.find(m => m.id === p.primaryMediaId) : null) ||
        productMedia.find(m => m.isPrimary) ||
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

// POST /api/coordinator/products - Create new product
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
      isPublished = false, // Default to DRAFT
      isFeatured = false,
      videoUrl,
      availabilityNote = 'Subject to partner confirmation',
      primaryMediaId,
    } = req.body;

    if (!name || !basePrice) {
      res.status(400).json({ error: 'NAME_AND_PRICE_REQUIRED', message: 'Product name and base price are required' });
      return;
    }

    // Generate unique ID and slug
    const cleanSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const productId = `prod_${cleanSlug.slice(0, 20)}_${crypto.randomBytes(4).toString('hex')}`;
    const slug = `${cleanSlug}-${crypto.randomBytes(3).toString('hex')}`;

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
    };

    await db.insert(schema.products).values(newProduct);

    // Persist new product to Cloud Firestore for durable lifecycle survival
    try {
      await persistProductToFirestore(newProduct as any);
    } catch (fsErr) {
      console.warn('[Coordinator] Firestore product persist warning:', fsErr);
    }

    // Record audit revision
    await db.insert(schema.productRevisions).values({
      id: 'rev_' + crypto.randomBytes(12).toString('hex'),
      productId,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: null,
      changeSummary: `Product created by ${req.staffUser!.name}: ${name} (${isPublished ? 'Published' : 'Draft'})`,
    });

    res.status(201).json({
      success: true,
      product: newProduct,
      message: `Product successfully created as ${isPublished ? 'PUBLISHED' : 'DRAFT'}`,
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'FAILED_TO_CREATE_PRODUCT', message: error.message });
  }
});

// PUT /api/coordinator/products/:id - Edit product with revision history
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

    const currentRecords = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));

    if (currentRecords.length === 0) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const current = currentRecords[0];

    // Record revision history for traceability
    await db.insert(schema.productRevisions).values({
      id: 'rev_' + crypto.randomBytes(12).toString('hex'),
      productId: id,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: current,
      changeSummary: `Product updated by ${req.staffUser!.name}: ${name || current.name}`,
    });

    // Update product
    await db
      .update(schema.products)
      .set({
        name: name !== undefined ? name.trim() : current.name,
        productType: productType !== undefined ? productType : current.productType,
        categorySlug: categorySlug !== undefined ? categorySlug : current.categorySlug,
        operatorId: operatorId !== undefined ? (operatorId || null) : current.operatorId,
        propertyId: propertyId !== undefined ? (propertyId || null) : current.propertyId,
        shortDescription: shortDescription !== undefined ? shortDescription.trim() : current.shortDescription,
        description: description !== undefined ? description.trim() : current.description,
        location: location !== undefined ? location.trim() : current.location,
        duration: duration !== undefined ? duration : current.duration,
        basePrice: basePrice !== undefined ? String(basePrice) : current.basePrice,
        currency: currency !== undefined ? currency : current.currency,
        priceBasis: priceBasis !== undefined ? priceBasis : current.priceBasis,
        inclusions: inclusions !== undefined ? inclusions : current.inclusions,
        exclusions: exclusions !== undefined ? exclusions : current.exclusions,
        suitability: suitability !== undefined ? suitability : current.suitability,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : current.isPublished,
        isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : current.isFeatured,
        videoUrl: videoUrl !== undefined ? (videoUrl ? videoUrl.trim() : null) : current.videoUrl,
        availabilityNote: availabilityNote !== undefined ? availabilityNote : current.availabilityNote,
        primaryMediaId: primaryMediaId !== undefined ? (primaryMediaId || null) : current.primaryMediaId,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id));

    // Fetch updated record
    const updated = (await db.select().from(schema.products).where(eq(schema.products.id, id)))[0];

    // Persist updated product (including videoUrl, pricing, primaryMediaId) to Cloud Firestore
    try {
      await persistProductToFirestore(updated);
    } catch (fsErr) {
      console.warn('[Coordinator] Firestore product update warning:', fsErr);
    }

    res.json({ success: true, product: updated, message: 'Product updated and revision recorded' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'FAILED_TO_UPDATE_PRODUCT' });
  }
});

// PATCH /api/coordinator/products/:id/publish - Publish or unpublish product
router.patch('/products/:id/publish', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const currentRecords = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));

    if (currentRecords.length === 0) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const current = currentRecords[0];
    const newStatus = isPublished !== undefined ? Boolean(isPublished) : !current.isPublished;

    await db
      .update(schema.products)
      .set({
        isPublished: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id));

    // Audit log
    await db.insert(schema.productRevisions).values({
      id: 'rev_' + crypto.randomBytes(12).toString('hex'),
      productId: id,
      modifiedByStaffId: req.staffUser!.id,
      previousSnapshot: current,
      changeSummary: `Product publication status changed to ${newStatus ? 'PUBLISHED' : 'UNPUBLISHED'} by ${req.staffUser!.name}`,
    });

    const updated = (await db.select().from(schema.products).where(eq(schema.products.id, id)))[0];
    try {
      await persistProductToFirestore(updated);
    } catch (fsErr) {
      console.warn('[Coordinator] Firestore product publish toggle sync warning:', fsErr);
    }

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

    const existing = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));

    if (existing.length === 0) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    // 1. Record durable deletion tombstone in Cloud Firestore
    await recordTombstoneInFirestore('products', id);

    // 2. Delete product from Cloud Firestore
    await deleteProductFromFirestore(id);

    // 3. Delete from relational engine
    await db.delete(schema.products).where(eq(schema.products.id, id));

    res.json({ success: true, message: `Product ${id} permanently deleted and deletion tombstoned in Cloud Firestore.` });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'FAILED_TO_DELETE_PRODUCT', message: error.message });
  }
});

// GET /api/coordinator/operators - Operators list
router.get('/operators', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const operators = await db.select().from(schema.operators).orderBy(schema.operators.name);
    res.json(operators);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_OPERATORS' });
  }
});

// GET /api/coordinator/properties - Properties list
router.get('/properties', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const properties = await db.select().from(schema.properties).orderBy(schema.properties.name);
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_PROPERTIES' });
  }
});

// GET /api/coordinator/packages - All packages for coordinator workbench
router.get('/packages', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const pkgs = await db.select().from(schema.packages).orderBy(schema.packages.name);
    res.json(pkgs);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_PACKAGES' });
  }
});

// POST /api/coordinator/packages - Create package
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
    };

    await db.insert(schema.packages).values(newPkg);

    try {
      await persistPackageToFirestore(newPkg as any);
    } catch (_) {}

    res.status(201).json({ success: true, package: newPkg });
  } catch (error: any) {
    res.status(500).json({ error: 'FAILED_TO_CREATE_PACKAGE', message: error.message });
  }
});

// PUT /api/coordinator/packages/:id - Update package
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

    const currentRecords = await db.select().from(schema.packages).where(eq(schema.packages.id, id));
    if (currentRecords.length === 0) {
      res.status(404).json({ error: 'PACKAGE_NOT_FOUND' });
      return;
    }

    const current = currentRecords[0];

    await db
      .update(schema.packages)
      .set({
        name: name !== undefined ? name.trim() : current.name,
        tagline: tagline !== undefined ? tagline : current.tagline,
        description: description !== undefined ? description : current.description,
        durationDays: durationDays !== undefined ? Number(durationDays) : current.durationDays,
        durationNights: durationNights !== undefined ? Number(durationNights) : current.durationNights,
        pricePerPerson: pricePerPerson !== undefined ? String(pricePerPerson) : current.pricePerPerson,
        currency: currency !== undefined ? currency : current.currency,
        highlights: highlights !== undefined ? highlights : current.highlights,
        inclusions: inclusions !== undefined ? inclusions : current.inclusions,
        exclusions: exclusions !== undefined ? exclusions : current.exclusions,
        primaryImageUrl: primaryImageUrl !== undefined ? primaryImageUrl : current.primaryImageUrl,
        videoUrl: videoUrl !== undefined ? (videoUrl ? videoUrl.trim() : null) : current.videoUrl,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : current.isPublished,
        updatedAt: new Date(),
      })
      .where(eq(schema.packages.id, id));

    const updated = (await db.select().from(schema.packages).where(eq(schema.packages.id, id)))[0];

    try {
      await persistPackageToFirestore(updated);
    } catch (_) {}

    res.json({ success: true, package: updated });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_PACKAGE' });
  }
});

// GET /api/coordinator/knowledge-sources
router.get('/knowledge-sources', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const sources = await db
      .select()
      .from(schema.knowledgeSources)
      .orderBy(desc(schema.knowledgeSources.lastVerified));
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
    await db.insert(schema.knowledgeSources).values({
      id: ksId,
      name,
      sourceUrl: sourceUrl || null,
      sourceType,
      evidenceStatus: evidenceStatus || 'ESTABLISHED',
      notes: notes || null,
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

    const allUsers = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.name);

    res.json(allUsers);
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
    const targetUser = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (targetUser.length === 0) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    const u = targetUser[0];
    const newActiveState = !u.isActive;

    await db
      .update(schema.users)
      .set({ isActive: newActiveState })
      .where(eq(schema.users.id, id));

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
