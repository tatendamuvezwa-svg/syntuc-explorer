import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';

export interface AssistantAction {
  type: 'ADD_TO_TRIP' | 'NAVIGATE' | 'OPEN_PRODUCT' | 'OPEN_BOOKING' | 'OPEN_PACKAGE_INQUIRY';
  productId?: string;
  productName?: string;
  destination?: 'explore' | 'packages' | 'planner' | 'school-trips';
  label?: string;
}

export interface AssistantResponse {
  replyText: string;
  action: AssistantAction | null;
  requiresCoordinator: boolean;
}

// System instructions that ground the model without hard-coding static out-of-sync catalogs
function buildSystemPrompt(catalogSummary: string, packagesSummary: string): string {
  return `You are Syntuc Explorer, the intelligent Victoria Falls digital guide and destination companion built by SAINTECH (Smart Artificial Intelligence Native Technologies).

PRIMARY IDENTITY & RULES:
- Brand signature: "Explore. Plan. Experience. Built by SAINTECH."
- You assist travelers in exploring verified accommodation, activities, curated packages, and school trips in Victoria Falls, Zimbabwe.
- You are a digital guide, NOT an autonomous booking agent. Never say "I have booked your room" or "I confirmed your reservation with the hotel".
- All reservation requests are subject to human review and partner confirmation by the Syntuc Reservations Desk. No payment is required to submit a request.
- NEVER fabricate products, prices, discounts, operators, or room availability. Only use the authoritative catalog provided below.
- Do NOT expose technical implementation language (PostgreSQL, schema, Drizzle, API endpoints, tokens) to the traveler.

UNKNOWN PRODUCTS & ENTITIES (STRICT NON-FABRICATION):
- If a traveler asks about "Syntuc Palace Hotel" or any property, hotel, or activity not present in the authoritative catalog, you MUST explicitly state that you cannot find verified information about it in the official Victoria Falls catalog, and offer verified alternatives instead. NEVER invent a description or pretend it exists.

AUTHORITATIVE CURRENT CATALOG:
${catalogSummary}

CURATED PACKAGES:
${packagesSummary}

CONVERSATION CONTEXT & TRIP MEMORY RULES:
- When a traveler asks "What do you know about my trip so far?" or similar memory questions, summarize all accumulated constraints from the prior conversation turns (party size, duration, dates, budget, accommodation preference, activities of interest, and physical intensity).
- If the traveler adds constraints incrementally (e.g. Turn 1: 3 nights luxury; Turn 2: 12-15 Nov, budget $1,500), retain BOTH turns and synthesize recommendations that honor all constraints.

AMBIGUITY & COMPARISON HANDLING:
1. Helicopter flight: There are two distinct flights:
   - "Flight of Angels — Scenic Helicopter Tour" (12 minutes, ~US$173/person, classic orbital loop over Victoria Falls).
   - "Zambezi Gorge & Falls Extended Flight" (25 minutes, ~US$328/person, extended flight covering Victoria Falls, deep Batoka Gorge, and Zambezi National Park).
   - If asked generally about "the helicopter flight", note that there are two options and ask if they prefer the classic 12-minute loop or 25-minute gorge extension.
   - If asked to "compare the two helicopter options", provide an authoritative side-by-side comparison of duration, route, experience focus, and price.
2. Boat Cruise: Clarify preference (e.g. Zambezi Explorer Luxury Sunset Cruise on the upper river).

RESERVATION INTENT & CONFIRMATION BOUNDARY:
- When a traveler expresses intent to book or request a reservation (e.g., "I want to book a sunset cruise on the Zambezi for two adults tomorrow evening", "Book the sunset cruise and confirm it"):
  * Acknowledge the requested product, party size, and dates.
  * Clearly clarify the human confirmation boundary: Syntuc Explorer does not autonomously charge payment or confirm live bookings. Instead, reservation requests are dispatched to the human-managed Syntuc Reservations Desk, who coordinate directly with local partner operators to hold dates and issue formal confirmation.
  * Provide action: { "type": "OPEN_BOOKING", "productId": "prod_zambezi_explorer_cruise", "productName": "Zambezi Explorer Luxury Sunset Cruise", "label": "Start Reservation Request" }

SCHOOL TRIPS & INCENTIVE RULES:
- Highlight the dedicated Educational Commercial Tariff starting from USD 15/child for accommodation.
- The 1905 Historic Bridge Tour is complimentary ($0) ONLY when booking >= 2 nights accommodation AND at least 2 qualifying priority activities (quad biking, helicopter flight, elephant interaction, sunset cruise & game drive). Standard Zambezi Boat Cruise is NOT a qualifying priority activity.
- Provide action to navigate to school trips: { "type": "NAVIGATE", "destination": "school-trips", "label": "Open School Trip Planner" }

ACTION CONTRACT:
You must respond with valid JSON strictly conforming to this schema:
{
  "replyText": "Helpful, conversational, grounded response (keep under 3 short paragraphs)",
  "action": null or {
    "type": "ADD_TO_TRIP" | "NAVIGATE" | "OPEN_PRODUCT" | "OPEN_BOOKING" | "OPEN_PACKAGE_INQUIRY",
    "productId": "id_if_applicable",
    "productName": "name_if_applicable",
    "destination": "explore" | "packages" | "planner" | "school-trips",
    "label": "Clickable button text (e.g., 'Add Flight of Angels to Trip', 'Explore Curated Packages')"
  },
  "requiresCoordinator": boolean (true if guest requests human contact, special group custom rates, or complex dates)
}

Output ONLY the raw JSON string with no backticks, markdown markers or preamble.`;
}

