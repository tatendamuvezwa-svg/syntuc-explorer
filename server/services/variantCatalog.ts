import { getCollectionDocs, getDocById, setDocById, updateDocById, deleteDocById } from '../lib/firestore.ts';

export type PricingBasisType =
  | 'per_person'
  | 'per_room_night'
  | 'per_person_sharing_night'
  | 'per_single_room_night'
  | 'per_group';

export interface CompulsoryFee {
  name: string;
  amount: number;
  currency: string;
  basis: 'per_person' | 'per_person_per_night' | 'per_room_night';
}

export interface AuthoritativeVariant {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  price: number; // Absolute authoritative unit rate
  priceDelta?: string; // Backwards compatible string representation
  currency: string;
  priceBasis: PricingBasisType;
  occupancyType?: 'sharing' | 'single' | 'room' | 'ticket';
  category?: string;
  season?: 'high' | 'low' | 'green' | 'mid' | 'high_water' | 'low_water';
  mealPlan?: string;
  duration?: string | null;
  compulsoryFees?: CompulsoryFee[];
  childRate?: number;
  isActive: boolean;
  evidenceStatus: 'ESTABLISHED' | 'SUPPORTED' | 'PROVISIONAL';
  supplierNote?: string;
}

/**
 * Baseline authoritative 2026 variants for confirmed supplier offerings.
 * Used when no custom coordinator-defined variants exist in Firestore for that product.
 */
