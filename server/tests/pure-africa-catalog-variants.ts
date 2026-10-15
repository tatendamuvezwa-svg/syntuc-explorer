import { getDocById, getCollectionDocs, setDocById } from '../lib/firestore.ts';
import { calculateAuthoritativePricing } from '../services/pricing.ts';
import {
  getAllCoordinatorVariantsForProduct,
  createCoordinatorVariant,
  updateCoordinatorVariant,
  toggleVariantActiveState,
  resolveAuthoritativeVariant,
  getAuthoritativeVariantsForProduct,
} from '../services/variantCatalog.ts';

async function runTests() {
  console.log('=== PURE AFRICA CATALOG & COORDINATOR VARIANT MANAGEMENT TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST SECTION 1: Product Records & Genuine Media Mappings
    // ----------------------------------------------------
    console.log('[Section 1] Verifying Pure Africa Product Records & Genuine Media Bindings...');
    const cruiseProduct = await getDocById<any>('products', 'prod_zambezi_explorer_cruise');
    const potjieProduct = await getDocById<any>('products', 'prod_potjie_dining');

    assert(Boolean(cruiseProduct), 'Cruise product exists in Firestore catalog');
    assert(Number(cruiseProduct?.basePrice) === 69, `Cruise headline base price aligned to lowest available fare $69 (actual: ${cruiseProduct?.basePrice})`);
    assert(cruiseProduct?.primaryMediaId === 'med_2db2d6add31909b4f3d0adcf', `Cruise primary media bound to genuine catamaran image (med_2db2d6add31909b4f3d0adcf)`);

    assert(Boolean(potjieProduct), 'Potjie dining product exists in Firestore catalog');
    assert(potjieProduct?.basePrice === '45.00', `Potjie dining tariff is authoritative $45 (actual: ${potjieProduct?.basePrice})`);
    assert(potjieProduct?.primaryMediaId === 'med_c586325b4fea5fe25236ca20', `Potjie dining primary media bound to genuine potjie image (med_c586325b4fea5fe25236ca20)`);

    // ----------------------------------------------------
    // TEST SECTION 2: Pricing Calculations for Decks & Compulsory Fees
    // ----------------------------------------------------
    console.log('\n[Section 2] Cruise Pricing Breakdown & Compulsory Fee Handling...');

    // 2A: Luxury Deck (1 guest): $69 base + $12 fee = $81 total
    const luxuryPriced1 = await calculateAuthoritativePricing([
      {
        productId: 'prod_zambezi_explorer_cruise',
        variantId: 'var_cruise_luxury_deck',
        guestCount: 1,
        scheduledDate: '2026-10-20',
      },
    ]);
    const luxItem1 = luxuryPriced1.items[0];
    assert(luxItem1.snapshotUnitPrice === 69, `Luxury deck base fare is $69 (actual: ${luxItem1.snapshotUnitPrice})`);
    assert(luxItem1.feeBreakdown.length === 1, 'Luxury deck includes exactly 1 compulsory fee item');
    assert(luxItem1.feeBreakdown[0].amount === 12, 'Compulsory conservation fee amount is $12');
    assert(luxItem1.calculatedSubtotal === 81, `Luxury deck 1 guest total is $81 ($69 + $12) (actual: ${luxItem1.calculatedSubtotal})`);
    assert(luxuryPriced1.authoritativeTotal === 81, `Authoritative total for 1 guest luxury deck is $81 (actual: ${luxuryPriced1.authoritativeTotal})`);

    // 2B: Luxury Deck (2 guests): (2 * $69) + (2 * $12) = $162 total
    const luxuryPriced2 = await calculateAuthoritativePricing([
      {
        productId: 'prod_zambezi_explorer_cruise',
        variantId: 'var_cruise_luxury_deck',
        guestCount: 2,
        scheduledDate: '2026-10-20',
      },
    ]);
    const luxItem2 = luxuryPriced2.items[0];
    assert(luxItem2.calculatedSubtotal === 162, `Luxury deck 2 guests total is $162 (actual: ${luxItem2.calculatedSubtotal})`);
    assert(luxuryPriced2.authoritativeTotal === 162, `Authoritative total for 2 guests is $162 (actual: ${luxuryPriced2.authoritativeTotal})`);

    // 2C: Signature Deck (1 guest): $110 base + $12 fee = $122 total
    const sigPriced1 = await calculateAuthoritativePricing([
      {
        productId: 'prod_zambezi_explorer_cruise',
        variantId: 'var_cruise_signature_deck',
        guestCount: 1,
        scheduledDate: '2026-10-20',
      },
    ]);
    const sigItem1 = sigPriced1.items[0];
    assert(sigItem1.snapshotUnitPrice === 110, `Signature deck base fare is $110 (actual: ${sigItem1.snapshotUnitPrice})`);
    assert(sigItem1.calculatedSubtotal === 122, `Signature deck 1 guest total is $122 ($110 + $12) (actual: ${sigItem1.calculatedSubtotal})`);

    // 2D: Signature Deck (2 guests): (2 * $110) + (2 * $12) = $244 total
    const sigPriced2 = await calculateAuthoritativePricing([
      {
        productId: 'prod_zambezi_explorer_cruise',
        variantId: 'var_cruise_signature_deck',
        guestCount: 2,
        scheduledDate: '2026-10-20',
      },
    ]);
    assert(sigPriced2.authoritativeTotal === 244, `Signature deck 2 guests total is $244 (actual: ${sigPriced2.authoritativeTotal})`);

    // 2E: Potjie Dining (2 guests): 2 * $45 = $90 total (no compulsory park fee)
    const potjiePriced = await calculateAuthoritativePricing([
      {
        productId: 'prod_potjie_dining',
        guestCount: 2,
        scheduledDate: '2026-10-21',
      },
    ]);
    const potjieItem = potjiePriced.items[0];
    assert(potjieItem.snapshotUnitPrice === 45, `Potjie dining unit price is $45 (actual: ${potjieItem.snapshotUnitPrice})`);
    assert(potjieItem.feeBreakdown.length === 0, 'Potjie dining does not double-charge or apply national park fees');
    assert(potjiePriced.authoritativeTotal === 90, `Potjie dining 2 guests total is $90 (actual: ${potjiePriced.authoritativeTotal})`);

    // ----------------------------------------------------
    // TEST SECTION 3: Coordinator Variant Management Service
    // ----------------------------------------------------
    console.log('\n[Section 3] Coordinator Variant Management CRUD & Safety...');

    // 3A: List variants for product
    const initialVariants = await getAllCoordinatorVariantsForProduct('prod_zambezi_explorer_cruise');
    assert(initialVariants.length >= 2, `Initial variants for cruise found: ${initialVariants.length}`);
    const luxVar = initialVariants.find((v) => v.id === 'var_cruise_luxury_deck');
    const sigVar = initialVariants.find((v) => v.id === 'var_cruise_signature_deck');
    assert(Boolean(luxVar && sigVar), 'Baseline Luxury Deck and Signature Deck variants present');

    // 3B: Validation - duplicate name rejection
    let dupCaught = false;
    try {
      await createCoordinatorVariant('prod_zambezi_explorer_cruise', {
        name: luxVar?.name || 'Sunset Cruise — Luxury Deck (Decks 1 & 2)',
        price: 69,
      });
    } catch (err: any) {
      if (err.message.includes('DUPLICATE_VARIANT_NAME')) {
        dupCaught = true;
      }
    }
    assert(dupCaught, 'Rejected duplicate variant name with DUPLICATE_VARIANT_NAME');

    // 3C: Validation - invalid negative price rejection
    let negCaught = false;
    try {
      await createCoordinatorVariant('prod_zambezi_explorer_cruise', {
        name: 'Private Captain Table',
        price: -25,
      });
    } catch (err: any) {
      if (err.message.includes('INVALID_VARIANT_PRICE')) {
        negCaught = true;
      }
    }
    assert(negCaught, 'Rejected negative variant price with INVALID_VARIANT_PRICE');

    // 3D: Create custom variant
    const testVarId = `var_test_${Date.now()}`;
    const created = await createCoordinatorVariant('prod_zambezi_explorer_cruise', {
      id: testVarId,
      name: `Sunset Private Bow Lounge (${testVarId.slice(-6)})`,
      description: 'Exclusive front bow lounge for couples or small private parties.',
      price: 150,
      currency: 'USD',
      priceBasis: 'per_person',
      category: 'Private Bow',
      compulsoryFees: [
        {
          name: 'National Parks River Conservation Fee',
          amount: 12,
          currency: 'USD',
          basis: 'per_person',
        },
      ],
      supplierNote: 'Contracted special tier: US$150 + US$12 National Parks fee.',
      isActive: true,
    });
    assert(Boolean(created), `Successfully created custom variant: ${created.name} (ID: ${created.id})`);

    // Verify it is resolved and bookable
    const resolvedCreated = await resolveAuthoritativeVariant('prod_zambezi_explorer_cruise', testVarId);
    assert(resolvedCreated?.price === 150, `Created variant resolves with price $150 (actual: ${resolvedCreated?.price})`);

    // 3E: Pricing test with created variant: 2 guests * ($150 + $12) = $324
    const customPriced = await calculateAuthoritativePricing([
      {
        productId: 'prod_zambezi_explorer_cruise',
        variantId: testVarId,
        guestCount: 2,
        scheduledDate: '2026-10-22',
      },
    ]);
    assert(customPriced.authoritativeTotal === 324, `Custom variant 2 guests total is $324 (actual: ${customPriced.authoritativeTotal})`);

    // 3F: Update variant
    const updated = await updateCoordinatorVariant('prod_zambezi_explorer_cruise', testVarId, {
      price: 160,
      supplierNote: 'Updated tariff: US$160 + US$12 National Parks fee.',
    });
    assert(updated.price === 160, `Variant price updated to $160 (actual: ${updated.price})`);

    // Verify product-level defaults remain unchanged
    const cruiseAfterVariantUpdate = await getDocById<any>('products', 'prod_zambezi_explorer_cruise');
    assert(Number(cruiseAfterVariantUpdate?.basePrice) === 69, `Product-level basePrice remains $69 and is not overwritten by variant edit`);

    // 3G: Soft deactivation of variant
    const deactivated = await toggleVariantActiveState('prod_zambezi_explorer_cruise', testVarId, false);
    assert(deactivated.isActive === false, 'Variant marked isActive: false');

    // Attempting to resolve deactivated variant for booking must fail safely
    let inactiveCaught = false;
    try {
      await resolveAuthoritativeVariant('prod_zambezi_explorer_cruise', testVarId);
    } catch (err: any) {
      if (err.message.includes('currently marked inactive')) {
        inactiveCaught = true;
      }
    }
    assert(inactiveCaught, 'Inactive variant is rejected from guest booking resolution');

    // 3H: Re-activation
    const reactivated = await toggleVariantActiveState('prod_zambezi_explorer_cruise', testVarId, true);
    assert(reactivated.isActive === true, 'Variant safely reactivated to isActive: true');

    // Final clean-up: deactivate test variant
    await toggleVariantActiveState('prod_zambezi_explorer_cruise', testVarId, false);

    console.log(`\n=== TEST SUITE RESULT: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal test runner error:', error);
    process.exit(1);
  }
}

runTests();
