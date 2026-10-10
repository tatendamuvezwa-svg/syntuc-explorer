import { Router, Response } from 'express';
import crypto from 'crypto';
import {
  createSessionCredentials,
  signSessionId,
  requireGuestSession,
  GuestSessionRequest,
} from '../middleware/auth.ts';
import {
  getDocById,
  setDocById,
  updateDocById,
  deleteDocById,
  getCollectionDocs,
  where,
} from '../lib/firestore.ts';

const router = Router();

// POST /api/session/init - Create new guest session or restore existing
router.post('/init', async (req, res: Response) => {
  try {
    const existingSessionId = req.body.sessionId;
    const existingSecret = req.body.sessionSecret;
    const nowIso = new Date().toISOString();

    if (existingSessionId && existingSecret) {
      const session = await getDocById<any>('guest_sessions', existingSessionId);

      if (session && session.sessionSecret === existingSecret) {
        await updateDocById('guest_sessions', existingSessionId, {
          lastActiveAt: nowIso,
        });

        res.json({
          sessionId: session.id,
          sessionSecret: session.sessionSecret,
          signature: signSessionId(session.id, session.sessionSecret),
        });
        return;
      }
    }

    // Create new session
    const { sessionId, sessionSecret } = createSessionCredentials();
    await setDocById('guest_sessions', sessionId, {
      id: sessionId,
      sessionSecret,
      ipHash: crypto.createHash('sha256').update(req.ip || '127.0.0.1').digest('hex'),
      userAgent: req.headers['user-agent'] || 'browser',
      createdAt: nowIso,
      lastActiveAt: nowIso,
    });

    // Create initial trip plan for this session
    const tripPlanId = 'trip_' + crypto.randomBytes(12).toString('hex');
    await setDocById('trip_plans', tripPlanId, {
      id: tripPlanId,
      guestSessionId: sessionId,
      title: 'My Victoria Falls Journey',
      adultsCount: 2,
      childrenCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    res.json({
      sessionId,
      sessionSecret,
      signature: signSessionId(sessionId, sessionSecret),
      tripPlanId,
    });
  } catch (error) {
    console.error('Session init error in Firestore:', error);
    res.status(500).json({ error: 'SESSION_INITIALIZATION_FAILED' });
  }
});

// GET /api/session/trip - Get current guest's trip plan (Strict Session Isolation)
router.get('/trip', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;
    const nowIso = new Date().toISOString();

    const tripPlans = await getCollectionDocs<any>(
      'trip_plans',
      where('guestSessionId', '==', sessionId)
    );

    if (tripPlans.length === 0) {
      const newTripId = 'trip_' + crypto.randomBytes(12).toString('hex');
      const newPlan = {
        id: newTripId,
        guestSessionId: sessionId,
        title: 'My Victoria Falls Journey',
        adultsCount: 2,
        childrenCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDocById('trip_plans', newTripId, newPlan);

      res.json({
        ...newPlan,
        items: [],
      });
      return;
    }

    const tripPlan = tripPlans[0];

    // Fetch items belonging strictly to this trip plan
    const items = await getCollectionDocs<any>(
      'trip_items',
      where('tripPlanId', '==', tripPlan.id)
    );

    // Enrich with product and room details
    const products = await getCollectionDocs<any>('products');
    const productMap = new Map(products.map((p) => [p.id, p]));

    const rooms = await getCollectionDocs<any>('rooms');
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    const enrichedItems = items.map((item) => {
      const prod = productMap.get(item.productId);
      const room = item.roomId ? roomMap.get(item.roomId) : null;
      return {
        ...item,
        product: prod,
        room: room,
      };
    });

    res.json({
      ...tripPlan,
      items: enrichedItems,
    });
  } catch (error) {
    console.error('Error fetching trip plan from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_TRIP_PLAN' });
  }
});

