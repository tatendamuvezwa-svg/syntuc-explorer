import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { calculateSchoolTripQuote, SchoolTripQuoteInput } from '../services/schoolTrips.ts';
import { persistReservationToFirestore } from '../services/firestoreSync.ts';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';

const router = Router();

// GET /api/school-trips/tariffs - List published educational tariffs
router.get('/tariffs', async (req: Request, res: Response) => {
  try {
    const tariffs = await db.select().from(schema.schoolTripTariffs);
    res.json(tariffs);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_TARIFFS' });
  }
});

// POST /api/school-trips/calculate - Calculate authoritative school trip quote
router.post('/calculate', (req: Request, res: Response) => {
  try {
    const input: SchoolTripQuoteInput = req.body;

    if (!input.studentCount || input.studentCount < 1) {
      res.status(400).json({ error: 'STUDENT_COUNT_REQUIRED', message: 'Number of students must be at least 1' });
      return;
    }

    const quoteResult = calculateSchoolTripQuote({
      schoolName: input.schoolName || 'School Delegation',
      educationLevel: input.educationLevel || 'secondary',
      studentCount: Number(input.studentCount),
      teacherCount: Number(input.teacherCount) || 0,
      nightsCount: Number(input.nightsCount) || 0,
      accommodationTier: input.accommodationTier || 'budget',
      selectedActivities: input.selectedActivities || {},
    });

    res.json(quoteResult);
  } catch (error: any) {
    console.error('School trip calculation error:', error);
    res.status(500).json({ error: 'CALCULATION_FAILED', message: error.message });
  }
});

