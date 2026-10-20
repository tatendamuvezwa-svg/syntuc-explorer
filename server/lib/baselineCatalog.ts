import crypto from 'crypto';
import { operatorCatalogImport } from '../data/operatorCatalogImport.ts';
import { accommodationCatalogImport } from '../data/accommodationCatalogImport.ts';
import { HERITAGE_CRUISE_PRODUCT_ID } from '../services/seedHeritageCruise.ts';

const normalize = (value: unknown) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// 1. The 5 canonical published baseline accommodations
const BASELINE_ACCOMMODATIONS = [
  {
    id: 'prod_azambezi',
    slug: 'azambezi-river-lodge',
    name: "A'Zambezi River Lodge",
    productType: 'accommodation',
    categorySlug: 'lodge-resort',
    classification: 'Mid-range',
    operatorId: 'op_rtg',
    operatorName: 'Rainbow Tourism Group (RTG)',
    propertyId: 'prop_azambezi',
    location: 'Victoria Falls, Zimbabwe',
    duration: 'Per night stay',
    basePrice: '220',
    currency: 'USD',
    priceBasis: 'per_room_night',
    shortDescription:
      "A'Zambezi River Lodge is located directly on the Zambezi River beside Zambezi National Park in Victoria Falls, Zimbabwe.",
    description:
      "A'Zambezi River Lodge is located directly on the banks of the Zambezi River beside Zambezi National Park in Victoria Falls, Zimbabwe. Features the famous Amulonga Restaurant, lush riverfront lawns, wild animals roaming freely, swimming pool, and comfortable en-suite rooms.",
    primaryMediaId: 'med_azambezi_river',
    primaryImageUrl: '/uploads/med_azambezi_river.jpeg',
    primaryImageAlt: "A'Zambezi River Lodge",
    isPublished: true,
    isFeatured: true,
    evidenceStatus: 'ESTABLISHED',
    inclusions: ['Accommodation', 'Full English breakfast', 'Wi-Fi in public areas'],
    exclusions: ['Transfers', 'National Park entry fees', 'Personal beverages'],
    mandatoryFees: [],
    availabilityNote: 'Subject to partner confirmation',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    createdAt: '2026-10-09T07:19:26.899Z',
    updatedAt: '2026-10-18T20:00:00.000Z',
  },
  {
    id: 'prod_olddrift',
    slug: 'old-drift-lodge',
    name: 'Old Drift Lodge',
    productType: 'accommodation',
    categorySlug: 'safari-camp',
    classification: 'Luxury',
    operatorId: 'op_machaba',
    operatorName: 'Machaba Safaris',
    propertyId: 'prop_olddrift',
    location: 'Zambezi National Park, Zimbabwe',
    duration: 'Per night stay',
    basePrice: '1087',
    currency: 'USD',
    priceBasis: 'per_person',
    shortDescription:
      'Old Drift Lodge is an exquisite luxury tented lodge situated inside Zambezi National Park on the Zambezi River.',
    description:
      'Old Drift Lodge is an exquisite luxury tented lodge situated inside Zambezi National Park on the Zambezi River. Features air-conditioned luxury canvas suites with private plunge pools, river views, game drives, and safari boat cruises.',
    primaryMediaId: 'med_olddrift_suite',
    primaryImageUrl: '/uploads/med_olddrift_suite.jpeg',
    primaryImageAlt: 'Old Drift Lodge',
    isPublished: true,
    isFeatured: true,
    evidenceStatus: 'ESTABLISHED',
    inclusions: ['All meals', 'Local beverages', 'Safari game drives', 'River boat cruises'],
    exclusions: ['Premium brand beverages', 'National Park conservation fees'],
    mandatoryFees: [],
    availabilityNote: 'Subject to partner confirmation',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    createdAt: '2026-10-09T07:19:26.899Z',
    updatedAt: '2026-10-18T20:00:00.000Z',
  },
  {
    id: 'prod_rainbow',
    slug: 'victoria-falls-rainbow-hotel',
    name: 'Victoria Falls Rainbow Hotel',
    productType: 'accommodation',
    categorySlug: 'hotel',
    classification: 'Budget',
    operatorId: 'op_rtg',
    operatorName: 'Rainbow Tourism Group (RTG)',
    propertyId: 'prop_rainbow',
    location: 'Victoria Falls, Zimbabwe',
    duration: 'Per night stay',
    basePrice: '165',
    currency: 'USD',
    priceBasis: 'per_room_night',
    shortDescription:
      'Victoria Falls Rainbow Hotel offers comfortable town accommodations with panoramic spray views and easy access to the falls.',
    description:
      'Victoria Falls Rainbow Hotel offers comfortable town accommodations with panoramic spray views and easy access to the falls. Features a swimming pool, rooftop lounge, and lush gardens.',
    primaryMediaId: 'med_rainbow_standard',
    primaryImageUrl: '/uploads/med_rainbow_standard.jpeg',
    primaryImageAlt: 'Victoria Falls Rainbow Hotel',
    isPublished: true,
    isFeatured: false,
    evidenceStatus: 'ESTABLISHED',
    inclusions: ['Accommodation', 'Full breakfast'],
    exclusions: ['Lunch and dinner', 'Airport transfers'],
    mandatoryFees: [],
    availabilityNote: 'Subject to partner confirmation',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    createdAt: '2026-10-09T07:19:26.899Z',
    updatedAt: '2026-10-18T20:00:00.000Z',
  },
  {
    id: 'prod_explorers',
    slug: 'shearwater-explorers-village',
    name: 'Shearwater Explorers Village',
    productType: 'accommodation',
    categorySlug: 'lodge-resort',
    classification: 'Budget',
    operatorId: 'op_shearwater',
    operatorName: 'Shearwater Victoria Falls',
    propertyId: 'prop_explorers',
    location: 'Victoria Falls, Zimbabwe',
    duration: 'Per night stay',
    basePrice: '110',
    currency: 'USD',
    priceBasis: 'per_room_night',
    shortDescription:
      'Shearwater Explorers Village is a vibrant lodge village close to the falls with chalets, bar, and pool.',
    description:
      'Shearwater Explorers Village is a vibrant lodge village located within walking distance of Victoria Falls town and rainforest. Private chalets, camping, swimming pool, restaurant, and adventure booking hub.',
    primaryMediaId: 'med_explorers_chalet',
    primaryImageUrl: '/uploads/med_explorers_chalet.jpeg',
    primaryImageAlt: 'Shearwater Explorers Village',
    isPublished: true,
    isFeatured: false,
    evidenceStatus: 'ESTABLISHED',
    inclusions: ['Accommodation', 'Full breakfast'],
    exclusions: ['Optional adventure bookings', 'Airport transfers'],
    mandatoryFees: [],
    availabilityNote: 'Subject to partner confirmation',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    createdAt: '2026-10-09T07:19:26.899Z',
    updatedAt: '2026-10-18T20:00:00.000Z',
  },
  {
    id: 'prod_elephantcamp',
    slug: 'the-elephant-camp',
    name: 'The Elephant Camp',
    productType: 'accommodation',
    categorySlug: 'safari-camp',
    classification: 'Luxury',
    operatorId: 'op_wildhorizons',
    operatorName: 'Wild Horizons',
    propertyId: 'prop_elephantcamp',
    location: 'Victoria Falls, Zimbabwe',
    duration: 'Per night stay',
    basePrice: '1087',
    currency: 'USD',
    priceBasis: 'per_room_night',
    shortDescription:
      'The Elephant Camp is a premier luxury safari camp situated on a private wildlife concession with spectacular gorge views.',
    description:
      'The Elephant Camp is a premier luxury safari camp situated on a private wildlife concession with spectacular gorge views. Luxury tented suites, private plunge pools, and intimate wildlife encounters.',
    primaryMediaId: 'med_elephantcamp_tent',
    primaryImageUrl: '/uploads/med_elephantcamp_tent.jpeg',
    primaryImageAlt: 'The Elephant Camp',
    isPublished: true,
    isFeatured: true,
    evidenceStatus: 'ESTABLISHED',
    inclusions: ['All meals', 'Selected drinks', 'Private game drives', 'Elephant interaction'],
    exclusions: ['Park conservation fees', 'Premium spirits'],
    mandatoryFees: [],
    availabilityNote: 'Subject to partner confirmation',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    createdAt: '2026-10-09T07:19:26.899Z',
    updatedAt: '2026-10-18T20:00:00.000Z',
  },
];

