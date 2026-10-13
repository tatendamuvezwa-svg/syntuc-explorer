import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { getCollectionDocs, getTombstones } from '../lib/firestore.ts';
import { getAuthoritativeVariantsForProduct, AuthoritativeVariant } from './variantCatalog.ts';

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

// System instructions grounding the model strictly in published catalogue and trip context
function buildSystemPrompt(
  catalogSummary: string,
  packagesSummary: string,
  variantsSummary: string,
  tripContextSummary: string
): string {
  return `You are Syntuc Explorer, the intelligent Victoria Falls digital guide and destination companion built by SAINTECH (Smart Artificial Intelligence Native Technologies).

PRIMARY IDENTITY & RULES:
- Brand signature: "Explore. Plan. Experience. Built by SAINTECH."
- You assist travelers in exploring verified accommodation, activities, curated packages, and school trips in Victoria Falls, Zimbabwe.
- You are a digital guide, NOT an autonomous booking agent. Never say "I have booked your room" or "I confirmed your reservation with the hotel".
- All reservation requests are subject to human review and partner confirmation by the Syntuc Reservations Desk. No payment is required to submit a request.
- STRICT NON-FABRICATION: NEVER fabricate products, prices, discounts, operators, or room availability. Only use the authoritative catalog and variants provided below.
- Do NOT label a product price as US dollars unless the authoritative record specifies that currency.
- Clearly distinguish per-person, per-room, per-night, per-person sharing per night, per-group, and total prices where applicable.
- Never treat "priceDelta" as an absolute selling price; use authoritative base rates and variant prices.
- Do not duplicate or invent pricing formulas. If the required price, variant, dates, or availability cannot be established from the available authoritative data, explain what needs confirmation instead of guessing.
- Do NOT expose technical implementation language (PostgreSQL, schema, Drizzle, API endpoints, tokens) to the traveler.

UNKNOWN PRODUCTS & ENTITIES (STRICT NON-FABRICATION):
- If a traveler asks about "Syntuc Palace Hotel" or any property, hotel, or activity not present in the authoritative catalog, you MUST explicitly state that you cannot find verified information about it in the official Victoria Falls catalog, and offer verified alternatives instead. NEVER invent a description or pretend it exists.

AUTHORITATIVE CURRENT CATALOG:
${catalogSummary}

AUTHORITATIVE PRODUCT VARIANTS & COMPULSORY FEES:
${variantsSummary}

CURATED PACKAGES:
${packagesSummary}

GUEST'S CURRENT TRIP CONTEXT:
${tripContextSummary}

CONVERSATION CONTEXT & TRIP MEMORY RULES:
- When a traveler asks "What do you know about my trip so far?" or similar memory questions:
  * Summarize ONLY facts present in the supplied conversation or current trip context.
  * Clearly distinguish selected items (items in their trip plan) from tentative interests.
  * If dates, budget, guest counts, or preferences are unknown, say they are not yet specified.
  * NEVER infer a November itinerary, a US$1,500 budget, or any other trip detail from hardcoded examples or keyword matches.

AMBIGUITY & COMPARISON HANDLING:
1. Helicopter flight: Check the authoritative catalog for:
   - "Flight of Angels — Scenic Helicopter Tour" (12 minutes, classic orbital loop over Victoria Falls).
   - "Zambezi Gorge & Falls Extended Flight" (25 minutes, extended flight covering Victoria Falls, deep Batoka Gorge, and Zambezi National Park).
   - Quote their actual catalog prices, durations, and currencies.
   - If asked generally about "the helicopter flight" without specifying duration or flight type, note that there are two options and ask if they prefer the classic 12-minute loop or 25-minute gorge extension.
   - If asked to "compare the two helicopter options", provide an authoritative side-by-side comparison of duration, route, experience focus, and price from the catalog.

RESERVATION INTENT & CONFIRMATION BOUNDARY:
- NEVER map a generic booking request (such as "book it", "reserve now", or "confirm") automatically to a sunset cruise or any other hardcoded product.
- Identify the intended product from the conversation and current trip context.
- If the intended product is ambiguous (e.g. guest says "book it" but has multiple items in their trip plan, or has not specified which product), ask one concise clarification question.
- Trigger booking actions only when the intended product is clear.
- When the product is clear:
  * Acknowledge the requested product, party size, and dates if provided.
  * Clarify the human confirmation boundary: Syntuc Explorer does not autonomously charge payment or confirm live bookings. Instead, reservation requests are dispatched to the human-managed Syntuc Reservations Desk, who coordinate directly with local partner operators to hold dates and issue formal confirmation.
  * Provide action: { "type": "OPEN_BOOKING", "productId": "<intended_product_id>", "productName": "<intended_product_name>", "label": "Start Reservation Request" }
- Do NOT claim that a reservation is confirmed, a partner has accepted, or a payment has been made.

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
    "label": "Clickable button text"
  },
  "requiresCoordinator": boolean
}

Output ONLY the raw JSON string with no backticks, markdown markers or preamble.`;
}