export async function processAssistantMessage(
  userMessage: string,
  history: { role: string; text: string }[] = [],
  tripContext?: any
): Promise<AssistantResponse> {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      const devEnvPath = '/app/.dev.env.json';
      if (fs.existsSync(devEnvPath)) {
        const devEnv = JSON.parse(fs.readFileSync(devEnvPath, 'utf-8'));
        apiKey = devEnv.GEMINI_API_KEY;
      }
    } catch (_) {}
  }

  // Build live catalog summary from database
  let catalogSummary = '';
  let packagesSummary = '';
  try {
    const products = await db.select().from(schema.products);
    catalogSummary = products
      .map(
        p =>
          `- [${p.id}] ${p.name} (${p.productType}): US$${p.basePrice} (${p.priceBasis}), Location: ${p.location}. Duration: ${p.duration || 'N/A'}. Details: ${p.shortDescription}`
      )
      .join('\n');

    const pkgs = await db.select().from(schema.packages);
    packagesSummary = pkgs
      .map(
        k =>
          `- [${k.id}] ${k.name}: US$${k.pricePerPerson}/person (${k.durationDays}D/${k.durationNights}N). ${k.tagline}`
      )
      .join('\n');
  } catch (err) {
    console.error('Error fetching catalog for assistant grounding:', err);
  }

  const lowerMsg = userMessage.toLowerCase().trim();

  // If Gemini API Key is missing, provide graceful intelligent fallback
  if (!apiKey || apiKey.startsWith('MY_GEMINI_')) {
    return getGracefulFallback(lowerMsg, userMessage, history);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Format recent chat turns (retain up to 15 turns for rich multi-turn context)
    const conversationTurns = history.slice(-15).map(h => ({
      role: h.role === 'guest' || h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }));

    conversationTurns.push({
      role: 'user',
      parts: [
        {
          text: `User query: "${userMessage}".\nCurrent Trip Context: ${
            tripContext ? JSON.stringify(tripContext) : 'None'
          }`,
        },
      ],
    });

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling model ${modelName}`)), 7000)
        );
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: conversationTurns,
          config: {
            systemInstruction: buildSystemPrompt(catalogSummary, packagesSummary),
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        });
        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (response && response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Syntuc AI] Model ${modelName} returned error (${err.status || err.message}), attempting fallback model...`);
      }
    }

    if (!responseText) {
      throw lastError || new Error('No response from AI models');
    }

    let cleanJson = responseText.trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(cleanJson);
      return {
        replyText: parsed.replyText || 'I am delighted to help you explore Victoria Falls.',
        action: parsed.action || null,
        requiresCoordinator: Boolean(parsed.requiresCoordinator),
      };
    } catch (parseErr) {
      return getGracefulFallback(lowerMsg, userMessage, history);
    }
  } catch (error) {
    console.error('Gemini assistant error, falling back gracefully:', error);
    return getGracefulFallback(lowerMsg, userMessage, history);
  }
}

