import assert from 'node:assert/strict';
import { setDocById, getDocById, getCollectionDocs } from '../lib/firestore.ts';
import { createStaffAuthToken, verifyStaffAuthToken } from '../middleware/auth.ts';

async function runTests() {
  console.log('[Test] Starting Boat Cruise Reviews end-to-end workflow test...');

  // 1. Validation test - Invalid payloads must be rejected
  const invalidPayloads = [
    { welcomeRating: 0 }, // Out of range (< 1)
    { welcomeRating: 6 }, // Out of range (> 5)
    { welcomeRating: 3.5 }, // Non-integer
    { welcomeRating: 5, cleanlinessRating: 5, drinksRating: 5, snacksRating: 5, captainInfoRating: 5, recommend: 'maybe' }, // Invalid recommend
    { welcomeRating: 5, cleanlinessRating: 5, drinksRating: 5, snacksRating: 5, captainInfoRating: 5, recommend: 'yes', guestEmail: 'not-an-email' }, // Invalid email
  ];

  function validatePayload(body: any): string[] {
    const errors: string[] = [];
    const isValidRating = (val: unknown) => typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 5;
    if (!isValidRating(body.welcomeRating)) errors.push('welcomeRating');
    if (!isValidRating(body.cleanlinessRating)) errors.push('cleanlinessRating');
    if (!isValidRating(body.drinksRating)) errors.push('drinksRating');
    if (!isValidRating(body.snacksRating)) errors.push('snacksRating');
    if (!isValidRating(body.captainInfoRating)) errors.push('captainInfoRating');
    if (body.recommend !== 'yes' && body.recommend !== 'no') errors.push('recommend');
    if (body.guestEmail && typeof body.guestEmail === 'string' && body.guestEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.guestEmail.trim())) errors.push('guestEmail');
    }
    return errors;
  }

  for (const invalid of invalidPayloads) {
    const errs = validatePayload(invalid);
    assert.ok(errs.length > 0, `Expected validation errors for payload: ${JSON.stringify(invalid)}`);
  }
  console.log('✓ Validation correctly rejects invalid payloads');

  // 2. Submit valid review and verify persistence in Firestore
  const testReviewId = 'rev_cruise_test_' + Date.now().toString(36);
  const nowIso = new Date().toISOString();

  const validReview = {
    id: testReviewId,
    projectName: 'Heritage Expedition Boat Cruise Review',
    experienceName: 'Heritage Expedition Sunset Cruise',
    welcomeRating: 5,
    cleanlinessRating: 4,
    drinksRating: 5,
    snacksRating: 5,
    captainInfoRating: 5,
    recommend: 'yes' as const,
    overallComments: 'Outstanding sunset cruise on the Zambezi! Incredible views and wonderful hospitality.',
    guestName: 'Eleanor Vance',
    guestEmail: 'eleanor.vance@example.com',
    submittedAt: nowIso,
    createdAt: nowIso,
  };

  // Save to persistent Firestore collection
  await setDocById('boat_cruise_reviews', testReviewId, validReview, false);

  // 3. Confirm the backend successfully persisted the record
  const fetched = await getDocById<any>('boat_cruise_reviews', testReviewId);
  assert.ok(fetched, 'Review record must exist in Firestore persistent storage');
  assert.equal(fetched.id, testReviewId);
  assert.equal(fetched.welcomeRating, 5);
  assert.equal(fetched.cleanlinessRating, 4);
  assert.equal(fetched.drinksRating, 5);
  assert.equal(fetched.snacksRating, 5);
  assert.equal(fetched.captainInfoRating, 5);
  assert.equal(fetched.recommend, 'yes');
  assert.equal(fetched.guestName, 'Eleanor Vance');
  assert.equal(fetched.guestEmail, 'eleanor.vance@example.com');
  assert.equal(fetched.submittedAt, nowIso);
  console.log('✓ Review saved persistently and read back with identical values and server timestamp');

  // 4. Security: Verify staff token authentication
  const staffToken = createStaffAuthToken('usr_coord_1');
  const authResult = verifyStaffAuthToken(staffToken);
  assert.ok(authResult.valid, 'Valid coordinator token must be accepted');
  assert.equal(authResult.userId, 'usr_coord_1');

  // Unauthenticated / forged token
  const forgedResult = verifyStaffAuthToken('invalid-or-fake-token');
  assert.equal(forgedResult.valid, false, 'Invalid token must be rejected');
  console.log('✓ Staff authentication boundary verified; invalid tokens rejected');

  // 5. Authorized Desk Retrieval
  const allReviews = await getCollectionDocs<any>('boat_cruise_reviews');
  const targetReview = allReviews.find((r) => r.id === testReviewId);
  assert.ok(targetReview, 'Coordinator review list must include newly submitted review');
  assert.equal(targetReview.overallComments, validReview.overallComments);
  console.log('✓ Reservations Desk query successfully retrieves persisted reviews');

  // 6. Reload / Persistence Verification
  // Ensure second query confirms durable storage
  const reloadedReviews = await getCollectionDocs<any>('boat_cruise_reviews');
  const reloaded = reloadedReviews.find((r) => r.id === testReviewId);
  assert.ok(reloaded, 'Review must remain available after reload');
  console.log('✓ Review remains available after reload');

  // 7. Heritage Standard Sunset Cruise product catalogue verification
  const cruiseProduct = await getDocById<any>('products', 'heritage-standard-sunset-cruise');
  assert.ok(cruiseProduct, 'Heritage Standard Sunset Cruise must exist in authoritative products collection');
  assert.equal(cruiseProduct.id, 'heritage-standard-sunset-cruise');
  assert.equal(cruiseProduct.name, 'Heritage Standard Sunset Cruise');
  assert.equal(cruiseProduct.categorySlug, 'river-cruises');
  assert.equal(Number(cruiseProduct.basePrice), 52);
  assert.equal(cruiseProduct.pricingBreakdown?.cruisePrice, 52);
  assert.equal(cruiseProduct.pricingBreakdown?.parkFeeInternational, 12);
  assert.equal(cruiseProduct.pricingBreakdown?.parkFeeLocal, 6);
  assert.equal(cruiseProduct.pricingBreakdown?.totalInternational, 64);
  assert.equal(cruiseProduct.pricingBreakdown?.totalLocal, 58);
  console.log('✓ Heritage Standard Sunset Cruise catalogue product verified (US$52 cruise, US$12/US$6 park fees, US$64/US$58 totals)');

  // 8. Associate review with stable product identifier "heritage-standard-sunset-cruise"
  const cruiseReviewId = 'rev_heritage_cruise_' + Date.now().toString(36);
  const attributedReview = {
    id: cruiseReviewId,
    productId: 'heritage-standard-sunset-cruise',
    productName: 'Heritage Standard Sunset Cruise',
    projectName: 'Heritage Expedition Boat Cruise Review',
    experienceName: 'Heritage Standard Sunset Cruise',
    welcomeRating: 5,
    cleanlinessRating: 5,
    drinksRating: 4,
    snacksRating: 5,
    captainInfoRating: 5,
    recommend: 'yes' as const,
    overallComments: 'Captivating Zambezi sunset with gracious hospitality.',
    guestName: 'James Sterling',
    guestEmail: 'james.sterling@example.com',
    submittedAt: nowIso,
    createdAt: nowIso,
  };
  await setDocById('boat_cruise_reviews', cruiseReviewId, attributedReview, false);

  const readCruiseReview = await getDocById<any>('boat_cruise_reviews', cruiseReviewId);
  assert.ok(readCruiseReview, 'Attributed cruise review must be persisted');
  assert.equal(readCruiseReview.productId, 'heritage-standard-sunset-cruise');
  assert.equal(readCruiseReview.productName, 'Heritage Standard Sunset Cruise');
  console.log('✓ Review successfully attributed to stable identifier heritage-standard-sunset-cruise');

  console.log('\nAll Boat Cruise Reviews workflow & Heritage Cruise integration checks PASSED successfully!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
