export type CatalogFee = {
  name: string;
  amount: number | null;
  currency: 'USD';
  mandatory: boolean | null;
  verificationStatus: 'SOURCE_STATED' | 'CONFLICT_REQUIRES_CONFIRMATION' | 'UNCONFIRMED';
};

export type OperatorCatalogImportItem = {
  operatorName: 'Wild Horizons' | 'Shearwater';
  name: string;
  categorySlug: string;
  productType: 'activity' | 'package' | 'transfer' | 'fee';
  basePrice: number;
  priceBasis: 'per_person' | 'per_trip' | 'per_transfer' | 'from';
  shortDescription: string;
  inclusions: string[];
  exclusions: string[];
  mandatoryFees: CatalogFee[];
  sourceReference: string;
  verificationNotes: string[];
};

const wh = 'Wild Horizons brochure summary supplied by the user; original brochure verification required';
const sh = '2026 - Shearwater Pricelist (lnternational).pdf; verify conflicting fee/inclusion details before publication';

const fee = (
  name: string,
  amount: number | null,
  verificationStatus: CatalogFee['verificationStatus'] = 'SOURCE_STATED',
  mandatory: boolean | null = true,
): CatalogFee => ({ name, amount, currency: 'USD', mandatory, verificationStatus });

const product = (
  operatorName: OperatorCatalogImportItem['operatorName'],
  name: string,
  categorySlug: string,
  basePrice: number,
  options: Partial<Omit<OperatorCatalogImportItem, 'operatorName' | 'name' | 'categorySlug' | 'basePrice'>> = {},
): OperatorCatalogImportItem => ({
  operatorName,
  name,
  categorySlug,
  basePrice,
  productType: 'activity',
  priceBasis: 'per_person',
  shortDescription: `${name}, supplied by ${operatorName} in the Victoria Falls tourism region.`,
  inclusions: [],
  exclusions: ['Draft import: verify current rate, fees, inclusions, availability and operator source before publishing.'],
  mandatoryFees: [],
  sourceReference: operatorName === 'Wild Horizons' ? wh : sh,
  verificationNotes: [],
  ...options,
});

