/**
 * Syntuc Explorer - Client-Side Analytics & Marketing Attribution Service
 * SAINTECH (Smart Artificial Intelligence Native Technologies)
 *
 * Privacy-conscious first-party attribution tracking.
 * Persistent visitor identification across browser restarts (localStorage).
 * Distinct session tracking per browser session (sessionStorage).
 */

const STORAGE_VISITOR_KEY = 'syntuc_visitor_id';
const STORAGE_SESSION_KEY = 'syntuc_session_id';

function generateRandomId(prefix: string): string {
  const chars = '0123456789abcdef';
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${rand}`;
}

export function getVisitorId(): string {
  try {
    let visitorId = localStorage.getItem(STORAGE_VISITOR_KEY);
    if (!visitorId) {
      visitorId = generateRandomId('vis');
      localStorage.setItem(STORAGE_VISITOR_KEY, visitorId);
    }
    return visitorId;
  } catch (_) {
    return 'vis_fallback';
  }
}

export function getSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem(STORAGE_SESSION_KEY);
    if (!sessionId) {
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      sessionId = `ses_${timestamp}_${generateRandomId('s').slice(2)}`;
      sessionStorage.setItem(STORAGE_SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch (_) {
    return 'ses_fallback';
  }
}

export interface UTMParameters {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

export function getUTMParameters(): UTMParameters {
  if (typeof window === 'undefined') {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
  };
}

let isSessionInitialized = false;

/**
 * Initializes the visitor session on application mount
 * Captures UTM parameters, Referrer, and device attributes
 */
export async function initAnalyticsSession(): Promise<void> {
  if (isSessionInitialized || typeof window === 'undefined') return;
  isSessionInitialized = true;

  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const utms = getUTMParameters();
    const referrerUrl = document.referrer || null;
    const landingPage = window.location.pathname + window.location.search;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    const deviceCategory = isMobile ? 'mobile' : 'desktop';

    await fetch('/api/analytics/init-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitorId,
        sessionId,
        utmSource: utms.utm_source,
        utmMedium: utms.utm_medium,
        utmCampaign: utms.utm_campaign,
        utmContent: utms.utm_content,
        utmTerm: utms.utm_term,
        referrerUrl,
        landingPage,
        deviceCategory,
      }),
    });
  } catch (err) {
    // Non-blocking
    console.debug('[Analytics] Session initialization deferred:', err);
  }
}

/**
 * Structured Event Tracking Function
 */
export function trackEvent(params: {
  eventType: string;
  route?: string;
  productId?: string;
  packageId?: string;
  reservationId?: string;
  reservationReference?: string;
  metadata?: Record<string, any>;
}): void {
  if (typeof window === 'undefined') return;

  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const route = params.route || window.location.pathname;

    // Use sendBeacon if available, otherwise fire-and-forget fetch
    const payload = JSON.stringify({
      visitorId,
      sessionId,
      eventType: params.eventType,
      route,
      productId: params.productId || null,
      packageId: params.packageId || null,
      reservationId: params.reservationId || null,
      reservationReference: params.reservationReference || null,
      metadata: params.metadata || {},
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
    } else {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (_) {
    // Silently ignore tracking errors to protect user experience
  }
}

/**
 * Returns header snapshot for attaching to reservation submission requests
 */
export function getAttributionHeaders(): Record<string, string> {
  return {
    'x-visitor-id': getVisitorId(),
    'x-analytics-session-id': getSessionId(),
  };
}
