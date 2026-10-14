import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PURE_AFRICA_FALLBACK_PRODUCTS } from '../routes/catalog.ts';
import { CONFIRMED_PRODUCT_VARIANTS } from '../services/variantCatalog.ts';

const products = PURE_AFRICA_FALLBACK_PRODUCTS;
const byId = new Map<string, any>(products.map((product: any) => [product.id, product] as [string, any]));

const requiredIds = [
  'prod_pure_africa_sunrise_cruise',
  'prod_pure_africa_lunch_cruise',
  'prod_zambezi_explorer_cruise',
  'prod_pure_africa_dinner_cruise',
  'prod_pure_africa_classic_dinner_cruise',
  'prod_pure_africa_eatery_lunch',
  'prod_pure_africa_eatery_dinner',
  'prod_pure_africa_eatery_dinner_sunset_combo',
  'prod_pure_africa_eatery_potjie_sunset_combo',
];

assert.equal(products.length, 9, 'All nine parent catalogue records should be present');
for (const id of requiredIds) assert.ok(byId.has(id), `Missing catalogue product: ${id}`);

assert.equal(Number(byId.get('prod_pure_africa_sunrise_cruise')?.basePrice), 92);
assert.equal(Number(byId.get('prod_pure_africa_lunch_cruise')?.basePrice), 92);
assert.equal(Number(byId.get('prod_zambezi_explorer_cruise')?.basePrice), 69);
assert.equal(Number(byId.get('prod_pure_africa_dinner_cruise')?.basePrice), 110);
assert.equal(Number(byId.get('prod_pure_africa_classic_dinner_cruise')?.basePrice), 185);
assert.equal(Number(byId.get('prod_pure_africa_eatery_lunch')?.basePrice), 43);
assert.equal(Number(byId.get('prod_pure_africa_eatery_dinner')?.basePrice), 49);

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

const assets = [
  'data/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
  'data/uploads/med_c586325b4fea5fe25236ca20.jpeg',
];
for (const asset of assets) {
  assert.ok(fs.existsSync(path.resolve(process.cwd(), asset)), `Missing referenced image asset: ${asset}`);
}

assert.equal(byId.get('prod_pure_africa_classic_dinner_cruise')?.minimumAgeYears, 12);
assert.match(String(byId.get('prod_pure_africa_classic_dinner_cruise')?.minimumAge), /No children under 12/);
assert.match(String(byId.get('prod_pure_africa_eatery_dinner_sunset_combo')?.schedule), /Summer 16:30/);
assert.match(String(byId.get('prod_pure_africa_eatery_potjie_sunset_combo')?.description), /three-course Potjie dinner/i);

console.log('Pure Africa catalogue checks passed: 9 parent products, official variants, fee rules, age restriction, schedules, and committed image assets.');