// PUT /api/session/trip - Update trip plan details
router.put('/trip', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;
    const { title, startDate, endDate, adultsCount, childrenCount, interests, intensity } = req.body;
    const nowIso = new Date().toISOString();

    const tripPlans = await getCollectionDocs<any>(
      'trip_plans',
      where('guestSessionId', '==', sessionId)
    );

    if (tripPlans.length === 0) {
      res.status(404).json({ error: 'TRIP_PLAN_NOT_FOUND' });
      return;
    }

    const tripId = tripPlans[0].id;

    await updateDocById('trip_plans', tripId, {
      title: title || tripPlans[0].title,
      startDate: startDate !== undefined ? startDate : tripPlans[0].startDate || null,
      endDate: endDate !== undefined ? endDate : tripPlans[0].endDate || null,
      adultsCount: adultsCount !== undefined ? Math.max(1, Number(adultsCount)) : tripPlans[0].adultsCount,
      childrenCount: childrenCount !== undefined ? Math.max(0, Number(childrenCount)) : tripPlans[0].childrenCount,
      interests: interests || tripPlans[0].interests || [],
      intensity: intensity || tripPlans[0].intensity || 'MODERATE',
      updatedAt: nowIso,
    });

    res.json({ success: true, message: 'Trip updated successfully' });
  } catch (error) {
    console.error('Error updating trip plan in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_UPDATE_TRIP' });
  }
});

// POST /api/session/trip/items - Add item to trip plan (Strict Session Isolation)
router.post('/trip/items', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;
    const {
      tripPlanId,
      productId,
      roomId,
      variantId,
      dayNumber,
      scheduledDate,
      scheduledTime,
      guestCount,
      notes,
    } = req.body;
    const nowIso = new Date().toISOString();

    if (!productId) {
      res.status(400).json({ error: 'PRODUCT_ID_REQUIRED' });
      return;
    }

    // Verify product exists in Firestore
    const product = await getDocById<any>('products', productId);
    if (!product) {
      res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: 'The requested product does not exist in catalog',
      });
      return;
    }

    // Fetch trip plan strictly belonging to this session
    const tripPlans = await getCollectionDocs<any>(
      'trip_plans',
      where('guestSessionId', '==', sessionId)
    );

    if (tripPlans.length === 0) {
      res.status(404).json({ error: 'TRIP_PLAN_NOT_FOUND' });
      return;
    }

    const ownedTrip = tripPlans[0];
    if (tripPlanId && tripPlanId !== ownedTrip.id) {
      // Forbidden: Attempting to modify another guest's trip plan!
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You cannot add items to another guest’s trip plan.',
      });
      return;
    }

    const itemId = 'item_' + crypto.randomBytes(12).toString('hex');
    await setDocById('trip_items', itemId, {
      id: itemId,
      tripPlanId: ownedTrip.id,
      productId,
      roomId: roomId || null,
      variantId: variantId || null,
      dayNumber: dayNumber ? Number(dayNumber) : 1,
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      guestCount: guestCount ? Math.max(1, Number(guestCount)) : ownedTrip.adultsCount,
      notes: notes || null,
      createdAt: nowIso,
    });

    res.json({
      success: true,
      itemId,
      message: `${product.name} added to My Trip`,
    });
  } catch (error) {
    console.error('Error adding trip item in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_ADD_TRIP_ITEM' });
  }
});

// DELETE /api/session/trip/items/:id - Remove item (Strict Session Isolation)
router.delete('/trip/items/:id', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;
    const itemId = req.params.id;

    // Fetch the trip item from Firestore
    const item = await getDocById<any>('trip_items', itemId);
    if (!item) {
      res.status(404).json({ error: 'ITEM_NOT_FOUND' });
      return;
    }

    // Verify trip plan belongs to current guest session
    const tripPlan = await getDocById<any>('trip_plans', item.tripPlanId);
    if (!tripPlan || tripPlan.guestSessionId !== sessionId) {
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You cannot delete another guest’s trip item.',
      });
      return;
    }

    await deleteDocById('trip_items', itemId);

    res.json({ success: true, message: 'Item removed from My Trip' });
  } catch (error) {
    console.error('Error deleting trip item in Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_DELETE_TRIP_ITEM' });
  }
});

export default router;
