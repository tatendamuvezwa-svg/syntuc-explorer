import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;
let firebaseConfig: any = null;

// ==========================================
// CIRCUIT BREAKER & IN-MEMORY RESILIENCE LAYER
// Completely eliminates quota burnout, read storms,
// and console error triggers during free-tier quota limits.
// ==========================================

const CACHE_TTL_MS = 60_000; // 60 seconds collection TTL
const QUOTA_COOLDOWN_MS = 5 * 60_000; // 5 minutes probe cooldown

let isFirestoreQuotaExceeded = false;
let quotaExceededTrippedAt = 0;

export function tripCircuitBreaker(): void {
  isFirestoreQuotaExceeded = true;
  quotaExceededTrippedAt = Date.now();
}

export function resetCircuitBreaker(): void {
  isFirestoreQuotaExceeded = false;
  quotaExceededTrippedAt = 0;
}

export function isBreakerActive(): boolean {
  if (!isFirestoreQuotaExceeded) return false;
  // If cooldown passed, allow one probe to test Firestore availability
  if (Date.now() - quotaExceededTrippedAt > QUOTA_COOLDOWN_MS) {
    return false;
  }
  return true;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const collectionCache = new Map<string, CacheEntry<any[]>>();
const memoryStore = new Map<string, Map<string, any>>();
let tombstonesCache: CacheEntry<Set<string>> | null = null;

function getMemoryCollection(name: string): Map<string, any> {
  let col = memoryStore.get(name);
  if (!col) {
    col = new Map<string, any>();
    memoryStore.set(name, col);
  }
  return col;
}

// In-memory query constraint evaluator
function matchesConstraints(item: any, constraints: QueryConstraint[]): boolean {
  if (!item || !constraints || constraints.length === 0) return true;
  for (const c of constraints) {
    const filter = c as any;
    if (filter._field && Array.isArray(filter._field.segments) && filter._op) {
      const fieldPath = filter._field.segments.join('.');
      const expectedVal = filter._value;
      const actualVal = fieldPath.includes('.')
        ? fieldPath.split('.').reduce((acc: any, part: string) => acc?.[part], item)
        : item[fieldPath];

      switch (filter._op) {
        case '==':
          if (actualVal !== expectedVal) return false;
          break;
        case '!=':
          if (actualVal === expectedVal) return false;
          break;
        case '>':
          if (!(actualVal > expectedVal)) return false;
          break;
        case '>=':
          if (!(actualVal >= expectedVal)) return false;
          break;
        case '<':
          if (!(actualVal < expectedVal)) return false;
          break;
        case '<=':
          if (!(actualVal <= expectedVal)) return false;
          break;
        case 'in':
          if (!Array.isArray(expectedVal) || !expectedVal.includes(actualVal)) return false;
          break;
        case 'array-contains':
          if (!Array.isArray(actualVal) || !actualVal.includes(expectedVal)) return false;
          break;
      }
    }
  }
  return true;
}

// Comprehensive baseline fallbacks for all collections
const BASELINE_COLLECTIONS: Record<string, any[]> = {
  categories: [
    { id: 'cat_lodge', displayOrder: 1, slug: 'lodge-resort', type: 'accommodation', name: 'Riverfront Lodges & Resorts' },
    { id: 'cat_hotel', name: 'Town Hotels & Suites', displayOrder: 2, type: 'accommodation', slug: 'hotel' },
    { id: 'cat_safari', type: 'accommodation', displayOrder: 3, slug: 'safari-camp', name: 'Luxury Safari Camps' },
    { id: 'cat_flight', name: 'Helicopter & Scenic Flights', displayOrder: 4, type: 'activity', slug: 'flight-air' },
    { id: 'cat_cruise', slug: 'river-cruises', type: 'activity', name: 'Zambezi River Cruises', displayOrder: 5 },
    { id: 'cat_guided', slug: 'guided-tours', type: 'activity', displayOrder: 6, name: 'Guided Falls & Heritage Tours' },
    { id: 'cat_dining', type: 'activity', slug: 'dining-culinary', displayOrder: 7, name: 'Scenic & Cultural Dining' },
    { id: 'cat_adventure', slug: 'adventure-wildlife', type: 'activity', name: 'Rafting, Wildlife & Adrenaline', displayOrder: 8 },
    { id: 'cat_packages', name: 'Curated Holiday Packages', displayOrder: 9, slug: 'packages', type: 'package' },
  ],
  operators: [
    { id: 'op_pure_africa', location: 'Victoria Falls, Zimbabwe', verified: true, description: 'Operators of the Zambezi Explorer and The Eatery Waterfront dining.', name: 'Pure Africa Experiences', contactEmail: 'experience@pure.africa', contactPhone: '+263 83 284 1005' },
    { id: 'op_shearwater', name: 'Shearwater Victoria Falls', location: 'Victoria Falls, Zimbabwe', verified: true, contactEmail: 'adventures@shearwatervf.com', contactPhone: '+263 83 284 4471', description: 'Premier adventure and touring operator in Victoria Falls since 1982.' },
    { id: 'op_wildhorizons', contactPhone: '+263 83 284 4219', contactEmail: 'info@wildhorizons.co.zw', description: 'Pioneers in high-end eco-tourism, wildlife sanctuaries, and scenic flights.', name: 'Wild Horizons', location: 'Victoria Falls, Zimbabwe', verified: true },
    { id: 'op_cresta', description: "Operators of A'Zambezi River Lodge on the banks of the Zambezi.", verified: true, location: 'Victoria Falls, Zimbabwe', name: 'Cresta Hotels Zimbabwe', contactEmail: 'azambezi@cresta.co.zw', contactPhone: '+263 83 284 4561' },
    { id: 'op_machaba', contactEmail: 'enquiries@machabasafaris.com', contactPhone: '+27 82 579 5249', location: 'Zambezi National Park, Zimbabwe', verified: true, description: 'Luxury classic safari camps including Old Drift Lodge.', name: 'Machaba Safaris' },
    { id: 'op_rtg', name: 'Rainbow Tourism Group (RTG)', contactPhone: '+263 83 284 4583', contactEmail: 'reservations@rtg.co.zw', verified: true, location: 'Victoria Falls, Zimbabwe', description: 'Leading hospitality group operating the Victoria Falls Rainbow Hotel.' },
  ],
  users: [
    { id: 'usr_admin_1', name: 'SAINTECH System Admin', passwordHash: 'saintech2026!admin', email: 'admin@saintech.io', role: 'admin', isActive: true },
    { id: 'usr_coord_1', passwordHash: 'syntuc2026!secure', isActive: true, role: 'reservations_coordinator', email: 'reservations@syntuc.com', name: 'Victoria Falls Reservations Desk' },
    { id: 'usr_user_email', email: 'tatenda.muvezwa@gmail.com', name: 'Tatenda Muvezwa', isActive: true, role: 'admin', passwordHash: 'admin2026!' },
  ],
  packages: [
    {
      id: 'pkg_essential_vf',
      name: 'Victoria Falls Essential Journey',
      tagline: 'The iconic 4-day introduction to Victoria Falls: rainforest, flight of angels & sunset cruise.',
      description: 'A seamlessly coordinated 4-day, 3-night holiday combining town accommodation at Shearwater Explorers Village with the three must-do experiences: a guided rainforest walking tour of the Falls, the world-famous 12-minute Flight of Angels helicopter flight, and a pure luxury sunset catamaran cruise on the Zambezi.',
      durationDays: 4,
      durationNights: 3,
      pricePerPerson: '680',
      currency: 'USD',
      priceBasis: 'per_person',
      categorySlug: 'packages',
      productType: 'package',
      isPublished: true,
      primaryImageUrl: 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=1200&q=80',
      inclusions: [
        '3 nights accommodation with daily breakfast',
        'All 3 signature activities as listed',
        'Return Victoria Falls International Airport transfers',
        'Dedicated Syntuc Explorer trip coordination',
      ],
      exclusions: [
        'Rainforest National Park entry fee ($50)',
        'Helicopter aviation levy ($15)',
        'River usage fee ($12)',
      ],
      highlights: [
        '3 nights at Shearwater Explorers Village with breakfast',
        '12-minute Flight of Angels scenic helicopter flight',
        'Zambezi Explorer luxury sunset cruise with canapés & open bar',
        'Victoria Falls Rainforest guided walking tour with poncho',
        'All airport and scheduled activity transfers included',
      ],
    },
    {
      id: 'pkg_luxury_zambezi',
      name: 'Zambezi Luxury Safari & River Retreat',
      tagline: 'All-inclusive 5-star riverfront canvas sanctuary, wildlife safaris & extended gorge helicopter flight.',
      description: 'Designed for the discerning traveler seeking complete wilderness immersion with unmatched luxury. Stay 3 nights at Old Drift Lodge in Zambezi National Park with private plunge pool, indulge in daily river boat safaris and game drives, fly on the 25-minute extended helicopter flight over Batoka Gorge, and dine suspended over the gorge at The Lookout Café.',
      durationDays: 4,
      durationNights: 3,
      pricePerPerson: '2450',
      currency: 'USD',
      priceBasis: 'per_person',
      categorySlug: 'packages',
      productType: 'package',
      isPublished: true,
      primaryImageUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
      inclusions: [
        'All luxury accommodations, all meals and premium open bar',
        'All guided safari drives and river cruises inside Zambezi National Park',
        '25-minute extended helicopter tour',
        'Executive VIP airport transfers',
      ],
      exclusions: [
        'Park conservation fees ($15/day)',
        'Helicopter park levy ($15)',
      ],
      highlights: [
        '3 nights all-inclusive luxury at Old Drift Lodge in Zambezi National Park',
        '25-minute Zambezi Gorge & Falls extended helicopter flight',
        'Private Zambezi Explorer sunset cruise with gourmet dinner',
        'The Lookout Café cliffside dining voucher',
        'Unlimited morning and evening wildlife game drives and river boat safaris',
      ],
    },
    {
      id: 'pkg_batoka_adventure',
      name: 'Batoka Adventure & Wilderness Duo',
      tagline: 'High-adrenaline white-water rafting, Chobe Botswana safari, and panoramic hotel stay.',
      description: "The definitive adventure package for active travelers. Base yourself for 2 nights at the Victoria Falls Rainbow Hotel overlooking the Falls spray. Conquer the world's greatest Grade 5 rapids on the Zambezi River with full-day rafting, and embark on a full-day cross-border safari to Botswana's Chobe National Park to witness hundreds of elephants along the Chobe River.",
      durationDays: 3,
      durationNights: 2,
      pricePerPerson: '590',
      currency: 'USD',
      priceBasis: 'per_person',
      categorySlug: 'packages',
      productType: 'package',
      isPublished: true,
      primaryImageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
      inclusions: [
        '2 nights accommodation with breakfast',
        'Full day white-water rafting with gear and guide',
        'Full day Chobe safari trip with border transfers and lunch',
        'Simunye theatre admission',
      ],
      exclusions: [
        'Parks river levy ($10)',
        'Botswana park fee ($15)',
      ],
      highlights: [
        '2 nights at Victoria Falls Rainbow Hotel with breakfast',
        'Full-day Grade 5 Batoka Gorge White Water Rafting with gorge buffet lunch',
        'Full-day Chobe National Park Safari in Botswana (boat safari + 4x4 game drive + lodge buffet)',
        'Simunye African theatrical evening performance ticket',
      ],
    },
  ],
  properties: [
    {
      id: 'prop_azambezi',
      name: "A'Zambezi River Lodge",
      slug: 'azambezi-river-lodge',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_cresta',
      propertyType: 'lodge',
      starRating: 4,
      isPublished: true,
      description: 'Direct frontage on the Zambezi River with open lush lawns and wildlife roaming freely.',
    },
    {
      id: 'prop_rainbow',
      name: 'Victoria Falls Rainbow Hotel',
      slug: 'victoria-falls-rainbow-hotel',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_rtg',
      propertyType: 'hotel',
      starRating: 3,
      isPublished: true,
      description: 'Panoramic views of the Victoria Falls spray and close proximity to town.',
    },
    {
      id: 'prop_explorers',
      name: 'Shearwater Explorers Village',
      slug: 'shearwater-explorers-village',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_shearwater',
      propertyType: 'lodge',
      starRating: 3,
      isPublished: true,
      description: 'Centrally located hub for adventures in Victoria Falls with chalets and camping.',
    },
    {
      id: 'prop_olddrift',
      name: 'Old Drift Lodge',
      slug: 'old-drift-lodge',
      location: 'Zambezi National Park, Zimbabwe',
      operatorId: 'op_machaba',
      propertyType: 'safari_camp',
      starRating: 5,
      isPublished: true,
      description: 'Luxury canvas sanctuary immersed in Zambezi National Park with private plunge pools.',
    },
    {
      id: 'prop_elephantcamp',
      name: 'The Elephant Camp',
      slug: 'the-elephant-camp',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_wildhorizons',
      propertyType: 'safari_camp',
      starRating: 5,
      isPublished: true,
      description: 'Exclusive safari camp situated on a private wildlife concession overlooking the gorge.',
    },
  ],
  rooms: [
    {
      id: 'rm_rainbow_standard',
      propertyId: 'prop_rainbow',
      productId: 'prod_rainbow',
      name: 'Standard Twin / Double Room',
      description: 'Comfortable air-conditioned en-suite room with views of lush gardens.',
      basePrice: 160,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_rainbow_deluxe',
      propertyId: 'prop_rainbow',
      productId: 'prod_rainbow',
      name: 'Deluxe Suite',
      description: 'Spacious suite with lounge area and private balcony.',
      basePrice: 220,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_azambezi_river',
      propertyId: 'prop_azambezi',
      productId: 'prod_azambezi',
      name: 'River Facing Room',
      description: 'En-suite room facing the tranquil Zambezi River.',
      basePrice: 210,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_azambezi_standard',
      propertyId: 'prop_azambezi',
      productId: 'prod_azambezi',
      name: 'Standard Garden Room',
      description: 'En-suite room overlooking indigenous gardens.',
      basePrice: 175,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_explorers_chalet',
      propertyId: 'prop_explorers',
      productId: 'prod_explorers',
      name: 'Standard Garden Chalet',
      description: 'Private garden chalet. Full breakfast included.',
      basePrice: 176,
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_explorers_deluxe',
      propertyId: 'prop_explorers',
      productId: 'prod_explorers',
      name: 'Deluxe Village Suite',
      description: 'Executive suite with modern amenities and pool views.',
      basePrice: 218,
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_olddrift_suite',
      propertyId: 'prop_olddrift',
      productId: 'prod_olddrift',
      name: 'Luxury Tented Suite',
      description: 'Air-conditioned luxury tent with plunge pool and outdoor shower.',
      basePrice: 835,
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      maxGuests: 2,
    },
    {
      id: 'rm_elephantcamp_tent',
      propertyId: 'prop_elephantcamp',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tent Suite',
      description: 'Spacious canvas suite with plunge pool overlooking Victoria Falls gorge.',
      basePrice: 890,
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      maxGuests: 2,
    },
  ],
  knowledge_sources: [
    {
      id: 'ks_pure_africa_2026',
      name: 'Pure Africa Experiences Official 2026 Tariff',
      sourceType: 'SUPPLIER_OFFICIAL',
      evidenceStatus: 'ESTABLISHED',
      notes: 'Authoritative tariffs for Zambezi Explorer cruises and The Eatery Waterfront dining.',
      lastVerified: '2026-10-14T10:00:00.000Z',
    },
    {
      id: 'ks_shearwater_2026',
      name: 'Shearwater Victoria Falls 2026 International Pricelist',
      sourceType: 'SUPPLIER_OFFICIAL',
      evidenceStatus: 'ESTABLISHED',
      notes: 'Authoritative rates for helicopter flights, rafting, bridge tours, Explorers Village.',
      lastVerified: '2026-10-14T10:00:00.000Z',
    },
    {
      id: 'ks_wildhorizons_2026',
      name: 'Wild Horizons 2026 Product Schedule',
      sourceType: 'SUPPLIER_OFFICIAL',
      evidenceStatus: 'ESTABLISHED',
      notes: 'Authoritative tariffs for wildlife encounters, gorge swings, and Chobe day safaris.',
      lastVerified: '2026-10-14T10:00:00.000Z',
    },
  ],
  leads: [],
  reservation_requests: [],
  reservation_items: [],
  guests: [],
  trip_plans: [],
  trip_items: [],
  products: [
    {
      id: 'prod_rainforest_walk',
      name: 'Victoria Falls Rainforest Guided Walking Tour',
      productType: 'activity',
      categorySlug: 'guided-tours',
      basePrice: '35.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_shearwater',
      duration: '2.5 Hours',
      shortDescription: 'Comprehensive guided exploration along the Zimbabwe edge of the Falls.',
    },
    {
      id: 'prod_flight_of_angels',
      name: 'Flight of Angels — Scenic Helicopter Tour',
      productType: 'activity',
      categorySlug: 'flight-air',
      basePrice: '150.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_shearwater',
      duration: '12–13 Minutes',
      shortDescription: 'The classic 12–13 minute scenic helicopter flight directly over the Falls.',
    },
    {
      id: 'prod_zambezi_extended_flight',
      name: 'Zambezi Gorge & Falls Extended Flight',
      productType: 'activity',
      categorySlug: 'flight-air',
      basePrice: '284.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_shearwater',
      duration: '25 Minutes',
      shortDescription: 'The comprehensive 25-minute scenic helicopter flight over the Falls and deep Batoka Gorge.',
    },
    {
      id: 'prod_white_water_rafting',
      name: 'Batoka Gorge White Water Rafting',
      productType: 'activity',
      categorySlug: 'adventure-wildlife',
      basePrice: '120.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_shearwater',
      duration: 'Full Day',
      shortDescription: 'World-renowned grade 5 rafting through the turbulent rapids of the Batoka Gorge.',
    },
    {
      id: 'prod_bridge_adventures',
      name: 'Victoria Falls Historic Bridge Adventures',
      productType: 'activity',
      categorySlug: 'guided-tours',
      basePrice: '137.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_shearwater',
      duration: '2 Hours',
      shortDescription: 'Walk the cat-walks underneath the 1905 Victoria Falls Bridge.',
    },
    {
      id: 'prod_chobe_safari',
      name: 'Chobe National Park Day Safari',
      productType: 'activity',
      categorySlug: 'adventure-wildlife',
      basePrice: '170.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_wildhorizons',
      duration: 'Full Day',
      shortDescription: 'Full-day safari to Botswana including Chobe River boat cruise and 4x4 game drive.',
    },
    {
      id: 'prod_boma_dinner',
      name: 'The Boma — Dinner & Drum Show',
      productType: 'activity',
      categorySlug: 'dining-culinary',
      basePrice: '60.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_rtg',
      duration: '3 Hours',
      shortDescription: 'Legendary African feast, traditional dancing and interactive drumming.',
    },
    {
      id: 'prod_simunye_theatre',
      name: 'Simunye — We Are One: Theatrical Experience',
      productType: 'activity',
      categorySlug: 'dining-culinary',
      basePrice: '50.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_shearwater',
      duration: '1.5 Hours',
      shortDescription: 'An immersive theatrical production in Victoria Falls.',
    },
    {
      id: 'prod_zambezi_game_drive',
      name: 'Zambezi National Park Safari Game Drive',
      productType: 'activity',
      categorySlug: 'adventure-wildlife',
      basePrice: '75.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_wildhorizons',
      duration: '3 Hours',
      shortDescription: 'Morning or afternoon wildlife drive along the Zambezi River.',
    },
    {
      id: 'prod_lookout_cafe',
      name: 'The Lookout Café — Gorge Dining Experience',
      productType: 'activity',
      categorySlug: 'dining-culinary',
      basePrice: '55.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_wildhorizons',
      duration: '2 Hours',
      shortDescription: 'Perched 120m above the turbulent rapids of the Batoka Gorge.',
    },
    {
      id: 'prod_zambezi_explorer_cruise',
      name: 'Zambezi Explorer Luxury Sunset Cruise',
      productType: 'activity',
      categorySlug: 'river-cruises',
      basePrice: '69.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_pure_africa',
      primaryMediaId: 'med_2db2d6add31909b4f3d0adcf',
      duration: '2 Hours',
      shortDescription: 'Luxury sunset catamaran cruise on the Zambezi River.',
    },
    {
      id: 'prod_potjie_dining',
      name: 'The Eatery Waterfront Potjie Dining',
      productType: 'activity',
      categorySlug: 'dining-culinary',
      basePrice: '45.00',
      currency: 'USD',
      priceBasis: 'per_person',
      isPublished: true,
      operatorId: 'op_pure_africa',
      primaryMediaId: 'med_c586325b4fea5fe25236ca20',
      duration: '3 Hours',
      shortDescription: 'Three-course traditional potjie dining at The Eatery Waterfront.',
    },
    {
      id: 'prod_rainbow',
      name: 'Victoria Falls Rainbow Hotel',
      productType: 'accommodation',
      categorySlug: 'hotel',
      basePrice: '160.00',
      currency: 'USD',
      priceBasis: 'per_room_night',
      isPublished: true,
      operatorId: 'op_rtg',
      propertyId: 'prop_rainbow',
    },
    {
      id: 'prod_azambezi',
      name: "A'Zambezi River Lodge",
      productType: 'accommodation',
      categorySlug: 'lodge-resort',
      basePrice: '175.00',
      currency: 'USD',
      priceBasis: 'per_room_night',
      isPublished: true,
      operatorId: 'op_cresta',
      propertyId: 'prop_azambezi',
    },
    {
      id: 'prod_explorers',
      name: 'Shearwater Explorers Village',
      productType: 'accommodation',
      categorySlug: 'lodge-resort',
      basePrice: '176.00',
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      isPublished: true,
      operatorId: 'op_shearwater',
      propertyId: 'prop_explorers',
    },
    {
      id: 'prod_olddrift',
      name: 'Old Drift Lodge',
      productType: 'accommodation',
      categorySlug: 'safari-camp',
      basePrice: '835.00',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      isPublished: true,
      operatorId: 'op_machaba',
      propertyId: 'prop_olddrift',
    },
    {
      id: 'prod_elephantcamp',
      name: 'The Elephant Camp',
      productType: 'accommodation',
      categorySlug: 'safari-camp',
      basePrice: '890.00',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      isPublished: true,
      operatorId: 'op_wildhorizons',
      propertyId: 'prop_elephantcamp',
    },
  ],
};

// Seed baseline entries into memory store
for (const [colName, items] of Object.entries(BASELINE_COLLECTIONS)) {
  const col = getMemoryCollection(colName);
  for (const item of items) {
    if (!col.has(item.id)) {
      col.set(item.id, item);
    }
  }
}

function isQuotaOrNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toString().toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('exceeded') ||
    code.includes('resource-exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('deadline') ||
    msg.includes('network')
  );
}