// 2. Heritage Standard Sunset Cruise product
const HERITAGE_CRUISE_PRODUCT = {
  id: HERITAGE_CRUISE_PRODUCT_ID,
  name: 'Heritage Standard Sunset Cruise',
  slug: 'heritage-standard-sunset-cruise',
  productType: 'activity',
  categorySlug: 'river-cruises',
  operatorName: 'Pure Africa',
  operatorId: 'op_pure_africa',
  propertyId: null,
  location: 'Victoria Falls, Zimbabwe',
  duration: '2 hours',
  basePrice: '52',
  currency: 'USD',
  priceBasis: 'per_person',
  shortDescription:
    'Sunset cruise on the Zambezi River. Cruise fare US$52 per person. National Park fee US$12 (international) / US$6 (local). Indicative totals: US$64 (international) / US$58 (local).',
  description:
    'The Heritage Standard Sunset Cruise offers an unforgettable voyage along the Zambezi River. Cruise price: US$52 per person. Park fee: US$12 per person for international guests (Total: US$64 per person) or US$6 per person for local guests (Total: US$58 per person). Totals clearly include the cruise price and the applicable park fee.',
  primaryMediaId: 'med_2db2d6add31909b4f3d0adcf',
  primaryImageUrl: '/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
  primaryImageAlt: 'Heritage Standard Sunset Cruise on the Zambezi River',
  isPublished: true,
  isFeatured: true,
  evidenceStatus: 'ESTABLISHED',
  inclusions: ['Zambezi River sunset cruise', 'Transfers', 'Canapés', 'Selected beverages'],
  exclusions: ['National Park fee (US$12 international / US$6 local per person)'],
  mandatoryFees: [
    {
      name: 'National Park Fee (International Guests)',
      amount: 12,
      currency: 'USD',
      basis: 'per_person',
      mandatory: true,
    },
    {
      name: 'National Park Fee (Local Guests)',
      amount: 6,
      currency: 'USD',
      basis: 'per_person',
      mandatory: true,
    },
  ],
  pricingBreakdown: {
    cruisePrice: 52,
    parkFeeInternational: 12,
    parkFeeLocal: 6,
    totalInternational: 64,
    totalLocal: 58,
  },
  createdAt: '2026-10-14T08:00:00.000Z',
  updatedAt: '2026-10-18T20:00:00.000Z',
};

