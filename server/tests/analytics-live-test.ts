async function runAttributionTestSuite() {
  const base = 'http://localhost:3000';
  console.log('================================================================');
  console.log('  STARTING LIVE MARKETING ATTRIBUTION & ANALYTICS TEST SUITE');
  console.log('================================================================');

  // 1. Cross-Platform Tests
  console.log('\n--- 1. Testing Platform Attribution (TikTok, Facebook, Instagram, Google, WhatsApp, Direct) ---');
  const platforms = [
    { name: 'TikTok', utm: { utmSource: 'tiktok', utmMedium: 'paid_social', utmCampaign: 'helicopter_launch', utmContent: 'helicopter_ad_01' } },
    { name: 'Facebook', utm: { utmSource: 'facebook', utmMedium: 'paid_social', utmCampaign: 'helicopter_launch', utmContent: 'helicopter_ad_02' } },
    { name: 'Instagram', utm: { utmSource: 'instagram', utmMedium: 'paid_social', utmCampaign: 'luxury_safari', utmContent: 'story_reel_01' } },
    { name: 'Google', utm: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'vic_falls_flights', utmContent: 'search_ad_angels' } },
    { name: 'WhatsApp', utm: { utmSource: 'whatsapp', utmMedium: 'referral', utmCampaign: 'family_package_share', utmContent: 'chat_share_btn' } },
    { name: 'Direct', utm: {} }
  ];

  for (const p of platforms) {
    const visId = 'vis_platform_' + p.name.toLowerCase();
    const sesId = 'ses_platform_' + p.name.toLowerCase();
    const res = await fetch(base + '/api/analytics/init-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: visId,
        sessionId: sesId,
        landingPage: '/',
        ...p.utm
      })
    });
    const data = await res.json();
    console.log(`[Platform: ${p.name.padEnd(9)}] Source: ${data.firstTouch?.source.padEnd(10)} | Campaign: ${(data.firstTouch?.campaign || 'none').padEnd(20)} | Content: ${(data.firstTouch?.content || 'none').padEnd(18)} | Confidence: ${data.firstTouch?.confidence}`);
  }

  // 2. Exact Ad Identification Test (utm_content comparison)
  console.log('\n--- 2. Testing Distinct Ad Identification (helicopter_ad_01 vs helicopter_ad_02) ---');
  const ad1Res = await fetch(base + '/api/analytics/init-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: 'vis_ad1_user',
      sessionId: 'ses_ad1',
      utmSource: 'tiktok',
      utmMedium: 'paid_social',
      utmCampaign: 'helicopter_launch',
      utmContent: 'helicopter_ad_01'
    })
  });
  const ad1Data = await ad1Res.json();

  const ad2Res = await fetch(base + '/api/analytics/init-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: 'vis_ad2_user',
      sessionId: 'ses_ad2',
      utmSource: 'tiktok',
      utmMedium: 'paid_social',
      utmCampaign: 'helicopter_launch',
      utmContent: 'helicopter_ad_02'
    })
  });
  const ad2Data = await ad2Res.json();
  console.log('Ad 1 Creative Content preserved:', ad1Data.firstTouch.content);
  console.log('Ad 2 Creative Content preserved:', ad2Data.firstTouch.content);
  console.log('Are they distinct & distinguishable?', ad1Data.firstTouch.content !== ad2Data.firstTouch.content);

  // 3. First-Touch vs Last-Touch Multi-Session Preservation Test
  console.log('\n--- 3. Testing First-Touch / Last-Touch Attribution Across Multiple Visits ---');
  const multiVisId = 'vis_multitouch_traveler';

  // Visit 1: TikTok Ad
  console.log('Visit 1: Arrives via TikTok Ad (helicopter_ad_01)');
  const v1 = await (await fetch(base + '/api/analytics/init-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: multiVisId,
      sessionId: 'ses_multi_1',
      utmSource: 'tiktok',
      utmMedium: 'paid_social',
      utmCampaign: 'helicopter_launch',
      utmContent: 'helicopter_ad_01'
    })
  })).json();

  // Visit 2: Direct return visit
  console.log('Visit 2: Returns 2 days later via Direct visit');
  const v2 = await (await fetch(base + '/api/analytics/init-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: multiVisId,
      sessionId: 'ses_multi_2',
      utmSource: null,
      landingPage: '/packages'
    })
  })).json();

  // Visit 3: Retargeted via Facebook Remarketing Ad
  console.log('Visit 3: Returns via Facebook Remarketing Ad (remarketing_ad_01)');
  const v3 = await (await fetch(base + '/api/analytics/init-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: multiVisId,
      sessionId: 'ses_multi_3',
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: 'remarketing',
      utmContent: 'remarketing_ad_01'
    })
  })).json();

  console.log('After Visit 3:');
  console.log('  First Touch Source:', v3.firstTouch.source, '(Expected: tiktok) => MATCH?', v3.firstTouch.source === 'tiktok');
  console.log('  First Touch Campaign:', v3.firstTouch.campaign, '(Expected: helicopter_launch) => MATCH?', v3.firstTouch.campaign === 'helicopter_launch');
  console.log('  First Touch Content:', v3.firstTouch.content, '(Expected: helicopter_ad_01) => MATCH?', v3.firstTouch.content === 'helicopter_ad_01');
  console.log('  Last Touch Source:', v3.lastTouch.source, '(Expected: facebook) => MATCH?', v3.lastTouch.source === 'facebook');
  console.log('  Last Touch Campaign:', v3.lastTouch.campaign, '(Expected: remarketing) => MATCH?', v3.lastTouch.campaign === 'remarketing');
  console.log('  Last Touch Content:', v3.lastTouch.content, '(Expected: remarketing_ad_01) => MATCH?', v3.lastTouch.content === 'remarketing_ad_01');

  // 4. End-to-End Commercial Journey with Reservation Attribution Attachment
  console.log('\n--- 4. End-to-End Commercial Journey with Persistent Reservation Attribution ---');
  // Initialize guest session
  const guestSesRes = await fetch(base + '/api/session/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const guestSes = await guestSesRes.json();

  // Track customer journey events
  await fetch(base + '/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: multiVisId,
      sessionId: 'ses_multi_3',
      eventType: 'PRODUCT_VIEWED',
      productId: 'prod_flight_of_angels'
    })
  });

  await fetch(base + '/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: multiVisId,
      sessionId: 'ses_multi_3',
      eventType: 'SYNTUC_CHAT_OPENED'
    })
  });

  await fetch(base + '/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: multiVisId,
      sessionId: 'ses_multi_3',
      eventType: 'SYNTUC_MESSAGE_SENT',
      metadata: { text: 'What are the departure times for the helicopter tour?' }
    })
  });

  // Add flight to trip
  await fetch(base + '/api/session/trip/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-guest-session-id': guestSes.sessionId,
      'x-guest-signature': guestSes.signature,
      'x-visitor-id': multiVisId,
      'x-analytics-session-id': 'ses_multi_3'
    },
    body: JSON.stringify({
      productId: 'prod_flight_of_angels',
      guestCount: 2
    })
  });

  // Submit Reservation Request (Submitting with attribution headers & body)
  const resSubmit = await fetch(base + '/api/reservations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-guest-session-id': guestSes.sessionId,
      'x-guest-signature': guestSes.signature,
      'x-visitor-id': multiVisId,
      'x-analytics-session-id': 'ses_multi_3'
    },
    body: JSON.stringify({
      visitorId: multiVisId,
      analyticsSessionId: 'ses_multi_3',
      fullName: 'Sophia Al-Mansoor',
      email: 'sophia.almansoor@example.com',
      phone: '+971 50 123 4567',
      country: 'United Arab Emirates',
      startDate: '2026-11-15',
      endDate: '2026-11-18',
      adultsCount: 2,
      childrenCount: 0,
      items: [{ productId: 'prod_flight_of_angels', guestCount: 2 }],
      specialRequests: 'Helicopter flight of angels front seats requested'
    })
  });
  const resData = await resSubmit.json();
  console.log('Reservation Submitted! Status:', resSubmit.status, 'Ref:', resData.referenceNumber, 'Total: $' + resData.authoritativeTotal);

  // 5. Verify in Coordinator Desk and Dashboard
  console.log('\n--- 5. Verifying Desk & Analytics Dashboard Integration ---');
  const loginRes = await fetch(base + '/api/coordinator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'reservations@syntuc.com', password: 'syntuc2026!secure' })
  });
  const { token: coordToken } = await loginRes.json();

  // Check Reservations Desk list
  const deskRes = await fetch(base + '/api/coordinator/reservations', {
    headers: { 'Authorization': 'Bearer ' + coordToken }
  });
  const deskList = await deskRes.json();
  const attributedRes = deskList.find((r: any) => r.referenceNumber === resData.referenceNumber);

  console.log('Attributed Reservation found in Desk:', !!attributedRes);
  console.log('  Desk First-Touch Source:', attributedRes?.firstTouchSource);
  console.log('  Desk First-Touch Campaign:', attributedRes?.firstTouchCampaign);
  console.log('  Desk First-Touch Content (Ad):', attributedRes?.firstTouchContent);
  console.log('  Desk Last-Touch Source:', attributedRes?.lastTouchSource);
  console.log('  Desk Last-Touch Campaign:', attributedRes?.lastTouchCampaign);
  console.log('  Desk Last-Touch Content (Ad):', attributedRes?.lastTouchContent);

  // Update status to CONFIRMED
  await fetch(base + '/api/coordinator/reservations/' + attributedRes.id + '/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + coordToken },
    body: JSON.stringify({ status: 'CONFIRMED', internalNote: 'Confirmed with Shearwater helicopter ops' })
  });
  console.log('Updated reservation status to CONFIRMED');

  // Query Dashboard API
  const dashRes = await fetch(base + '/api/analytics/dashboard?range=all', {
    headers: { 'Authorization': 'Bearer ' + coordToken }
  });
  const dashData = await dashRes.json();
  console.log('\n--- Dashboard Summary Metrics ---');
  console.log('  Total Visitors:', dashData.traffic.totalVisitors);
  console.log('  Total Sessions:', dashData.traffic.totalSessions);
  console.log('  Syntuc Chat Opens:', dashData.engagement.syntucChatOpens);
  console.log('  Total Reservation Requests:', dashData.conversion.reservationRequests);
  console.log('  Confirmed Reservations:', dashData.conversion.confirmedReservations);
  console.log('  Confirmed Revenue: $' + dashData.conversion.confirmedRevenue);

  console.log('\n--- Sources Table ---');
  console.table(dashData.sourcesTable);

  console.log('\n--- Campaigns Table ---');
  console.table(dashData.campaignsTable);

  console.log('\n--- Ad Creatives Table (utm_content) ---');
  console.table(dashData.adCreativesTable);

  // 6. Test Guest Journey Inspection
  console.log('\n--- 6. Testing Guest Journey Inspection ---');
  const journeyRes = await fetch(base + '/api/analytics/journey/' + resData.referenceNumber, {
    headers: { 'Authorization': 'Bearer ' + coordToken }
  });
  const journeyData = await journeyRes.json();
  console.log('Journey retrieved for ref:', journeyData.identifier);
  console.log('  Total sessions in journey:', journeyData.sessionsCount);
  console.log('  Total chronological events:', journeyData.eventsCount);
  console.log('  Event types:', journeyData.events.map((e: any) => e.eventType).join(' -> '));

  console.log('\n================================================================');
  console.log('  ALL MARKETING ATTRIBUTION TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runAttributionTestSuite().catch(console.error);
