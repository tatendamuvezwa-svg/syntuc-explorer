import http from 'http';
import { getFirestoreDb } from '../services/firestoreSync.ts';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

function post(path: string, data: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(text) });
          } catch (_) {
            resolve({ status: res.statusCode || 0, body: text });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(text) });
          } catch (_) {
            resolve({ status: res.statusCode || 0, body: text });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runAcceptanceSuite() {
  console.log('=== STARTING PRODUCTION PERSISTENCE ACCEPTANCE TEST SUITE ===');

  // 1. Coordinator Login
  console.log('[Step 1] Coordinator Authentication...');
  const loginRes = await post('/api/coordinator/login', {
    email: 'reservations@syntuc.com',
    password: 'syntuc2026!secure',
  });
  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error('Coordinator login failed');
  }
  const token = loginRes.body.token;
  const staffAuth = { Authorization: 'Bearer ' + token };
  console.log('-> Coordinator Authenticated:', loginRes.body.user.name);

  // 2. Initialize Analytics Session with controlled UTM campaign
  console.log('[Step 2] Analytics Attribution Simulation (TikTok Campaign)...');
  const visitorId = 'vis_test_tiktok_' + Date.now();
  const sessionId = 'ses_test_tiktok_' + Date.now();
  const initSessionRes = await post('/api/analytics/init-session', {
    visitorId,
    sessionId,
    landingPage: '/catalog',
    referrerUrl: 'https://www.tiktok.com/',
    utmSource: 'tiktok',
    utmMedium: 'paid_social',
    utmCampaign: 'persistence_test',
    utmContent: 'persistence_test_ad',
  });
  console.log('-> Analytics Init Session:', initSessionRes.status, initSessionRes.body.session?.source);

  // 3. Create Guest Session
  console.log('[Step 3] Initializing Guest Session...');
  const initGuestRes = await post('/api/session/init', {});
  const guestSessionId = initGuestRes.body.sessionId;
  const guestSessionHeaders = { 'x-guest-session-id': guestSessionId };

  // 4. Create Controlled Guest Reservation
  console.log('[Step 4] Submitting Guest Reservation with Attribution Snapshots...');
  const bookingPayload = {
    fullName: 'Tinashe Chikwava',
    email: 'tinashe.chikwava@test.com',
    phone: '+263 77 123 4567',
    country: 'Zimbabwe',
    startDate: '2026-11-20',
    endDate: '2026-11-24',
    adultsCount: 2,
    childrenCount: 0,
    specialRequests: 'Sunset cruise upper deck seating requested. Vegetarian canapés.',
    visitorId,
    clientAnalyticsSessionId: sessionId,
    items: [
      {
        productId: 'prod_flight_of_angels',
        guestCount: 2,
        scheduledDate: '2026-11-21',
        scheduledTime: '11:00',
        notes: 'Flight of Angels scenic helicopter',
      },
      {
        productId: 'prod_zambezi_explorer_cruise',
        guestCount: 2,
        scheduledDate: '2026-11-22',
        scheduledTime: '16:00',
        notes: 'Luxury sunset cruise',
      },
    ],
  };

  const bookingRes = await post('/api/reservation/submit', bookingPayload, {
    ...guestSessionHeaders,
    'x-visitor-id': visitorId,
  });
  console.log('Booking response raw:', bookingRes.status, JSON.stringify(bookingRes.body));

  if (bookingRes.status !== 200 || !bookingRes.body.referenceNumber) {
    throw new Error('Booking submission failed: ' + JSON.stringify(bookingRes.body));
  }
  const refNum = bookingRes.body.referenceNumber;
  const resId = bookingRes.body.reservationId;
  console.log(`-> Reservation Created: ${refNum} (ID: ${resId}) Total: $${bookingRes.body.authoritativeTotal}`);

  // 5. Verify Record in Cloud Firestore
  console.log('[Step 5] Verifying durable Cloud Firestore commit...');
  const fdb = getFirestoreDb();
  if (!fdb) throw new Error('Firestore DB instance unavailable');
  const firestoreDoc = await getDoc(doc(fdb, 'reservation_requests', resId));
  if (!firestoreDoc.exists()) {
    throw new Error(`Reservation ${refNum} not found in Cloud Firestore!`);
  }
  const fsData = firestoreDoc.data();
  console.log('-> Verified in Cloud Firestore:');
  console.log(`   Reference: ${fsData.referenceNumber}`);
  console.log(`   Status: ${fsData.status}`);
  console.log(`   Total: $${fsData.authoritativeTotal}`);
  console.log(`   First-Touch: ${fsData.firstTouchSource} / ${fsData.firstTouchCampaign}`);
  console.log(`   Last-Touch: ${fsData.lastTouchSource} / ${fsData.lastTouchCampaign}`);
  console.log(`   CloudPersistedAt: ${fsData.cloudPersistedAt}`);

  // 6. Update Reservation Status to CONFIRMED
  console.log('[Step 6] Updating reservation status to CONFIRMED in coordinator desk...');
  const statusUpdateRes = await post(`/api/coordinator/reservations/${resId}/status`, {
    status: 'CONFIRMED',
    internalNote: 'Partner Shearwater & Wild Horizons hold confirmed via direct desk liaison.',
  }, staffAuth);
  console.log('-> Status update response:', statusUpdateRes.status);

  // 7. Verify Status in Cloud Firestore
  const updatedDoc = await getDoc(doc(fdb, 'reservation_requests', resId));
  console.log('-> Updated status in Cloud Firestore:', updatedDoc.data()?.status);

  // 8. Upload Controlled Test Media Asset
  console.log('[Step 7] Uploading Controlled Test Media Asset...');
  const testMediaPayload = {
    ownerType: 'product',
    ownerId: 'prod_flight_of_angels',
    externalUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'IMAGE',
    caption: 'Verified Victoria Falls Crest Panorama',
    altText: 'Spectacular aerial view of the Victoria Falls gorge',
    sourceName: 'Shearwater Heli Verification Desk',
    isPrimary: false,
    displayOrder: 2,
  };
  const mediaRes = await post('/api/media/upload', testMediaPayload, staffAuth);
  const mediaId = mediaRes.body.mediaId;
  console.log('-> Media uploaded and registered:', mediaId);

  // Verify Media in Cloud Firestore
  const mediaDoc = await getDoc(doc(fdb, 'media_assets', mediaId));
  console.log('-> Media verified in Cloud Firestore:', mediaDoc.exists(), mediaDoc.data()?.caption);

  console.log('\n=== PHASE 1 (PRE-INTERRUPTION) VERIFICATION COMPLETE ===');
  console.log(`Reference: ${refNum}`);
  console.log(`ReservationId: ${resId}`);
  console.log(`MediaId: ${mediaId}`);

  return { refNum, resId, mediaId };
}

runAcceptanceSuite()
  .then((res) => {
    console.log('Acceptance run complete:', JSON.stringify(res));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Acceptance suite failed:', err);
    process.exit(1);
  });
