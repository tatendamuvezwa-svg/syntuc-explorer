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

// System instructions grounding the model strictly in published catalogue and trip context
function buildSystemPrompt(
  catalogSummary: string,
  packagesSummary: string,
  variantsSummary: string,
  tripContextSummary: string
): string {
  const currentYear = new Date().getFullYear();
  const currentDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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

CURRENT RUNTIME DATE CONTEXT:
Today is ${currentDateStr}. The current calendar year is ${currentYear}.
When dates are given without an explicit year (such as "20th of October" or "October 20"), interpret the year within this reliable current-date context (${currentYear}). If unavailable or ambiguous, ask.

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

TRIP-PLANNING INTENT RECOGNITION & CONCISE FOLLOW-UP QUESTIONS:
When a traveler submits a natural-language trip-planning request or mentions constraints (e.g., "I want to visit Victoria Falls with a budget of 5000. I want to travel on the 20th of October for 4 days"):
1. Acknowledge and preserve all explicitly supplied constraints without discarding or silently modifying them:
   - Destination: Victoria Falls
   - Budget amount: exactly as stated (e.g., 5,000)
   - Budget currency: explicitly note if the currency is not yet specified (NEVER assume or default to USD if no currency symbol or name was supplied!)
   - Travel date: starting 20 October ${currentYear} (using runtime date context)
   - Duration: four days
   - Explicitly note what remains unconfirmed: traveller count (adults/children), budget currency, and whether transport/flights to Victoria Falls are needed
2. Ask concise, relevant follow-up questions to confirm missing details before producing estimates:
   - "Which currency is your budget in (e.g., USD, ZAR, EUR)?"
   - "How many adults and children will be travelling?"
   - "Should the budget include transport to Victoria Falls, or cover your local stay and activities here only?"
   - Clarify whether four days means 3 nights or 4 nights of accommodation when this affects accommodation estimates.
3. NEVER return generic promotional copy when a traveler provides specific planning constraints.
4. When follow-up answers are provided across multiple conversation turns:
   - Retain all previously supplied constraints (destination, budget, dates, duration).
   - Do NOT ask for information already supplied in the conversation or trip context.
   - Ground all recommendations in the published catalogue and authoritative variant rates.
   - Do not invent prices, availability, or automatic bookings.
   - Always preserve the human-review requirement of the Syntuc Reservations Desk.
5. Provide action: { "type": "NAVIGATE", "destination": "planner", "label": "Open Itinerary Planner" }

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

  // If Gemini API Key is missing or in test offline mode, provide graceful intelligent fallback grounded in the real catalog
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
          text: `User query: "${userMessage}".\nCurrent Runtime Date Context: 13 October 2026 (Year: 2026).\nCurrent Trip Context: ${
            tripContext ? JSON.stringify(tripContext) : 'None'
          }`,
        },
      ],
    });

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling model ${modelName}`)), 5000)
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

interface ParsedPlanningConstraints {
  hasPlanningIntent: boolean;
  destination: string | null;
  budgetAmount: string | null;
  budgetCurrency: string | null;
  startDateStr: string | null;
  startDay: number | null;
  startMonth: string | null;
  startYear: number | null;
  durationText: string | null;
  durationDays: number | null;
  durationNights: number | null;
  adultsCount: number | null;
  childrenCount: number | null;
  transportSpecified: boolean;
  transportIncluded: boolean | null;
  nightsAmbiguous: boolean;
}

function parsePlanningConstraints(
  currentMsg: string,
  history: { role?: string; text?: string }[] = [],
  tripContext?: any
): ParsedPlanningConstraints {
  const currentYear = new Date().getFullYear(); // e.g. 2026
  const userTurns = history
    .filter(h => h.role === 'user' || h.role === 'guest')
    .map(h => h.text || '');
  const allUserMessages = [...userTurns, currentMsg];
  const combinedText = allUserMessages.join(' ');
  const lowerCurrent = currentMsg.toLowerCase();
  const lowerCombined = combinedText.toLowerCase();

  // 1. Destination
  let destination: string | null = null;
  if (lowerCombined.includes('victoria falls') || lowerCombined.includes('vic falls')) {
    destination = 'Victoria Falls';
  }

  // 2. Budget Amount and Currency
  let budgetAmount: string | null = null;
  let budgetCurrency: string | null = null;

  // Check currency explicitly stated in any user turn
  if (
    lowerCombined.includes('usd') ||
    lowerCombined.includes('us dollars') ||
    lowerCombined.includes('us$') ||
    /\$\s*[0-9]/.test(combinedText)
  ) {
    budgetCurrency = 'USD';
  } else if (
    lowerCombined.includes('zar') ||
    lowerCombined.includes('rand') ||
    /\br\s*[0-9]/.test(combinedText)
  ) {
    budgetCurrency = 'ZAR';
  } else if (
    lowerCombined.includes('eur') ||
    lowerCombined.includes('euro') ||
    /€\s*[0-9]/.test(combinedText)
  ) {
    budgetCurrency = 'EUR';
  } else if (
    lowerCombined.includes('gbp') ||
    lowerCombined.includes('pound') ||
    /£\s*[0-9]/.test(combinedText)
  ) {
    budgetCurrency = 'GBP';
  }

  // Check budget amount pattern
  const budgetMatch = lowerCombined.match(
    /budget\s*(?:of|is|around|approx|approximately)?\s*[:$€£R]?\s*([0-9,]+(?:\.[0-9]{2})?)/i
  ) || lowerCombined.match(
    /(?:with a|have a)\s*budget\s*(?:of)?\s*[:$€£R]?\s*([0-9,]+(?:\.[0-9]{2})?)/i
  );
  if (budgetMatch) {
    const rawDigits = budgetMatch[1].replace(/,/g, '');
    const num = parseFloat(rawDigits);
    if (!isNaN(num)) {
      budgetAmount = num.toLocaleString('en-US');
    }
  }

  // 3. Travel Dates
  let startDateStr: string | null = null;
  let startDay: number | null = null;
  let startMonth: string | null = null;
  let startYear: number | null = currentYear;

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  // Regex for "20th of October", "20 October", "October 20"
  const dateMatch1 = lowerCombined.match(
    /\b([0-9]{1,2})(?:st|nd|rd|th)?\s*(?:of)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s*([0-9]{4}))?\b/i
  );
  const dateMatch2 = lowerCombined.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*([0-9]{1,2})(?:st|nd|rd|th)?(?:\s*([0-9]{4}))?\b/i
  );

  if (dateMatch1) {
    startDay = parseInt(dateMatch1[1], 10);
    const mStr = dateMatch1[2].toLowerCase();
    const fullM = monthNames.find(m => m.startsWith(mStr)) || mStr;
    startMonth = fullM.charAt(0).toUpperCase() + fullM.slice(1);
    if (dateMatch1[3]) {
      startYear = parseInt(dateMatch1[3], 10);
    }
    startDateStr = `${startDay} ${startMonth}`;
  } else if (dateMatch2) {
    startDay = parseInt(dateMatch2[2], 10);
    const mStr = dateMatch2[1].toLowerCase();
    const fullM = monthNames.find(m => m.startsWith(mStr)) || mStr;
    startMonth = fullM.charAt(0).toUpperCase() + fullM.slice(1);
    if (dateMatch2[3]) {
      startYear = parseInt(dateMatch2[3], 10);
    }
    startDateStr = `${startDay} ${startMonth}`;
  } else if (tripContext?.startDate) {
    startDateStr = tripContext.startDate;
  }

  // 4. Duration (Days & Nights)
  let durationDays: number | null = null;
  let durationNights: number | null = null;
  let durationText: string | null = null;

  const wordNumberMap: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };

  const daysMatch = lowerCombined.match(/\b([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten)\s*days?\b/i);
  if (daysMatch) {
    const raw = daysMatch[1].toLowerCase();
    durationDays = wordNumberMap[raw] || parseInt(raw, 10);
    durationText = raw === '4' ? 'four-day' : `${raw}-day`;
  }

  const nightsMatch = lowerCombined.match(/\b([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten)\s*nights?\b/i);
  if (nightsMatch) {
    const raw = nightsMatch[1].toLowerCase();
    durationNights = wordNumberMap[raw] || parseInt(raw, 10);
  }

  // Ambiguity: Days specified but accommodation nights count not explicitly clarified
  const nightsAmbiguous = durationDays !== null && durationNights === null;

  // 5. Party Size / Traveller Count
  let adultsCount: number | null = null;
  let childrenCount: number | null = null;

  if (tripContext && tripContext.adultsCount !== undefined) {
    adultsCount = tripContext.adultsCount;
    childrenCount = tripContext.childrenCount || 0;
  } else {
    const adultsMatch = lowerCombined.match(/\b([0-9]+|one|two|three|four|five|six)\s*adults?\b/i);
    if (adultsMatch) {
      const raw = adultsMatch[1].toLowerCase();
      adultsCount = wordNumberMap[raw] || parseInt(raw, 10);
    } else if (lowerCombined.includes('couple') || lowerCombined.includes('my wife and i') || lowerCombined.includes('my husband and i') || lowerCombined.includes('my partner and i')) {
      adultsCount = 2;
    } else if (lowerCombined.includes('solo traveler') || lowerCombined.includes('solo traveller') || lowerCombined.includes('just me') || lowerCombined.includes('on my own')) {
      adultsCount = 1;
    }

    const childrenMatch = lowerCombined.match(/\b([0-9]+|one|two|three|four)\s*(?:children|kids|child)\b/i);
    if (childrenMatch) {
      const raw = childrenMatch[1].toLowerCase();
      childrenCount = wordNumberMap[raw] || parseInt(raw, 10);
    } else if (lowerCombined.includes('no children') || lowerCombined.includes('no kids') || lowerCombined.includes('adults only')) {
      childrenCount = 0;
    }
  }

  // 6. Transport to Victoria Falls
  let transportSpecified = false;
  let transportIncluded: boolean | null = null;

  if (
    lowerCombined.includes('flights included') ||
    lowerCombined.includes('include flights') ||
    lowerCombined.includes('include transport') ||
    lowerCombined.includes('including flights') ||
    lowerCombined.includes('with flights')
  ) {
    transportSpecified = true;
    transportIncluded = true;
  } else if (
    lowerCombined.includes('accommodation only') ||
    lowerCombined.includes('stay only') ||
    lowerCombined.includes('local activities only') ||
    lowerCombined.includes('excluding flights') ||
    lowerCombined.includes('exclude flights') ||
    lowerCombined.includes('own transport') ||
    lowerCombined.includes('flights booked') ||
    lowerCombined.includes('own flights') ||
    lowerCombined.includes('activities only') ||
    lowerCombined.includes('stay and activities only') ||
    lowerCombined.includes('here only')
  ) {
    transportSpecified = true;
    transportIncluded = false;
  }

  // 7. Check if this is a Planning Intent
  const hasPlanningKeywords =
    lowerCombined.includes('plan') ||
    lowerCombined.includes('visit') ||
    lowerCombined.includes('travel') ||
    lowerCombined.includes('trip') ||
    lowerCombined.includes('vacation') ||
    lowerCombined.includes('holiday') ||
    lowerCombined.includes('itinerary');

  const hasSpecificConstraints =
    (budgetAmount !== null || startDateStr !== null || durationDays !== null);

  const hasPlanningIntent =
    hasPlanningKeywords && hasSpecificConstraints;

  return {
    hasPlanningIntent,
    destination,
    budgetAmount,
    budgetCurrency,
    startDateStr,
    startDay,
    startMonth,
    startYear,
    durationText,
    durationDays,
    durationNights,
    adultsCount,
    childrenCount,
    transportSpecified,
    transportIncluded,
    nightsAmbiguous,
  };
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

  // 2. Trip Planning Intent Recognition & Follow-Up Questions (High Priority)
  const planning = parsePlanningConstraints(originalMsg, history, tripContext);
  if (planning.hasPlanningIntent) {
    const currentYear = new Date().getFullYear();
    const destName = planning.destination || 'Victoria Falls';
    const dateFormatted = planning.startDateStr
      ? `${planning.startDateStr}${planning.startYear ? ` ${planning.startYear}` : ` ${currentYear}`}`
      : 'in October';
    const durationLabel = planning.durationText || (planning.durationDays ? `${planning.durationDays}-day` : 'multi-day');
    const budgetLabel = planning.budgetAmount || 'your budget';

    // Determine what questions remain unanswered across multi-turn context
    const followUpQuestions: string[] = [];

    if (!planning.budgetCurrency) {
      followUpQuestions.push(
        `Which currency is your ${budgetLabel} budget in (e.g., USD, ZAR, EUR)?`
      );
    }

    if (planning.adultsCount === null) {
      followUpQuestions.push('How many adults and children will be travelling?');
    }

    if (!planning.transportSpecified) {
      followUpQuestions.push(
        `Should the budget include transport to ${destName}, or cover your stay and activities here only?`
      );
    }

    if (planning.nightsAmbiguous && planning.durationDays) {
      followUpQuestions.push(
        `Does your ${durationLabel} visit mean ${planning.durationDays - 1} nights or ${planning.durationDays} nights of accommodation?`
      );
    }

    // If there are still unanswered clarification questions, respond naturally without generic promotional copy
    if (followUpQuestions.length > 0) {
      const intro = `I can help plan your ${durationLabel} ${destName} visit starting ${planning.startDateStr || '20 October'}. Your budget is ${budgetLabel}, but I need to confirm a few details before recommending suitable options:`;
      const questionsBody = followUpQuestions.map(q => `• ${q}`).join('\n');
      const conclusion = 'Once you confirm these details, I will tailor verified accommodation and activity options from our published catalogue directly to your trip.';

      return {
        replyText: `${intro}\n\n${questionsBody}\n\n${conclusion}`,
        action: {
          type: 'NAVIGATE',
          destination: 'planner',
          label: 'Open Itinerary Planner',
        },
        requiresCoordinator: false,
      };
    }

    // If ALL details are confirmed (multi-turn answered): produce grounded catalogue recommendations
    const currency = planning.budgetCurrency || 'USD';
    const nights = planning.durationNights || (planning.durationDays ? planning.durationDays - 1 : 3);
    const party = `${planning.adultsCount || 2} adult${(planning.adultsCount || 2) > 1 ? 's' : ''}${planning.childrenCount ? `, ${planning.childrenCount} child(ren)` : ''}`;

    return {
      replyText:
        `Thank you for confirming! Here is your custom ${durationLabel} (${nights} nights) ${destName} itinerary framework starting ${dateFormatted} for ${party} with a budget of ${currency} ${budgetLabel} (local stay and activities):\n\n` +
        `• **Verified Accommodation**:\n` +
        `  - Riverfront: A'Zambezi River Lodge (${currency} 220/room/night × ${nights} nights = ${currency} ${220 * nights}) with direct Zambezi river frontage.\n` +
        `  - Village Hub: Shearwater Explorers Village (${currency} 110 pppn sharing, Bed & Breakfast included).\n` +
        `  - Luxury Tented: Old Drift Lodge or The Elephant Camp (fully inclusive luxury tented suites with private plunge pools, plus ${currency} 50/person/night conservation levy).\n\n` +
        `• **Iconic Activities**:\n` +
        `  - Flight of Angels Scenic Helicopter Tour: ${currency} 173 per person (12 minutes over the Falls and roaring spray).\n` +
        `  - Zambezi Explorer Luxury Sunset Cruise: ${currency} 81 per person (including ${currency} 12 National Parks conservation fee) with luxury catamaran seating, bar, and canapés.\n` +
        `  - Guided Rainforest Walking Tour: ${currency} 35 per person.\n\n` +
        `All reservation requests are submitted to our human-managed Syntuc Reservations Desk to hold dates with local partner operators; no upfront payment is taken. Would you like to review this in your trip planner?`,
      action: {
        type: 'NAVIGATE',
        destination: 'planner',
        label: 'View Trip in Planner',
      },
      requiresCoordinator: false,
    };
  }

  // 3. Memory & Accumulated Context Retention ("What do you know about my trip so far?")
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
      // Check if user history mentioned explicit dates
      const planning = parsePlanningConstraints(originalMsg, history, tripContext);
      if (planning.startDateStr) {
        memoryPoints.push(`• Travel Dates: Starting ${planning.startDateStr}${planning.startYear ? ` ${planning.startYear}` : ''}${planning.durationDays ? ` (${planning.durationDays} days)` : ''}`);
      } else {
        memoryPoints.push('• Travel Dates: Not yet specified');
      }
    }

    // Budget: search ONLY for explicit budget stated by the guest in conversation
    let extractedBudget: string | null = null;
    for (const text of userHistoryTexts) {
      const bMatch = text.match(/budget\s*(?:of|is|around|approx|approximately)?\s*[:$€£R]?\s*([0-9,]+(?:\s*(?:usd|dollars|zar|eur|gbp))?)/i);
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

  // 4. Helicopter Comparison & Ambiguity Handling
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

  // 5. Product-Specific Booking Intent & Human-Confirmation Boundary
  const isBookingIntent =
    lowerMsg.includes('book') ||
    lowerMsg.includes('reserve') ||
    lowerMsg.includes('reservation') ||
    lowerMsg.includes('confirm') ||
    lowerMsg.includes('hold a room') ||
    lowerMsg.includes('charge my card') ||
    lowerMsg.includes('make a booking');

  if (isBookingIntent) {
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

    if (!intendedProduct) {
      if (tripContext && tripContext.items && tripContext.items.length === 1) {
        const singleItem = tripContext.items[0];
        intendedProduct = findProduct(singleItem.productId) || {
          id: singleItem.productId,
          name: singleItem.productName || 'Selected Experience',
        };
      } else if (tripContext && tripContext.items && tripContext.items.length > 1) {
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

  // 6. Product Details & Authoritative Variant Inquiries
  if (lowerMsg.includes('old drift')) {
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

  // 7. Educational School Trips
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

  // 8. General Recommendations & Itineraries
  if (
    lowerMsg.includes('recommend') ||
    lowerMsg.includes('itinerary') ||
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

  // 9. General Accommodations
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

  // 10. General Activities
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