// POST /api/school-trips/submit - Authoritative submission of School Trip delegation request
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const {
      schoolName,
      educationLevel = 'secondary',
      studentCount,
      teacherCount = 2,
      nightsCount = 2,
      accommodationTier = 'budget',
      selectedActivities = {},
      contactPerson,
      contactEmail,
      contactPhone,
      arrivalDate,
      departureDate,
      specialRequests,
      guestSessionId,
    } = req.body;

    if (!schoolName || !contactEmail) {
      res.status(400).json({
        error: 'SCHOOL_CONTACT_REQUIRED',
        message: 'School name and coordinator contact email are required'
      });
      return;
    }

    const students = Math.max(1, Number(studentCount) || 20);
    const teachers = Math.max(0, Number(teacherCount) || 2);
    const nights = Math.max(0, Number(nightsCount) || 0);

    // Calculate server-authoritative educational quote
    const quoteResult = calculateSchoolTripQuote({
      schoolName: schoolName.trim(),
      educationLevel: educationLevel === 'primary' ? 'primary' : 'secondary',
      studentCount: students,
      teacherCount: teachers,
      nightsCount: nights,
      accommodationTier,
      selectedActivities,
    });

    // Idempotency / Duplicate Submission Protection (double-click / network retry)
    const recentSchoolSubmissions = await db
      .select()
      .from(schema.reservationRequests)
      .where(
        and(
          eq(schema.reservationRequests.requestType, 'SCHOOL_DELEGATION'),
          eq(schema.reservationRequests.authoritativeTotal, quoteResult.totalEstimate.toString())
        )
      )
      .orderBy(desc(schema.reservationRequests.createdAt))
      .limit(5);

    for (const r of recentSchoolSubmissions) {
      const meta = r.schoolMetadata as any;
      if (
        meta &&
        meta.schoolName?.toLowerCase() === schoolName.trim().toLowerCase() &&
        (Date.now() - new Date(r.createdAt).getTime()) < 15000
      ) {
        const tokens = await db
          .select()
          .from(schema.guestAccessTokens)
          .where(eq(schema.guestAccessTokens.reservationRequestId, r.id));
        res.status(200).json({
          success: true,
          referenceNumber: r.referenceNumber,
          reservationId: r.id,
          guestToken: tokens[0]?.id || '',
          quoteResult,
          message: `School delegation request #${r.referenceNumber} already received.`,
        });
        return;
      }
    }

    // 1. Create or link Guest
    const guestId = 'gst_sch_' + crypto.randomBytes(10).toString('hex');
    await db.insert(schema.guests).values({
      id: guestId,
      fullName: (contactPerson || `${schoolName} Coordinator`).trim(),
      email: contactEmail.trim().toLowerCase(),
      phone: contactPhone?.trim() || null,
      country: 'Zimbabwe / SADC',
      specialRequests: specialRequests?.trim() || `School delegation: ${schoolName} (${educationLevel})`,
    });

    // Ensure session exists or link session
    let sessionId = guestSessionId;
    if (sessionId) {
      const existingSession = await db
        .select()
        .from(schema.guestSessions)
        .where(eq(schema.guestSessions.id, sessionId));
      if (existingSession.length === 0) {
        await db.insert(schema.guestSessions).values({
          id: sessionId,
          guestId,
          sessionSecret: crypto.randomBytes(32).toString('hex'),
        });
      }
    } else {
      sessionId = 'ses_' + crypto.randomBytes(16).toString('hex');
      await db.insert(schema.guestSessions).values({
        id: sessionId,
        guestId,
        sessionSecret: crypto.randomBytes(32).toString('hex'),
      });
    }

    // 2. Generate Authoritative Reference (SYN-VF-XXXXX)
    const refNum = `SYN-VF-${Math.floor(20000 + Math.random() * 70000)}`;
    const reservationId = 'res_sch_' + crypto.randomBytes(10).toString('hex');

    // 3. Insert Reservation Request into central authoritative table
    await db.insert(schema.reservationRequests).values({
      id: reservationId,
      referenceNumber: refNum,
      requestType: 'SCHOOL_DELEGATION',
      guestId,
      guestSessionId: sessionId,
      status: 'NEW',
      startDate: arrivalDate || null,
      endDate: departureDate || null,
      adultsCount: teachers,
      childrenCount: students,
      authoritativeTotal: quoteResult.totalEstimate.toString(),
      currency: quoteResult.currency || 'USD',
      specialRequests: specialRequests || `School delegation: ${schoolName} (${students} students, ${teachers} teachers)`,
      isBridgeIncentiveApplied: quoteResult.bridgeIncentiveApplied,
      schoolMetadata: {
        schoolName: schoolName.trim(),
        educationLevel,
        studentCount: students,
        teacherCount: teachers,
        nightsCount: nights,
        accommodationTier,
        selectedActivities,
        lineItems: quoteResult.lineItems,
        totalEstimate: quoteResult.totalEstimate,
        perStudentEstimate: quoteResult.perStudentEstimate,
        bridgeIncentiveQualified: quoteResult.bridgeIncentiveQualified,
        bridgeIncentiveApplied: quoteResult.bridgeIncentiveApplied,
        contactPerson: contactPerson || 'Educational Coordinator',
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone || null,
      },
    });

    // 4. Insert Reservation Items from authoritative line items
    for (const item of quoteResult.lineItems) {
      const resItemId = 'ri_sch_' + crypto.randomBytes(10).toString('hex');
      await db.insert(schema.reservationItems).values({
        id: resItemId,
        reservationRequestId: reservationId,
        productId: item.id.startsWith('prod_') ? item.id : 'prod_rainforest_walk',
        snapshotProductName: item.name,
        snapshotOperatorName: 'Victoria Falls Educational Tariff Desk',
        snapshotProductType: item.category === 'accommodation' ? 'accommodation' : 'activity',
        snapshotUnitPrice: item.unitRate.toString(),
        snapshotPriceBasis: item.rateBasis,
        snapshotCurrency: 'USD',
        guestCount: item.quantity,
        nightsCount: item.category === 'accommodation' ? nights : 1,
        calculatedSubtotal: item.subtotal.toString(),
        notes: item.isComplimentaryIncentive ? 'Complimentary 1905 Historic Bridge Tour Incentive ($0)' : item.notes || null,
      });
    }

    // 5. Create Lead
    const leadId = 'lead_sch_' + crypto.randomBytes(10).toString('hex');
    await db.insert(schema.leads).values({
      id: leadId,
      guestId,
      status: 'ACTIVE',
      leadSource: 'school_trip_planner',
      firstTouchTimestamp: new Date(),
      lastTouchTimestamp: new Date(),
      lastInteractionType: 'school_quote_submitted',
      estimatedValue: quoteResult.totalEstimate.toString(),
      notes: `School delegation: ${schoolName} (${students} students, ${teachers} teachers, ${nights} nights)`,
    });

    // 6. Post initial notification in guest messages
    const msgId = 'msg_sch_' + crypto.randomBytes(10).toString('hex');
    await db.insert(schema.guestMessages).values({
      id: msgId,
      reservationRequestId: reservationId,
      senderType: 'coordinator',
      senderName: 'Victoria Falls Educational Desk',
      messageText: `Your school delegation request for "${schoolName}" has been received under reference #${refNum}. Our desk is reviewing educational tariff holds with verified accommodation and activity partners.`,
    });

    // 7. Generate Guest Access Token
    const guestToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(guestToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await db.insert(schema.guestAccessTokens).values({
      id: guestToken,
      reservationRequestId: reservationId,
      guestId,
      tokenHash,
      expiresAt,
    });

    // Persist School Delegation reservation and line items to Cloud Firestore
    try {
      const resRecord = (await db.select().from(schema.reservationRequests).where(eq(schema.reservationRequests.id, reservationId)))[0];
      const resItems = await db.select().from(schema.reservationItems).where(eq(schema.reservationItems.reservationRequestId, reservationId));
      const guestRecord = (await db.select().from(schema.guests).where(eq(schema.guests.id, guestId)))[0];
      const tokenRecord = (await db.select().from(schema.guestAccessTokens).where(eq(schema.guestAccessTokens.id, guestToken)))[0];
      if (resRecord && guestRecord) {
        await persistReservationToFirestore(resRecord, resItems, guestRecord, tokenRecord);
      }
    } catch (fsErr) {
      console.warn('[SchoolTrips] Cloud Firestore sync notice:', fsErr);
    }

    res.status(201).json({
      success: true,
      referenceNumber: refNum,
      reservationId,
      guestToken,
      quoteResult,
      message: `School delegation request #${refNum} successfully submitted to Reservations Desk`,
    });
  } catch (error: any) {
    console.error('School trip submission error:', error);
    res.status(500).json({ error: 'SUBMISSION_FAILED', message: error.message });
  }
});

export default router;