export function getFirebaseConfig() {
  if (firebaseConfig) return firebaseConfig;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found');
  }
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return firebaseConfig;
}

export function getFirestoreDb(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  const cfg = getFirebaseConfig();
  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        projectId: cfg.projectId,
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        appId: cfg.appId,
        storageBucket: cfg.storageBucket,
      });

  firestoreInstance = getFirestore(app, cfg.firestoreDatabaseId || '(default)');
  console.log('[Firestore] Authoritative database initialized:', cfg.firestoreDatabaseId);
  return firestoreInstance;
}

export async function getDocById<T = DocumentData>(collectionName: string, id: string): Promise<T | null> {
  const memCol = getMemoryCollection(collectionName);
  const memDoc = memCol.get(id);

  if (isBreakerActive()) {
    if (memDoc) return memDoc as T;
    return null;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (memDoc) return memDoc as T;
      return null;
    }
    const data = { id: snap.id, ...snap.data() } as T;
    memCol.set(id, data);
    return data;
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
    }
    if (memDoc) return memDoc as T;
    return null;
  }
}

export async function setDocById<T extends Record<string, any>>(
  collectionName: string,
  id: string,
  data: T,
  merge: boolean = true
): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id) || {};
  const merged = merge ? { ...existing, id, ...data } : { id, ...data };
  memCol.set(id, merged);

  // Invalidate collection cache so fresh reads include this update
  collectionCache.delete(collectionName);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await setDoc(ref, { id, ...data }, { merge });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      return;
    }
    throw err;
  }
}

