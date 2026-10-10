import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireGuestSession, GuestSessionRequest } from '../middleware/auth.ts';
import { calculateAuthoritativePricing, RawReservationItemInput } from '../services/pricing.ts';
import { getAttributionForReservation, recordEventSafely } from '../services/attribution.ts';
import {
  getFirestoreDb,
  doc,
  writeBatch,
  getDocById,
  setDocById,
  updateDocById,
  getCollectionDocs,
  where,
} from '../lib/firestore.ts';

const router = Router();

const handleReservationSubmit = async (req: GuestSessionRequest, res: Response) => {
  try {
    const currentSessionId = req.guestSession!.id;
    const {
      guestSessionId,
      tripPlanId,
      fullName,
      email,
      phone,
      country,
      startDate,
      endDate,
      adultsCount,
      childrenCount,
      specialRequests,
      items,
      status: clientStatus,
    } = req.body;

    // Security Check: Session Mismatch Protection
    if (guestSessionId && guestSessionId !== currentSessionId) {
      res.status(403).json({
        error: 'SESSION_MISMATCH',
        message: 'You cannot submit a reservation request on behalf of another guest session.',
      });
      return;
    }

    if (!fullName || !email) {
      res.status(400).json({ error: 'GUEST_CONTACT_REQUIRED', message: 'Full name and email are required' });
      return;
    }

    // Security Check: Trip Plan Ownership Protection
    let activeTripPlanId = tripPlanId;
    if (tripPlanId) {
      const ownedTrip = await getDocById<any>('trip_plans', tripPlanId);
      if (!ownedTrip || ownedTrip.guestSessionId !== currentSessionId) {
        res.status(403).json({
          error: 'TRIP_PLAN_OWNERSHIP_VIOLATION',
          message: 'The specified trip plan does not belong to your guest session.',
        });
        return;
      }
    } else {
      const sessionTrips = await getCollectionDocs<any>(
        'trip_plans',
        where('guestSessionId', '==', currentSessionId)
      );
      if (sessionTrips.length > 0) {
        activeTripPlanId = sessionTrips[0].id;
      }
    }

    const adults = Math.max(1, Number(adultsCount) || 2);
    const children = Math.max(0, Number(childrenCount) || 0);

    let rawItems: RawReservationItemInput[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      rawItems = items;
    } else if (activeTripPlanId) {
      const tripItems = await getCollectionDocs<any>(
        'trip_items',
        where('tripPlanId', '==', activeTripPlanId)
      );
      rawItems = tripItems.map((ti) => ({
        productId: ti.productId,
        roomId: ti.roomId || undefined,
        variantId: ti.variantId || undefined,
        guestCount: ti.guestCount,
        scheduledDate: ti.scheduledDate || undefined,
        scheduledTime: ti.scheduledTime || undefined,
        notes: ti.notes || undefined,
      }));
    }

    if (rawItems.length === 0) {
      res.status(400).json({
        error: 'NO_ITEMS_SELECTED',
        message: 'Please select at least one accommodation or activity for your reservation request.',
      });
      return;
    }

    // Server-Authoritative Pricing Calculation
    let pricingResult;
    try {
      pricingResult = await calculateAuthoritativePricing(rawItems, adults, children);
    } catch (err: any) {
      res.status(400).json({
        error: 'PRICING_CALCULATION_ERROR',
        message: err.message || 'Unable to calculate authoritative pricing',
      });
      return;
    }

    // Status Protection: All guest requests MUST begin in 'NEW' status
    const initialStatus = 'NEW';
    if (clientStatus && clientStatus !== 'NEW') {
      console.warn(`[Security] Client attempted to force status "${clientStatus}". Enforcing "NEW".`);
    }

    // Idempotency / Duplicate Submission Protection
    const existingReservations = await getCollectionDocs<any>(
      'reservation_requests',
      where('guestSessionId', '==', currentSessionId)
    );

    const matchingRecent = existingReservations
      .filter((r) => Number(r.authoritativeTotal) === pricingResult.authoritativeTotal)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (matchingRecent.length > 0) {
      const recent = matchingRecent[0];
      const timeDiff = Date.now() - new Date(recent.createdAt).getTime();
      if (timeDiff < 15000) {
        const tokens = await getCollectionDocs<any>(
          'guest_access_tokens',
          where('reservationRequestId', '==', recent.id)
        );
        const guestToken = tokens[0]?.id || '';
        res.json({
          success: true,
          referenceNumber: recent.referenceNumber,
          reservationId: recent.id,
          authoritativeTotal: Number(recent.authoritativeTotal),
          currency: recent.currency,
          status: recent.status,
          isBridgeIncentiveApplied: recent.isBridgeIncentiveApplied,
          guestToken,
          dashboardUrl: `/guest/reservation/${guestToken}`,
          message: 'Existing reservation request retrieved (duplicate submission prevented).',
        });
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const guestId = 'gst_' + crypto.randomBytes(12).toString('hex');
    const guestRecord = {
      id: guestId,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      country: country?.trim() || null,
      specialRequests: specialRequests || null,
      createdAt: nowIso,
    };

    const refNum = `SYN-VF-${Math.floor(10000 + Math.random() * 90000)}`;
    const reservationId = 'res_' + crypto.randomBytes(12).toString('hex');

    // Retrieve authoritative attribution
    const clientVisitorId = req.body.visitorId || (req.headers['x-visitor-id'] as string) || null;
    const clientAnalyticsSessionId =
      req.body.analyticsSessionId ||
      (req.headers['x-analytics-session-id'] as string) ||
      currentSessionId;

    let attribution = {
      visitorId: clientVisitorId,
      firstTouchSource: 'direct',
      firstTouchMedium: 'none',
      firstTouchCampaign: null as string | null,
      firstTouchContent: null as string | null,
      firstTouchTerm: null as string | null,
      firstTouchReferrer: null as string | null,
      lastTouchSource: 'direct',
      lastTouchMedium: 'none',
      lastTouchCampaign: null as string | null,
      lastTouchContent: null as string | null,
      lastTouchTerm: null as string | null,
      lastTouchReferrer: null as string | null,
      attributionConfidence: 'DIRECT',
    };

    try {
      attribution = await getAttributionForReservation(clientVisitorId, clientAnalyticsSessionId);
    } catch (attrErr) {
      console.warn('[Analytics] Attribution retrieval warning:', attrErr);
    }

    const reservationRecord = {
      id: reservationId,
      referenceNumber: refNum,
      guestId,
      guestSessionId: currentSessionId,
      tripPlanId: tripPlanId || null,
      status: initialStatus,
      startDate: startDate || null,
      endDate: endDate || null,
      adultsCount: adults,
      childrenCount: children,
      authoritativeTotal: pricingResult.authoritativeTotal.toString(),
      currency: pricingResult.currency,
      specialRequests: specialRequests || null,
      isBridgeIncentiveApplied: pricingResult.isBridgeIncentiveApplied,
      visitorId: attribution.visitorId,
      firstTouchSource: attribution.firstTouchSource,
      firstTouchMedium: attribution.firstTouchMedium,
      firstTouchCampaign: attribution.firstTouchCampaign,
      firstTouchContent: attribution.firstTouchContent,
      firstTouchTerm: attribution.firstTouchTerm,
      firstTouchReferrer: attribution.firstTouchReferrer,
      lastTouchSource: attribution.lastTouchSource,
      lastTouchMedium: attribution.lastTouchMedium,
      lastTouchCampaign: attribution.lastTouchCampaign,
      lastTouchContent: attribution.lastTouchContent,
      lastTouchTerm: attribution.lastTouchTerm,
      lastTouchReferrer: attribution.lastTouchReferrer,
      attributionConfidence: attribution.attributionConfidence,
      createdAt: nowIso,
      updatedAt: nowIso,
      cloudPersistedAt: nowIso,
    };

    const reservationItemRecords = pricingResult.items.map((snap) => {
      const resItemId = 'ri_' + crypto.randomBytes(12).toString('hex');
      return {
        id: resItemId,
        reservationRequestId: reservationId,
        productId: snap.productId,
        roomId: snap.roomId,
        variantId: snap.variantId,
        snapshotProductName: snap.snapshotProductName,
        snapshotOperatorName: snap.snapshotOperatorName,
        snapshotProductType: snap.snapshotProductType,
        snapshotUnitPrice: snap.snapshotUnitPrice.toString(),
        snapshotPriceBasis: snap.snapshotPriceBasis,
        snapshotCurrency: snap.snapshotCurrency,
        guestCount: snap.guestCount,
        nightsCount: snap.nightsCount,
        calculatedSubtotal: snap.calculatedSubtotal.toString(),
        scheduledDate: snap.scheduledDate,
        scheduledTime: snap.scheduledTime,
        notes: snap.notes,
        createdAt: nowIso,
      };
    });

    const leadId = 'lead_' + crypto.randomBytes(12).toString('hex');
    const leadRecord = {
      id: leadId,
      guestId,
      status: 'ACTIVE',
      leadSource: 'syntuc_explorer_direct',
      firstTouchTimestamp: nowIso,
      lastTouchTimestamp: nowIso,
      lastInteractionType: 'reservation_requested',
      estimatedValue: pricingResult.authoritativeTotal.toString(),
      notes: `Reservation request ${refNum} submitted. Total: US$${pricingResult.authoritativeTotal}.`,
      createdAt: nowIso,
    };

    const interactionId = 'int_' + crypto.randomBytes(12).toString('hex');
    const interactionRecord = {
      id: interactionId,
      leadId,
      guestId,
      channel: 'web_desk',
      interactionType: 'inquiry',
      summary: `Traveler submitted request ${refNum} with ${pricingResult.items.length} items.`,
      createdAt: nowIso,
    };

    const guestAccessToken = 'gstok_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(guestAccessToken).digest('hex');
    const expiresAtIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const tokenRecord = {
      id: guestAccessToken,
      reservationRequestId: reservationId,
      guestId,
      tokenHash,
      isRevoked: false,
      expiresAt: expiresAtIso,
      createdAt: nowIso,
    };

    const messageId = 'msg_' + crypto.randomBytes(12).toString('hex');
    const messageRecord = {
      id: messageId,
      reservationRequestId: reservationId,
      guestSessionId: currentSessionId,
      senderType: 'coordinator',
      senderName: 'Syntuc Reservations Desk',
      messageText: `Welcome to Victoria Falls! We have safely received your reservation request (${refNum}). Our coordinator is reviewing partner availability and will update your dashboard with confirmation details shortly. No payment is required at this stage.`,
      createdAt: nowIso,
    };

    // AUTHORITATIVE WRITE: Atomically execute writeBatch to Cloud Firestore
    const fdb = getFirestoreDb();
    const batch = writeBatch(fdb);

    batch.set(doc(fdb, 'guests', guestId), guestRecord);
    batch.set(doc(fdb, 'guest_sessions', currentSessionId), { guestId }, { merge: true });
    batch.set(doc(fdb, 'reservation_requests', reservationId), reservationRecord);

    for (const ri of reservationItemRecords) {
      batch.set(doc(fdb, 'reservation_items', ri.id), ri);
    }

    batch.set(doc(fdb, 'leads', leadId), leadRecord);
    batch.set(doc(fdb, 'interactions', interactionId), interactionRecord);
    batch.set(doc(fdb, 'guest_access_tokens', guestAccessToken), tokenRecord);
    batch.set(doc(fdb, 'guest_messages', messageId), messageRecord);

    // Commit batch to Firestore
    await batch.commit();
    console.log(`[Firestore] Reservation ${refNum} (${reservationId}) atomically committed.`);

    // Safely log conversion event
    await recordEventSafely({
      visitorId: attribution.visitorId || 'vis_guest',
      sessionId: clientAnalyticsSessionId,
      eventType: 'RESERVATION_REQUEST_SUBMITTED',
      reservationId,
      reservationReference: refNum,
      metadata: {
        total: pricingResult.authoritativeTotal,
        firstTouchSource: attribution.firstTouchSource,
        firstTouchCampaign: attribution.firstTouchCampaign,
        firstTouchContent: attribution.firstTouchContent,
        lastTouchSource: attribution.lastTouchSource,
        lastTouchCampaign: attribution.lastTouchCampaign,
        lastTouchContent: attribution.lastTouchContent,
      },
    });

    res.json({
      success: true,
      referenceNumber: refNum,
      reservationId,
      authoritativeTotal: pricingResult.authoritativeTotal,
      currency: pricingResult.currency,
      status: initialStatus,
      isBridgeIncentiveApplied: pricingResult.isBridgeIncentiveApplied,
      guestToken: guestAccessToken,
      dashboardUrl: `/guest/reservation/${guestAccessToken}`,
      message: 'Reservation request successfully submitted to the Syntuc Reservations Desk.',
    });
  } catch (error: any) {
    console.error('Reservation submission error in Firestore:', error);
    res.status(500).json({
      error: 'FAILED_TO_SUBMIT_RESERVATION',
      message: error.message || 'Authoritative database write failed',
    });
  }
};

router.post('/', requireGuestSession, handleReservationSubmit);
router.post('/submit', requireGuestSession, handleReservationSubmit);

// GET /api/reservations/guest/:token - Secure Guest Reservation Dashboard
router.get('/guest/:token', async (req, res: Response) => {
  try {
    const token = req.params.token;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Look up token in Firestore: first by doc ID, then by tokenHash
    let tokenRecord = await getDocById<any>('guest_access_tokens', token);
    if (!tokenRecord || tokenRecord.isRevoked) {
      const allTokens = await getCollectionDocs<any>(
        'guest_access_tokens',
        where('tokenHash', '==', tokenHash)
      );
      tokenRecord = allTokens.find((t) => !t.isRevoked) || null;
    }

    if (!tokenRecord) {
      res.status(404).json({
        error: 'INVALID_OR_REVOKED_TOKEN',
        message: 'Reservation access link is invalid or expired.',
      });
      return;
    }

    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
      res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'This reservation access link has expired.',
      });
      return;
    }

    await updateDocById('guest_access_tokens', tokenRecord.id, {
      lastAccessedAt: new Date().toISOString(),
    });

    const reservation = await getDocById<any>(
      'reservation_requests',
      tokenRecord.reservationRequestId
    );

    if (!reservation) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const guest = reservation.guestId
      ? await getDocById<any>('guests', reservation.guestId)
      : null;

    const items = await getCollectionDocs<any>(
      'reservation_items',
      where('reservationRequestId', '==', reservation.id)
    );

    const allMessages = await getCollectionDocs<any>(
      'guest_messages',
      where('reservationRequestId', '==', reservation.id)
    );
    const messages = allMessages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.json({
      reservation: {
        id: reservation.id,
        referenceNumber: reservation.referenceNumber,
        status: reservation.status,
        isConfirmed: reservation.status === 'CONFIRMED',
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        adultsCount: reservation.adultsCount,
        childrenCount: reservation.childrenCount,
        authoritativeTotal: reservation.authoritativeTotal,
        currency: reservation.currency,
        isBridgeIncentiveApplied: reservation.isBridgeIncentiveApplied,
        specialRequests: reservation.specialRequests,
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
      },
      guest: {
        fullName: guest?.fullName,
        email: guest?.email,
        phone: guest?.phone,
        country: guest?.country,
      },
      items,
      messages,
    });
  } catch (error) {
    console.error('Guest dashboard load error in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_DASHBOARD' });
  }
});

