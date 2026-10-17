import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIRMED_PRODUCT_VARIANTS } from '../services/variantCatalog.ts';

// Public and reservation-facing product records must come from Firestore, not
// from a hard-coded Pure Africa fallback list.
for (const file of [
  'server/routes/catalog.ts',
  'server/routes/coordinator.ts',
  'server/routes/session.ts',
  'server/services/pricing.ts',
]) {
  const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  assert.ok(
    !source.includes('PURE_AFRICA_FALLBACK_PRODUCTS'),
    `Unexpected embedded product fallback remains in ${file}`,
  );
}

// Keep the independent, confirmed variant rules while removing the parent
// product fallback. Parent products must exist in the authoritative catalogue.
const expectedVariantGroups: Record<string, number> = {
  prod_pure_africa_sunrise_cruise: 2,
  prod_pure_africa_lunch_cruise: 2,
  prod_zambezi_explorer_cruise: 2,
  prod_pure_africa_dinner_cruise: 1,
  prod_pure_africa_classic_dinner_cruise: 1,
  prod_pure_africa_eatery_dinner: 2,
  prod_pure_africa_eatery_dinner_sunset_combo: 2,
  prod_pure_africa_eatery_potjie_sunset_combo: 2,
};

for (const [productId, count] of Object.entries(expectedVariantGroups)) {
  const variants = CONFIRMED_PRODUCT_VARIANTS[productId] || [];
  assert.equal(variants.length, count, `Unexpected variant count for ${productId}`);
}

for (const productId of [
  'prod_pure_africa_sunrise_cruise',
  'prod_pure_africa_lunch_cruise',
  'prod_zambezi_explorer_cruise',
  'prod_pure_africa_dinner_cruise',
  'prod_pure_africa_classic_dinner_cruise',
  'prod_pure_africa_eatery_dinner_sunset_combo',
  'prod_pure_africa_eatery_potjie_sunset_combo',
]) {
  for (const variant of CONFIRMED_PRODUCT_VARIANTS[productId] || []) {
    assert.ok(
      variant.compulsoryFees?.some((fee) => fee.amount === 12 && fee.basis === 'per_person'),
      `Missing US$12 per-person National Park fee for ${variant.id}`,
    );
  }
}

for (const asset of [
  'data/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
  'data/uploads/med_c586325b4fea5fe25236ca20.jpeg',
]) {
  assert.ok(fs.existsSync(path.resolve(process.cwd(), asset)), `Missing referenced image asset: ${asset}`);
}

console.log('Catalogue source checks passed: no embedded Pure Africa product fallback; confirmed variant and fee rules retained.');
