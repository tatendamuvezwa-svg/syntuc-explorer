import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { requireGuestSession, GuestSessionRequest } from '../middleware/auth.ts';
import { calculateAuthoritativePricing, RawReservationItemInput } from '../services/pricing.ts';
import { getAttributionForReservation, recordEventSafely } from '../services/attribution.ts';
import { persistReservationToFirestore } from '../services/firestoreSync.ts';

const router = Router();

// POST /api/reservations and POST /api/reservations/submit - Submit reservation request
const handleReservationSubmit = async (req: GuestSessionRequest, res: Response) => {
  try {
    const currentSessionId = req.guestSession!.id;
    const {
      guestSessionId, // Provided in body
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
      items, // RawReservationItemInput[]
      status: clientStatus, // Client attempted status
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
      const ownedTrip = await db
        .select()
        .from(schema.tripPlans)
        .where(
          and(
            eq(schema.tripPlans.id, tripPlanId),
            eq(schema.tripPlans.guestSessionId, currentSessionId)
          )
        );

      if (ownedTrip.length === 0) {
        res.status(403).json({
          error: 'TRIP_PLAN_OWNERSHIP_VIOLATION',
          message: 'The specified trip plan does not belong to your guest session.',
        });
        return;
      }
    } else {
      // Auto-resolve trip plan for current session
      const sessionTrips = await db
        .select()
        .from(schema.tripPlans)
        .where(eq(schema.tripPlans.guestSessionId, currentSessionId));
      if (sessionTrips.length > 0) {
        activeTripPlanId = sessionTrips[0].id;
      }
    }

    const adults = Math.max(1, Number(adultsCount) || 2);
    const children = Math.max(0, Number(childrenCount) || 0);

    // Collect reservation items: either from payload or from owned trip plan
    let rawItems: RawReservationItemInput[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      rawItems = items;
    } else if (activeTripPlanId) {
      // Load items from the verified trip plan
      const tripItems = await db
        .select()
        .from(schema.tripItems)
        .where(eq(schema.tripItems.tripPlanId, activeTripPlanId));

      rawItems = tripItems.map(ti => ({
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
    // Client-submitted unitPrice, totalPrice, or discounts are explicitly ignored!
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

    // Status Protection: Never allow client to force CONFIRMED or privileged status
    // All guest requests MUST begin in 'NEW' status
    const initialStatus = 'NEW';
    if (clientStatus && clientStatus !== 'NEW') {
      console.warn(`[Security] Client attempted to force status "${clientStatus}". Enforcing "NEW".`);
    }

    // Idempotency / Duplicate Submission Protection (double-click / network retry)
    const recentSubmissions = await db
      .select()
      .from(schema.reservationRequests)
      .where(
        and(
          eq(schema.reservationRequests.guestSessionId, currentSessionId),
          eq(schema.reservationRequests.authoritativeTotal, pricingResult.authoritativeTotal.toString())
        )
      )
      .orderBy(desc(schema.reservationRequests.createdAt))
      .limit(1);

    if (recentSubmissions.length > 0) {
      const recent = recentSubmissions[0];
      const timeDiff = Date.now() - new Date(recent.createdAt).getTime();
      if (timeDiff < 15000) {
        const existingTokens = await db
          .select()
          .from(schema.guestAccessTokens)
          .where(eq(schema.guestAccessTokens.reservationRequestId, recent.id));
        const guestToken = existingTokens[0]?.id || '';
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

    // 1. Create or link Guest
    const guestId = 'gst_' + crypto.randomBytes(12).toString('hex');
    await db.insert(schema.guests).values({
      id: guestId,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      country: country?.trim() || null,
      specialRequests: specialRequests || null,
    });

    // Update guest session with guestId
    await db
      .update(schema.guestSessions)
      .set({ guestId })
      .where(eq(schema.guestSessions.id, currentSessionId));

    // 2. Generate Reference Number (e.g., SYN-VF-78291)
    const refNum = `SYN-VF-${Math.floor(10000 + Math.random() * 90000)}`;
    const reservationId = 'res_' + crypto.randomBytes(12).toString('hex');

    // Retrieve authoritative First-Touch and Last-Touch attribution snapshots
    const clientVisitorId = req.body.visitorId || (req.headers['x-visitor-id'] as string) || null;
    const clientAnalyticsSessionId = req.body.analyticsSessionId || (req.headers['x-analytics-session-id'] as string) || currentSessionId;
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
      console.warn('[Analytics] Attribution retrieval warning (continuing reservation safely):', attrErr);
    }

    // 3. Insert Reservation Request
    await db.insert(schema.reservationRequests).values({
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
      // Marketing Attribution Snapshots
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
    });

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

    // 4. Insert Reservation Items Historical Snapshots
    for (const snap of pricingResult.items) {
      const resItemId = 'ri_' + crypto.randomBytes(12).toString('hex');
      await db.insert(schema.reservationItems).values({
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
      });
    }

    // 5. Create or Update Lead with First/Last Touch
    const leadId = 'lead_' + crypto.randomBytes(12).toString('hex');
    await db.insert(schema.leads).values({
      id: leadId,
      guestId,
      status: 'ACTIVE',
      leadSource: 'syntuc_explorer_direct',
      firstTouchTimestamp: new Date(),
      lastTouchTimestamp: new Date(),
      lastInteractionType: 'reservation_requested',
      estimatedValue: pricingResult.authoritativeTotal.toString(),
      notes: `Reservation request ${refNum} submitted. Total: US$${pricingResult.authoritativeTotal}.`,
    });

    // 6. Record Initial Interaction
    await db.insert(schema.interactions).values({
      id: 'int_' + crypto.randomBytes(12).toString('hex'),
      leadId,
      guestId,
      channel: 'web_desk',
      interactionType: 'inquiry',
      summary: `Traveler submitted request ${refNum} with ${pricingResult.items.length} items.`,
    });

    // 7. Issue Secure Guest Access Token
    const guestAccessToken = 'gstok_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(guestAccessToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

    await db.insert(schema.guestAccessTokens).values({
      id: guestAccessToken,
      reservationRequestId: reservationId,
      guestId,
      tokenHash,
      isRevoked: false,
      expiresAt,
    });

    // 8. Add initial automated welcome message from Reservations Desk
    await db.insert(schema.guestMessages).values({
      id: 'msg_' + crypto.randomBytes(12).toString('hex'),
      reservationRequestId: reservationId,
      guestSessionId: currentSessionId,
      senderType: 'coordinator',
      senderName: 'Syntuc Reservations Desk',
      messageText: `Welcome to Victoria Falls! We have safely received your reservation request (${refNum}). Our coordinator is reviewing partner availability and will update your dashboard with confirmation details shortly. No payment is required at this stage.`,
    });

    // 9. Persist synchronously to Cloud Firestore for durable container lifecycle survival
    try {
      const persistedRes = (await db
        .select()
        .from(schema.reservationRequests)
        .where(eq(schema.reservationRequests.id, reservationId)))[0];
      const persistedItems = await db
        .select()
        .from(schema.reservationItems)
        .where(eq(schema.reservationItems.reservationRequestId, reservationId));
      const persistedGuest = (await db
        .select()
        .from(schema.guests)
        .where(eq(schema.guests.id, guestId)))[0];
      const persistedToken = (await db
        .select()
        .from(schema.guestAccessTokens)
        .where(eq(schema.guestAccessTokens.id, guestAccessToken)))[0];
      const persistedMsg = (await db
        .select()
        .from(schema.guestMessages)
        .where(eq(schema.guestMessages.reservationRequestId, reservationId)))[0];

      if (persistedRes) {
        await persistReservationToFirestore(
          persistedRes,
          persistedItems,
          persistedGuest,
          persistedToken,
          persistedMsg
        );
      }
    } catch (fsErr) {
      console.error('[Reservation] Cloud Firestore sync warning:', fsErr);
    }

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
  } catch (error) {
    console.error('Reservation submission error:', error);
    res.status(500).json({ error: 'FAILED_TO_SUBMIT_RESERVATION' });
  }
};

router.post('/', requireGuestSession, handleReservationSubmit);
router.post('/submit', requireGuestSession, handleReservationSubmit);

// GET /api/reservations/guest/:token - Secure Guest Reservation Dashboard
router.get('/guest/:token', async (req, res: Response) => {
  try {
    const token = req.params.token;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenRecords = await db
      .select()
      .from(schema.guestAccessTokens)
      .where(
        and(
          eq(schema.guestAccessTokens.tokenHash, tokenHash),
          eq(schema.guestAccessTokens.isRevoked, false)
        )
      );

    if (tokenRecords.length === 0) {
      res.status(404).json({ error: 'INVALID_OR_REVOKED_TOKEN', message: 'Reservation access link is invalid or expired.' });
      return;
    }

    const tokenRecord = tokenRecords[0];

    // Check expiration
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'This reservation access link has expired.' });
      return;
    }

    // Update last accessed
    await db
      .update(schema.guestAccessTokens)
      .set({ lastAccessedAt: new Date() })
      .where(eq(schema.guestAccessTokens.id, tokenRecord.id));

    // Fetch reservation request
    const resRecords = await db
      .select()
      .from(schema.reservationRequests)
      .where(eq(schema.reservationRequests.id, tokenRecord.reservationRequestId));

    if (resRecords.length === 0) {
      res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      return;
    }

    const reservation = resRecords[0];

    // Fetch guest info
    const guestRecords = await db
      .select()
      .from(schema.guests)
      .where(eq(schema.guests.id, reservation.guestId));
    const guest = guestRecords[0] || null;

    // Fetch historical reservation items
    const items = await db
      .select()
      .from(schema.reservationItems)
      .where(eq(schema.reservationItems.reservationRequestId, reservation.id));

    // Fetch messages for this reservation
    const messages = await db
      .select()
      .from(schema.guestMessages)
      .where(eq(schema.guestMessages.reservationRequestId, reservation.id))
      .orderBy(schema.guestMessages.createdAt);

    res.json({
      reservation: {
        id: reservation.id,
        referenceNumber: reservation.referenceNumber,
        status: reservation.status, // Clearly distinguish REQUESTED vs CONFIRMED
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
    console.error('Guest dashboard load error:', error);
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
    const tokenRecords = await db
      .select()
      .from(schema.guestAccessTokens)
      .where(
        and(
          eq(schema.guestAccessTokens.tokenHash, tokenHash),
          eq(schema.guestAccessTokens.isRevoked, false)
        )
      );

    if (tokenRecords.length === 0) {
      res.status(404).json({ error: 'INVALID_TOKEN' });
      return;
    }

    const tokenRecord = tokenRecords[0];

    const guestRecords = await db
      .select()
      .from(schema.guests)
      .where(eq(schema.guests.id, tokenRecord.guestId));

    const senderName = guestRecords[0]?.fullName || 'Guest';

    const msgId = 'msg_' + crypto.randomBytes(12).toString('hex');
    await db.insert(schema.guestMessages).values({
      id: msgId,
      reservationRequestId: tokenRecord.reservationRequestId,
      senderType: 'guest',
      senderName,
      messageText: messageText.trim(),
    });

    res.json({ success: true, messageId: msgId });
  } catch (error) {
    console.error('Error posting guest message:', error);
    res.status(500).json({ error: 'FAILED_TO_SEND_MESSAGE' });
  }
});

export default router;