// POST /api/reservations/guest/:token/messages - Guest sends message to coordinator
router.post('/guest/:token/messages', async (req, res: Response) => {
  try {
    const token = req.params.token;
    const { messageText } = req.body;

    if (!messageText || !messageText.trim()) {
      res.status(400).json({ error: 'MESSAGE_EMPTY' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    let tokenRecord = await getDocById<any>('guest_access_tokens', token);
    if (!tokenRecord || tokenRecord.isRevoked) {
      const allTokens = await getCollectionDocs<any>(
        'guest_access_tokens',
        where('tokenHash', '==', tokenHash)
      );
      tokenRecord = allTokens.find((t) => !t.isRevoked) || null;
    }

    if (!tokenRecord) {
      res.status(404).json({ error: 'INVALID_TOKEN' });
      return;
    }

    const guest = await getDocById<any>('guests', tokenRecord.guestId);
    const senderName = guest?.fullName || 'Guest';

    const msgId = 'msg_' + crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();

    await setDocById('guest_messages', msgId, {
      id: msgId,
      reservationRequestId: tokenRecord.reservationRequestId,
      senderType: 'guest',
      senderName,
      messageText: messageText.trim(),
      createdAt: nowIso,
    });

    res.json({ success: true, messageId: msgId });
  } catch (error) {
    console.error('Error posting guest message in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_SEND_MESSAGE' });
  }
});

export default router;
