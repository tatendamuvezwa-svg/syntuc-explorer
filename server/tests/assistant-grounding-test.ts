import { processAssistantMessage } from '../services/gemini.ts';

// Use graceful offline mode for fast test execution
process.env.GEMINI_API_KEY = 'MY_GEMINI_TEST';

async function runAssistantVerificationSuite() {
  console.log('=== STARTING ASSISTANT CONTEXT-AWARE & GROUNDING VERIFICATION SUITE ===');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    }
  }

  // TEST 1: Trip Memory with real trip context without fabricated dates/budget
  console.log('\n[Scenario 1] Trip Memory with Actual Trip Context...');
  const res1 = await processAssistantMessage(
    'What do you know about my trip so far?',
    [],
    {
      adultsCount: 3,
      childrenCount: 1,
      startDate: '2026-10-15',
      endDate: '2026-10-18',
      interests: ['Wilderness', 'Photography'],
      items: [
        {
          productId: 'prod_flight_of_angels',
          productName: 'Flight of Angels — Scenic Helicopter Tour',
          variantName: null,
          scheduledDate: '2026-10-16',
          guestCount: 4,
          unitPrice: 173,
          currency: 'USD',
          priceBasis: 'per_person',
        },
      ],
    }
  );
  console.log('RES 1 TEXT:\n' + res1.replyText);
  assert(res1.replyText.includes('3 adults, 1 child') || res1.replyText.includes('3 adult') || res1.replyText.includes('4 guests'), 'TEST-1A: Party size accurately reflects real trip context');
  assert(res1.replyText.includes('2026-10-15') || res1.replyText.includes('15 to') || res1.replyText.includes('October'), 'TEST-1B: Dates reflect real trip context dates');
  assert(res1.replyText.includes('Flight of Angels'), 'TEST-1C: Selected items list Flight of Angels');
  assert(!res1.replyText.includes('1,500') && !res1.replyText.includes('$1500'), 'TEST-1D: Budget does not guess $1,500');
  assert(!res1.replyText.includes('12–15 November') && !res1.replyText.includes('12-15 November'), 'TEST-1E: Never infers November dates when not specified');

  // TEST 2: Trip Memory with empty session - no arbitrary guesses
  console.log('\n[Scenario 2] Trip Memory with Empty Trip Plan...');
  const res2 = await processAssistantMessage(
    'What do you know about my trip so far?',
    [],
    null
  );
  assert(res2.replyText.includes('Travel Dates: Not yet specified'), 'TEST-2A: Dates state Not yet specified');
  assert(res2.replyText.includes('Budget: Not yet specified'), 'TEST-2B: Budget states Not yet specified');
  assert(res2.replyText.includes('Selected Trip Items: None added'), 'TEST-2C: Items state None added');
  assert(!res2.replyText.includes('US$1,500') && !res2.replyText.includes('$1,500'), 'TEST-2D: No fabricated $1,500 budget');
  assert(!res2.replyText.includes('November'), 'TEST-2E: No fabricated November dates');

  // TEST 3: Generic booking intent with no items must NOT map to sunset cruise
  console.log('\n[Scenario 3] Generic Booking Intent with No Items in Trip...');
  const res3 = await processAssistantMessage('I want to book it now', [], null);
  assert(res3.action?.productId !== 'prod_zambezi_explorer_cruise', 'TEST-3A: Generic booking does not map to sunset cruise');
  assert(res3.replyText.includes('Which accommodation or activity'), 'TEST-3B: Asks clarification on which experience to reserve');

  // TEST 4: Generic booking intent with multiple items asks for clarification
  console.log('\n[Scenario 4] Generic Booking Intent with Multiple Items in Trip...');
  const res4 = await processAssistantMessage(
    'Book it',
    [],
    {
      items: [
        { productId: 'prod_rainforest_walk', productName: 'Rainforest Walking Tour' },
        { productId: 'prod_boma_dinner', productName: 'The Boma Dinner' },
      ],
    }
  );
  assert(res4.action?.productId !== 'prod_zambezi_explorer_cruise', 'TEST-4A: Multiple items booking does not map to sunset cruise');
  assert(res4.replyText.includes('multiple items in your trip plan'), 'TEST-4B: Clarifies between multiple items');

  // TEST 5: Generic booking intent with single item maps to that specific item
  console.log('\n[Scenario 5] Generic Booking Intent with Single Item in Trip...');
  const res5 = await processAssistantMessage(
    'Please book it',
    [],
    {
      items: [
        { productId: 'prod_olddrift', productName: 'Old Drift Lodge' },
      ],
    }
  );
  assert(res5.action?.type === 'OPEN_BOOKING', 'TEST-5A: Triggers OPEN_BOOKING');
  assert(res5.action?.productId === 'prod_olddrift', 'TEST-5B: Maps to single item in trip (Old Drift Lodge)');
  assert(res5.replyText.includes('Old Drift Lodge'), 'TEST-5C: Acknowledges Old Drift Lodge');
  assert(res5.replyText.includes('Syntuc Reservations Desk'), 'TEST-5D: Emphasizes human review at Reservations Desk');
  assert(!res5.replyText.includes('I have confirmed your booking'), 'TEST-5E: Never claims booking is autonomously confirmed');

  // TEST 6: Explicit booking intent for sunset cruise
  console.log('\n[Scenario 6] Explicit Sunset Cruise Booking Intent...');
  const res6 = await processAssistantMessage('I would like to reserve the sunset cruise on the Zambezi', [], null);
  assert(res6.action?.productId === 'prod_zambezi_explorer_cruise', 'TEST-6A: Explicit sunset cruise maps to cruise');
  assert(res6.replyText.includes('Syntuc Reservations Desk'), 'TEST-6B: Explains human review boundary');

  // TEST 7: Ambiguous helicopter inquiry requires clarification
  console.log('\n[Scenario 7] Ambiguous Helicopter Inquiry...');
  const res7 = await processAssistantMessage('Tell me about the helicopter flight', [], null);
  assert(res7.replyText.includes('12-minute') && res7.replyText.includes('25-minute'), 'TEST-7A: Notes both 12-min and 25-min options');
  assert(res7.replyText.includes('Flight of Angels'), 'TEST-7B: Mentions Flight of Angels');
  assert(res7.replyText.includes('Zambezi Gorge & Falls Extended Flight'), 'TEST-7C: Mentions Extended Flight');

  // TEST 8: Helicopter comparison quotes catalog prices
  console.log('\n[Scenario 8] Helicopter Comparison...');
  const res8 = await processAssistantMessage('Compare the helicopter flights', [], null);
  assert(res8.replyText.includes('173'), 'TEST-8A: Quotes Flight of Angels rate (173)');
  assert(res8.replyText.includes('328'), 'TEST-8B: Quotes Extended Flight rate (328)');

  // TEST 9: Grounded variant pricing - Old Drift Lodge
  console.log('\n[Scenario 9] Old Drift Lodge Authoritative Pricing Inquiry...');
  const res9 = await processAssistantMessage('How much is Old Drift Lodge?', [], null);
  assert(res9.replyText.includes('835'), 'TEST-9A: Lists Green season rate (835)');
  assert(res9.replyText.includes('1,042') || res9.replyText.includes('1042'), 'TEST-9B: Lists Mid season rate (1,042)');
  assert(res9.replyText.includes('1,087') || res9.replyText.includes('1087'), 'TEST-9C: Lists High season rate (1,087)');
  assert(res9.replyText.includes('50'), 'TEST-9D: States USD 50 Conservation & Community Levy');
  assert(res9.replyText.includes('per person sharing'), 'TEST-9E: Distinguishes per person sharing per night');

  // TEST 10: Grounded variant pricing - Shearwater Explorers Village
  console.log('\n[Scenario 10] Explorers Village Authoritative Pricing Inquiry...');
  const res10 = await processAssistantMessage('What are the room rates for Explorers Village?', [], null);
  assert(res10.replyText.includes('110'), 'TEST-10A: Standard chalet rate (110)');
  assert(res10.replyText.includes('137'), 'TEST-10B: Deluxe suite rate (137)');
  assert(res10.replyText.includes('per person sharing') || res10.replyText.includes('pppn'), 'TEST-10C: States sharing rate basis');

  // TEST 11: Unknown entity rejection
  console.log('\n[Scenario 11] Unknown Product Rejection...');
  const res11 = await processAssistantMessage('Can I book Syntuc Palace Hotel?', [], null);
  assert(res11.replyText.includes('cannot find verified information about "Syntuc Palace Hotel"'), 'TEST-11A: Explicitly rejects invented hotel');
  assert(res11.action?.type === 'NAVIGATE', 'TEST-11B: Directs to verified accommodations');

  // TEST 12: School trips tariff and bridge incentive
  console.log('\n[Scenario 12] School Trip Inquiry...');
  const res12 = await processAssistantMessage('Tell me about school trip rates', [], null);
  assert(res12.replyText.includes('15'), 'TEST-12A: Highlights $15 student tariff');
  assert(res12.replyText.includes('Bridge Tour'), 'TEST-12B: Mentions Historic Bridge Tour incentive');
  assert(res12.replyText.includes('Standard Zambezi Boat Cruise is not a qualifying') || res12.replyText.includes('Standard Zambezi Boat Cruise is NOT a qualifying'), 'TEST-12C: Strictly specifies boat cruise does not qualify');

  console.log(`\n=== SUMMARY: ${passed} / ${total} ASSISTANT VERIFICATION CHECKS PASSED ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runAssistantVerificationSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
