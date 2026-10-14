import assert from 'node:assert/strict';
import { operatorCatalogImport, resolveOperatorMappings } from '../data/operatorCatalogImport.ts';

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

assert.ok(operatorCatalogImport.length > 0, 'catalog import data must not be empty');

const allowedOperators = new Set(['Wild Horizons', 'Shearwater', 'Pure Africa']);
const keys = new Set<string>();

for (const item of operatorCatalogImport) {
  assert.ok(allowedOperators.has(item.operatorName), `unexpected operator: ${item.operatorName}`);
  assert.ok(item.name.trim().length > 0, 'product name must not be empty');
  assert.ok(Number.isFinite(item.basePrice) && item.basePrice > 0, `invalid price for ${item.name}`);
  assert.ok(item.sourceReference.trim().length > 0, `source reference missing for ${item.name}`);
  assert.ok(Array.isArray(item.mandatoryFees), `fee list missing for ${item.name}`);
  assert.ok(Array.isArray(item.verificationNotes), `verification notes missing for ${item.name}`);

  const key = `${normalize(item.operatorName)}::${normalize(item.name)}`;
  assert.ok(!keys.has(key), `duplicate operator/product key: ${key}`);
  keys.add(key);

  for (const charge of item.mandatoryFees) {
    assert.equal(charge.currency, 'USD');
    assert.ok(charge.amount === null || (Number.isFinite(charge.amount) && charge.amount >= 0));
  }
}

assert.ok(operatorCatalogImport.some((item) => item.operatorName === 'Wild Horizons'));
assert.ok(operatorCatalogImport.some((item) => item.operatorName === 'Shearwater'));
assert.ok(operatorCatalogImport.some((item) => item.operatorName === 'Pure Africa'));
assert.ok(operatorCatalogImport.some((item) => item.operatorName === 'Pure Africa' && item.name === 'Zambezi Explorer Luxury Sunset Cruise' && item.basePrice === 69 && item.authoritativeOverride));
assert.ok(operatorCatalogImport.some((item) => item.productType === 'package'));
console.log(`Operator catalog import data passed validation: ${operatorCatalogImport.length} records.`);


const missingMappings = resolveOperatorMappings([]);
assert.deepEqual(missingMappings.operatorIds, { 'Wild Horizons': null, 'Shearwater': null, 'Pure Africa': null });
assert.equal(missingMappings.issues.length, 3);

const duplicateMappings = resolveOperatorMappings([
  { id: 'wh-1', name: 'Wild Horizons' }, { id: 'wh-2', name: 'Wild Horizons Safaris' },
  { id: 'sh-1', name: 'Shearwater Victoria Falls' }, { id: 'pa-1', name: 'Pure Africa Experiences' },
]);
assert.equal(duplicateMappings.operatorIds['Wild Horizons'], null);
assert.equal(duplicateMappings.issues.length, 1);
assert.equal(duplicateMappings.issues[0].operator, 'Wild Horizons');

const validMappings = resolveOperatorMappings([
  { id: 'wh-1', name: 'Wild Horizons' }, { id: 'sh-1', name: 'Shearwater Victoria Falls' },
  { id: 'pa-1', name: 'Pure Africa Experiences' },
]);
assert.deepEqual(validMappings.operatorIds, { 'Wild Horizons': 'wh-1', 'Shearwater': 'sh-1', 'Pure Africa': 'pa-1' });
assert.equal(validMappings.issues.length, 0);
