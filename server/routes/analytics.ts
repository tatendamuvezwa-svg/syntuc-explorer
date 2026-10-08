import { Router, Request, Response } from 'express';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { requireCoordinatorAuth, AuthenticatedStaffRequest } from '../middleware/auth.ts';
import { initializeSession, recordEventSafely } from '../services/attribution.ts';

const router = Router();

// ==========================================
// PUBLIC GUEST TRACKING ENDPOINTS
// ==========================================

// POST /api/analytics/init-session - Initialize or resume visitor session with UTM & Referrer capture
router.post('/init-session', async (req: Request, res: Response) => {
  try {
    const {
      visitorId,
      sessionId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrerUrl,
      landingPage,
      deviceCategory,
      browser,
      os,
      country,
    } = req.body;

    if (!visitorId || !sessionId) {
      res.status(400).json({ error: 'VISITOR_AND_SESSION_ID_REQUIRED' });
      return;
    }

    const result = await initializeSession({
      visitorId,
      sessionId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrerUrl,
      landingPage,
      deviceCategory,
      browser,
      os,
      country,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[Analytics API] Failed to initialize session:', err);
    res.status(500).json({ error: 'SESSION_INIT_FAILED', message: err.message });
  }
});

// POST /api/analytics/track - Record an event safely
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      visitorId,
      sessionId,
      eventType,
      route,
      productId,
      packageId,
      reservationId,
      reservationReference,
      metadata,
    } = req.body;

    if (!visitorId || !sessionId || !eventType) {
      res.status(400).json({ error: 'MISSING_REQUIRED_EVENT_FIELDS' });
      return;
    }

    const eventId = await recordEventSafely({
      visitorId,
      sessionId,
      eventType,
      route,
      productId,
      packageId,
      reservationId,
      reservationReference,
      metadata,
    });

    res.json({ success: true, eventId });
  } catch (err: any) {
    console.error('[Analytics API] Failed to record event:', err);
    // Non-blocking response: even on error return success false without failing client workflow
    res.status(200).json({ success: false, error: err.message });
  }
});

// ==========================================
// AUTHORIZED STAFF ANALYTICS ENDPOINTS (RBAC)
// ==========================================

