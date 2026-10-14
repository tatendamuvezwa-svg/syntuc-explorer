import assert from 'node:assert/strict';
import { operatorCatalogImport } from '../data/operatorCatalogImport.ts';

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

assert.ok(operatorCatalogImport.length > 0, 'catalog import data must not be empty');

const allowedOperators = new Set(['Wild Horizons', 'Shearwater']);
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
assert.ok(operatorCatalogImport.some((item) => item.productType === 'package'));
console.log(`Operator catalog import data passed validation: ${operatorCatalogImport.length} records.`);