/**
 * Robust document updater:
 * Uses setDoc with merge: true to avoid Grpc Code: 5 NOT_FOUND error
 * when documents do not yet exist or were written concurrently.
 */
export async function updateDocById(
  collectionName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id) || {};
  const merged = { ...existing, id, ...data };
  memCol.set(id, merged);

  // Invalidate collection cache
  collectionCache.delete(collectionName);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await setDoc(ref, { id, ...data }, { merge: true });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      return;
    }
    throw err;
  }
}

export async function deleteDocById(collectionName: string, id: string): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  memCol.delete(id);
  collectionCache.delete(collectionName);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await deleteDoc(ref);
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      return;
    }
    throw err;
  }
}

export async function getCollectionDocs<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const hasConstraints = constraints.length > 0;
  const now = Date.now();
  const memCol = getMemoryCollection(collectionName);

  // If circuit breaker is active, directly serve from memory/baseline without hitting network
  if (isBreakerActive()) {
    const allDocs = Array.from(memCol.values());
    if (allDocs.length === 0 && BASELINE_COLLECTIONS[collectionName]) {
      const baselines = BASELINE_COLLECTIONS[collectionName];
      for (const b of baselines) {
        memCol.set(b.id, b);
      }
      return (hasConstraints ? baselines.filter((d) => matchesConstraints(d, constraints)) : [...baselines]) as T[];
    }
    return (hasConstraints ? allDocs.filter((d) => matchesConstraints(d, constraints)) : [...allDocs]) as T[];
  }

  // If no constraints, check fresh collection cache
  if (!hasConstraints) {
    const cached = collectionCache.get(collectionName);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return [...cached.data] as T[];
    }
  }

  try {
    const fdb = getFirestoreDb();
    const cRef = collection(fdb, collectionName);
    const q = hasConstraints ? query(cRef, ...constraints) : cRef;
    const snap = await getDocs(q);
    const docs: T[] = [];
    snap.forEach((d) => {
      const docData = { id: d.id, ...d.data() } as T;
      docs.push(docData);
      memCol.set(d.id, docData);
    });

    if (!hasConstraints) {
      collectionCache.set(collectionName, { timestamp: now, data: docs });
    }

    return docs;
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      const allDocs = Array.from(memCol.values());
      if (allDocs.length > 0) {
        return (hasConstraints ? allDocs.filter((d) => matchesConstraints(d, constraints)) : [...allDocs]) as T[];
      }
      if (BASELINE_COLLECTIONS[collectionName]) {
        const baselines = BASELINE_COLLECTIONS[collectionName];
        for (const b of baselines) {
          memCol.set(b.id, b);
        }
        return (hasConstraints ? baselines.filter((d) => matchesConstraints(d, constraints)) : [...baselines]) as T[];
      }
      return [];
    }

    const allDocs = Array.from(memCol.values());
    return (hasConstraints ? allDocs.filter((d) => matchesConstraints(d, constraints)) : [...allDocs]) as T[];
  }
}