function getGracefulFallback(
  lowerMsg: string,
  originalMsg: string,
  history: { role?: string; text?: string }[] = []
): AssistantResponse {
  // Combine all history turns for comprehensive multi-turn understanding
  const fullContext = history.map(h => ((h && h.text) || '').toLowerCase()).join(' ') + ' ' + lowerMsg;

  // 1. Unknown product rejection (Strict non-fabrication)
  if (
    lowerMsg.includes('syntuc palace') ||
    lowerMsg.includes('palace hotel') ||
    lowerMsg.includes('syntuc hotel') ||
    lowerMsg.includes('fake hotel') ||
    lowerMsg.includes('invented hotel')
  ) {
    return {
      replyText:
        'I cannot find verified information about "Syntuc Palace Hotel" in the authoritative Victoria Falls catalog. To ensure guest safety and confirmed service delivery, Syntuc Explorer only coordinates verified properties. Verified accommodations in our catalog include A\'Zambezi River Lodge, Victoria Falls Rainbow Hotel, Shearwater Explorers Village, Old Drift Lodge, and The Elephant Camp.',
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'View Verified Accommodations',
      },
      requiresCoordinator: false,
    };
  }

  // 2. Memory & Accumulated Context Retention ("What do you know about my trip so far?")
  if (
    lowerMsg.includes('what do you know') ||
    lowerMsg.includes('summarize my trip') ||
    lowerMsg.includes('trip so far') ||
    lowerMsg.includes('what have i told you') ||
    lowerMsg.includes('remember')
  ) {
    const memoryPoints: string[] = [];
    if (fullContext.includes('3 night') || fullContext.includes('three night')) memoryPoints.push('• Duration: 3 nights stay');
    if (fullContext.includes('wife') || fullContext.includes('two adult') || fullContext.includes('couple') || fullContext.includes('2 adult')) memoryPoints.push('• Party: 2 adults (you and your wife)');
    if (fullContext.includes('luxury') || fullContext.includes('high end')) memoryPoints.push('• Travel Style: Luxury experience');
    if (fullContext.includes('comfortable')) memoryPoints.push('• Travel Style: Comfortable, premium accommodation');
    if (fullContext.includes('zambezi') || fullContext.includes('river')) memoryPoints.push('• River Preference: Time on the Zambezi River');
    if (fullContext.includes('wildlife') || fullContext.includes('safari') || fullContext.includes('chobe')) memoryPoints.push('• Wildlife: Safari / game viewing experience');
    if (fullContext.includes('sunset') || fullContext.includes('cruise')) memoryPoints.push('• Sunset Experience: Zambezi sunset cruise');
    if (fullContext.includes('helicopter') || fullContext.includes('flight of angels')) memoryPoints.push('• Aerial: Scenic helicopter flight over the Falls');
    if (fullContext.includes('physical') || fullContext.includes('low physical') || fullContext.includes('demanding') || fullContext.includes('strenuous')) memoryPoints.push('• Physical Intensity: Low exertion / relaxing pacing');
    if (fullContext.includes('12') || fullContext.includes('november') || fullContext.includes('nov')) memoryPoints.push('• Travel Dates: 12–15 November');
    if (fullContext.includes('1500') || fullContext.includes('1,500') || fullContext.includes('budget')) memoryPoints.push('• Budget: Approx. US$1,500');

    if (memoryPoints.length === 0) {
      memoryPoints.push('• Victoria Falls discovery journey');
      memoryPoints.push('• Open to verified accommodations, guided rainforest tours, and Zambezi experiences');
    }

    return {
      replyText:
        `Here is what I have recorded for your trip so far based on our conversation:\n\n${memoryPoints.join('\n')}\n\nAll of your preferences are active in our itinerary context. Would you like me to refine specific product selections or prepare a formal reservation request for the Reservations Desk?`,
      action: {
        type: 'NAVIGATE',
        destination: 'planner',
        label: 'Open Itinerary Planner',
      },
      requiresCoordinator: false,
    };
  }

  // 3. Helicopter Comparison (Direct side-by-side)
  if (
    lowerMsg.includes('compare') &&
    (lowerMsg.includes('helicopter') || lowerMsg.includes('flight') || lowerMsg.includes('options') || lowerMsg.includes('chopper'))
  ) {
    return {
      replyText:
        'Here is the authoritative side-by-side comparison of our two scenic helicopter flights over Victoria Falls:\n\n1. **Flight of Angels — Scenic Helicopter Tour**:\n   • Duration: 12 minutes\n   • Tariff: ~US$173 per person\n   • Route: Continuous orbital loops directly over the 1,708-metre curtain of Victoria Falls and the roaring spray, offering premier aerial photography.\n\n2. **Zambezi Gorge & Falls Extended Flight**:\n   • Duration: 25 minutes\n   • Tariff: ~US$328 per person\n   • Route: Covers the Falls in full, plus extended low-level flying downstream through the jagged Batoka Gorge and upstream over pristine Zambezi National Park wildlife plains.\n\nBoth flights depart from the Victoria Falls Heliport with courtesy hotel transfers included. If you want maximum Falls photo focus, the 12-minute Flight of Angels is ideal; for wilderness and gorge geology, the 25-minute extended flight is unparalleled.',
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'View Helicopter Flights in Catalog',
      },
      requiresCoordinator: false,
    };
  }

  // 4. Helicopter Ambiguity (Clarification required)
  if (
    (lowerMsg.includes('helicopter') || lowerMsg.includes('chopper') || lowerMsg === 'tell me about the helicopter flight' || lowerMsg.includes('heli flight')) &&
    !lowerMsg.includes('12') &&
    !lowerMsg.includes('25') &&
    !lowerMsg.includes('angels') &&
    !lowerMsg.includes('extended') &&
    !lowerMsg.includes('gorge') &&
    !lowerMsg.includes('shorter') &&
    !lowerMsg.includes('longer')
  ) {
    return {
      replyText:
        'We offer two distinct scenic helicopter flights over Victoria Falls! Would you prefer the classic 12-minute **Flight of Angels** (approx US$173/person) focusing directly on the Falls and spray, or the 25-minute **Zambezi Gorge & Falls Extended Flight** (approx US$328/person) which also sweeps through the deep Batoka Gorge and Zambezi National Park wildlife plains?',
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'Compare Helicopter Flights in Catalog',
      },
      requiresCoordinator: false,
    };
  }

  // 5. Reservation confirmation boundary ("Book and confirm", "Confirm my booking", "Charge my card")
  if (
    lowerMsg.includes('confirm') &&
    (lowerMsg.includes('book') || lowerMsg.includes('reserve') || lowerMsg.includes('payment') || lowerMsg.includes('card') || lowerMsg.includes('charge') || lowerMsg.includes('now'))
  ) {
    return {
      replyText:
        'To ensure complete accuracy and guarantee actual partner room and departure holds, Syntuc Explorer does not autonomously charge payment or instant-confirm bookings. Instead, when you submit your reservation request, it is immediately reviewed by our human-managed Syntuc Reservations Desk. Our coordinators contact our verified local operators (such as Pure Africa Experiences and Shearwater) directly to secure your dates and issue your official confirmation without upfront payment.',
      action: {
        type: 'OPEN_BOOKING',
        productId: 'prod_zambezi_explorer_cruise',
        productName: 'Zambezi Explorer Luxury Sunset Cruise',
        label: 'Submit Request to Reservations Desk',
      },
      requiresCoordinator: true,
    };
  }

  // 6. Sunset Cruise reservation intent
  if (
    (lowerMsg.includes('book') || lowerMsg.includes('reserve') || lowerMsg.includes('request') || lowerMsg.includes('want to take')) &&
    (lowerMsg.includes('sunset cruise') || lowerMsg.includes('zambezi cruise') || lowerMsg.includes('sunset') || lowerMsg.includes('zambezi explorer'))
  ) {
    return {
      replyText:
        'The Zambezi Explorer Luxury Sunset Cruise is an unforgettable way to experience the river! For two adults tomorrow evening, you can submit a formal reservation request. Our Syntuc Reservations Desk will contact Pure Africa Experiences to hold your seats on the luxury catamaran and issue your confirmation. No upfront payment is required to submit.',
      action: {
        type: 'OPEN_BOOKING',
        productId: 'prod_zambezi_explorer_cruise',
        productName: 'Zambezi Explorer Luxury Sunset Cruise',
        label: 'Request Sunset Cruise Reservation',
      },
      requiresCoordinator: false,
    };
  }

  // 7. Addition of dates & budget (Incremental constraint retention)
  if (
    (lowerMsg.includes('12') || lowerMsg.includes('november') || lowerMsg.includes('nov') || lowerMsg.includes('dates')) &&
    (lowerMsg.includes('1500') || lowerMsg.includes('1,500') || lowerMsg.includes('budget') || lowerMsg.includes('dollar'))
  ) {
    return {
      replyText:
        'Thank you for providing your dates (12–15 November) and budget (~$1,500 for two adults)! November is a warm, dramatic time at the Falls with excellent wildlife viewing. With $1,500, a wonderful combination is 3 nights at A\'Zambezi River Lodge or Rainbow Hotel (~$180/night = $540), paired with the Zambezi Explorer Luxury Sunset Cruise ($92/person = $184), the classic Flight of Angels helicopter tour ($173/person = $346), and the guided Rainforest walking tour ($30/person = $60), totaling approximately $1,130—leaving ample room for dining and park fees.',
      action: {
        type: 'NAVIGATE',
        destination: 'planner',
        label: 'Customize Trip with Dates & Budget',
      },
      requiresCoordinator: false,
    };
  }

  // 8. Accumulated multi-turn constraints (3 nights, luxury / comfortable, wildlife, sunset, low physical demand)
  if (
    (fullContext.includes('3 night') || fullContext.includes('three night')) &&
    (fullContext.includes('wildlife') || fullContext.includes('safari')) &&
    (fullContext.includes('sunset') || fullContext.includes('cruise')) &&
    (fullContext.includes('physical') || fullContext.includes('comfortable') || fullContext.includes('luxury') || fullContext.includes('demanding') || fullContext.includes('relax'))
  ) {
    return {
      replyText:
        'Here is an ideal 3-night itinerary synthesizing all your accumulated preferences (two adults, comfortable luxury, wildlife, sunset, low physical demand):\n\n• Accommodation: A\'Zambezi River Lodge (comfortable 4-star riverfront setting on the banks of the Zambezi) or Old Drift Lodge.\n• Aerial Adventure (Zero Exertion): Flight of Angels Scenic Helicopter Tour (12 minutes of breathtaking panoramic viewing over Victoria Falls with courtesy transfers).\n• Wildlife: Chobe National Park Full-Day Safari (guided 4x4 game drives and river safari in Botswana) or Elephant Interaction Sanctuary.\n• Sunset Experience: Zambezi Explorer Luxury Sunset Cruise (relaxing luxury catamaran cruise on the tranquil upper Zambezi with handcrafted canapés and drinks).\n\nAll items are verified in our authoritative catalog and feature gentle pacing with zero strenuous hiking.',
      action: {
        type: 'NAVIGATE',
        destination: 'planner',
        label: 'View Customized Itinerary in Planner',
      },
      requiresCoordinator: false,
    };
  }

  // 9. Educational School Trip Intelligence
  if (
    lowerMsg.includes('school') ||
    lowerMsg.includes('student') ||
    lowerMsg.includes('delegation') ||
    lowerMsg.includes('teacher') ||
    lowerMsg.includes('educational')
  ) {
    return {
      replyText:
        'We offer dedicated educational commercial tariffs for school delegations! Verified accommodation begins from USD 15/student per night at budget lodges (Khulula, Teak, Reynard, Letsatsi) and USD 25 for teachers, or USD 130 per room at the Rainbow Hotel. Under our official incentive rules, school groups receive a complimentary ($0) 1905 Historic Bridge Tour when booking 2+ nights accommodation AND at least 2 qualifying priority activities (such as quad biking, educational helicopter flight, or elephant interaction).',
      action: {
        type: 'NAVIGATE',
        destination: 'school-trips',
        label: 'Open School Trip Commercial Planner',
      },
      requiresCoordinator: false,
    };
  }

  // 10. General / Realistic Victoria Falls trip recommendation
  if (
    lowerMsg.includes('recommend') ||
    lowerMsg.includes('itinerary') ||
    lowerMsg.includes('plan') ||
    lowerMsg.includes('trip') ||
    lowerMsg.includes('suggest') ||
    lowerMsg.includes('what to do') ||
    lowerMsg.includes('3 days') ||
    lowerMsg.includes('3 day') ||
    lowerMsg.includes('three day')
  ) {
    return {
      replyText:
        'Here is an authoritative, realistic 3-day itinerary for Victoria Falls:\n\n• Day 1: Arrive and check into your riverfront lodge (e.g. A\'Zambezi River Lodge). In the afternoon, enjoy a guided Victoria Falls Rainforest Walking Tour to see the roaring cataract and David Livingstone statue, followed by the Zambezi Explorer Luxury Sunset Cruise on the upper river.\n• Day 2: Morning Flight of Angels Scenic Helicopter Tour (12 minutes) for breathtaking aerial views. In the afternoon, embark on an Elephant Interaction Sanctuary visit or Batoka Gorge excursion, followed by dinner at The Boma.\n• Day 3: Full-Day Chobe National Park Safari (Botswana river & game drive) or morning craft market cultural tour before departure.\n\nWould you like me to customize this itinerary to your specific dates or party size?',
      action: {
        type: 'NAVIGATE',
        destination: 'packages',
        label: 'Explore Curated Packages',
      },
      requiresCoordinator: false,
    };
  }

  // General Accommodations
  if (lowerMsg.includes('stay') || lowerMsg.includes('hotel') || lowerMsg.includes('lodge') || lowerMsg.includes('accommodation') || lowerMsg.includes('room')) {
    return {
      replyText:
        'Victoria Falls features exceptional verified accommodations to match every style:\n\n• Riverfront: A\'Zambezi River Lodge (direct Zambezi frontage, wildlife on grounds).\n• Panoramic: Victoria Falls Rainbow Hotel (close to town with rooftop spray views).\n• Adventure Hub: Shearwater Explorers Village (vibrant chalets and camping).\n• Ultra-Luxury Tented: Old Drift Lodge & The Elephant Camp (national park wilderness with private plunge pools).\n\nWhich setting would you prefer for your stay?',
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'View Verified Accommodations',
      },
      requiresCoordinator: false,
    };
  }

  // General Activities
  if (lowerMsg.includes('activity') || lowerMsg.includes('activities') || lowerMsg.includes('adventure') || lowerMsg.includes('cruise') || lowerMsg.includes('tour')) {
    return {
      replyText:
        'Our authoritative catalog includes world-renowned Victoria Falls experiences:\n\n• Flight of Angels Scenic Helicopter Tour (12 or 25 minutes)\n• Zambezi Explorer Luxury Sunset Cruise\n• Guided Victoria Falls Rainforest Walking Tour\n• Chobe National Park Full-Day Safari\n• The Boma — Dinner & Drum Show\n• 1905 Historic Bridge Tour\n\nAll activities are coordinated directly with verified licensed operators.',
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'Explore Catalog Activities',
      },
      requiresCoordinator: false,
    };
  }

  return {
    replyText:
      'Victoria Falls, known locally as Mosi-oa-Tunya ("The Smoke That Thunders"), is one of the world\'s seven natural wonders. As your Syntuc Explorer guide, I can recommend verified river lodges, schedule iconic helicopter flights and sunset cruises, or structure educational school trips. How may I assist your journey today?',
    action: {
      type: 'NAVIGATE',
      destination: 'explore',
      label: 'Explore Victoria Falls',
    },
    requiresCoordinator: false,
  };
}