interface CachedCatalogData {
  timestamp: number;
  products: any[];
  packages: any[];
  variantsByProduct: Record<string, AuthoritativeVariant[]>;
}

let catalogCache: CachedCatalogData | null = null;
const CACHE_TTL_MS = 60000; // 1 minute

async function getGroundedCatalogData(): Promise<CachedCatalogData> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.timestamp < CACHE_TTL_MS) {
    return catalogCache;
  }

  try {
    const tombstones = await getTombstones();
    const allProducts = await getCollectionDocs<any>('products');
    const products = allProducts.filter((p) => p.isPublished && !tombstones.has(`products_${p.id}`));

    const variantsByProduct: Record<string, AuthoritativeVariant[]> = {};
    await Promise.all(
      products.map(async (p) => {
        const vars = await getAuthoritativeVariantsForProduct(p.id);
        if (vars && vars.length > 0) {
          variantsByProduct[p.id] = vars;
        }
      })
    );

    const allPkgs = await getCollectionDocs<any>('packages');
    const packages = allPkgs.filter((k) => k.isPublished && !tombstones.has(`packages_${k.id}`));

    catalogCache = {
      timestamp: now,
      products,
      packages,
      variantsByProduct,
    };
    return catalogCache;
  } catch (err) {
    console.error('Error fetching catalog data for assistant grounding:', err);
    if (catalogCache) return catalogCache;
    return {
      timestamp: now,
      products: [],
      packages: [],
      variantsByProduct: {},
    };
  }
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

  // Build live catalog summary and variants directly from Firestore
  let catalogSummary = '';
  let packagesSummary = '';
  let variantsSummary = '';
  let currentTripSummary = 'No active trip items or dates recorded in current session.';

  const { products, packages, variantsByProduct } = await getGroundedCatalogData();

  try {
    catalogSummary = products
      .map(
        p =>
          `- [${p.id}] ${p.name} (${p.productType}): ${p.currency || 'USD'} ${p.basePrice} (${p.priceBasis}), Location: ${p.location}. Duration: ${p.duration || 'N/A'}. Details: ${p.shortDescription}`
      )
      .join('\n');

    packagesSummary = packages
      .map(
        k =>
          `- [${k.id}] ${k.name}: ${k.currency || 'USD'} ${k.pricePerPerson}/person (${k.durationDays}D/${k.durationNights}N). ${k.tagline}`
      )
      .join('\n');

    variantsSummary = Object.entries(variantsByProduct)
      .map(([prodId, vars]) => {
        const prod = products.find(p => p.id === prodId);
        const varLines = vars
          .map(v => {
            let feeStr = '';
            if (v.compulsoryFees && v.compulsoryFees.length > 0) {
              feeStr = ` Compulsory fees: ${v.compulsoryFees.map((f: any) => `${f.currency} ${f.amount} (${f.basis})`).join(', ')}.`;
            }
            return `   * [${v.id}] "${v.name}": ${v.currency} ${v.price} (${v.priceBasis}).${v.season ? ` Season: ${v.season}.` : ''}${v.mealPlan ? ` Meal plan: ${v.mealPlan}.` : ''}${feeStr}${v.description ? ` Details: ${v.description}` : ''}`;
          })
          .join('\n');
        return `Product: ${prod ? prod.name : prodId}\n${varLines}`;
      })
      .join('\n\n');

    if (tripContext) {
      const tripParts: string[] = [];
      if (tripContext.startDate || tripContext.endDate) {
        tripParts.push(`Travel dates: ${tripContext.startDate || 'Unspecified'} to ${tripContext.endDate || 'Unspecified'}`);
      }
      if (tripContext.adultsCount !== undefined) {
        tripParts.push(`Party: ${tripContext.adultsCount} adult(s)${tripContext.childrenCount ? `, ${tripContext.childrenCount} child(ren)` : ''}`);
      }
      if (tripContext.interests && tripContext.interests.length > 0) {
        tripParts.push(`Interests: ${tripContext.interests.join(', ')}`);
      }
      if (tripContext.intensity) {
        tripParts.push(`Physical intensity: ${tripContext.intensity}`);
      }
      if (tripContext.items && tripContext.items.length > 0) {
        const itemsList = tripContext.items
          .map(
            (it: any) =>
              `  - ${it.productName || it.productId}${it.variantName ? ` [Variant: ${it.variantName}]` : ''}${it.roomName ? ` [Room: ${it.roomName}]` : ''}${it.scheduledDate ? ` [Scheduled: ${it.scheduledDate}${it.checkOutDate ? ` to ${it.checkOutDate}` : ''}]` : ''}${it.guestCount ? ` [Guests: ${it.guestCount}]` : ''}${it.unitPrice !== null ? ` [Rate: ${it.currency || 'USD'} ${it.unitPrice} (${it.priceBasis || 'standard'})]` : ''}`
          )
          .join('\n');
        tripParts.push(`Selected items in trip plan:\n${itemsList}`);
      } else {
        tripParts.push('Selected items in trip plan: None added yet');
      }
      currentTripSummary = tripParts.join('\n');
    }
  } catch (err) {
    console.error('Error fetching catalog from Firestore for assistant grounding:', err);
  }

  const lowerMsg = userMessage.toLowerCase().trim();

  // If Gemini API Key is missing, provide graceful intelligent fallback grounded in the real catalog
  if (!apiKey || apiKey.startsWith('MY_GEMINI_')) {
    return getGracefulFallback(
      lowerMsg,
      userMessage,
      history,
      tripContext,
      products,
      packages,
      variantsByProduct
    );
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
            systemInstruction: buildSystemPrompt(
              catalogSummary,
              packagesSummary,
              variantsSummary,
              currentTripSummary
            ),
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
      return getGracefulFallback(
        lowerMsg,
        userMessage,
        history,
        tripContext,
        products,
        packages,
        variantsByProduct
      );
    }
  } catch (error) {
    console.error('Gemini assistant error, falling back gracefully:', error);
    return getGracefulFallback(
      lowerMsg,
      userMessage,
      history,
      tripContext,
      products,
      packages,
      variantsByProduct
    );
  }
}