// GET /api/analytics/dashboard - Comprehensive Commercial Intelligence
router.get('/dashboard', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { range = 'all', startDate, endDate } = req.query;

    let timeFilterStart: Date | null = null;
    let timeFilterEnd: Date | null = null;
    const now = new Date();

    if (range === 'today') {
      timeFilterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'yesterday') {
      timeFilterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      timeFilterEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'last7days') {
      timeFilterStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === 'last30days') {
      timeFilterStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === 'thisMonth') {
      timeFilterStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'custom' && startDate) {
      timeFilterStart = new Date(startDate as string);
      if (endDate) {
        timeFilterEnd = new Date(endDate as string);
      }
    }

    // 1. Fetch visitors
    const allVisitors = await db.select().from(schema.analyticsVisitors);
    const filteredVisitors = allVisitors.filter((v) => {
      if (timeFilterStart && v.lastSeenAt < timeFilterStart) return false;
      if (timeFilterEnd && v.firstSeenAt > timeFilterEnd) return false;
      return true;
    });

    // 2. Fetch sessions
    const allSessions = await db.select().from(schema.analyticsSessions);
    const filteredSessions = allSessions.filter((s) => {
      if (timeFilterStart && s.startedAt < timeFilterStart) return false;
      if (timeFilterEnd && s.startedAt > timeFilterEnd) return false;
      return true;
    });

    // 3. Fetch events
    const allEvents = await db.select().from(schema.analyticsEvents);
    const filteredEvents = allEvents.filter((e) => {
      if (timeFilterStart && e.occurredAt < timeFilterStart) return false;
      if (timeFilterEnd && e.occurredAt > timeFilterEnd) return false;
      return true;
    });

    // 4. Fetch reservations
    const allReservations = await db.select().from(schema.reservationRequests);
    const filteredReservations = allReservations.filter((r) => {
      if (timeFilterStart && r.createdAt < timeFilterStart) return false;
      if (timeFilterEnd && r.createdAt > timeFilterEnd) return false;
      return true;
    });

    // --- KPI CALCULATIONS ---
    const uniqueVisitorIds = new Set(filteredSessions.map((s) => s.visitorId));
    // Also include visitors who triggered events
    filteredEvents.forEach((e) => uniqueVisitorIds.add(e.visitorId));
    filteredVisitors.forEach((v) => uniqueVisitorIds.add(v.visitorId));

    const totalVisitors = uniqueVisitorIds.size;
    const newVisitorsCount = filteredVisitors.filter((v) => {
      if (!timeFilterStart) return true;
      return v.firstSeenAt >= timeFilterStart;
    }).length;
    const returningVisitorsCount = Math.max(0, totalVisitors - newVisitorsCount);
    const totalSessionsCount = filteredSessions.length;

    const pageViewsCount = filteredEvents.filter((e) =>
      ['PAGE_VIEWED', 'LANDING_PAGE_VIEWED'].includes(e.eventType)
    ).length;

    // Engagement metrics
    const syntucChatOpens = filteredEvents.filter((e) => e.eventType === 'SYNTUC_CHAT_OPENED').length;
    const syntucMessagesSent = filteredEvents.filter((e) => e.eventType === 'SYNTUC_MESSAGE_SENT').length;
    const productViews = filteredEvents.filter((e) => e.eventType === 'PRODUCT_VIEWED').length;
    const packageViews = filteredEvents.filter((e) => e.eventType === 'PACKAGE_VIEWED').length;
    const tripsCreated = filteredEvents.filter((e) => e.eventType === 'TRIP_CREATED').length;
    const itemsAdded = filteredEvents.filter((e) => e.eventType === 'TRIP_ITEM_ADDED').length;
    const bookingStarts = filteredEvents.filter((e) => e.eventType === 'BOOKING_STARTED').length;

    // Conversion metrics
    const reservationRequestsCount = filteredReservations.length;
    const confirmedReservationsCount = filteredReservations.filter((r) => r.status === 'CONFIRMED').length;
    const cancelledReservationsCount = filteredReservations.filter((r) =>
      ['CANCELLED', 'DECLINED'].includes(r.status)
    ).length;

    const conversionRate = totalVisitors > 0 ? (reservationRequestsCount / totalVisitors) * 100 : 0;
    const confirmedConversionRate = totalVisitors > 0 ? (confirmedReservationsCount / totalVisitors) * 100 : 0;

    let confirmedRevenue = 0;
    let pipelineRevenue = 0;
    filteredReservations.forEach((r) => {
      const val = Number(r.authoritativeTotal) || 0;
      if (r.status === 'CONFIRMED') {
        confirmedRevenue += val;
      }
      if (!['CANCELLED', 'DECLINED'].includes(r.status)) {
        pipelineRevenue += val;
      }
    });

    // --- FUNNEL ANALYSIS (Unique visitors per milestone) ---
    const funnelVisitors = new Set(filteredSessions.map((s) => s.visitorId));
    filteredEvents.forEach((e) => funnelVisitors.add(e.visitorId));

    const funnelExplorers = new Set(
      filteredEvents.filter((e) => ['PRODUCT_VIEWED', 'PACKAGE_VIEWED'].includes(e.eventType)).map((e) => e.visitorId)
    );

    const funnelSyntuc = new Set(
      filteredEvents.filter((e) => ['SYNTUC_CHAT_OPENED', 'SYNTUC_MESSAGE_SENT'].includes(e.eventType)).map((e) => e.visitorId)
    );

    const funnelTrip = new Set(
      filteredEvents.filter((e) => ['TRIP_CREATED', 'TRIP_ITEM_ADDED'].includes(e.eventType)).map((e) => e.visitorId)
    );

    const funnelBookingStarted = new Set(
      filteredEvents.filter((e) => e.eventType === 'BOOKING_STARTED').map((e) => e.visitorId)
    );

    const funnelReservationSubmitted = new Set<string>();
    filteredReservations.forEach((r) => {
      if (r.visitorId) funnelReservationSubmitted.add(r.visitorId);
    });
    filteredEvents
      .filter((e) => e.eventType === 'RESERVATION_REQUEST_SUBMITTED')
      .forEach((e) => funnelReservationSubmitted.add(e.visitorId));

    const funnelConfirmed = new Set<string>();
    filteredReservations
      .filter((r) => r.status === 'CONFIRMED')
      .forEach((r) => {
        if (r.visitorId) funnelConfirmed.add(r.visitorId);
      });

    const funnelSteps = [
      { name: '1. Total Visitors', count: funnelVisitors.size, pct: 100 },
      {
        name: '2. Product / Package Viewed',
        count: funnelExplorers.size,
        pct: funnelVisitors.size > 0 ? (funnelExplorers.size / funnelVisitors.size) * 100 : 0,
      },
      {
        name: '3. Talk to Syntuc AI',
        count: funnelSyntuc.size,
        pct: funnelVisitors.size > 0 ? (funnelSyntuc.size / funnelVisitors.size) * 100 : 0,
      },
      {
        name: '4. Trip Created / Item Added',
        count: funnelTrip.size,
        pct: funnelVisitors.size > 0 ? (funnelTrip.size / funnelVisitors.size) * 100 : 0,
      },
      {
        name: '5. Booking Flow Started',
        count: funnelBookingStarted.size,
        pct: funnelVisitors.size > 0 ? (funnelBookingStarted.size / funnelVisitors.size) * 100 : 0,
      },
      {
        name: '6. Reservation Submitted',
        count: funnelReservationSubmitted.size,
        pct: funnelVisitors.size > 0 ? (funnelReservationSubmitted.size / funnelVisitors.size) * 100 : 0,
      },
      {
        name: '7. Confirmed Booking',
        count: funnelConfirmed.size,
        pct: funnelVisitors.size > 0 ? (funnelConfirmed.size / funnelVisitors.size) * 100 : 0,
      },
    ];

    // --- TRAFFIC SOURCES BREAKDOWN ---
    const sourceMap = new Map<
      string,
      {
        source: string;
        visitors: Set<string>;
        sessions: number;
        reservations: number;
        confirmed: number;
        revenue: number;
      }
    >();

    // Seed known canonical channels
    ['tiktok', 'facebook', 'instagram', 'google', 'whatsapp', 'direct'].forEach((src) => {
      sourceMap.set(src, {
        source: src,
        visitors: new Set(),
        sessions: 0,
        reservations: 0,
        confirmed: 0,
        revenue: 0,
      });
    });

    // Attribute sessions
    filteredSessions.forEach((s) => {
      const src = (s.source || 'direct').toLowerCase();
      if (!sourceMap.has(src)) {
        sourceMap.set(src, {
          source: src,
          visitors: new Set(),
          sessions: 0,
          reservations: 0,
          confirmed: 0,
          revenue: 0,
        });
      }
      const entry = sourceMap.get(src)!;
      entry.visitors.add(s.visitorId);
      entry.sessions += 1;
    });

    // Attribute reservations to source (First-touch or Last-touch)
    filteredReservations.forEach((r) => {
      const src = (r.firstTouchSource || r.lastTouchSource || 'direct').toLowerCase();
      if (!sourceMap.has(src)) {
        sourceMap.set(src, {
          source: src,
          visitors: new Set(),
          sessions: 0,
          reservations: 0,
          confirmed: 0,
          revenue: 0,
        });
      }
      const entry = sourceMap.get(src)!;
      entry.reservations += 1;
      const rev = Number(r.authoritativeTotal) || 0;
      if (r.status === 'CONFIRMED') {
        entry.confirmed += 1;
        entry.revenue += rev;
      }
    });

    const sourcesTable = Array.from(sourceMap.values())
      .map((item) => {
        const vCount = item.visitors.size;
        return {
          source: item.source,
          visitors: vCount,
          sessions: item.sessions,
          reservations: item.reservations,
          confirmed: item.confirmed,
          conversionRate: vCount > 0 ? ((item.reservations / vCount) * 100).toFixed(2) + '%' : '0.00%',
          revenue: item.revenue.toFixed(2),
        };
      })
      .sort((a, b) => b.visitors - a.visitors || b.reservations - a.reservations);

    // --- CAMPAIGN PERFORMANCE BREAKDOWN ---
    const campaignMap = new Map<
      string,
      {
        campaign: string;
        source: string;
        visitors: Set<string>;
        sessions: number;
        reservations: number;
        confirmed: number;
        revenue: number;
      }
    >();

    filteredSessions
      .filter((s) => s.campaign)
      .forEach((s) => {
        const key = `${s.campaign}:::${s.source}`;
        if (!campaignMap.has(key)) {
          campaignMap.set(key, {
            campaign: s.campaign!,
            source: s.source,
            visitors: new Set(),
            sessions: 0,
            reservations: 0,
            confirmed: 0,
            revenue: 0,
          });
        }
        const entry = campaignMap.get(key)!;
        entry.visitors.add(s.visitorId);
        entry.sessions += 1;
      });

    filteredReservations
      .filter((r) => r.firstTouchCampaign || r.lastTouchCampaign)
      .forEach((r) => {
        const camp = r.firstTouchCampaign || r.lastTouchCampaign!;
        const src = r.firstTouchSource || r.lastTouchSource || 'unknown';
        const key = `${camp}:::${src}`;
        if (!campaignMap.has(key)) {
          campaignMap.set(key, {
            campaign: camp,
            source: src,
            visitors: new Set(),
            sessions: 0,
            reservations: 0,
            confirmed: 0,
            revenue: 0,
          });
        }
        const entry = campaignMap.get(key)!;
        entry.reservations += 1;
        if (r.status === 'CONFIRMED') {
          entry.confirmed += 1;
          entry.revenue += Number(r.authoritativeTotal) || 0;
        }
      });

    const campaignsTable = Array.from(campaignMap.values())
      .map((c) => ({
        campaign: c.campaign,
        source: c.source,
        visitors: c.visitors.size,
        sessions: c.sessions,
        reservations: c.reservations,
        confirmed: c.confirmed,
        conversionRate: c.visitors.size > 0 ? ((c.reservations / c.visitors.size) * 100).toFixed(2) + '%' : '0.00%',
        revenue: c.revenue.toFixed(2),
      }))
      .sort((a, b) => b.reservations - a.reservations || b.visitors - a.visitors);

    // --- EXACT AD / CREATIVE CONTENT (utm_content) BREAKDOWN ---
    const contentMap = new Map<
      string,
      {
        content: string;
        campaign: string;
        source: string;
        visitors: Set<string>;
        sessions: number;
        reservations: number;
        confirmed: number;
        revenue: number;
      }
    >();

    filteredSessions
      .filter((s) => s.content)
      .forEach((s) => {
        const key = `${s.content}:::${s.campaign || 'none'}:::${s.source}`;
        if (!contentMap.has(key)) {
          contentMap.set(key, {
            content: s.content!,
            campaign: s.campaign || 'none',
            source: s.source,
            visitors: new Set(),
            sessions: 0,
            reservations: 0,
            confirmed: 0,
            revenue: 0,
          });
        }
        const entry = contentMap.get(key)!;
        entry.visitors.add(s.visitorId);
        entry.sessions += 1;
      });

    filteredReservations
      .filter((r) => r.firstTouchContent || r.lastTouchContent)
      .forEach((r) => {
        const cont = r.firstTouchContent || r.lastTouchContent!;
        const camp = r.firstTouchCampaign || r.lastTouchCampaign || 'none';
        const src = r.firstTouchSource || r.lastTouchSource || 'unknown';
        const key = `${cont}:::${camp}:::${src}`;
        if (!contentMap.has(key)) {
          contentMap.set(key, {
            content: cont,
            campaign: camp,
            source: src,
            visitors: new Set(),
            sessions: 0,
            reservations: 0,
            confirmed: 0,
            revenue: 0,
          });
        }
        const entry = contentMap.get(key)!;
        entry.reservations += 1;
        if (r.status === 'CONFIRMED') {
          entry.confirmed += 1;
          entry.revenue += Number(r.authoritativeTotal) || 0;
        }
      });

    const adCreativesTable = Array.from(contentMap.values())
      .map((ad) => ({
        content: ad.content,
        campaign: ad.campaign,
        source: ad.source,
        visitors: ad.visitors.size,
        sessions: ad.sessions,
        reservations: ad.reservations,
        confirmed: ad.confirmed,
        conversionRate: ad.visitors.size > 0 ? ((ad.reservations / ad.visitors.size) * 100).toFixed(2) + '%' : '0.00%',
        revenue: ad.revenue.toFixed(2),
      }))
      .sort((a, b) => b.reservations - a.reservations || b.visitors - a.visitors);

    // --- RECENT RESERVATIONS WITH ATTRIBUTION SNAPSHOTS ---
    const recentAttributedReservations = filteredReservations
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        status: r.status,
        authoritativeTotal: r.authoritativeTotal,
        currency: r.currency,
        createdAt: r.createdAt,
        visitorId: r.visitorId,
        firstTouch: {
          source: r.firstTouchSource || 'direct',
          medium: r.firstTouchMedium,
          campaign: r.firstTouchCampaign,
          content: r.firstTouchContent,
          confidence: r.attributionConfidence,
        },
        lastTouch: {
          source: r.lastTouchSource || 'direct',
          medium: r.lastTouchMedium,
          campaign: r.lastTouchCampaign,
          content: r.lastTouchContent,
          confidence: r.attributionConfidence,
        },
      }));

    res.json({
      timeRange: {
        range,
        start: timeFilterStart?.toISOString() || null,
        end: timeFilterEnd?.toISOString() || null,
      },
      traffic: {
        totalVisitors,
        uniqueVisitors: totalVisitors,
        newVisitors: newVisitorsCount,
        returningVisitors: returningVisitorsCount,
        totalSessions: totalSessionsCount,
        pageViews: pageViewsCount,
      },
      engagement: {
        syntucChatOpens,
        syntucMessagesSent,
        productViews,
        packageViews,
        tripsCreated,
        itemsAdded,
        bookingStarts,
      },
      conversion: {
        reservationRequests: reservationRequestsCount,
        confirmedReservations: confirmedReservationsCount,
        cancelledReservations: cancelledReservationsCount,
        conversionRate: conversionRate.toFixed(2) + '%',
        confirmedConversionRate: confirmedConversionRate.toFixed(2) + '%',
        confirmedRevenue: confirmedRevenue.toFixed(2),
        pipelineRevenue: pipelineRevenue.toFixed(2),
      },
      funnel: funnelSteps,
      sourcesTable,
      campaignsTable,
      adCreativesTable,
      recentAttributedReservations,
    });
  } catch (err: any) {
    console.error('[Analytics Dashboard API] Error generating metrics:', err);
    res.status(500).json({ error: 'ANALYTICS_DASHBOARD_ERROR', message: err.message });
  }
});

