import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import {
  createSessionCredentials,
  signSessionId,
  requireGuestSession,
  GuestSessionRequest,
} from '../middleware/auth.ts';

const router = Router();

// POST /api/session/init - Create new guest session or restore existing
router.post('/init', async (req, res: Response) => {
  try {
    const existingSessionId = req.body.sessionId;
    const existingSecret = req.body.sessionSecret;

    if (existingSessionId && existingSecret) {
      const records = await db
        .select()
        .from(schema.guestSessions)
        .where(eq(schema.guestSessions.id, existingSessionId));

      if (records.length > 0 && records[0].sessionSecret === existingSecret) {
        // Update last active
        await db
          .update(schema.guestSessions)
          .set({ lastActiveAt: new Date() })
          .where(eq(schema.guestSessions.id, existingSessionId));

        res.json({
          sessionId: records[0].id,
          sessionSecret: records[0].sessionSecret,
          signature: signSessionId(records[0].id, records[0].sessionSecret),
        });
        return;
      }
    }

    // Create new session
    const { sessionId, sessionSecret } = createSessionCredentials();
    await db.insert(schema.guestSessions).values({
      id: sessionId,
      sessionSecret,
      ipHash: crypto.createHash('sha256').update(req.ip || '127.0.0.1').digest('hex'),
      userAgent: req.headers['user-agent'] || 'browser',
    });

    // Create initial trip plan for this session
    const tripPlanId = 'trip_' + crypto.randomBytes(12).toString('hex');
    await db.insert(schema.tripPlans).values({
      id: tripPlanId,
      guestSessionId: sessionId,
      title: 'My Victoria Falls Journey',
      adultsCount: 2,
      childrenCount: 0,
    });

    res.json({
      sessionId,
      sessionSecret,
      signature: signSessionId(sessionId, sessionSecret),
      tripPlanId,
    });
  } catch (error) {
    console.error('Session init error:', error);
    res.status(500).json({ error: 'SESSION_INITIALIZATION_FAILED' });
  }
});

// GET /api/session/trip - Get current guest's trip plan (Strict Session Isolation)
router.get('/trip', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;

    // Fetch trip plan strictly belonging to this session
    const tripPlans = await db
      .select()
      .from(schema.tripPlans)
      .where(eq(schema.tripPlans.guestSessionId, sessionId));

    if (tripPlans.length === 0) {
      // Auto-create if somehow missing
      const newTripId = 'trip_' + crypto.randomBytes(12).toString('hex');
      await db.insert(schema.tripPlans).values({
        id: newTripId,
        guestSessionId: sessionId,
        title: 'My Victoria Falls Journey',
        adultsCount: 2,
        childrenCount: 0,
      });

      res.json({
        id: newTripId,
        guestSessionId: sessionId,
        title: 'My Victoria Falls Journey',
        adultsCount: 2,
        childrenCount: 0,
        items: [],
      });
      return;
    }

    const tripPlan = tripPlans[0];

    // Fetch items belonging to this trip plan
    const items = await db
      .select()
      .from(schema.tripItems)
      .where(eq(schema.tripItems.tripPlanId, tripPlan.id));

    // Join with product and room details for client display
    const products = await db.select().from(schema.products);
    const productMap = new Map(products.map(p => [p.id, p]));

    const rooms = await db.select().from(schema.rooms);
    const roomMap = new Map(rooms.map(r => [r.id, r]));

    const enrichedItems = items.map(item => {
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
    console.error('Error fetching trip plan:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_TRIP_PLAN' });
  }
});

// PUT /api/session/trip - Update trip plan details
router.put('/trip', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;
    const { title, startDate, endDate, adultsCount, childrenCount, interests, intensity } = req.body;

    const tripPlans = await db
      .select()
      .from(schema.tripPlans)
      .where(eq(schema.tripPlans.guestSessionId, sessionId));

    if (tripPlans.length === 0) {
      res.status(404).json({ error: 'TRIP_PLAN_NOT_FOUND' });
      return;
    }

    const tripId = tripPlans[0].id;

    await db
      .update(schema.tripPlans)
      .set({
        title: title || tripPlans[0].title,
        startDate: startDate !== undefined ? startDate : tripPlans[0].startDate,
        endDate: endDate !== undefined ? endDate : tripPlans[0].endDate,
        adultsCount: adultsCount !== undefined ? Math.max(1, Number(adultsCount)) : tripPlans[0].adultsCount,
        childrenCount: childrenCount !== undefined ? Math.max(0, Number(childrenCount)) : tripPlans[0].childrenCount,
        interests: interests || tripPlans[0].interests,
        intensity: intensity || tripPlans[0].intensity,
        updatedAt: new Date(),
      })
      .where(eq(schema.tripPlans.id, tripId));

    res.json({ success: true, message: 'Trip updated successfully' });
  } catch (error) {
    console.error('Error updating trip plan:', error);
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

    if (!productId) {
      res.status(400).json({ error: 'PRODUCT_ID_REQUIRED' });
      return;
    }

    // Verify product exists in catalog
    const productRecords = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId));

    if (productRecords.length === 0) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'The requested product does not exist in catalog' });
      return;
    }

    // If tripPlanId passed, verify it belongs strictly to this session
    const tripPlans = await db
      .select()
      .from(schema.tripPlans)
      .where(eq(schema.tripPlans.guestSessionId, sessionId));

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
    await db.insert(schema.tripItems).values({
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
    });

    res.json({
      success: true,
      itemId,
      message: `${productRecords[0].name} added to My Trip`,
    });
  } catch (error) {
    console.error('Error adding trip item:', error);
    res.status(500).json({ error: 'FAILED_TO_ADD_TRIP_ITEM' });
  }
});

// DELETE /api/session/trip/items/:id - Remove item (Strict Session Isolation)
router.delete('/trip/items/:id', requireGuestSession, async (req: GuestSessionRequest, res: Response) => {
  try {
    const sessionId = req.guestSession!.id;
    const itemId = req.params.id;

    // Fetch the trip item
    const itemRecords = await db
      .select()
      .from(schema.tripItems)
      .where(eq(schema.tripItems.id, itemId));

    if (itemRecords.length === 0) {
      res.status(404).json({ error: 'ITEM_NOT_FOUND' });
      return;
    }

    const item = itemRecords[0];

    // Verify trip plan belongs to current guest session
    const tripPlanRecords = await db
      .select()
      .from(schema.tripPlans)
      .where(
        and(
          eq(schema.tripPlans.id, item.tripPlanId),
          eq(schema.tripPlans.guestSessionId, sessionId)
        )
      );

    if (tripPlanRecords.length === 0) {
      // Security check: item does not belong to this guest's session!
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You cannot delete another guest’s trip item.',
      });
      return;
    }

    // Safe to delete
    await db.delete(schema.tripItems).where(eq(schema.tripItems.id, itemId));

    res.json({ success: true, message: 'Item removed from My Trip' });
  } catch (error) {
    console.error('Error deleting trip item:', error);
    res.status(500).json({ error: 'FAILED_TO_DELETE_TRIP_ITEM' });
  }
});

export default router;
