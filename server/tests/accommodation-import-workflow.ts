import assert from 'node:assert/strict';
import { getDocById, updateDocById, getCollectionDocs } from '../lib/firestore.ts';
import { PRESERVED_ACCOMMODATION_CANONICALS } from '../data/accommodationCatalogImport.ts';

const API_BASE = 'http://localhost:3000/api';

async function main() {
  console.log('=== Accommodation Catalogue Import Workflow Test ===\n');

  // Step 1: Coordinator Admin Authentication
  console.log('Step 1: Authenticating as Coordinator Administrator...');
  const loginRes = await fetch(`${API_BASE}/coordinator/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@saintech.io', password: 'saintech2026!admin' }),
  });
  assert.equal(loginRes.status, 200, 'Coordinator admin login must succeed');
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert.ok(token, 'Auth token must be returned');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✓ Administrator authentication confirmed.\n');

  // Step 2: Validate existing 5 accommodation records prior to import
  console.log('Step 2: Checking existing 5 baseline accommodation records...');
  const azambeziBefore = await getDocById<any>('products', 'prod_azambezi');
  assert.ok(azambeziBefore, "A'Zambezi River Lodge must exist");
  assert.equal(azambeziBefore.basePrice, '220', "A'Zambezi rate must be 220");
  assert.equal(azambeziBefore.isPublished, true, "A'Zambezi must be published");
  assert.ok(azambeziBefore.shortDescription.includes('Zambezi River beside Zambezi National Park'));
  assert.ok(azambeziBefore.description.includes('Amulonga Restaurant'));

  const oldDriftBefore = await getDocById<any>('products', 'prod_olddrift');
  assert.ok(oldDriftBefore, 'Old Drift Lodge must exist');
  assert.equal(oldDriftBefore.basePrice, '1087');
  console.log('✓ Preserved baseline accommodation records verified.\n');

  // Step 3: Trigger Catalogue Import via Reservations Desk Import endpoint
  console.log('Step 3: Triggering Import Operator Price Lists & Accommodation...');
  const importRes = await fetch(`${API_BASE}/coordinator/catalog/import-operator-pricelists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert.ok([200, 207].includes(importRes.status), `Import response must be 200/207, got ${importRes.status}`);
  const importResult = await importRes.json();
  console.log('Import result summary:', {
    created: importResult.created,
    alreadyImported: importResult.alreadyImported,
    existingNeedsManualReview: importResult.existingNeedsManualReview,
    errorsCount: (importResult.errors || []).length,
  });

  // Step 4: Verify all 24 candidates are in products as unpublished drafts
  console.log('Step 4: Verifying the 24 accommodation candidates in catalogue...');
  const coordProductsRes = await fetch(`${API_BASE}/coordinator/products`, { headers });
  assert.equal(coordProductsRes.status, 200, 'Coordinator products must return 200');
  const allProducts: any[] = await coordProductsRes.json();

  const importedAccommodations = allProducts.filter(
    (p) => p.productType === 'accommodation' && p.catalogImportKey?.startsWith('accommodation-catalog-v1:')
  );
  console.log(`Found ${importedAccommodations.length} imported accommodation candidates.`);
  assert.equal(importedAccommodations.length, 24, 'All 24 accommodation candidates must exist in coordinator catalogue');

  const budgetItems = importedAccommodations.filter((p) => p.classification === 'Budget');
  const midItems = importedAccommodations.filter((p) => p.classification === 'Mid-range');
  const luxItems = importedAccommodations.filter((p) => p.classification === 'Luxury');

  assert.equal(budgetItems.length, 8, '8 Budget accommodation candidates');
  assert.equal(midItems.length, 8, '8 Mid-range accommodation candidates');
  assert.equal(luxItems.length, 8, '8 Luxury accommodation candidates');

  // Check specific candidate properties
  for (const acc of importedAccommodations) {
    assert.equal(acc.isPublished, false, `${acc.name} must be UNPUBLISHED`);
    assert.equal(acc.basePrice, null, `${acc.name} basePrice must remain null/unknown`);
    assert.equal(acc.priceBasis, null, `${acc.name} priceBasis must remain null`);
    assert.ok(acc.shortDescription && acc.shortDescription.length > 20, `${acc.name} shortDescription must exist`);
    assert.ok(acc.description && acc.description.length > 50, `${acc.name} full description must exist`);
    assert.ok(acc.sourceReference, `${acc.name} sourceReference must exist`);
    assert.ok(acc.verificationNotes && acc.verificationNotes.length > 0, `${acc.name} must have verification notes`);
  }

  // Check Dzimbahwe and Kasambabezi classifications
  const dzimbahwe = importedAccommodations.find((p) => p.name === 'Dzimbahwe Guest Lodge');
  assert.ok(dzimbahwe);
  assert.equal(dzimbahwe.classification, 'Budget', 'Dzimbahwe Guest Lodge must be Budget');

  const kasambabezi = importedAccommodations.find((p) => p.name === 'Kasambabezi Lodge');
  assert.ok(kasambabezi);
  assert.equal(kasambabezi.classification, 'Mid-range', 'Kasambabezi Lodge must be Mid-range');

  console.log('✓ All 24 candidates verified with paired descriptions, null basePrice, and draft status.\n');

  // Step 5: Verification Gate Controls: Publishing unverified draft must be blocked
  console.log('Step 5: Testing publication gate on unverified draft...');
  const testCandidate = importedAccommodations.find((p) => p.catalogImportStatus !== 'VERIFIED') || importedAccommodations[0];
  const publishBlockedRes = await fetch(`${API_BASE}/coordinator/products/${testCandidate.id}/publish`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isPublished: true }),
  });
  assert.equal(
    publishBlockedRes.status,
    409,
    'Publishing unverified draft must return 409 CATALOG_VERIFICATION_REQUIRED'
  );
  console.log('✓ Publication gate correctly blocked unverified draft.\n');

  // Step 6: Explicit Administrator Verification
  console.log('Step 6: Testing explicit administrator verification...');
  const verifyRes = await fetch(`${API_BASE}/coordinator/products/${testCandidate.id}/verify`, {
    method: 'PATCH',
    headers,
  });
  assert.equal(verifyRes.status, 200, 'Administrator verification must succeed');
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.catalogImportStatus, 'VERIFIED');

  // Verify that marking verified does NOT automatically publish!
  const allProdsRes = await fetch(`${API_BASE}/coordinator/products`, { headers });
  const allProds = await allProdsRes.json();
  const reloadedDoc = allProds.find((p: any) => p.id === testCandidate.id);
  assert.equal(reloadedDoc.catalogImportStatus, 'VERIFIED');
  assert.equal(reloadedDoc.isPublished, false, 'Marking verified must NOT automatically publish!');

  // Cleanup: Restore testCandidate back to DRAFT_NEEDS_VERIFICATION so catalogue remains strictly unpublished drafts
  await fetch(`${API_BASE}/coordinator/products/${testCandidate.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      catalogImportStatus: 'DRAFT_NEEDS_VERIFICATION',
      evidenceStatus: 'NEEDS_VERIFICATION',
      isPublished: false,
    }),
  });
  await updateDocById('products', testCandidate.id, {
    catalogImportStatus: 'DRAFT_NEEDS_VERIFICATION',
    evidenceStatus: 'NEEDS_VERIFICATION',
    isPublished: false,
  });
  console.log('✓ Verification succeeded without automatic publication (and test draft state cleaned up).\n');

  // Step 7: Idempotency: Re-running import must create 0 duplicates
  console.log('Step 7: Testing import idempotency (re-running import)...');
  const reImportRes = await fetch(`${API_BASE}/coordinator/catalog/import-operator-pricelists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert.ok([200, 207].includes(reImportRes.status));
  const reImportData = await reImportRes.json();
  assert.equal(reImportData.created, 0, 'Re-importing must create 0 new records');
  assert.ok(reImportData.alreadyImported >= 24, 'All 24 accommodation records must be skipped as alreadyImported');
  console.log(`✓ Idempotency confirmed: created=${reImportData.created}, alreadyImported=${reImportData.alreadyImported}.\n`);

  // Step 8: Custom payload with an existing canonical accommodation must not overwrite
  console.log('Step 8: Testing preservation of 5 existing accommodations against duplicate attempts...');
  const preserveTestRes = await fetch(`${API_BASE}/coordinator/catalog/import-operator-pricelists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: [
        {
          operatorName: 'Fake Test Operator',
          name: "A'Zambezi River Lodge",
          productType: 'accommodation',
          categorySlug: 'lodge-resort',
          basePrice: 50,
          priceBasis: 'per_person',
          shortDescription: 'Fake description trying to overwrite A Zambezi',
          fullDescription: 'Fake full description',
          inclusions: [],
          exclusions: [],
          mandatoryFees: [],
          sourceReference: 'fake.com',
          verificationNotes: [],
        },
      ],
    }),
  });
  assert.ok([200, 207].includes(preserveTestRes.status));
  const preserveTestData = await preserveTestRes.json();
  assert.equal(preserveTestData.created, 0, 'Must NOT create or overwrite canonical record');
  assert.equal(preserveTestData.existingNeedsManualReview, 1, 'Must flag canonical collision for manual review');
  assert.ok(
    preserveTestData.skipped.some((s: any) => s.reason.includes('Preserved baseline accommodation record')),
    'Must explain preserved canonical record in skipped reason'
  );

  const azambeziAfter = await getDocById<any>('products', 'prod_azambezi');
  assert.equal(azambeziAfter.basePrice, '220', "A'Zambezi rate must remain unchanged at 220");
  assert.ok(azambeziAfter.shortDescription.includes('Zambezi River beside Zambezi National Park'));
  console.log('✓ Canonical records are fully protected against overwrites.\n');

  // Step 9: Guest Catalogue Inspection: Unverified/unpublished candidates must NOT leak to guest view
  console.log('Step 9: Testing guest catalogue API (/api/catalog/products)...');
  const guestRes = await fetch(`${API_BASE}/catalog/products`);
  assert.equal(guestRes.status, 200);
  const guestProducts: any[] = await guestRes.json();
  const guestAccommodations = guestProducts.filter((p) => p.productType === 'accommodation');
  assert.equal(
    guestAccommodations.length,
    5,
    'Guest catalogue must contain strictly the 5 published baseline accommodations'
  );
  for (const c of importedAccommodations) {
    assert.ok(
      !guestProducts.some((p) => p.id === c.id),
      `Draft ${c.name} must NOT be visible in guest catalogue`
    );
  }
  console.log('✓ Guest catalogue contains only the 5 published accommodations.\n');

  console.log('=== All Accommodation Import & Verification Workflow Tests Passed Successfully! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Workflow test failed:', err);
  process.exit(1);
});