// Operator ID resolver helper
const OPERATOR_IDS: Record<string, string> = {
  'Wild Horizons': 'op_wildhorizons',
  'Shearwater': 'op_shearwater',
  'Pure Africa': 'op_pure_africa',
};

export function getBaselineProducts(): any[] {
  const products: any[] = [...BASELINE_ACCOMMODATIONS, HERITAGE_CRUISE_PRODUCT];
  const now = '2026-10-18T20:00:00.000Z';

  // 3. Activity / transfer / fee records from operatorCatalogImport
  for (const item of operatorCatalogImport) {
    if (item.productType === 'package') continue;
    const importKey = `operator-pricelist-v1:${normalize(item.operatorName).replace(/ /g, '-')}:${normalize(item.name).replace(/ /g, '-')}`;
    const productId = 'imp_' + crypto.createHash('sha256').update(importKey).digest('hex').slice(0, 20);
    const hasValidPrice = item.basePrice !== null && item.basePrice !== undefined && !isNaN(Number(item.basePrice));

    products.push({
      id: productId,
      slug: `${normalize(item.name).replace(/ /g, '-')}-${productId.slice(-6)}`,
      name: item.name,
      productType: item.productType === 'transfer' ? 'transfer' : item.productType === 'fee' ? 'fee' : 'activity',
      catalogItemType: item.productType || 'activity',
      categorySlug: item.categorySlug || 'adventure-wildlife',
      classification: null,
      operatorId: OPERATOR_IDS[item.operatorName] || null,
      operatorName: item.operatorName,
      propertyId: null,
      shortDescription: item.shortDescription,
      description: item.shortDescription,
      location: 'Victoria Falls, Zimbabwe',
      duration: item.productType === 'transfer' ? 'Transfer' : null,
      basePrice: hasValidPrice ? String(item.basePrice) : null,
      currency: 'USD',
      priceBasis: hasValidPrice ? (item.priceBasis || 'per_person') : null,
      inclusions: Array.isArray(item.inclusions) ? item.inclusions : [],
      exclusions: Array.isArray(item.exclusions) ? item.exclusions : [],
      mandatoryFees: Array.isArray(item.mandatoryFees) ? item.mandatoryFees : [],
      sourceReference: item.sourceReference,
      catalogImportKey: importKey,
      catalogImportStatus: 'DRAFT_NEEDS_VERIFICATION',
      verificationNotes: item.verificationNotes,
      isPublished: false,
      isFeatured: false,
      availabilityNote: 'Subject to operator confirmation; draft import not bookable until verified.',
      primaryMediaId: null,
      videoUrl: null,
      evidenceStatus: 'NEEDS_VERIFICATION',
      createdAt: now,
      updatedAt: now,
    });
  }

  // 4. Exactly 24 accommodation candidate drafts from accommodationCatalogImport
  for (const item of accommodationCatalogImport) {
    const importKey = `accommodation-catalog-v1:${normalize(item.name).replace(/ /g, '-')}`;
    const productId = 'imp_acc_' + crypto.createHash('sha256').update(importKey).digest('hex').slice(0, 20);

    products.push({
      id: productId,
      slug: `${normalize(item.name).replace(/ /g, '-')}-${productId.slice(-6)}`,
      name: item.name,
      productType: 'accommodation',
      catalogItemType: 'accommodation',
      categorySlug: item.categorySlug || 'lodge-resort',
      classification: item.classification,
      operatorId: null,
      operatorName: item.operatorName || item.name,
      propertyId: null,
      shortDescription: item.shortDescription,
      description: item.fullDescription || item.shortDescription,
      location: 'Victoria Falls, Zimbabwe',
      duration: null,
      basePrice: null,
      currency: 'USD',
      priceBasis: null,
      inclusions: Array.isArray(item.inclusions) ? item.inclusions : [],
      exclusions: Array.isArray(item.exclusions) ? item.exclusions : [],
      mandatoryFees: Array.isArray(item.mandatoryFees) ? item.mandatoryFees : [],
      sourceReference: item.sourceReference,
      catalogImportKey: importKey,
      catalogImportStatus: 'DRAFT_NEEDS_VERIFICATION',
      verificationNotes: item.verificationNotes,
      isPublished: false,
      isFeatured: false,
      availabilityNote: 'Draft candidate under review; rates, room inventory, and supplier terms unconfirmed.',
      primaryMediaId: null,
      videoUrl: null,
      evidenceStatus: 'NEEDS_VERIFICATION',
      createdAt: now,
      updatedAt: now,
    });
  }

  return products;
}