export const CONFIRMED_PRODUCT_VARIANTS: Record<string, AuthoritativeVariant[]> = {
  // 1. Shearwater Batoka Gorge White Water Rafting
  prod_white_water_rafting: [
    {
      id: 'var_rafting_high_water',
      productId: 'prod_white_water_rafting',
      name: 'High Water Rafting (Jan–Jul)',
      description: 'Run through rapid 11 to 24 in high volume Zambezi flow. Buffet lunch and transfers included.',
      price: 161,
      priceDelta: '0',
      currency: 'USD',
      priceBasis: 'per_person',
      season: 'high_water',
      duration: 'Full Day (approx 7.5 hours)',
      compulsoryFees: [
        {
          name: 'National Parks River Conservation Fee',
          amount: 12,
          currency: 'USD',
          basis: 'per_person',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Indicative high water season (Jan–Jul). Rapid selection and departure subject to real-time river levels confirmed by Shearwater.',
    },
    {
      id: 'var_rafting_low_water',
      productId: 'prod_white_water_rafting',
      name: 'Low Water Rafting (Jul–Dec)',
      description: 'The premier grade 5 white-water descent tackling legendary rapids 1 to 19 through Batoka Gorge.',
      price: 173,
      priceDelta: '12',
      currency: 'USD',
      priceBasis: 'per_person',
      season: 'low_water',
      duration: 'Full Day (approx 7.5 hours)',
      compulsoryFees: [
        {
          name: 'National Parks River Conservation Fee',
          amount: 12,
          currency: 'USD',
          basis: 'per_person',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Indicative low water season (mid-Jul–Dec). Pure adrenaline grade 5 cataracts. River conditions confirmed on day of departure.',
    },
  ],

  // 2. Shearwater Explorers Village (2026 Confirmed Categories & Occupancies)
  prod_explorers: [
    {
      id: 'var_explorers_std_sharing',
      productId: 'prod_explorers',
      name: 'Standard Garden Chalet — Sharing',
      description: 'Air-conditioned ensuite chalet surrounded by natural indigenous gardens. Buffet breakfast included.',
      price: 110,
      priceDelta: '0',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      occupancyType: 'sharing',
      category: 'Standard Chalet',
      mealPlan: 'Bed & Breakfast included',
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Official 2026 contracted rate: US$110 per person sharing per night. Buffet breakfast included.',
    },
    {
      id: 'var_explorers_deluxe_sharing',
      productId: 'prod_explorers',
      name: 'Deluxe Village Suite — Sharing',
      description: 'Premium spacious suite with private veranda, refrigerator and luxury appointments. Breakfast included.',
      price: 137,
      priceDelta: '27',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      occupancyType: 'sharing',
      category: 'Deluxe Suite',
      mealPlan: 'Bed & Breakfast included',
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Official 2026 contracted rate: US$137 per person sharing per night. Buffet breakfast included.',
    },
    {
      id: 'var_explorers_std_single',
      productId: 'prod_explorers',
      name: 'Standard Garden Chalet — Single Occupancy',
      description: 'Private garden chalet for solo travelers. Full breakfast included.',
      price: 176,
      priceDelta: '66',
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      occupancyType: 'single',
      category: 'Standard Chalet',
      mealPlan: 'Bed & Breakfast included',
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Official 2026 single room tariff: US$176 per night. Breakfast included.',
    },
    {
      id: 'var_explorers_deluxe_single',
      productId: 'prod_explorers',
      name: 'Deluxe Village Suite — Single Occupancy',
      description: 'Executive suite reserved for single occupancy. Full breakfast included.',
      price: 218,
      priceDelta: '108',
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      occupancyType: 'single',
      category: 'Deluxe Suite',
      mealPlan: 'Bed & Breakfast included',
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Official 2026 single room tariff: US$218 per night. Breakfast included.',
    },
  ],

  // 3. Old Drift Lodge (2026 Seasonal Sharing Rates)
  prod_olddrift: [
    {
      id: 'var_olddrift_green_sharing',
      productId: 'prod_olddrift',
      name: 'Luxury Tented Suite — Green Season (Sharing)',
      description: 'Spacious riverside suite on Zambezi National Park banks. All meals, game drives, boat cruises included.',
      price: 835,
      priceDelta: '-252',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      season: 'green',
      occupancyType: 'sharing',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive (All meals, local drinks & activities)',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Green Season: Jan 11 – Mar 31 and Dec 1 – Dec 20. US$835 pppn + US$50 conservation levy.',
    },
    {
      id: 'var_olddrift_mid_sharing',
      productId: 'prod_olddrift',
      name: 'Luxury Tented Suite — Mid Season (Sharing)',
      description: 'Luxury tented suite during prime shoulder season. All meals, game drives and river safaris included.',
      price: 1042,
      priceDelta: '-45',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      season: 'mid',
      occupancyType: 'sharing',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive (All meals, local drinks & activities)',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Mid Season: Apr 1 – Jun 30 and Nov 1 – Nov 30. US$1,042 pppn + US$50 conservation levy.',
    },
    {
      id: 'var_olddrift_high_sharing',
      productId: 'prod_olddrift',
      name: 'Luxury Tented Suite — High Season (Sharing)',
      description: 'Peak wildlife viewing season right on the Zambezi River. Fully inclusive luxury safari experience.',
      price: 1087,
      priceDelta: '0',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      season: 'high',
      occupancyType: 'sharing',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive (All meals, local drinks & activities)',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'High Season: Jul 1 – Oct 31 and Dec 21 – Jan 10. US$1,087 pppn + US$50 conservation levy.',
    },
  ],

  // 4. The Elephant Camp (2026 Seasonal Sharing & Single Rates)
  prod_elephantcamp: [
    {
      id: 'var_elephant_green_sharing',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tented Suite — Green Season (Sharing)',
      description: 'Luxury suite overlooking gorge and waterhole. Private plunge pool, all meals and interaction included.',
      price: 835,
      priceDelta: '-252',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      season: 'green',
      occupancyType: 'sharing',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Green Season: Jan 11 – Mar 31 and Dec 1 – Dec 20. US$835 pppn + US$50 levy.',
    },
    {
      id: 'var_elephant_mid_sharing',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tented Suite — Mid Season (Sharing)',
      description: 'Mid season luxury tented suite with view of Victoria Falls spray. Fully inclusive.',
      price: 1042,
      priceDelta: '-45',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      season: 'mid',
      occupancyType: 'sharing',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Mid Season: Apr 1 – Jun 30 and Nov 1 – Nov 30. US$1,042 pppn + US$50 levy.',
    },
    {
      id: 'var_elephant_high_sharing',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tented Suite — High Season (Sharing)',
      description: 'High season luxury suite. Breathtaking views of the Batoka Gorge and private plunge pool.',
      price: 1087,
      priceDelta: '0',
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      season: 'high',
      occupancyType: 'sharing',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'High Season: Jul 1 – Oct 31 and Dec 21 – Jan 10. US$1,087 pppn + US$50 levy.',
    },
    {
      id: 'var_elephant_green_single',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tented Suite — Green Season (Single Occupancy)',
      description: 'Solo guest luxury tented suite during Green Season. Fully inclusive.',
      price: 835,
      priceDelta: '-252',
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      season: 'green',
      occupancyType: 'single',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Green Season Single: US$835 per night + US$50 levy.',
    },
    {
      id: 'var_elephant_mid_single',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tented Suite — Mid Season (Single Occupancy)',
      description: 'Solo guest luxury tented suite during Mid Season. Fully inclusive.',
      price: 1564,
      priceDelta: '477',
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      season: 'mid',
      occupancyType: 'single',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Mid Season Single: US$1,564 per night + US$50 levy.',
    },
    {
      id: 'var_elephant_high_single',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tented Suite — High Season (Single Occupancy)',
      description: 'Solo guest luxury tented suite during High Season. Fully inclusive.',
      price: 1632,
      priceDelta: '545',
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      season: 'high',
      occupancyType: 'single',
      category: 'Luxury Tented Suite',
      mealPlan: 'Fully Inclusive',
      compulsoryFees: [
        {
          name: 'Conservation & Community Levy',
          amount: 50,
          currency: 'USD',
          basis: 'per_person_per_night',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'High Season Single: US$1,632 per night + US$50 levy.',
    },
  ],

  // 5. Zambezi Explorer Luxury Sunset Cruise — Pure Africa
  prod_zambezi_explorer_cruise: [
    {
      id: 'var_cruise_luxury_deck',
      productId: 'prod_zambezi_explorer_cruise',
      name: 'Sunset Cruise — Luxury Deck (Decks 1 & 2)',
      description: 'Zambezi Explorer Decks 1 and 2. Summer 16:30–18:30; winter 16:00–18:00. Transfers, canapés and beverages. Capacity 2–116 guests.',
      price: 69,
      priceDelta: '-6',
      currency: 'USD',
      priceBasis: 'per_person',
      category: 'Luxury Deck',
      duration: '2 Hours (Sunset)',
      compulsoryFees: [
        {
          name: 'National Parks River Conservation Fee',
          amount: 12,
          currency: 'USD',
          basis: 'per_person',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Official Pure Africa 2026 leaflet: US$69 base fare plus US$12 National Park fee per person.',
    },
    {
      id: 'var_cruise_signature_deck',
      productId: 'prod_zambezi_explorer_cruise',
      name: 'Signature Deck (Upper VIP Deck)',
      description: 'Exclusive top deck vantage, premium top-shelf bar, artisanal hors d\'oeuvres and dedicated service.',
      price: 110,
      priceDelta: '35',
      currency: 'USD',
      priceBasis: 'per_person',
      category: 'Signature Deck',
      duration: '2 Hours (Sunset)',
      compulsoryFees: [
        {
          name: 'National Parks River Conservation Fee',
          amount: 12,
          currency: 'USD',
          basis: 'per_person',
        },
      ],
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Official Pure Africa 2026 leaflet: US$110 base fare plus US$12 National Park fee per person.',
    },
  ],

  // 6. Simunye — We Are One: Theatrical Experience
  prod_simunye_theatre: [
    {
      id: 'var_simunye_adult',
      productId: 'prod_simunye_theatre',
      name: 'Adult Admission (Age 16+)',
      description: 'Standard adult entry to the renowned multimedia theatrical spectacle.',
      price: 58,
      priceDelta: '0',
      currency: 'USD',
      priceBasis: 'per_person',
      category: 'Adult',
      duration: '1.5 Hours',
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
    },
    {
      id: 'var_simunye_child',
      productId: 'prod_simunye_theatre',
      name: 'Child Admission (Under 16 Years)',
      description: 'Special 50% youth tariff for children under 16 years.',
      price: 29,
      priceDelta: '-29',
      currency: 'USD',
      priceBasis: 'per_person',
      category: 'Child',
      childRate: 29,
      duration: '1.5 Hours',
      isActive: true,
      evidenceStatus: 'ESTABLISHED',
      supplierNote: 'Proof of age may be requested by theatre ushers at entry.',
    },
  ],
  // Pure Africa 2026 official leaflet: Sunrise Cruise
  prod_pure_africa_sunrise_cruise: [
    {
      id: 'var_pure_africa_sunrise_reflections',
      productId: 'prod_pure_africa_sunrise_cruise',
      name: 'Standard Sunrise Cruise — Zambezi Reflections',
      description: '06:00–08:00; departures 05:30–10:00 on request. English breakfast, transfers. Minimum 4, maximum 30 guests.',
      price: 92, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '2 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Fee excluded from base price.'
    },
    {
      id: 'var_pure_africa_sunrise_kalunda',
      productId: 'prod_pure_africa_sunrise_cruise',
      name: 'Private Sunrise Cruise — Kalunda',
      description: 'Private vessel; 05:30–10:00 departure window on request. Continental breakfast and transfers. Minimum 2, maximum 6 guests.',
      price: 92, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '2 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official leaflet lists US$92 per person; confirm private charter terms with supplier.'
    }
  ],
  // Pure Africa 2026 official leaflet: Lunch Cruise
  prod_pure_africa_lunch_cruise: [
    {
      id: 'var_pure_africa_lunch_reflections',
      productId: 'prod_pure_africa_lunch_cruise',
      name: 'Standard Lunch Cruise — Zambezi Reflections',
      description: '12:00–14:00; transfers, three-course lunch and beverages. Minimum 4, maximum 30 guests.',
      price: 92, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '2 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Fee excluded from base price.'
    },
    {
      id: 'var_pure_africa_lunch_kalunda',
      productId: 'prod_pure_africa_lunch_cruise',
      name: 'Private Lunch Cruise — Kalunda',
      description: '12:00–14:00; transfers, three-course lunch and beverages. Minimum 2, maximum 6 guests.',
      price: 92, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '2 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official leaflet lists US$92 per person; confirm private charter terms with supplier.'
    }
  ],
  // Pure Africa 2026 official leaflet: Dinner Cruise aboard Zambezi Breeze
  prod_pure_africa_dinner_cruise: [
    {
      id: 'var_pure_africa_zambezi_breeze_dinner',
      productId: 'prod_pure_africa_dinner_cruise',
      name: 'Dinner Cruise — Zambezi Breeze',
      description: '17:00–20:00; four-course dinner, beverages and transfers. Capacity 2–70 guests.',
      price: 110, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '3 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Fee excluded from base price.'
    }
  ],
  // Pure Africa 2026 official leaflet: Classic Dinner Cruise
  prod_pure_africa_classic_dinner_cruise: [
    {
      id: 'var_pure_africa_classic_dinner',
      productId: 'prod_pure_africa_classic_dinner_cruise',
      name: 'Classic Dinner Cruise — Zambezi Reflections',
      description: '17:00–19:00 cruise until sunset, then float at the jetty until 20:00. Six-course dinner and premium beverages. No children under 12.',
      price: 185, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '3 hours',
      compulsoryFees: [{ name: 'National Parks Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Fee excluded from base price.'
    }
  ],
  // Pure Africa 2026 official leaflet: Eatery Dinner options
  prod_pure_africa_eatery_dinner: [
    {
      id: 'var_pure_africa_eatery_alacarte',
      productId: 'prod_pure_africa_eatery_dinner',
      name: 'The Eatery Dinner — Three-course à la carte',
      description: '18:00–21:00. Dinner only; transfers and beverages excluded.',
      price: 49, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '3 hours', isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet.'
    },
    {
      id: 'var_pure_africa_eatery_potjie',
      productId: 'prod_pure_africa_eatery_dinner',
      name: 'The Eatery Potjie Dinner — Three-course Potjie',
      description: '18:00–21:00. Three-course Potjie dinner only; transfers and beverages excluded.',
      price: 49, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '3 hours', isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet.'
    }
  ],
  // Pure Africa 2026 official leaflet: Eatery Dinner & Sunset Cruise Combo
  prod_pure_africa_eatery_dinner_sunset_combo: [
    {
      id: 'var_pure_africa_eatery_combo_luxury',
      productId: 'prod_pure_africa_eatery_dinner_sunset_combo',
      name: 'Luxury Deck — Dinner & Sunset Cruise Combo',
      description: 'Summer 16:30–21:00; winter 16:00–21:00. Three-course dinner at The Eatery. Luxury Deck capacity 2–40.',
      price: 110, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '5 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Dinner beverages excluded; fee additional.'
    },
    {
      id: 'var_pure_africa_eatery_combo_signature',
      productId: 'prod_pure_africa_eatery_dinner_sunset_combo',
      name: 'Signature Deck — Dinner & Sunset Cruise Combo',
      description: 'Summer 16:30–21:00; winter 16:00–21:00. Three-course dinner at The Eatery. Signature Deck capacity 2–34.',
      price: 156, priceDelta: '46', currency: 'USD', priceBasis: 'per_person',
      duration: '5 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Dinner beverages excluded; fee additional.'
    }
  ],
  // Pure Africa 2026 official leaflet: Eatery Potjie Dinner & Sunset Cruise Combo
  prod_pure_africa_eatery_potjie_sunset_combo: [
    {
      id: 'var_pure_africa_potjie_combo_luxury',
      productId: 'prod_pure_africa_eatery_potjie_sunset_combo',
      name: 'Luxury Deck — Potjie Dinner & Sunset Cruise Combo',
      description: 'Summer 16:30–21:00; winter 16:00–21:00. Three-course Potjie dinner at The Eatery. Luxury Deck capacity 2–40.',
      price: 110, priceDelta: '0', currency: 'USD', priceBasis: 'per_person',
      duration: '5 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Beverages at The Eatery excluded; fee additional.'
    },
    {
      id: 'var_pure_africa_potjie_combo_signature',
      productId: 'prod_pure_africa_eatery_potjie_sunset_combo',
      name: 'Signature Deck — Potjie Dinner & Sunset Cruise Combo',
      description: 'Summer 16:30–21:00; winter 16:00–21:00. Three-course Potjie dinner at The Eatery. Signature Deck capacity 2–34.',
      price: 156, priceDelta: '46', currency: 'USD', priceBasis: 'per_person',
      duration: '5 hours',
      compulsoryFees: [{ name: 'National Park Fee', amount: 12, currency: 'USD', basis: 'per_person' }],
      isActive: true, evidenceStatus: 'SUPPORTED',
      supplierNote: 'Official Pure Africa 2026 leaflet. Beverages at The Eatery excluded; fee additional.'
    }
  ]
};

/**
 * Retrieves ALL variants for a product for Coordinator management (including inactive ones).
 * Merges confirmed catalog baseline variants with custom or overridden variants from Firestore `product_variants`.
 */
export async function getAllCoordinatorVariantsForProduct(productId: string): Promise<AuthoritativeVariant[]> {
  const baseline = CONFIRMED_PRODUCT_VARIANTS[productId] || [];
  try {
    const firestoreVariants = await getCollectionDocs<any>('product_variants');
    const matched = firestoreVariants.filter((v) => v.productId === productId);

    const variantMap = new Map<string, AuthoritativeVariant>();
    // 1. Seed baseline confirmed catalog variants
    for (const b of baseline) {
      variantMap.set(b.id, { ...b });
    }

    // 2. Overlay Firestore documents (custom additions or modified baselines)
    for (const v of matched) {
      variantMap.set(v.id, {
        id: v.id,
        productId: v.productId,
        name: v.name,
        description: v.description || null,
        price: Number(v.price !== undefined ? v.price : (v.basePrice !== undefined ? v.basePrice : v.priceDelta || 0)),
        priceDelta: String(v.priceDelta || '0'),
        currency: v.currency || 'USD',
        priceBasis: v.priceBasis || 'per_person',
        occupancyType: v.occupancyType,
        category: v.category,
        season: v.season,
        mealPlan: v.mealPlan,
        duration: v.duration || null,
        compulsoryFees: v.compulsoryFees || [],
        childRate: v.childRate ? Number(v.childRate) : undefined,
        isActive: v.isActive !== false,
        evidenceStatus: v.evidenceStatus || 'SUPPORTED',
        supplierNote: v.supplierNote,
      });
    }

    return Array.from(variantMap.values());
  } catch (err) {
    console.warn(`[Variants] Could not read product_variants from Firestore for coordinator (${productId}):`, err);
    return baseline;
  }
}

/**
 * Retrieves all active authoritative variants for a product for guest display and booking.
 */
export async function getAuthoritativeVariantsForProduct(productId: string): Promise<AuthoritativeVariant[]> {
  const allVariants = await getAllCoordinatorVariantsForProduct(productId);
  return allVariants.filter((v) => v.isActive !== false);
}

/**
 * Creates a new coordinator variant in Firestore.
 * Enforces non-negative price, non-empty name, and duplicate name prevention.
 */
export async function createCoordinatorVariant(
  productId: string,
  variantData: {
    id?: string;
    name: string;
    description?: string;
    price: number;
    currency?: string;
    priceBasis?: PricingBasisType;
    category?: string;
    duration?: string;
    compulsoryFees?: CompulsoryFee[];
    childRate?: number;
    supplierNote?: string;
    isActive?: boolean;
  }
): Promise<AuthoritativeVariant> {
  const cleanName = (variantData.name || '').trim();
  if (!cleanName) {
    throw new Error('VARIANT_NAME_REQUIRED: Variant name is required and cannot be empty.');
  }

  const numPrice = Number(variantData.price);
  if (isNaN(numPrice) || numPrice < 0) {
    throw new Error('INVALID_VARIANT_PRICE: Variant price must be a valid non-negative number.');
  }

  // Duplicate detection against existing variants for this product
  const existingVariants = await getAllCoordinatorVariantsForProduct(productId);
  const duplicate = existingVariants.find(
    (v) => v.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`DUPLICATE_VARIANT_NAME: A variant with name "${cleanName}" already exists for this product.`);
  }

  const id = variantData.id?.trim() || `var_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const nowIso = new Date().toISOString();

  const newVariant: any = {
    id,
    productId,
    name: cleanName,
    description: variantData.description?.trim() || null,
    price: numPrice,
    priceDelta: '0',
    currency: variantData.currency || 'USD',
    priceBasis: variantData.priceBasis || 'per_person',
    duration: variantData.duration?.trim() || null,
    compulsoryFees: variantData.compulsoryFees || [],
    isActive: variantData.isActive !== false,
    evidenceStatus: 'SUPPORTED',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (variantData.category?.trim()) {
    newVariant.category = variantData.category.trim();
  }
  if (variantData.childRate !== undefined && !isNaN(Number(variantData.childRate))) {
    newVariant.childRate = Number(variantData.childRate);
  }
  if (variantData.supplierNote?.trim()) {
    newVariant.supplierNote = variantData.supplierNote.trim();
  }

  await setDocById('product_variants', id, newVariant);
  return newVariant as AuthoritativeVariant;
}

/**
 * Updates an existing coordinator variant in Firestore.
 * If the variant was only defined in baseline memory, materializes it in Firestore with updates.
 */
export async function updateCoordinatorVariant(
  productId: string,
  variantId: string,
  updates: Partial<AuthoritativeVariant>
): Promise<AuthoritativeVariant> {
  if (!variantId) {
    throw new Error('VARIANT_ID_REQUIRED: Variant ID is required for update.');
  }

  // Check if variant exists in Firestore
  let existing: any = await getDocById<any>('product_variants', variantId);

  // If not found in Firestore, check baseline
  if (!existing) {
    const baseline = (CONFIRMED_PRODUCT_VARIANTS[productId] || []).find((v) => v.id === variantId);
    if (!baseline) {
      throw new Error(`VARIANT_NOT_FOUND: Variant ${variantId} does not exist for product ${productId}.`);
    }
    existing = { ...baseline, createdAt: new Date().toISOString() };
  }

  if (existing.productId !== productId) {
    throw new Error(`SECURITY_VIOLATION: Variant ${variantId} does not belong to product ${productId}.`);
  }

  if (updates.name !== undefined) {
    const cleanName = updates.name.trim();
    if (!cleanName) {
      throw new Error('VARIANT_NAME_REQUIRED: Variant name cannot be empty.');
    }
    // Check duplicates
    const allVars = await getAllCoordinatorVariantsForProduct(productId);
    const dup = allVars.find((v) => v.id !== variantId && v.name.toLowerCase() === cleanName.toLowerCase());
    if (dup) {
      throw new Error(`DUPLICATE_VARIANT_NAME: Another variant with name "${cleanName}" already exists for this product.`);
    }
    existing.name = cleanName;
  }

  if (updates.price !== undefined) {
    const numPrice = Number(updates.price);
    if (isNaN(numPrice) || numPrice < 0) {
      throw new Error('INVALID_VARIANT_PRICE: Variant price must be a valid non-negative number.');
    }
    existing.price = numPrice;
  }

  if (updates.description !== undefined) existing.description = updates.description?.trim() || null;
  if (updates.currency !== undefined) existing.currency = updates.currency;
  if (updates.priceBasis !== undefined) existing.priceBasis = updates.priceBasis;
  if (updates.category !== undefined) existing.category = updates.category?.trim() || null;
  if (updates.duration !== undefined) existing.duration = updates.duration?.trim() || null;
  if (updates.compulsoryFees !== undefined) existing.compulsoryFees = updates.compulsoryFees;
  if (updates.childRate !== undefined) existing.childRate = Number(updates.childRate);
  if (updates.supplierNote !== undefined) existing.supplierNote = updates.supplierNote?.trim() || null;
  if (updates.isActive !== undefined) existing.isActive = Boolean(updates.isActive);

  existing.updatedAt = new Date().toISOString();

  // Strip any undefined keys before sending to Firestore
  const cleanDoc: any = {};
  for (const [k, v] of Object.entries(existing)) {
    if (v !== undefined) {
      cleanDoc[k] = v;
    }
  }

  await setDocById('product_variants', variantId, cleanDoc);
  return cleanDoc as AuthoritativeVariant;
}

/**
 * Safely toggles or deactivates a variant in Firestore.
 */
export async function toggleVariantActiveState(
  productId: string,
  variantId: string,
  targetActiveState?: boolean
): Promise<AuthoritativeVariant> {
  const existing = await getAllCoordinatorVariantsForProduct(productId);
  const found = existing.find((v) => v.id === variantId);
  if (!found) {
    throw new Error(`VARIANT_NOT_FOUND: Variant ${variantId} does not exist for product ${productId}.`);
  }

  const newState = targetActiveState !== undefined ? Boolean(targetActiveState) : !found.isActive;
  return updateCoordinatorVariant(productId, variantId, { isActive: newState });
}

/**
 * Resolves a specific authoritative variant by ID for a product.
 * Confirms that the variant belongs to the requested product and is active.
 */
export async function resolveAuthoritativeVariant(
  productId: string,
  variantId: string
): Promise<AuthoritativeVariant | null> {
  if (!variantId) return null;

  // Check Firestore first
  try {
    const docVariant = await getDocById<any>('product_variants', variantId);
    if (docVariant) {
      if (docVariant.productId !== productId) {
        throw new Error(
          `Security violation: Variant ${variantId} belongs to product ${docVariant.productId}, not ${productId}.`
        );
      }
      if (docVariant.isActive === false) {
        throw new Error(`Variant ${variantId} is currently marked inactive.`);
      }
      return {
        id: docVariant.id,
        productId: docVariant.productId,
        name: docVariant.name,
        description: docVariant.description || null,
        price: Number(docVariant.price !== undefined ? docVariant.price : (docVariant.basePrice !== undefined ? docVariant.basePrice : docVariant.priceDelta || 0)),
        priceDelta: String(docVariant.priceDelta || '0'),
        currency: docVariant.currency || 'USD',
        priceBasis: docVariant.priceBasis || 'per_person',
        occupancyType: docVariant.occupancyType,
        category: docVariant.category,
        season: docVariant.season,
        mealPlan: docVariant.mealPlan,
        duration: docVariant.duration || null,
        compulsoryFees: docVariant.compulsoryFees || [],
        childRate: docVariant.childRate ? Number(docVariant.childRate) : undefined,
        isActive: Boolean(docVariant.isActive),
        evidenceStatus: docVariant.evidenceStatus || 'SUPPORTED',
        supplierNote: docVariant.supplierNote,
      };
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('Security violation') || err.message.includes('currently marked inactive'))) {
      throw err;
    }
  }

  // Check confirmed catalog variants baseline
  const baseline = CONFIRMED_PRODUCT_VARIANTS[productId] || [];
  const found = baseline.find((v) => v.id === variantId);
  if (found) {
    if (found.isActive === false) {
      throw new Error(`Variant ${variantId} is currently marked inactive.`);
    }
    return found;
  }

  return null;
}
