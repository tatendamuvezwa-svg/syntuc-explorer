import { initializeDatabase, db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import {
  getDeletedTombstones,
  hydrateFromFirestore,
  ensureCanonicalCloudSeed,
  syncUnpersistedLocalMedia,
  reconcileAuthoritativeMediaAndPrimaries,
  persistProductToFirestore,
  persistMediaAssetToFirestore,
  deleteMediaAssetFromFirestore,
  deleteReservationFromFirestore,
  recordTombstoneInFirestore,
  persistReservationToFirestore,
  getFirestoreDb,
} from '../services/firestoreSync.ts';
import { seedMasterReferenceData, seedBootstrapCatalog, seedFallbackMediaAssets } from '../db/seed.ts';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export async function runForensicVerification() {
  console.log('=== RUNNING TARGETED FORENSIC VERIFICATION SUITE ===');
  const fdb = getFirestoreDb()!;

  // 1. Initial Boot Lifecycle
  console.log('\n--- LIFECYCLE 1: Clean Engine Initialization ---');
  await initializeDatabase();
  const initTombstones = await getDeletedTombstones();
  await seedMasterReferenceData();
  const bootHydration = await hydrateFromFirestore(initTombstones);
  await seedBootstrapCatalog(initTombstones);
  await seedFallbackMediaAssets(initTombstones);
  await ensureCanonicalCloudSeed(initTombstones);
  await syncUnpersistedLocalMedia(initTombstones, bootHydration.hydratedMediaIds);
  await reconcileAuthoritativeMediaAndPrimaries(initTombstones);
  console.log(`[Lifecycle 1] Hydration: ${bootHydration.productsRestored} products, ${bootHydration.mediaRestored} media, ${bootHydration.reservationsRestored} reservations restored.`);

  // 2. CATEGORY A & D: Catalog Product & Video Hyperlink Customization
  console.log('\n--- CATEGORY A & D: Product Customization & Video Hyperlink ---');
  const targetProdId = 'prod_flight_of_angels';
  const customVideoUrl = 'https://www.youtube.com/watch?v=ANGELS_FLIGHT_4K_HDR';
  const customDescription = 'FORENSIC TEST: Exclusive pilot commentary and enhanced helicopter routing.';

  await db.update(schema.products).set({
    videoUrl: customVideoUrl,
    description: customDescription,
    basePrice: '185.00',
    updatedAt: new Date(),
  }).where(eq(schema.products.id, targetProdId));

  const updatedProd = (await db.select().from(schema.products).where(eq(schema.products.id, targetProdId)))[0];
  await persistProductToFirestore(updatedProd);

  const fProdDoc = await getDoc(doc(fdb, 'products', targetProdId));
  const fVideoMatch = fProdDoc.data()?.videoUrl === customVideoUrl;
  console.log('Firestore Product videoUrl verified:', fVideoMatch ? 'PASS' : 'FAIL', fProdDoc.data()?.videoUrl);

  // 3. CATEGORY B: Deleted Media & Durable Tombstones
  console.log('\n--- CATEGORY B: Media Deletion & Tombstone Prevention ---');
  const testDeleteMediaId = 'med_del_test_' + Date.now();
  const mediaToDel = {
    id: testDeleteMediaId,
    ownerType: 'product',
    ownerId: targetProdId,
    mediaType: 'IMAGE',
    url: 'https://images.unsplash.com/photo-generic-to-delete',
    thumbnailUrl: 'https://images.unsplash.com/photo-generic-to-delete',
    isPrimary: false,
    displayOrder: 99,
    sourceName: 'Seed Test',
    verificationState: 'ESTABLISHED',
  };
  await db.insert(schema.mediaAssets).values(mediaToDel as any);
  await persistMediaAssetToFirestore(mediaToDel as any);

  // Perform legitimate deletion via service helpers
  await recordTombstoneInFirestore('media_assets', testDeleteMediaId);
  await deleteMediaAssetFromFirestore(testDeleteMediaId);
  await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, testDeleteMediaId));

  const fDeletedSnap = await getDoc(doc(fdb, 'media_assets', testDeleteMediaId));
  const fTombSnap = await getDoc(doc(fdb, 'deleted_records', `media_assets_${testDeleteMediaId}`));
  console.log('Media deleted from Firestore collection:', !fDeletedSnap.exists() ? 'PASS' : 'FAIL');
  console.log('Durable tombstone recorded in Firestore:', fTombSnap.exists() ? 'PASS' : 'FAIL');

  // 4. CATEGORY C: Custom Chunked Media Upload
  console.log('\n--- CATEGORY C: Custom Chunked Media Upload & Storage ---');
  const customMediaId = 'med_custom_hi_res_' + Date.now();
  // Generate large 450KB payload (exceeds single Firestore chunk limit safely)
  const largeBase64 = 'data:image/jpeg;base64,' + 'B'.repeat(450 * 1024);
  const customAsset = {
    id: customMediaId,
    ownerType: 'product',
    ownerId: targetProdId,
    mediaType: 'IMAGE',
    url: largeBase64,
    thumbnailUrl: largeBase64,
    isPrimary: true,
    displayOrder: 0,
    sourceName: 'Coordinator Upload',
    verificationState: 'ESTABLISHED',
    createdAt: new Date(),
  };
  await db.insert(schema.mediaAssets).values(customAsset as any);
  await persistMediaAssetToFirestore(customAsset as any);
  await db.update(schema.products).set({ primaryMediaId: customMediaId }).where(eq(schema.products.id, targetProdId));
  await persistProductToFirestore((await db.select().from(schema.products).where(eq(schema.products.id, targetProdId)))[0]);

  const fCustomSnap = await getDoc(doc(fdb, 'media_assets', customMediaId));
  console.log('Custom media stored chunked in Firestore:', fCustomSnap.data()?.isChunked === true ? 'PASS' : 'FAIL');
  console.log('Custom media chunk count:', fCustomSnap.data()?.totalChunks);

  // 5. CATEGORY E: Live Guest Reservation & Items Persistence
  console.log('\n--- CATEGORY E: Live Reservation & Line Items Persistence ---');
  const testResId = 'res_forensic_live_' + Date.now();
  const testRef = 'SYN-VF-88771';
  const testGuestId = 'gst_forensic_' + Date.now();
  const testGuest = {
    id: testGuestId,
    fullName: 'David Livingstone',
    email: 'david.livingstone@expedition.org',
    phone: '+263 78 555 1234',
    country: 'United Kingdom',
    createdAt: new Date(),
  };
  await db.insert(schema.guests).values(testGuest);

  await db.insert(schema.guestSessions).values({
    id: 'ses_david_livingstone',
    guestId: testGuestId,
    sessionSecret: 'secret_david_livingstone',
    createdAt: new Date(),
    lastActiveAt: new Date(),
  }).onConflictDoNothing();

  const testRes = {
    id: testResId,
    referenceNumber: testRef,
    requestType: 'STANDARD',
    guestId: testGuestId,
    guestSessionId: 'ses_david_livingstone',
    tripPlanId: null,
    status: 'REVIEWED',
    startDate: '2026-11-28',
    endDate: '2026-12-02',
    adultsCount: 2,
    childrenCount: 0,
    authoritativeTotal: '370.00',
    currency: 'USD',
    specialRequests: 'Historical vantage points request.',
    isBridgeIncentiveApplied: false,
    schoolMetadata: null,
    assignedStaffId: 'usr_coord_1',
    visitorId: 'vis_test_david',
    firstTouchSource: 'partner_direct',
    firstTouchMedium: 'referral',
    firstTouchCampaign: null,
    firstTouchContent: null,
    firstTouchTerm: null,
    firstTouchReferrer: null,
    lastTouchSource: 'direct',
    lastTouchMedium: 'none',
    lastTouchCampaign: null,
    lastTouchContent: null,
    lastTouchTerm: null,
    lastTouchReferrer: null,
    attributionConfidence: 'DIRECT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(schema.reservationRequests).values(testRes as any);

  const testItem = {
    id: 'ri_forensic_item_' + Date.now(),
    reservationRequestId: testResId,
    productId: targetProdId,
    roomId: null,
    variantId: null,
    snapshotProductName: 'Flight of Angels — Scenic Helicopter Tour',
    snapshotOperatorName: 'Shearwater Victoria Falls',
    snapshotProductType: 'activity',
    snapshotUnitPrice: '185.00',
    snapshotPriceBasis: 'per_person',
    snapshotCurrency: 'USD',
    guestCount: 2,
    nightsCount: 1,
    calculatedSubtotal: '370.00',
    scheduledDate: '2026-11-29',
    scheduledTime: '10:30',
    notes: 'Historical memorial view',
    createdAt: new Date(),
  };
  await db.insert(schema.reservationItems).values(testItem as any);

  // Persist reservation & line items to Cloud Firestore
  await persistReservationToFirestore(testRes as any, [testItem as any], testGuest as any);

  console.log('\n=============================================================');
  console.log('--- RESTART LIFECYCLE: FULL IN-MEMORY RELATIONAL WIPE & REBOOT ---');
  console.log('=============================================================');

  // Complete clean in-memory database wipe and re-execution of startup lifecycle:
  await initializeDatabase();
  const restartTombstones = await getDeletedTombstones();
  await seedMasterReferenceData();
  const restartHydration = await hydrateFromFirestore(restartTombstones);
  await seedBootstrapCatalog(restartTombstones);
  await seedFallbackMediaAssets(restartTombstones);
  await ensureCanonicalCloudSeed(restartTombstones);
  await syncUnpersistedLocalMedia(restartTombstones, restartHydration.hydratedMediaIds);
  await reconcileAuthoritativeMediaAndPrimaries(restartTombstones);

  console.log(`[Post-Restart] Hydration: ${restartHydration.productsRestored} products, ${restartHydration.mediaRestored} media, ${restartHydration.reservationsRestored} reservations restored.`);

  console.log('\n--- POST-RESTART FORENSIC INTEGRITY AUDIT ---');

  // 1. Check Product & Video URL
  const prodPostRestart = (await db.select().from(schema.products).where(eq(schema.products.id, targetProdId)))[0];
  const videoSurvives = prodPostRestart?.videoUrl === customVideoUrl;
  const descSurvives = prodPostRestart?.description === customDescription;
  const primarySurvives = prodPostRestart?.primaryMediaId === customMediaId;
  console.log('Product custom videoUrl survived lifecycle restart:', videoSurvives ? 'PASS' : 'FAIL', prodPostRestart?.videoUrl);
  console.log('Product custom description survived lifecycle restart:', descSurvives ? 'PASS' : 'FAIL');
  console.log('Product primaryMediaId points to custom upload:', primarySurvives ? 'PASS' : 'FAIL', prodPostRestart?.primaryMediaId);

  // 2. Check Deleted Media
  const deletedMediaInDb = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, testDeleteMediaId));
  const tombstoneProtects = deletedMediaInDb.length === 0;
  console.log('Deleted media NOT resurrected in DB:', tombstoneProtects ? 'PASS' : 'FAIL');

  // 3. Check Custom Media
  const customMediaInDb = (await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, customMediaId)))[0];
  const customRestored = Boolean(customMediaInDb);
  const payloadIntact = customMediaInDb?.url === largeBase64;
  const isPrimaryInDb = customMediaInDb?.isPrimary === true;
  console.log('Custom media restored in DB:', customRestored ? 'PASS' : 'FAIL');
  console.log('Custom media payload perfectly reconstructed from chunks:', payloadIntact ? 'PASS' : 'FAIL', 'Length:', customMediaInDb?.url?.length);
  console.log('Custom media has isPrimary = true:', isPrimaryInDb ? 'PASS' : 'FAIL');

  // 4. Check Reservation & Line Items
  const resInDb = (await db.select().from(schema.reservationRequests).where(eq(schema.reservationRequests.id, testResId)))[0];
  const resSurvives = Boolean(resInDb);
  const itemsInDb = await db.select().from(schema.reservationItems).where(eq(schema.reservationItems.reservationRequestId, testResId));
  const itemsSurvive = itemsInDb.length === 1;
  console.log('Reservation restored in DB after lifecycle restart:', resSurvives ? 'PASS' : 'FAIL', resInDb?.referenceNumber);
  console.log('Reservation line items restored after lifecycle restart:', itemsSurvive ? 'PASS' : 'FAIL', 'Count:', itemsInDb.length);
  console.log('Restored line item product snapshot:', itemsInDb[0]?.snapshotProductName, 'Total:', resInDb?.authoritativeTotal);

  // Clean up transient test records from Firestore
  console.log('\n--- CLEANING UP TRANSIENT VERIFICATION RECORDS ---');
  await deleteReservationFromFirestore(testResId);
  await deleteMediaAssetFromFirestore(customMediaId);
  await deleteDoc(doc(fdb, 'deleted_records', `media_assets_${testDeleteMediaId}`));

  const allPassed =
    videoSurvives &&
    descSurvives &&
    primarySurvives &&
    tombstoneProtects &&
    customRestored &&
    payloadIntact &&
    isPrimaryInDb &&
    resSurvives &&
    itemsSurvive;

  console.log(`\n=== OVERALL INTEGRITY AUDIT RESULT: ${allPassed ? 'ALL TESTS PASSED (100% SUCCESS)' : 'FAILURES DETECTED'} ===`);
  return { allPassed };
}

if (process.argv[1]?.includes('forensic-verification')) {
  runForensicVerification()
    .then(r => process.exit(r.allPassed ? 0 : 1))
    .catch(e => {
      console.error('Forensic test suite failed:', e);
      process.exit(1);
    });
}