export const operatorCatalogImport: OperatorCatalogImportItem[] = [
  // WILD HORIZONS — each record is assigned only to the Wild Horizons operator.
  product('Wild Horizons', 'Adventure Pass 1', 'packages', 416, {
    productType: 'package', inclusions: ['Sundowner cruise', 'Any two of: High Wire Pass, 12/13-minute helicopter flight, Night Drive'],
    exclusions: ['National Parks fees excluded according to supplied summary.'], verificationNotes: ['Verify exact eligible activity combinations and all exclusions.'],
  }),
  product('Wild Horizons', 'Adventure Pass 2', 'packages', 347, {
    productType: 'package', inclusions: ['Sundowner cruise', 'Any two eligible activities: Elephant Encounter, solo Zip Line or Gorge Swing, White Water Rafting'],
    exclusions: ['National Parks fees excluded according to supplied summary.'], verificationNotes: ['Verify exact eligible activity combinations and all exclusions.'],
  }),
  product('Wild Horizons', 'Victoria Falls Classic', 'packages', 69, { productType: 'package', inclusions: ['Victoria Falls tour', 'Lookout Cafe lunch'] }),
  product('Wild Horizons', 'Wild Horizons Classic', 'packages', 255, { productType: 'package', inclusions: ['Helicopter flight', 'Victoria Falls tour', 'Sundowner cruise'] }),
  product('Wild Horizons', 'Wild Horizons Classic with Lookout Lunch', 'packages', 289, { productType: 'package', inclusions: ['Helicopter flight', 'Victoria Falls tour', 'Sundowner cruise', 'Lookout Cafe lunch'] }),
  product('Wild Horizons', 'Zambezi Classic', 'packages', 94, { productType: 'package', inclusions: ['Victoria Falls tour', 'Sundowner cruise'] }),
  product('Wild Horizons', 'Zambezi Classic with Lookout Lunch', 'packages', 122, { productType: 'package', inclusions: ['Victoria Falls tour', 'Sundowner cruise', 'Lookout Cafe lunch'] }),
  product('Wild Horizons', 'Rafting and Gorge Swing Combo', 'packages', 274, { productType: 'package', mandatoryFees: [fee('National Parks fees', 18, 'SOURCE_STATED')], verificationNotes: ['Supplied summary states $18 in fees; confirm applicability and fee basis.'] }),
  product('Wild Horizons', 'White Water Rafting', 'adventure', 174, { mandatoryFees: [fee('Park fee', 12)] }),
  product('Wild Horizons', 'Gorge Swing', 'adventure', 134, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Tandem Gorge Swing', 'adventure', 201, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Zip Line', 'adventure', 108, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Tandem Zip Line', 'adventure', 162, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Flying Fox', 'adventure', 69, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Canopy Tour', 'adventure', 81, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Highwire Pass', 'adventure', 208, { mandatoryFees: [fee('Park fee', 6)] }),
  product('Wild Horizons', 'Full Day Chobe Day Trip', 'safari', 178, { mandatoryFees: [fee('Park fee', 20)] }),
  product('Wild Horizons', 'Elephant Encounter', 'wildlife', 169, { mandatoryFees: [fee('Park fee', 24)] }),
  product('Wild Horizons', 'Elephant Art Safari and Lunch/Snacks', 'wildlife', 212, { mandatoryFees: [fee('Park fee', 24)] }),
  product('Wild Horizons', 'Zambezi National Park Game Drive', 'safari', 83, { mandatoryFees: [fee('Park fee', 18)], verificationNotes: ['Existing catalog has a similarly named Wild Horizons game drive at a different rate; do not overwrite it. Confirm current product identity/rate.'] }),
  product('Wild Horizons', 'Private Reserve Game Drive AM/PM', 'safari', 159, { mandatoryFees: [fee('Park fee', 10)] }),
  product('Wild Horizons', 'Night Drive or Bush Dinner', 'safari', 216, { mandatoryFees: [fee('Park fee', 10)], verificationNotes: ['Confirm whether Night Drive and Bush Dinner are alternatives or distinct variants before publication.'] }),
  product('Wild Horizons', 'Horseback Safari', 'safari', 171, { mandatoryFees: [fee('Park fee', 30)] }),
  product('Wild Horizons', 'Helicopter Flight 12/13 Minutes', 'scenic-flights', 174, { mandatoryFees: [fee('Government/other fee', 29, 'UNCONFIRMED')], verificationNotes: ['Confirm exact fee description and mandatory status against original brochure.'] }),
  product('Wild Horizons', 'Helicopter Flight 25 Minutes', 'scenic-flights', 329, { mandatoryFees: [fee('Government/other fee', 35, 'UNCONFIRMED')], verificationNotes: ['Confirm exact fee description and mandatory status against original brochure.'] }),
  product('Wild Horizons', 'Microlight Flight Zambia 12/15 Minutes', 'scenic-flights', 190, { mandatoryFees: [fee('Additional fee', 6, 'UNCONFIRMED')], verificationNotes: ['Confirm exact fee description and mandatory status.'] }),
  product('Wild Horizons', 'Microlight Flight Zambia 25/30 Minutes', 'scenic-flights', 380, { mandatoryFees: [fee('Additional fee', 6, 'UNCONFIRMED')], verificationNotes: ['Confirm exact fee description and mandatory status.'] }),
  product('Wild Horizons', 'Sundowner Cruise', 'river-cruises', 52, { mandatoryFees: [fee('Park fee', 12)] }),
  product('Wild Horizons', 'Luxury Zambezi Royal Cruise', 'river-cruises', 102, { mandatoryFees: [fee('Park fee', 12)] }),
  product('Wild Horizons', 'Dinner Cruise', 'river-cruises', 116, { mandatoryFees: [fee('Park fee', 12)] }),
  product('Wild Horizons', 'Victoria Falls Tour', 'tours', 32, { exclusions: ['Entry/park fee additional; exact amount not supplied.'], verificationNotes: ['Keep separate from Shearwater and other operators’ Falls tours.'] }),
  product('Wild Horizons', 'Bike Tour', 'tours', 61),
  product('Wild Horizons', 'Meet People Village', 'culture', 91),
  product('Wild Horizons', 'Home Hosted Lunch', 'dining', 41),
  product('Wild Horizons', 'Boma Dinner', 'dining', 60, { productType: 'activity', exclusions: ['Transfers excluded according to supplied summary.'] }),
  product('Wild Horizons', 'Bamba Tram Sunrise Run', 'tours', 76, { inclusions: ['Transfers according to supplied summary.'] }),
  product('Wild Horizons', 'Livingstone Island Breakfast Green', 'livingstone-island', 123, { mandatoryFees: [fee('Additional fee', 26, 'UNCONFIRMED')], verificationNotes: ['Confirm the $26 fee and whether it applies to this variant.'] }),
  product('Wild Horizons', 'Livingstone Island Breakfast High', 'livingstone-island', 133, { mandatoryFees: [fee('Additional fee', 26, 'UNCONFIRMED')], verificationNotes: ['Confirm the $26 fee and whether it applies to this variant.'] }),
  product('Wild Horizons', 'Livingstone Island Lunch Green', 'livingstone-island', 173, { mandatoryFees: [fee('Additional fee', 26, 'UNCONFIRMED')], verificationNotes: ['Confirm the $26 fee and whether it applies to this variant.'] }),
  product('Wild Horizons', 'Livingstone Island Lunch High', 'livingstone-island', 183, { mandatoryFees: [fee('Additional fee', 26, 'UNCONFIRMED')], verificationNotes: ['Confirm the $26 fee and whether it applies to this variant.'] }),
  product('Wild Horizons', 'Livingstone Island High Tea Green', 'livingstone-island', 163, { mandatoryFees: [fee('Additional fee', 26, 'UNCONFIRMED')], verificationNotes: ['Confirm the $26 fee and whether it applies to this variant.'] }),
  product('Wild Horizons', 'Livingstone Island High Tea High', 'livingstone-island', 173, { mandatoryFees: [fee('Additional fee', 26, 'UNCONFIRMED')], verificationNotes: ['Confirm the $26 fee and whether it applies to this variant.'] }),

  // SHEARWATER — separate operator records; conflicting values remain drafts with notes.
  product('Shearwater', 'Tick It to Adventure — Any 2 Activities', 'packages', 370, { productType: 'package', verificationNotes: ['Source describes selection of any two activities. Verify the eligible activity list and exclusions.'] }),
  product('Shearwater', 'Tick It to Adventure — Any 3 Activities', 'packages', 478, { productType: 'package', verificationNotes: ['Source describes selection of any three activities. Verify the eligible activity list and exclusions.'] }),
  product('Shearwater', 'Gruesome Twosome — Rafting and Bungee', 'packages', 347, { productType: 'package', verificationNotes: ['Source describes a $10 saving; confirm eligible season and fees.'] }),
  product('Shearwater', 'Gruesome Twosome — Bungee and Jetboat', 'packages', 312, { productType: 'package', verificationNotes: ['Source describes a $34 saving; confirm eligible season and fees.'] }),
  product('Shearwater', 'Big Air — Bridge Swing, Slide and Bungee', 'packages', 280, { productType: 'package' }),
  product('Shearwater', 'Rampage — Jetboat and Rafting Rapids 1–5', 'packages', 204, { productType: 'package', verificationNotes: ['Verify river/season conditions and exact inclusions.'] }),
  product('Shearwater', 'Jetboat and Rafting Combo', 'packages', 268, { productType: 'package', mandatoryFees: [fee('National Parks fees', 12, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Summary says $10, source PDF transcription says $12; confirm before publishing.'] }),
  product('Shearwater', 'Platinum Package', 'packages', 326, { productType: 'package', inclusions: ['Sunset cruise', 'Helicopter flight', 'Victoria Falls tour', 'Rainforest lunch (unconfirmed)', 'Bridge tour'], verificationNotes: ['Source notes rainforest lunch may be optional. Confirm exact inclusions before publishing.'] }),
  product('Shearwater', 'Gold Package', 'packages', 247, { productType: 'package', inclusions: ['Sunset cruise', 'Helicopter flight', 'Victoria Falls tour', 'Rainforest lunch (unconfirmed)'], verificationNotes: ['Source notes rainforest lunch may be optional. Confirm exact inclusions before publishing.'] }),
  product('Shearwater', 'Silver Package', 'packages', 150, { productType: 'package', inclusions: ['Sunset cruise', 'Victoria Falls tour', 'Rainforest lunch (unconfirmed)', 'Bridge tour'], verificationNotes: ['Source notes rainforest lunch may be optional. Confirm exact inclusions before publishing.'] }),
  product('Shearwater', 'Bronze Package', 'packages', 75, { productType: 'package', inclusions: ['Sunset cruise', 'Victoria Falls tour', 'Rainforest lunch (unconfirmed)'], verificationNotes: ['Source notes rainforest lunch may be optional. Confirm exact inclusions before publishing.'] }),
  product('Shearwater', 'Bungee Jump', 'adventure', 194),
  product('Shearwater', 'Bridge Slide', 'adventure', 58),
  product('Shearwater', 'Tandem Bridge Slide', 'adventure', 82),
  product('Shearwater', 'Bridge Swing', 'adventure', 137, { verificationNotes: ['Supplied summary says $131; source PDF transcription says $137. Confirm current price.'] }),
  product('Shearwater', 'Tandem Bridge Swing', 'adventure', 201),
  product('Shearwater', 'White Water Rafting — High Water', 'adventure', 161, { verificationNotes: ['Seasonal variant; confirm current season and availability.'] }),
  product('Shearwater', 'White Water Rafting — Low Water', 'adventure', 173, { verificationNotes: ['Seasonal variant; confirm current season and availability.'] }),
  product('Shearwater', 'Overnight Rafting', 'adventure', 330),
  product('Shearwater', 'Jetboat', 'adventure', 141, { mandatoryFees: [fee('Park fee', 10)] }),
  product('Shearwater', 'Riversong Premium Luxury Morning Cruise', 'river-cruises', 80),
  product('Shearwater', 'Riversong Premium Luxury Lunch Cruise', 'river-cruises', 100),
  product('Shearwater', 'Riversong Premium Luxury Sunset Cruise', 'river-cruises', 100),
  product('Shearwater', 'Standard Sunset Cruise', 'river-cruises', 59, { verificationNotes: ['Supplied summary says $52; source PDF transcription says $59. Confirm current price.'] }),
  product('Shearwater', 'Dinner Cruise', 'river-cruises', 110, { mandatoryFees: [fee('Park fee', 12, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Supplied summary says $10 fee; source PDF transcription says $12. Confirm.'] }),
  product('Shearwater', 'Flight of Angels — 12–13 Minutes', 'scenic-flights', 173, { mandatoryFees: [fee('Government fee/fuel surcharge', 29, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Supplied summary says $27; source PDF transcription says $29. Confirm exact fee.'] }),
  product('Shearwater', 'Zambezi Explorer Scenic Flight — 20 Minutes', 'scenic-flights', 271, { verificationNotes: ['Keep under Shearwater only if the source/operator confirms Shearwater supplies this flight; do not merge with Pure Africa cruise records or another operator’s similarly named offer.'] }),
  product('Shearwater', 'Zambezi Spectacular — 25 Minutes', 'scenic-flights', 328, { mandatoryFees: [fee('Government fee/fuel surcharge', 35, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Supplied summary says $32; source PDF transcription says $35. Confirm exact fee.'] }),
  product('Shearwater', 'Night Game Drive and Shearwater Bush Dinner', 'safari', 159, { mandatoryFees: [fee('Park fee', 18, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Supplied summary says $15 fee; source PDF transcription says $18. Confirm.'] }),
  product('Shearwater', 'AM/PM Game Drive', 'safari', 95, { mandatoryFees: [fee('Park fee', 18, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Supplied summary says $81 plus $15 fee; source PDF transcription says $95 plus $18. Confirm both.'] }),
  product('Shearwater', 'Safari Game Walks', 'safari', 132, { mandatoryFees: [fee('Park fee', 18, 'CONFLICT_REQUIRES_CONFIRMATION')], verificationNotes: ['Supplied summary says $15 fee; source PDF transcription says $18. Confirm.'] }),
  product('Shearwater', 'Through the Eyes of an Elephant', 'wildlife', 148, { priceBasis: 'from', verificationNotes: ['Source describes this as a suggested donation; confirm guest-facing wording and supplier.'] }),
  product('Shearwater', 'Breakfast with Elephants', 'wildlife', 100, { verificationNotes: ['Confirm current availability, inclusions and supplier attribution.'] }),
  product('Shearwater', 'Chobe Day Trip', 'safari', 229, { verificationNotes: ['Supplied summary says $178; source PDF transcription says $229. Confirm price and exact additional fees before publication.'] }),
  product('Shearwater', 'Quad Bike', 'adventure', 60, { verificationNotes: ['Listed as a third-party activity. Confirm actual service provider/operator attribution before publication.'] }),
  product('Shearwater', 'Horse Trails', 'adventure', 125, { mandatoryFees: [fee('Park fee', 10)], verificationNotes: ['Listed as a third-party activity. Confirm supplier attribution.'] }),
  product('Shearwater', 'Rhino Encounter Game Drive', 'wildlife', 128, { mandatoryFees: [fee('Park fee', 15)], verificationNotes: ['Listed as a third-party activity. Confirm supplier attribution.'] }),
  product('Shearwater', 'Boma Dinner', 'dining', 65, { mandatoryFees: [fee('Transfer fee', 15, 'UNCONFIRMED', null)], verificationNotes: ['Confirm whether transfer is optional or mandatory and who supplies the dinner.'] }),
  product('Shearwater', 'Livingstone Island Tour', 'livingstone-island', 137, { priceBasis: 'from', verificationNotes: ['Starting price; confirm meal variant, season, fees and actual supplier.'] }),
  product('Shearwater', 'Livingstone Island Return Transfer', 'transfers', 46, { productType: 'transfer', priceBasis: 'per_trip', verificationNotes: ['Keep distinct from the Livingstone Island tour; confirm provider and inclusions.'] }),
  product('Shearwater', 'Theatrical Historical Bridge Tour', 'tours', 64, { mandatoryFees: [fee('Transfer fee', 12, 'UNCONFIRMED', null)], verificationNotes: ['Confirm transfer fee and supplier.'] }),
  product('Shearwater', 'Traditional Village Tour', 'culture', 74, { verificationNotes: ['Confirm actual supplier/operator attribution and inclusions.'] }),
  product('Shearwater', 'Guided Victoria Falls Tour', 'tours', 32, { exclusions: ['Park/entry fee additional; exact amount not confirmed.'], verificationNotes: ['Keep separate from Wild Horizons and other operators’ Falls tours.'] }),
  product('Shearwater', 'Simunye', 'culture', 58, { verificationNotes: ['Confirm exact experience identity, supplier and inclusions.'] }),
  product('Shearwater', 'Victoria Falls Airport Transfer — One Way', 'transfers', 28, { productType: 'transfer', priceBasis: 'per_transfer', verificationNotes: ['Confirm pickup zone, capacity and service provider.'] }),
  product('Shearwater', 'Livingstone Airport Transfer — One Way', 'transfers', 40, { productType: 'transfer', priceBasis: 'per_transfer', verificationNotes: ['Confirm pickup zone, capacity and service provider.'] }),
];