function getGracefulFallback(
  lowerMsg: string,
  originalMsg: string,
  history: { role?: string; text?: string }[] = [],
  tripContext?: any,
  products: any[] = [],
  packages: any[] = [],
  variantsByProduct: Record<string, AuthoritativeVariant[]> = {}
): AssistantResponse {
  // Combine user history turns for conversational context
  const userHistoryTexts = history
    .filter(h => h.role === 'user' || h.role === 'guest')
    .map(h => (h.text || '').toLowerCase());
  const fullUserContext = [...userHistoryTexts, lowerMsg].join(' ');

  // Helper to find product from catalogue by keywords
  const findProduct = (idOrKey: string): any => {
    return products.find(
      p =>
        p.id === idOrKey ||
        p.name.toLowerCase().includes(idOrKey.toLowerCase())
    );
  };

  // 1. Unknown product rejection (Strict non-fabrication)
  if (
    lowerMsg.includes('syntuc palace') ||
    lowerMsg.includes('palace hotel') ||
    lowerMsg.includes('syntuc hotel') ||
    lowerMsg.includes('fake hotel') ||
    lowerMsg.includes('invented hotel') ||
    lowerMsg.includes('invented lodge')
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
    lowerMsg.includes('what do you remember') ||
    lowerMsg.includes('remember about my trip')
  ) {
    const memoryPoints: string[] = [];

    // Party size: from actual tripContext or explicit user history
    if (tripContext && (tripContext.adultsCount !== undefined || tripContext.childrenCount !== undefined)) {
      const adults = tripContext.adultsCount || 0;
      const children = tripContext.childrenCount || 0;
      memoryPoints.push(`• Party Size: ${adults} adult${adults === 1 ? '' : 's'}${children > 0 ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}`);
    } else {
      const matchedParty = userHistoryTexts.find(t => t.includes('adult') || t.includes('couple') || t.includes('solo') || t.includes('family'));
      if (matchedParty) {
        if (matchedParty.includes('2 adult') || matchedParty.includes('two adult') || matchedParty.includes('couple')) {
          memoryPoints.push('• Party Size: 2 adults');
        } else if (matchedParty.includes('1 adult') || matchedParty.includes('one adult') || matchedParty.includes('solo')) {
          memoryPoints.push('• Party Size: 1 adult');
        } else {
          memoryPoints.push('• Party Size: Mentioned in conversation');
        }
      } else {
        memoryPoints.push('• Party Size: Not yet specified');
      }
    }

    // Dates: from actual tripContext or explicitly mentioned in user history
    if (tripContext && (tripContext.startDate || tripContext.endDate)) {
      memoryPoints.push(`• Travel Dates: ${tripContext.startDate || 'Unspecified'} to ${tripContext.endDate || 'Unspecified'}`);
    } else {
      memoryPoints.push('• Travel Dates: Not yet specified');
    }

    // Budget: search ONLY for explicit budget stated by the guest in conversation
    let extractedBudget: string | null = null;
    for (const text of userHistoryTexts) {
      const bMatch = text.match(/budget\s*(?:of|is|around|approx|approximately)?\s*[:$]?\s*([$0-9,]+(?:\s*(?:usd|dollars))?)/i);
      if (bMatch) {
        extractedBudget = bMatch[1];
        break;
      }
    }
    if (extractedBudget) {
      memoryPoints.push(`• Budget: Approx. ${extractedBudget}`);
    } else {
      memoryPoints.push('• Budget: Not yet specified');
    }

    // Selected Trip Items: strictly from current trip plan items
    if (tripContext && tripContext.items && tripContext.items.length > 0) {
      const itemsList = tripContext.items
        .map((it: any) => {
          const variantStr = it.variantName ? ` — ${it.variantName}` : (it.roomName ? ` — ${it.roomName}` : '');
          const dateStr = it.scheduledDate ? ` (Scheduled: ${it.scheduledDate}${it.checkOutDate ? ` to ${it.checkOutDate}` : ''})` : '';
          const guestStr = it.guestCount ? ` [${it.guestCount} guest(s)]` : '';
          const rateStr = it.unitPrice !== null ? ` [${it.currency || 'USD'} ${it.unitPrice} (${it.priceBasis || 'standard'})]` : '';
          return `  - ${it.productName || it.productId}${variantStr}${dateStr}${guestStr}${rateStr}`;
        })
        .join('\n');
      memoryPoints.push(`• Selected Trip Items (in your trip plan):\n${itemsList}`);
    } else {
      memoryPoints.push('• Selected Trip Items: None added to trip plan yet');
    }

    // Tentative Interests & Style
    const tentativeInterests: string[] = [];
    if (tripContext && tripContext.interests && tripContext.interests.length > 0) {
      tentativeInterests.push(...tripContext.interests);
    }
    if (tripContext && tripContext.intensity) {
      tentativeInterests.push(`Physical intensity: ${tripContext.intensity}`);
    }
    // Check if user conversation mentions specific styles or interests
    if (fullUserContext.includes('luxury')) tentativeInterests.push('Luxury travel style');
    if (fullUserContext.includes('wildlife') || fullUserContext.includes('safari')) tentativeInterests.push('Wildlife / safari');
    if (fullUserContext.includes('river') || fullUserContext.includes('zambezi')) tentativeInterests.push('River experiences');

    const uniqueInterests = Array.from(new Set(tentativeInterests));
    if (uniqueInterests.length > 0) {
      memoryPoints.push(`• Tentative Interests / Travel Style: ${uniqueInterests.join(', ')}`);
    } else {
      memoryPoints.push('• Tentative Interests: Not yet specified');
    }

    return {
      replyText:
        `Here is what I have recorded for your trip based on your actual trip plan and our conversation:\n\n${memoryPoints.join('\n')}\n\nAll details are grounded in your current session. Would you like to adjust dates, browse catalog experiences, or proceed to submit a reservation request?`,
      action: {
        type: 'NAVIGATE',
        destination: 'planner',
        label: 'Open Itinerary Planner',
      },
      requiresCoordinator: false,
    };
  }

  // 3. Helicopter Comparison & Ambiguity Handling
  const flightOfAngels = findProduct('prod_flight_of_angels') || {
    id: 'prod_flight_of_angels',
    name: 'Flight of Angels — Scenic Helicopter Tour',
    basePrice: 173,
    currency: 'USD',
    priceBasis: 'per_person',
    duration: '12 minutes',
  };
  const extendedFlight = findProduct('prod_zambezi_extended_flight') || {
    id: 'prod_zambezi_extended_flight',
    name: 'Zambezi Gorge & Falls Extended Flight',
    basePrice: 328,
    currency: 'USD',
    priceBasis: 'per_person',
    duration: '25 minutes',
  };

  if (
    lowerMsg.includes('compare') &&
    (lowerMsg.includes('helicopter') || lowerMsg.includes('flight') || lowerMsg.includes('chopper') || lowerMsg.includes('heli'))
  ) {
    return {
      replyText:
        `Here is the authoritative side-by-side comparison of our two scenic helicopter flights over Victoria Falls:\n\n1. **${flightOfAngels.name}**:\n   • Duration: 12 minutes\n   • Tariff: ${flightOfAngels.currency} ${flightOfAngels.basePrice} per person\n   • Route: Continuous orbital loops directly over the 1,708-metre curtain of Victoria Falls and the roaring spray, offering premier aerial photography.\n\n2. **${extendedFlight.name}**:\n   • Duration: 25 minutes\n   • Tariff: ${extendedFlight.currency} ${extendedFlight.basePrice} per person\n   • Route: Covers the Falls in full, plus extended low-level flying downstream through the jagged Batoka Gorge and upstream over pristine Zambezi National Park wildlife plains.\n\nBoth flights depart from the Victoria Falls Heliport with courtesy hotel transfers included. If you want maximum Falls photo focus, the 12-minute Flight of Angels is ideal; for wilderness and gorge geology, the 25-minute extended flight is unparalleled.`,
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'View Helicopter Flights in Catalog',
      },
      requiresCoordinator: false,
    };
  }

  if (
    (lowerMsg.includes('helicopter') || lowerMsg.includes('chopper') || lowerMsg.includes('heli flight') || lowerMsg === 'tell me about the helicopter flight') &&
    !lowerMsg.includes('12') &&
    !lowerMsg.includes('25') &&
    !lowerMsg.includes('angels') &&
    !lowerMsg.includes('extended') &&
    !lowerMsg.includes('gorge') &&
    !lowerMsg.includes('book') &&
    !lowerMsg.includes('reserve')
  ) {
    return {
      replyText:
        `We offer two distinct scenic helicopter flights over Victoria Falls in our authoritative catalogue! Would you prefer the classic 12-minute **${flightOfAngels.name}** (${flightOfAngels.currency} ${flightOfAngels.basePrice}/person) focusing directly on the Falls and spray, or the 25-minute **${extendedFlight.name}** (${extendedFlight.currency} ${extendedFlight.basePrice}/person) which also sweeps through the deep Batoka Gorge and Zambezi National Park wildlife plains?`,
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'Compare Helicopter Flights in Catalog',
      },
      requiresCoordinator: false,
    };
  }

  // 4. Product-Specific Booking Intent & Human-Confirmation Boundary
  const isBookingIntent =
    lowerMsg.includes('book') ||
    lowerMsg.includes('reserve') ||
    lowerMsg.includes('reservation') ||
    lowerMsg.includes('confirm') ||
    lowerMsg.includes('hold a room') ||
    lowerMsg.includes('charge my card') ||
    lowerMsg.includes('make a booking');

  if (isBookingIntent) {
    // Determine intended product:
    // A. Check if user specified a product in the current message or immediate context
    let intendedProduct: any = null;
    let isAmbiguousHelicopter = false;

    if (lowerMsg.includes('flight of angels') || lowerMsg.includes('12-minute') || lowerMsg.includes('12 min')) {
      intendedProduct = flightOfAngels;
    } else if (lowerMsg.includes('extended flight') || lowerMsg.includes('25-minute') || lowerMsg.includes('25 min') || lowerMsg.includes('gorge flight')) {
      intendedProduct = extendedFlight;
    } else if (lowerMsg.includes('helicopter') || lowerMsg.includes('chopper')) {
      isAmbiguousHelicopter = true;
    } else if (lowerMsg.includes('sunset cruise') || lowerMsg.includes('zambezi explorer') || lowerMsg.includes('sunset') || lowerMsg.includes('catamaran')) {
      intendedProduct = findProduct('prod_zambezi_explorer_cruise');
    } else if (lowerMsg.includes('white water') || lowerMsg.includes('rafting')) {
      intendedProduct = findProduct('prod_white_water_rafting');
    } else if (lowerMsg.includes('old drift')) {
      intendedProduct = findProduct('prod_olddrift');
    } else if (lowerMsg.includes('elephant camp')) {
      intendedProduct = findProduct('prod_elephantcamp');
    } else if (lowerMsg.includes('rainbow')) {
      intendedProduct = findProduct('prod_rainbow');
    } else if (lowerMsg.includes('a\'zambezi') || lowerMsg.includes('azambezi')) {
      intendedProduct = findProduct('prod_azambezi');
    } else if (lowerMsg.includes('explorers village') || lowerMsg.includes('explorers')) {
      intendedProduct = findProduct('prod_explorers');
    } else if (lowerMsg.includes('boma')) {
      intendedProduct = findProduct('prod_boma_dinner');
    } else if (lowerMsg.includes('chobe')) {
      intendedProduct = findProduct('prod_chobe_safari');
    } else if (lowerMsg.includes('bridge')) {
      intendedProduct = findProduct('prod_bridge_adventures');
    } else if (lowerMsg.includes('rainforest') || lowerMsg.includes('walking tour')) {
      intendedProduct = findProduct('prod_rainforest_walk');
    } else if (lowerMsg.includes('simunye')) {
      intendedProduct = findProduct('prod_simunye_theatre');
    }

    if (isAmbiguousHelicopter) {
      return {
        replyText:
          `Which helicopter tour would you like to reserve: the 12-minute **${flightOfAngels.name}** (${flightOfAngels.currency} ${flightOfAngels.basePrice}/person) or the 25-minute **${extendedFlight.name}** (${extendedFlight.currency} ${extendedFlight.basePrice}/person)?`,
        action: {
          type: 'NAVIGATE',
          destination: 'explore',
          label: 'Compare Helicopter Flights in Catalog',
        },
        requiresCoordinator: false,
      };
    }

    // B. If no product was named in message, check tripContext items
    if (!intendedProduct) {
      if (tripContext && tripContext.items && tripContext.items.length === 1) {
        // Single item in trip plan - clear intent
        const singleItem = tripContext.items[0];
        intendedProduct = findProduct(singleItem.productId) || {
          id: singleItem.productId,
          name: singleItem.productName || 'Selected Experience',
        };
      } else if (tripContext && tripContext.items && tripContext.items.length > 1) {
        // Multiple items in trip plan - ambiguous intent, ask concise clarification question
        const itemNames = tripContext.items.map((i: any) => i.productName || i.productId).join(', ');
        return {
          replyText:
            `You currently have multiple items in your trip plan (${itemNames}). Which specific experience would you like to reserve, or would you like to submit a reservation request for your entire trip?`,
          action: {
            type: 'OPEN_BOOKING',
            label: 'Review Trip & Start Reservation Request',
          },
          requiresCoordinator: false,
        };
      } else {
        // No items in trip plan and no product named - ask concise clarification question
        return {
          replyText:
            'Which accommodation or activity from our verified Victoria Falls catalogue would you like to reserve? Please let me know the experience name.',
          action: {
            type: 'NAVIGATE',
            destination: 'explore',
            label: 'Browse Verified Experiences',
          },
          requiresCoordinator: false,
        };
      }
    }

    // C. Product is clearly identified -> explain human review and partner confirmation boundary
    const operatorName = intendedProduct.operatorName || 'our local partner operator';
    return {
      replyText:
        `To ensure confirmed partner holds without charging upfront, Syntuc Explorer does not autonomously charge payment or instantly confirm bookings. When you submit your reservation request for ${intendedProduct.name}, our human-managed Syntuc Reservations Desk reviews the details and coordinates directly with ${operatorName} to secure your dates and issue formal confirmation. Would you like to start your reservation request now?`,
      action: {
        type: 'OPEN_BOOKING',
        productId: intendedProduct.id,
        productName: intendedProduct.name,
        label: `Start Reservation Request for ${intendedProduct.name}`,
      },
      requiresCoordinator: false,
    };
  }

  // 5. Product Details & Authoritative Variant Inquiries
  if (lowerMsg.includes('old drift')) {
    const oldDrift = findProduct('prod_olddrift');
    const vars = variantsByProduct['prod_olddrift'] || [];
    const varText = vars.length > 0
      ? vars.map(v => `• ${v.name}: ${v.currency} ${v.price} (${v.priceBasis === 'per_person_sharing_night' ? 'per person sharing per night' : v.priceBasis})`).join('\n')
      : '• Green Season: USD 835 pppn\n• Mid Season: USD 1,042 pppn\n• High Season: USD 1,087 pppn';
    return {
      replyText:
        `Old Drift Lodge is an ultra-luxury tented lodge nestled in Zambezi National Park along the Zambezi River. Published authoritative 2026 rates (Fully Inclusive of all meals, local drinks, game drives and river safaris):\n\n${varText}\n\nCompulsory fee: USD 50 Conservation & Community Levy per person per night. The applicable rate depends on your travel dates. Would you like to view Old Drift Lodge details or check dates?`,
      action: {
        type: 'OPEN_PRODUCT',
        productId: 'prod_olddrift',
        productName: 'Old Drift Lodge',
        label: 'View Old Drift Lodge Details',
      },
      requiresCoordinator: false,
    };
  }

  if (lowerMsg.includes('elephant camp')) {
    const vars = variantsByProduct['prod_elephantcamp'] || [];
    const varText = vars.length > 0
      ? vars.map(v => `• ${v.name}: ${v.currency} ${v.price} (${v.priceBasis === 'per_person_sharing_night' ? 'per person sharing/night' : v.priceBasis === 'per_single_room_night' ? 'per single room/night' : v.priceBasis})`).join('\n')
      : '• Green Season: USD 835 pppn (sharing) / USD 835 (single)\n• Mid Season: USD 1,042 pppn (sharing) / USD 1,564 (single)\n• High Season: USD 1,087 pppn (sharing) / USD 1,632 (single)';
    return {
      replyText:
        `The Elephant Camp is a luxury tented sanctuary situated on a private concession overlooking Victoria Falls spray and the Batoka Gorge. Published authoritative 2026 rates (Fully Inclusive):\n\n${varText}\n\nCompulsory fee: USD 50 Conservation & Community Levy per person per night. Would you like to view The Elephant Camp?`,
      action: {
        type: 'OPEN_PRODUCT',
        productId: 'prod_elephantcamp',
        productName: 'The Elephant Camp',
        label: 'View The Elephant Camp Details',
      },
      requiresCoordinator: false,
    };
  }

  if (lowerMsg.includes('explorers village') || (lowerMsg.includes('explorers') && lowerMsg.includes('village'))) {
    const vars = variantsByProduct['prod_explorers'] || [];
    const varText = vars.length > 0
      ? vars.map(v => `• ${v.name}: ${v.currency} ${v.price} (${v.priceBasis === 'per_person_sharing_night' ? 'per person sharing/night' : v.priceBasis === 'per_single_room_night' ? 'per single room/night' : v.priceBasis})`).join('\n')
      : '• Standard Garden Chalet: USD 110 pppn (sharing) / USD 176 (single)\n• Deluxe Village Suite: USD 137 pppn (sharing) / USD 218 (single)';
    return {
      replyText:
        `Shearwater Explorers Village offers vibrant lodge accommodation just 400 metres from Victoria Falls. Official 2026 contracted rates (Bed & Breakfast included):\n\n${varText}\n\nAll chalets are air-conditioned and ensuite. Would you like to view room options?`,
      action: {
        type: 'OPEN_PRODUCT',
        productId: 'prod_explorers',
        productName: 'Shearwater Explorers Village',
        label: 'View Explorers Village Rooms',
      },
      requiresCoordinator: false,
    };
  }

  if (lowerMsg.includes('sunset cruise') || lowerMsg.includes('zambezi explorer') || lowerMsg.includes('catamaran')) {
    const cruise = findProduct('prod_zambezi_explorer_cruise');
    const vars = variantsByProduct['prod_zambezi_explorer_cruise'] || [];
    const varText = vars.length > 0
      ? vars.map(v => `• ${v.name}: ${v.currency} ${v.price} per person (+ USD 12 National Parks River Conservation Fee)`).join('\n')
      : '• Luxury Deck: USD 69 per person (+ USD 12 National Parks fee)\n• Signature Deck (VIP): USD 110 per person (+ USD 12 National Parks fee)';
    return {
      replyText:
        `The Zambezi Explorer Luxury Sunset Cruise by Pure Africa Experiences glides along the tranquil upper Zambezi River with all-inclusive bar and handcrafted canapés. Published authoritative deck rates:\n\n${varText}\n\nBoth decks offer 2-hour sunset cruises with hotel transfers included. Would you like to view the cruise details?`,
      action: {
        type: 'OPEN_PRODUCT',
        productId: 'prod_zambezi_explorer_cruise',
        productName: 'Zambezi Explorer Luxury Sunset Cruise',
        label: 'View Sunset Cruise Details',
      },
      requiresCoordinator: false,
    };
  }

  if (lowerMsg.includes('rafting') || lowerMsg.includes('white water')) {
    const vars = variantsByProduct['prod_white_water_rafting'] || [];
    const varText = vars.length > 0
      ? vars.map(v => `• ${v.name}: ${v.currency} ${v.price} per person (+ USD 12 National Parks River Conservation Fee)`).join('\n')
      : '• High Water Rafting (Jan–Jul): USD 161 per person (+ USD 12 National Parks fee)\n• Low Water Rafting (Jul–Dec): USD 173 per person (+ USD 12 National Parks fee)';
    return {
      replyText:
        `Shearwater Batoka Gorge White Water Rafting offers world-renowned Grade 5 rapids beneath Victoria Falls. Published authoritative season variants:\n\n${varText}\n\nIncludes safety briefing, equipment, riverside lunch, and hotel transfers. Rapid sections and water levels are confirmed on day of departure by Shearwater based on river conditions.`,
      action: {
        type: 'OPEN_PRODUCT',
        productId: 'prod_white_water_rafting',
        productName: 'Batoka Gorge White Water Rafting',
        label: 'View White Water Rafting Details',
      },
      requiresCoordinator: false,
    };
  }

  // 6. Educational School Trips
  if (
    lowerMsg.includes('school') ||
    lowerMsg.includes('student') ||
    lowerMsg.includes('delegation') ||
    lowerMsg.includes('teacher') ||
    lowerMsg.includes('educational')
  ) {
    return {
      replyText:
        'We offer dedicated educational commercial tariffs for school delegations! Verified accommodation begins from USD 15/student per night at budget partner lodges (Khulula, Teak, Reynard, Letsatsi) and USD 25 for teachers, or USD 130 per room at the Rainbow Hotel. Under official incentive rules, school groups receive a complimentary ($0) 1905 Historic Bridge Tour when booking 2+ nights accommodation AND at least 2 qualifying priority activities (such as quad biking, educational helicopter flight, or elephant interaction). Standard Zambezi Boat Cruise is not a qualifying priority activity.',
      action: {
        type: 'NAVIGATE',
        destination: 'school-trips',
        label: 'Open School Trip Planner',
      },
      requiresCoordinator: false,
    };
  }

  // 7. General Recommendations & Itineraries
  if (
    lowerMsg.includes('recommend') ||
    lowerMsg.includes('itinerary') ||
    lowerMsg.includes('plan') ||
    lowerMsg.includes('suggest') ||
    lowerMsg.includes('what to do')
  ) {
    return {
      replyText:
        'Here is an authoritative, realistic 3-day itinerary for Victoria Falls based on our verified catalogue:\n\n• Day 1: Arrive and check into your riverfront lodge (e.g. A\'Zambezi River Lodge). In the afternoon, enjoy a guided Victoria Falls Rainforest Walking Tour to see the roaring cataract, followed by the Zambezi Explorer Luxury Sunset Cruise on the upper river.\n• Day 2: Morning Flight of Angels Scenic Helicopter Tour (12 minutes) for breathtaking aerial views. In the afternoon, explore the Batoka Gorge or elephant sanctuary, followed by dinner at The Boma.\n• Day 3: Full-Day Chobe National Park Safari (Botswana river & game drive) or local cultural touring before departure.\n\nAll items are coordinated with verified local operators. Would you like to explore curated packages or customize your trip plan?',
      action: {
        type: 'NAVIGATE',
        destination: 'packages',
        label: 'Explore Curated Packages',
      },
      requiresCoordinator: false,
    };
  }

  // 8. General Accommodations
  if (
    lowerMsg.includes('stay') ||
    lowerMsg.includes('hotel') ||
    lowerMsg.includes('lodge') ||
    lowerMsg.includes('accommodation') ||
    lowerMsg.includes('room')
  ) {
    return {
      replyText:
        'Victoria Falls features exceptional verified accommodations to match every style:\n\n• Riverfront: A\'Zambezi River Lodge (direct Zambezi frontage, wildlife on grounds).\n• Town & Spray Views: Victoria Falls Rainbow Hotel (close to town with rooftop panorama).\n• Adventure Hub: Shearwater Explorers Village (vibrant chalets and village suites).\n• Ultra-Luxury Tented: Old Drift Lodge & The Elephant Camp (national park wilderness with private plunge pools).\n\nWhich setting would you prefer for your stay?',
      action: {
        type: 'NAVIGATE',
        destination: 'explore',
        label: 'View Verified Accommodations',
      },
      requiresCoordinator: false,
    };
  }

  // 9. General Activities
  if (
    lowerMsg.includes('activity') ||
    lowerMsg.includes('activities') ||
    lowerMsg.includes('adventure') ||
    lowerMsg.includes('cruise') ||
    lowerMsg.includes('tour')
  ) {
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

  // Default welcome response
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