export function getBaselinePackages(): any[] {
  const packages: any[] = [];
  const now = '2026-10-18T20:00:00.000Z';

  for (const item of operatorCatalogImport) {
    if (item.productType !== 'package') continue;
    const importKey = `operator-pricelist-v1:${normalize(item.operatorName).replace(/ /g, '-')}:${normalize(item.name).replace(/ /g, '-')}`;
    const packageId = 'imp_pkg_' + crypto.createHash('sha256').update(importKey).digest('hex').slice(0, 20);
    const hasValidPrice = item.basePrice !== null && item.basePrice !== undefined && !isNaN(Number(item.basePrice));

    packages.push({
      id: packageId,
      slug: `${normalize(item.name).replace(/ /g, '-')}-${packageId.slice(-6)}`,
      name: item.name,
      tagline: `Operator package from ${item.operatorName}`,
      description: item.shortDescription,
      durationDays: 1,
      durationNights: 0,
      pricePerPerson: hasValidPrice ? String(item.basePrice) : null,
      currency: 'USD',
      highlights: item.inclusions,
      inclusions: item.inclusions,
      exclusions: item.exclusions,
      primaryImageUrl: null,
      videoUrl: null,
      operatorId: OPERATOR_IDS[item.operatorName] || null,
      operatorName: item.operatorName,
      catalogItemType: 'package',
      categorySlug: item.categorySlug,
      mandatoryFees: item.mandatoryFees,
      sourceReference: item.sourceReference,
      catalogImportKey: importKey,
      catalogImportStatus: 'DRAFT_NEEDS_VERIFICATION',
      verificationNotes: item.verificationNotes,
      isPublished: false,
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  return packages;
}
