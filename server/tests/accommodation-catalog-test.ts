import assert from 'node:assert/strict';
import {
  accommodationCatalogImport,
  PRESERVED_ACCOMMODATION_CANONICALS,
  SAFEGUARD_DISTINCTIONS,
} from '../data/accommodationCatalogImport.ts';
import fs from 'fs';
import path from 'path';

console.log('--- Testing Accommodation Catalogue Content & Structure ---');

// 1. Verify exact 24 candidates
assert.equal(accommodationCatalogImport.length, 24, 'Exactly 24 accommodation candidates must be defined');

const budgetCandidates = accommodationCatalogImport.filter((c) => c.classification === 'Budget');
const midRangeCandidates = accommodationCatalogImport.filter((c) => c.classification === 'Mid-range');
const luxuryCandidates = accommodationCatalogImport.filter((c) => c.classification === 'Luxury');

assert.equal(budgetCandidates.length, 8, 'Must have exactly 8 Budget candidates');
assert.equal(midRangeCandidates.length, 8, 'Must have exactly 8 Mid-range candidates');
assert.equal(luxuryCandidates.length, 8, 'Must have exactly 8 Luxury candidates');

// Check fixed classifications: Dzimbahwe = Budget, Kasambabezi = Mid-range
const dzimbahwe = accommodationCatalogImport.find((c) => c.name === 'Dzimbahwe Guest Lodge');
assert.ok(dzimbahwe, 'Dzimbahwe Guest Lodge must exist');
assert.equal(dzimbahwe.classification, 'Budget', 'Dzimbahwe Guest Lodge classification must remain Budget');

const kasambabezi = accommodationCatalogImport.find((c) => c.name === 'Kasambabezi Lodge');
assert.ok(kasambabezi, 'Kasambabezi Lodge must exist');
assert.equal(kasambabezi.classification, 'Mid-range', 'Kasambabezi Lodge classification must remain Mid-range');

// 2. Validate paired descriptions, source references, and verification notes
for (const item of accommodationCatalogImport) {
  assert.ok(item.name.trim().length > 0, `Name must not be empty`);
  assert.equal(item.productType, 'accommodation', `${item.name} must have productType accommodation`);
  assert.ok(item.shortDescription.trim().length > 20, `${item.name} must have a valid short description`);
  assert.ok(item.fullDescription.trim().length > 50, `${item.name} must have a valid full description`);
  assert.notEqual(item.shortDescription, item.fullDescription, `${item.name} short and full descriptions must be distinct`);
  assert.ok(item.sourceReference.trim().length > 5, `${item.name} must have a source reference`);
  assert.ok(item.verificationNotes.length > 0, `${item.name} must have at least one verification note`);

  // Unknown prices must remain null / unknown
  assert.equal(item.basePrice, null, `${item.name} price must remain null (unknown), never 0 or estimated`);
  assert.equal(item.priceBasis, null, `${item.name} priceBasis must remain null`);
}

// 3. Verify JSON payload matches TypeScript definition
const jsonPath = path.resolve(process.cwd(), 'server/data/accommodation-catalog-v1.json');
assert.ok(fs.existsSync(jsonPath), 'accommodation-catalog-v1.json payload file must exist');
const jsonPayload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
assert.equal(jsonPayload.items.length, 24, 'JSON payload must contain exactly 24 items');

for (let i = 0; i < 24; i++) {
  assert.equal(jsonPayload.items[i].name, accommodationCatalogImport[i].name, `Item ${i} name must match in JSON`);
  assert.equal(jsonPayload.items[i].classification, accommodationCatalogImport[i].classification, `Item ${i} classification must match in JSON`);
  assert.equal(jsonPayload.items[i].basePrice, null, `Item ${i} basePrice must be null in JSON`);
  assert.equal(jsonPayload.items[i].shortDescription, accommodationCatalogImport[i].shortDescription);
  assert.equal(jsonPayload.items[i].fullDescription, accommodationCatalogImport[i].fullDescription);
}

// 4. Verify canonical preserved accommodation records list
assert.equal(PRESERVED_ACCOMMODATION_CANONICALS.length, 5, 'Must protect exactly 5 canonical accommodation records');
const preservedNames = PRESERVED_ACCOMMODATION_CANONICALS.map((c) => c.name);
assert.ok(preservedNames.includes('Old Drift Lodge'));
assert.ok(preservedNames.includes("A'Zambezi River Lodge"));
assert.ok(preservedNames.includes('Victoria Falls Rainbow Hotel'));
assert.ok(preservedNames.includes('Shearwater Explorers Village'));
assert.ok(preservedNames.includes('The Elephant Camp'));

// 5. Verify safeguard distinctions
assert.equal(SAFEGUARD_DISTINCTIONS.length, 3, 'Must define 3 specific safeguard distinctions');

console.log('✓ Accommodation catalogue static and schema validation passed successfully!');