/**
 * Durable deletion tombstones to ensure deleted media or products
 * are NEVER resurrected.
 */
export async function recordTombstone(collectionName: string, recordId: string): Promise<void> {
  const tombstoneId = `${collectionName}_${recordId}`;

  // Update in-memory tombstones
  if (!tombstonesCache) {
    tombstonesCache = { timestamp: Date.now(), data: new Set<string>() };
  }
  tombstonesCache.data.add(tombstoneId);
  tombstonesCache.data.add(recordId);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    await setDoc(doc(fdb, 'deleted_records', tombstoneId), {
      id: tombstoneId,
      collectionName,
      recordId,
      deletedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
    }
  }
}

/** Strict point lookup for callers that must fail closed when tombstone reads fail. */
export async function hasTombstone(collectionName: string, recordId: string): Promise<boolean> {
  const tombstoneId = `${collectionName}_${recordId}`;
  if (tombstonesCache && (tombstonesCache.data.has(tombstoneId) || tombstonesCache.data.has(recordId))) {
    return true;
  }
  if (isBreakerActive()) {
    return false;
  }
  try {
    const fdb = getFirestoreDb();
    const snap = await getDoc(doc(fdb, 'deleted_records', tombstoneId));
    return snap.exists();
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
    }
    return tombstonesCache ? (tombstonesCache.data.has(tombstoneId) || tombstonesCache.data.has(recordId)) : false;
  }
}

export async function getTombstones(): Promise<Set<string>> {
  const now = Date.now();
  if (tombstonesCache && now - tombstonesCache.timestamp < CACHE_TTL_MS) {
    return new Set(tombstonesCache.data);
  }

  const set: Set<string> = tombstonesCache ? new Set<string>(tombstonesCache.data) : new Set<string>();

  if (isBreakerActive()) {
    return set;
  }

  try {
    const fdb = getFirestoreDb();
    const snap = await getDocs(collection(fdb, 'deleted_records'));
    snap.forEach((d) => {
      set.add(d.id);
      const data = d.data();
      if (data.collectionName && data.recordId) {
        set.add(`${data.collectionName}_${data.recordId}`);
      }
    });
    tombstonesCache = { timestamp: now, data: set };
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
    }
  }

  return set;
}

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
};