// GET /api/analytics/journey/:identifier - Chronological visitor/reservation journey
router.get('/journey/:identifier', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      res.status(400).json({ error: 'IDENTIFIER_REQUIRED' });
      return;
    }

    // Identify target visitorId
    let targetVisitorId = identifier;
    let targetReservation: typeof schema.reservationRequests.$inferSelect | null = null;

    // Check if identifier is reservation reference or reservation ID
    const reservations = await db
      .select()
      .from(schema.reservationRequests)
      .where(
        sql`${schema.reservationRequests.referenceNumber} = ${identifier} OR ${schema.reservationRequests.id} = ${identifier}`
      );

    if (reservations.length > 0) {
      targetReservation = reservations[0];
      if (targetReservation.visitorId) {
        targetVisitorId = targetReservation.visitorId;
      }
    }

    // Fetch visitor record
    const visitors = await db
      .select()
      .from(schema.analyticsVisitors)
      .where(eq(schema.analyticsVisitors.visitorId, targetVisitorId));

    const visitorRecord = visitors[0] || null;

    // Fetch all sessions for this visitor
    const sessions = await db
      .select()
      .from(schema.analyticsSessions)
      .where(eq(schema.analyticsSessions.visitorId, targetVisitorId))
      .orderBy(schema.analyticsSessions.startedAt);

    // Fetch all events for this visitor
    const events = await db
      .select()
      .from(schema.analyticsEvents)
      .where(eq(schema.analyticsEvents.visitorId, targetVisitorId))
      .orderBy(schema.analyticsEvents.occurredAt);

    res.json({
      identifier,
      visitor: visitorRecord,
      reservation: targetReservation,
      sessionsCount: sessions.length,
      eventsCount: events.length,
      sessions,
      events,
    });
  } catch (err: any) {
    console.error('[Analytics Journey API] Error retrieving journey:', err);
    res.status(500).json({ error: 'JOURNEY_RETRIEVAL_FAILED', message: err.message });
  }
});

export default router;
