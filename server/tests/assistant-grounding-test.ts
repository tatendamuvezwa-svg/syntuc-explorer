import { processAssistantMessage } from '../services/gemini.ts';

// Use graceful offline mode for reliable deterministic unit test execution
process.env.GEMINI_API_KEY = 'MY_GEMINI_TEST';

async function runAssistantVerificationSuite() {
  console.log('=== STARTING ASSISTANT TRIP-PLANNING & GROUNDING REGRESSION SUITE ===');
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

  // REGRESSION 1: The exact Victoria Falls, 5,000 budget, 20 October, four-day scenario
  console.log('\n[Regression 1] Exact Guest Planning Scenario...');
  const observedPrompt = 'I want to visit Victoria Falls with a budget of 5000. I want to travel on the 20th of October for 4 days.';
  const resObserved = await processAssistantMessage(observedPrompt, [], null);

  assert(resObserved.replyText.includes('Victoria Falls'), 'REG-1A: Acknowledges destination Victoria Falls');
  assert(resObserved.replyText.includes('5,000') || resObserved.replyText.includes('5000'), 'REG-1B: Acknowledges budget amount 5,000');
  assert(resObserved.replyText.includes('20 October'), 'REG-1C: Acknowledges travel date 20 October');
  assert(resObserved.replyText.includes('four-day') || resObserved.replyText.includes('4-day') || resObserved.replyText.includes('4 days'), 'REG-1D: Acknowledges four-day duration');
  assert(resObserved.action?.destination === 'planner', 'REG-1E: Sets action to planner');

  // REGRESSION 2: Missing budget currency does NOT silently become USD
  console.log('\n[Regression 2] Missing Budget Currency Safety...');
  assert(!resObserved.replyText.includes('USD 5,000') && !resObserved.replyText.includes('$5,000') && !resObserved.replyText.includes('US$5,000'), 'REG-2A: Does not prepend USD or $ when currency was omitted');
  assert(resObserved.replyText.toLowerCase().includes('currency'), 'REG-2B: Explicitly asks which currency the budget is in');

  // REGRESSION 3: Missing traveller count is NOT fabricated
  console.log('\n[Regression 3] Missing Traveller Count Safety...');
  assert(!resObserved.replyText.includes('2 adults') && !resObserved.replyText.includes('two adults'), 'REG-3A: Does not fabricate 2 adults when not specified');
  assert(resObserved.replyText.toLowerCase().includes('how many adults') || resObserved.replyText.toLowerCase().includes('adults and children'), 'REG-3B: Asks how many adults and children will be travelling');

  // REGRESSION 4: Follow-up answers are retained across multiple messages
  console.log('\n[Regression 4] Multi-Turn Detail Retention...');
  const multiTurnHistory = [
    { role: 'user', text: observedPrompt },
    { role: 'assistant', text: resObserved.replyText },
  ];
  const followUpAnswer = 'The budget is in USD, for 2 adults, accommodation only for 3 nights.';
  const resTurn2 = await processAssistantMessage(followUpAnswer, multiTurnHistory, null);

  assert(resTurn2.replyText.includes('USD') || resTurn2.replyText.includes('5,000'), 'REG-4A: Retains budget and confirmed USD currency');
  assert(resTurn2.replyText.includes('2 adults') || resTurn2.replyText.includes('two adults'), 'REG-4B: Retains confirmed 2 adults party size');
  assert(resTurn2.replyText.includes('3 nights') || resTurn2.replyText.includes('three nights'), 'REG-4C: Retains confirmed 3 nights accommodation');
  assert(resTurn2.replyText.includes('20 October'), 'REG-4D: Retains original 20 October start date from Turn 1');
  assert(!resTurn2.replyText.toLowerCase().includes('which currency is your budget in'), 'REG-4E: Does not re-ask currency question once answered');
  assert(!resTurn2.replyText.toLowerCase().includes('how many adults and children'), 'REG-4F: Does not re-ask traveller count once answered');

  // REGRESSION 5: Four-day duration and accommodation-night ambiguity handled appropriately
  console.log('\n[Regression 5] Duration vs Nights Ambiguity...');
  assert(resObserved.replyText.includes('3 nights or 4 nights') || resObserved.replyText.includes('nights of accommodation'), 'REG-5A: Clarifies whether 4 days means 3 nights or 4 nights of accommodation');

  // REGRESSION 6: Gemini-unavailable fallback recognises trip-planning intent
  console.log('\n[Regression 6] Fallback Execution Path Trip Planning...');
  assert(!resObserved.replyText.includes('Mosi-oa-Tunya') && !resObserved.replyText.includes('Smoke That Thunders'), 'REG-6A: Fallback path does not default to generic promotional copy');
  assert(resObserved.replyText.includes('I can help plan your'), 'REG-6B: Fallback path directly addresses trip planning intent');

  // REGRESSION 7: Unknown prices, products, and availability are never invented
  console.log('\n[Regression 7] Strict Non-Fabrication of Unknown Products & Prices...');
  const resUnknown = await processAssistantMessage('Can I stay at Syntuc Palace Hotel?', [], null);
  assert(resUnknown.replyText.includes('cannot find verified information about "Syntuc Palace Hotel"'), 'REG-7A: Explicitly rejects non-existent hotel');
  assert(resUnknown.action?.type === 'NAVIGATE', 'REG-7B: Directs to verified accommodations');

  // REGRESSION 8: Generic welcome copy does not replace a meaningful planning response
  console.log('\n[Regression 8] Welcome Copy Suppression for Planning Queries...');
  const welcomeSnippet = 'Victoria Falls, known locally as Mosi-oa-Tunya';
  assert(!resObserved.replyText.includes(welcomeSnippet), 'REG-8A: Welcome copy excluded from planning response');
  assert(!resTurn2.replyText.includes(welcomeSnippet), 'REG-8B: Welcome copy excluded from Turn 2 recommendation');

  // REGRESSION 9: Existing safe booking-intent handling remains intact
  console.log('\n[Regression 9] Existing Safe Booking Intent Intact...');
  const resGenericBook = await processAssistantMessage('Book it now', [], null);
  assert(resGenericBook.action?.productId !== 'prod_zambezi_explorer_cruise', 'REG-9A: Generic booking does not map to sunset cruise');
  assert(resGenericBook.replyText.includes('Which accommodation or activity'), 'REG-9B: Asks clarification for generic booking');

  const resSingleBook = await processAssistantMessage(
    'Please book it',
    [],
    { items: [{ productId: 'prod_olddrift', productName: 'Old Drift Lodge' }] }
  );
  assert(resSingleBook.action?.productId === 'prod_olddrift', 'REG-9C: Single item booking maps to Old Drift Lodge');
  assert(resSingleBook.replyText.includes('Syntuc Reservations Desk'), 'REG-9D: Preserves human review boundary');

  // REGRESSION 10: Authoritative variant pricing and helicopter comparisons
  console.log('\n[Regression 10] Authoritative Variants & Helicopter Comparisons...');
  const resOldDrift = await processAssistantMessage('How much is Old Drift Lodge?', [], null);
  assert(resOldDrift.replyText.includes('835'), 'REG-10A: Old Drift Green Season rate (835)');
  assert(resOldDrift.replyText.includes('1,042') || resOldDrift.replyText.includes('1042'), 'REG-10B: Old Drift Mid Season rate (1,042)');
  assert(resOldDrift.replyText.includes('50'), 'REG-10C: States USD 50 Conservation Levy');

  const resHeliCompare = await processAssistantMessage('Compare the helicopter flights', [], null);
  assert(resHeliCompare.replyText.includes('173'), 'REG-10D: Flight of Angels rate (173)');
  assert(resHeliCompare.replyText.includes('328'), 'REG-10E: Extended Flight rate (328)');

  const resSchool = await processAssistantMessage('What are the school trip rates?', [], null);
  assert(resSchool.replyText.includes('15'), 'REG-10F: Educational commercial tariff ($15)');
  assert(resSchool.replyText.includes('Bridge Tour'), 'REG-10G: 1905 Historic Bridge Tour incentive');

  console.log(`\n=== SUMMARY: ${passed} / ${total} REGRESSION CHECKS PASSED ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runAssistantVerificationSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
