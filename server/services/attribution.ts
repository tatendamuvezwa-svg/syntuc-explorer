import crypto from 'crypto';
import {
  getDocById,
  setDocById,
  updateDocById,
  getCollectionDocs,
  where,
} from '../lib/firestore.ts';

export interface RawAttributionInput {
  visitorId: string;
  sessionId: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrerUrl?: string | null;
  landingPage?: string | null;
  deviceCategory?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
}

export interface ClassifiedAttribution {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrerUrl: string | null;
  referrerDomain: string | null;
  confidence: 'UTM_EXACT' | 'REFERRER_ONLY' | 'DIRECT' | 'UNKNOWN';
}

export function classifyTraffic(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrerUrl?: string | null;
}): ClassifiedAttribution {
  const cleanStr = (val?: string | null) => (val && val.trim() !== '' ? val.trim() : null);

  const utmSource = cleanStr(input.utmSource)?.toLowerCase();
  const utmMedium = cleanStr(input.utmMedium)?.toLowerCase();
  const utmCampaign = cleanStr(input.utmCampaign);
  const utmContent = cleanStr(input.utmContent);
  const utmTerm = cleanStr(input.utmTerm);
  const refUrl = cleanStr(input.referrerUrl);

  let refDomain: string | null = null;
  if (refUrl) {
    try {
      const parsed = new URL(refUrl);
      refDomain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch (_) {
      refDomain = refUrl.toLowerCase().split('/')[0].replace(/^www\./, '');
    }
  }

  // 1. UTM parameters take precedence (UTM_EXACT)
  if (utmSource) {
    return {
      source: utmSource,
      medium: utmMedium || (utmSource === 'google' ? 'cpc' : 'paid_social'),
      campaign: utmCampaign,
      content: utmContent,
      term: utmTerm,
      referrerUrl: refUrl,
      referrerDomain: refDomain,
      confidence: 'UTM_EXACT',
    };
  }

  // 2. Referrer-based classification (REFERRER_ONLY)
  if (refDomain) {
    if (refDomain.includes('tiktok.com')) {
      return {
        source: 'tiktok',
        medium: 'referral',
        campaign: null,
        content: null,
        term: null,
        referrerUrl: refUrl,
        referrerDomain: refDomain,
        confidence: 'REFERRER_ONLY',
      };
    }
    if (refDomain.includes('facebook.com') || refDomain.includes('fb.me')) {
      return {
        source: 'facebook',
        medium: 'referral',
        campaign: null,
        content: null,
        term: null,
        referrerUrl: refUrl,
        referrerDomain: refDomain,
        confidence: 'REFERRER_ONLY',
      };
    }
    if (refDomain.includes('google.')) {
      return {
        source: 'google',
        medium: 'organic',
        campaign: null,
        content: null,
        term: null,
        referrerUrl: refUrl,
        referrerDomain: refDomain,
        confidence: 'REFERRER_ONLY',
      };
    }
    if (refDomain.includes('instagram.com')) {
      return {
        source: 'instagram',
        medium: 'social_referral',
        campaign: null,
        content: null,
        term: null,
        referrerUrl: refUrl,
        referrerDomain: refDomain,
        confidence: 'REFERRER_ONLY',
      };
    }
    if (refDomain.includes('whatsapp') || refDomain.includes('wa.me')) {
      return {
        source: 'whatsapp',
        medium: 'referral',
        campaign: null,
        content: null,
        term: null,
        referrerUrl: refUrl,
        referrerDomain: refDomain,
        confidence: 'REFERRER_ONLY',
      };
    }

    return {
      source: refDomain,
      medium: 'referral',
      campaign: null,
      content: null,
      term: null,
      referrerUrl: refUrl,
      referrerDomain: refDomain,
      confidence: 'REFERRER_ONLY',
    };
  }

  // 3. Direct traffic (DIRECT)
  return {
    source: 'direct',
    medium: 'none',
    campaign: null,
    content: null,
    term: null,
    referrerUrl: null,
    referrerDomain: null,
    confidence: 'DIRECT',
  };
}

export async function initializeSession(input: RawAttributionInput) {
  try {
    const { visitorId, sessionId, landingPage, deviceCategory, browser, os, country } = input;
    const classified = classifyTraffic(input);
    const nowIso = new Date().toISOString();

    // Check if visitor exists in Firestore
    const existingVisitor = await getDocById<any>('analytics_visitors', visitorId);
    let isReturning = false;
    let visitorRecord: any;

    if (!existingVisitor) {
      // First-Touch: Create new visitor record with initial attribution
      const newVisitor = {
        id: visitorId,
        visitorId,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        firstSource: classified.source,
        firstMedium: classified.medium,
        firstCampaign: classified.campaign,
        firstContent: classified.content,
        firstTerm: classified.term,
        firstReferrerUrl: classified.referrerUrl,
        firstReferrerDomain: classified.referrerDomain,
        firstLandingPage: landingPage || '/',
        attributionConfidence: classified.confidence,
        totalSessions: 1,
      };
      await setDocById('analytics_visitors', visitorId, newVisitor);
      visitorRecord = newVisitor;
    } else {
      isReturning = true;
      const updatedVisitor = {
        lastSeenAt: nowIso,
        totalSessions: (existingVisitor.totalSessions || 1) + 1,
        updatedAt: nowIso,
      };
      await updateDocById('analytics_visitors', visitorId, updatedVisitor);
      visitorRecord = { ...existingVisitor, ...updatedVisitor };
    }

    // Check or upsert session in Firestore
    const existingSession = await getDocById<any>('analytics_sessions', sessionId);
    let sessionRecord: any;

    if (!existingSession) {
      const newSession = {
        id: sessionId,
        sessionId,
        visitorId,
        startedAt: nowIso,
        lastActivityAt: nowIso,
        landingPage: landingPage || '/',
        source: classified.source,
        medium: classified.medium,
        campaign: classified.campaign,
        content: classified.content,
        term: classified.term,
        referrerUrl: classified.referrerUrl,
        referrerDomain: classified.referrerDomain,
        attributionConfidence: classified.confidence,
        deviceCategory: deviceCategory || 'desktop',
        browser: browser || null,
        os: os || null,
        country: country || null,
      };
      await setDocById('analytics_sessions', sessionId, newSession);
      sessionRecord = newSession;

      await recordEventSafely({
        visitorId,
        sessionId,
        eventType: 'SESSION_STARTED',
        route: landingPage || '/',
        metadata: {
          isReturning,
          source: classified.source,
          campaign: classified.campaign,
          content: classified.content,
          confidence: classified.confidence,
        },
      });

      await recordEventSafely({
        visitorId,
        sessionId,
        eventType: 'LANDING_PAGE_VIEWED',
        route: landingPage || '/',
        metadata: {
          landingPage: landingPage || '/',
        },
      });
    } else {
      await updateDocById('analytics_sessions', sessionId, {
        lastActivityAt: nowIso,
        updatedAt: nowIso,
      });
      sessionRecord = { ...existingSession, lastActivityAt: nowIso };
    }

    return {
      success: true,
      visitorId,
      sessionId,
      isReturning,
      firstTouch: {
        source: visitorRecord.firstSource,
        medium: visitorRecord.firstMedium,
        campaign: visitorRecord.firstCampaign,
        content: visitorRecord.firstContent,
        term: visitorRecord.firstTerm,
        confidence: visitorRecord.attributionConfidence,
      },
      lastTouch: {
        source: sessionRecord.source,
        medium: sessionRecord.medium,
        campaign: sessionRecord.campaign,
        content: sessionRecord.content,
        term: sessionRecord.term,
        confidence: sessionRecord.attributionConfidence,
      },
    };
  } catch (err) {
    console.error('[Analytics] Failed to initialize session in Firestore:', err);
    return {
      success: false,
      error: 'INITIALIZATION_FAILED',
    };
  }
}

export async function recordEventSafely(params: {
  visitorId: string;
  sessionId: string;
  eventType: string;
  route?: string | null;
  productId?: string | null;
  packageId?: string | null;
  reservationId?: string | null;
  reservationReference?: string | null;
  metadata?: Record<string, any> | null;
}) {
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
    } = params;

    if (!visitorId || !sessionId || !eventType) {
      return null;
    }

    const eventId = 'evt_' + crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();

    await setDocById('analytics_events', eventId, {
      id: eventId,
      eventId,
      visitorId,
      sessionId,
      eventType,
      route: route || null,
      productId: productId || null,
      packageId: packageId || null,
      reservationId: reservationId || null,
      reservationReference: reservationReference || null,
      metadata: metadata || {},
      occurredAt: nowIso,
    });

    try {
      await updateDocById('analytics_sessions', sessionId, {
        lastActivityAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (_) {}

    return eventId;
  } catch (err) {
    console.error('[Analytics] Safe event recording error in Firestore:', err);
    return null;
  }
}

export async function getAttributionForReservation(visitorId?: string | null, sessionId?: string | null) {
  let firstTouch = {
    source: 'direct',
    medium: 'none',
    campaign: null as string | null,
    content: null as string | null,
    term: null as string | null,
    referrer: null as string | null,
    confidence: 'DIRECT',
  };

  let lastTouch = {
    source: 'direct',
    medium: 'none',
    campaign: null as string | null,
    content: null as string | null,
    term: null as string | null,
    referrer: null as string | null,
    confidence: 'DIRECT',
  };

  try {
    if (visitorId) {
      const v = await getDocById<any>('analytics_visitors', visitorId);
      if (v) {
        firstTouch = {
          source: v.firstSource || 'direct',
          medium: v.firstMedium || 'none',
          campaign: v.firstCampaign || null,
          content: v.firstContent || null,
          term: v.firstTerm || null,
          referrer: v.firstReferrerUrl || null,
          confidence: v.attributionConfidence || 'UNKNOWN',
        };
      }
    }

    if (sessionId) {
      const s = await getDocById<any>('analytics_sessions', sessionId);
      if (s) {
        lastTouch = {
          source: s.source || 'direct',
          medium: s.medium || 'none',
          campaign: s.campaign || null,
          content: s.content || null,
          term: s.term || null,
          referrer: s.referrerUrl || null,
          confidence: s.attributionConfidence || 'UNKNOWN',
        };
      }
    }
  } catch (err) {
    console.error('[Analytics] Error looking up attribution in Firestore:', err);
  }

  return {
    visitorId: visitorId || null,
    firstTouchSource: firstTouch.source,
    firstTouchMedium: firstTouch.medium,
    firstTouchCampaign: firstTouch.campaign,
    firstTouchContent: firstTouch.content,
    firstTouchTerm: firstTouch.term,
    firstTouchReferrer: firstTouch.referrer,
    lastTouchSource: lastTouch.source,
    lastTouchMedium: lastTouch.medium,
    lastTouchCampaign: lastTouch.campaign,
    lastTouchContent: lastTouch.content,
    lastTouchTerm: lastTouch.term,
    lastTouchReferrer: lastTouch.referrer,
    attributionConfidence: firstTouch.confidence !== 'DIRECT' ? firstTouch.confidence : lastTouch.confidence,
  };
}
