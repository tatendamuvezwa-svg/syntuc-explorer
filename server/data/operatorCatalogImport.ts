export type CatalogFee = {
  name: string;
  amount: number | null;
  currency: 'USD';
  mandatory: boolean | null;
  verificationStatus: 'SOURCE_STATED' | 'CONFLICT_REQUIRES_CONFIRMATION' | 'UNCONFIRMED';
};

export type OperatorCatalogImportItem = {
  operatorName: 'Wild Horizons' | 'Shearwater' | 'Pure Africa';
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
  authoritativeOverride?: boolean;
};

const wh = 'Wild Horizons brochure summary supplied by the user; original brochure verification required';
const sh = '2026 - Shearwater Pricelist (lnternational).pdf; verify conflicting fee/inclusion details before publication';
const pa = 'Latest Pure Africa catalog supplied by the user on 14 October 2026; authoritative over all earlier Pure Africa catalog prices.';

const fee = (
  name: string,
  amount: number | null,
  verificationStatus: CatalogFee['verificationStatus'] = 'SOURCE_STATED',
  mandatory: boolean | null = true,
): CatalogFee => ({ name, amount, currency: 'USD', mandatory, verificationStatus });

const curatedDescriptions: Record<string, string> = {
  "Adventure Pass 1": "Pair a Zambezi sundowner cruise with two selected activities from the eligible Wild Horizons list. Check the permitted activity combinations and park-fee exclusions with the operator before choosing.",
  "Adventure Pass 2": "Combine a Zambezi sundowner cruise with two eligible adventure experiences. The source list names Elephant Encounter, solo Zip Line or Gorge Swing, and White Water Rafting; confirm the exact combination and seasonal availability.",
  "Victoria Falls Classic": "A compact Wild Horizons package pairing a Victoria Falls tour with lunch at the Lookout Café. Confirm tour timing, entry fees and the current lunch arrangement before booking.",
  "Wild Horizons Classic": "A multi-experience package bringing together a scenic helicopter flight, a Victoria Falls tour and a Zambezi sundowner cruise. Confirm flight duration, departure times and any additional fees.",
  "Wild Horizons Classic with Lookout Lunch": "A fuller Victoria Falls day combining a scenic helicopter flight, a Falls tour, a Zambezi sundowner cruise and lunch at the Lookout Café. Confirm schedules and fee exclusions with the operator.",
  "Zambezi Classic": "Combine a Victoria Falls tour with a Zambezi sundowner cruise in one Wild Horizons package. Confirm tour timing, cruise departure and any park or entry fees.",
  "Zambezi Classic with Lookout Lunch": "A Victoria Falls tour and Zambezi sundowner cruise paired with lunch at the Lookout Café. Confirm the day’s schedule and any fees not included in the package price.",
  "Rafting and Gorge Swing Combo": "A high-adventure combination pairing white-water rafting on the Zambezi with a gorge swing experience. River conditions, operating season and the stated National Parks fee require confirmation.",
  "White Water Rafting": "Take on the Zambezi’s white-water rapids with a guided rafting experience from Wild Horizons. River access and route conditions vary by season; confirm the operating level, safety requirements and park fee before booking.",
  "Gorge Swing": "Experience a dramatic swing out over the Batoka Gorge with Wild Horizons. Confirm operating conditions, participant requirements and the additional park fee before booking.",
  "Tandem Gorge Swing": "Share the gorge-swing experience with a second participant on this tandem option from Wild Horizons. Confirm tandem operating requirements, availability and the additional park fee.",
  "Zip Line": "Glide across the Batoka Gorge on a zip-line adventure offered by Wild Horizons. Confirm participant restrictions, operating conditions and the additional park fee.",
  "Tandem Zip Line": "A shared zip-line option for two participants, offering a high-adrenaline way to experience the Batoka Gorge. Confirm tandem availability, participant requirements and the additional park fee.",
  "Flying Fox": "Try the Flying Fox gorge activity with Wild Horizons for a fast, suspended crossing above the landscape. Confirm current operating requirements and the additional park fee.",
  "Canopy Tour": "Explore the forest canopy from a network of elevated walkways and canopy bridges with Wild Horizons. Confirm route conditions, participant requirements and the additional park fee.",
  "Highwire Pass": "A multi-activity high-wire experience from Wild Horizons for visitors looking to add aerial adventure to their Victoria Falls itinerary. Confirm which activities are covered by the pass and the additional park fee.",
  "Full Day Chobe Day Trip": "Spend a full day on a cross-border safari excursion to Botswana’s Chobe region, known for its wildlife and elephant viewing. Confirm border documentation, transport, included meals and the stated park fee.",
  "Elephant Encounter": "A wildlife-focused encounter offered by Wild Horizons for guests interested in learning about elephants at close range. Confirm the experience format, welfare arrangements, availability and additional park fee before booking.",
  "Elephant Art Safari and Lunch/Snacks": "A wildlife experience combining an elephant-themed safari activity with lunch or snacks, as indicated in the supplied catalogue. Confirm the exact activity format, meal inclusions and park fee.",
  "Zambezi National Park Game Drive": "Join a guided game drive in the Zambezi National Park area with Wild Horizons, looking for wildlife in its natural habitat. Confirm the exact route, current rate and park fee because a similarly named offer already exists in the catalogue.",
  "Private Reserve Game Drive AM/PM": "Choose a morning or afternoon game drive in a private reserve setting with Wild Horizons. Wildlife sightings are not guaranteed; confirm departure time, reserve details and the stated park fee.",
  "Night Drive or Bush Dinner": "An evening option listed by Wild Horizons that refers to a night drive or bush dinner. The source does not establish whether these are alternatives or separate products, so confirm the exact experience and fee before selecting.",
  "Horseback Safari": "Explore the surrounding landscape on a guided horseback safari offered by Wild Horizons. Confirm rider suitability, route, safety requirements and the stated park fee before booking.",
  "Helicopter Flight 12/13 Minutes": "See Victoria Falls and the surrounding gorge from the air on a short scenic helicopter flight. Confirm the actual flight duration, departure location, weight requirements and the additional government or fuel fee.",
  "Helicopter Flight 25 Minutes": "A longer scenic helicopter flight offering more time in the air over the Victoria Falls region and gorge. Confirm the precise route, duration, departure arrangements and the additional government or fuel fee.",
  "Microlight Flight Zambia 12/15 Minutes": "Take a microlight flight from the Zambian side for an aerial perspective of the Victoria Falls landscape. Confirm the flight duration, departure point, operating restrictions and the additional fee.",
  "Microlight Flight Zambia 25/30 Minutes": "A longer microlight flight from the Zambian side for an extended aerial experience around the Falls region. Confirm the route, duration, departure point, operating restrictions and the additional fee.",
  "Sundowner Cruise": "Wind down with an evening cruise on the Zambezi, timed for the changing light around sunset. Confirm the departure time, refreshments and the stated park fee with Wild Horizons.",
  "Luxury Zambezi Royal Cruise": "A premium-style Zambezi River cruise from Wild Horizons, suited to guests looking for a relaxed river outing. Confirm the vessel, service level, refreshments and additional park fee before booking.",
  "Dinner Cruise": "Enjoy an evening cruise on the Zambezi paired with a dinner service as specified by the operator. Confirm menu, cruise duration, departure time and the stated park fee before booking.",
  "Victoria Falls Tour": "Discover the Victoria Falls area on a guided tour offered by Wild Horizons. Confirm whether rainforest entry or other park fees are included, as the supplied source lists entry fees separately.",
  "Bike Tour": "Explore the Victoria Falls area by bicycle on a guided tour offered by Wild Horizons. Confirm the route, duration, equipment provision and suitability for your group before booking.",
  "Meet People Village": "A community and cultural visit listed by Wild Horizons, offering an opportunity to learn about local life and traditions. Confirm the host location, programme and what is included before booking.",
  "Home Hosted Lunch": "Share a hosted meal in a local home setting, as listed by Wild Horizons. Confirm the venue, menu, dietary options, group size and transfer arrangements before booking.",
  "Boma Dinner": "Enjoy a traditional-style dinner experience listed by Wild Horizons. Transfers are not included according to the supplied summary; confirm the venue, menu and transport options.",
  "Bamba Tram Sunrise Run": "A sunrise tram outing listed by Wild Horizons, with transfers noted in the supplied summary. Confirm the route, departure time, transfer arrangements and full inclusions before booking.",
  "Livingstone Island Breakfast Green": "A breakfast visit to Livingstone Island using the Green route or seating option named in the tariff. Confirm access conditions, the exact breakfast package, seasonal operation and the additional fee.",
  "Livingstone Island Breakfast High": "A breakfast visit to Livingstone Island using the High option named in the tariff. Confirm what the High variant means, island access conditions, seasonal operation and the additional fee.",
  "Livingstone Island Lunch Green": "A Livingstone Island lunch visit using the Green option named in the tariff. Confirm the exact meal and access package, seasonal operating conditions and the additional fee.",
  "Livingstone Island Lunch High": "A Livingstone Island lunch visit using the High option named in the tariff. Confirm the meaning of the High variant, meal inclusions, seasonal operation and the additional fee.",
  "Livingstone Island High Tea Green": "A high-tea visit to Livingstone Island using the Green option named in the tariff. Confirm the meal format, island access conditions, seasonal operation and the additional fee.",
  "Livingstone Island High Tea High": "A high-tea visit to Livingstone Island using the High option named in the tariff. Confirm the meaning of the High variant, meal details, seasonal operation and the additional fee.",
  "Tick It to Adventure — Any 2 Activities": "Build your own adventure combination by selecting two activities from Shearwater’s eligible list. Confirm the permitted choices, any seasonal restrictions and excluded fees before booking.",
  "Tick It to Adventure — Any 3 Activities": "Choose three activities from Shearwater’s eligible list in one combination package. Confirm the eligible activity menu, seasonal restrictions and excluded fees before booking.",
  "Gruesome Twosome — Rafting and Bungee": "Pair Zambezi white-water rafting with a bungee jump in this Shearwater adventure combination. Confirm river season, operating conditions, eligibility and the stated package saving before booking.",
  "Gruesome Twosome — Bungee and Jetboat": "Combine a bungee jump with a jetboat ride in this Shearwater adventure package. Confirm operating conditions, participant requirements and the package’s fee exclusions.",
  "Big Air — Bridge Swing, Slide and Bungee": "A three-part high-adrenaline package combining bridge swing, bridge slide and bungee activities. Confirm activity availability, participant restrictions and any fees not included in the package rate.",
  "Rampage — Jetboat and Rafting Rapids 1–5": "Combine a jetboat ride with white-water rafting on the rapids identified in the package name. River conditions and access can change seasonally; confirm the available route and all inclusions.",
  "Jetboat and Rafting Combo": "Combine a jetboat experience with Zambezi white-water rafting in one Shearwater package. Confirm river conditions, activity timing and the conflicting National Parks fee before booking.",
  "Platinum Package": "A broad Victoria Falls itinerary combining a sunset cruise, scenic helicopter flight, Falls tour and bridge tour. The source also mentions rainforest lunch but marks it as potentially optional; confirm the final inclusions and schedule.",
  "Gold Package": "A Victoria Falls combination featuring a sunset cruise, scenic helicopter flight and Falls tour. Rainforest lunch may be optional according to the source, so confirm the package inclusions before booking.",
  "Silver Package": "A Victoria Falls combination featuring a sunset cruise, Falls tour and bridge tour. The source lists rainforest lunch as potentially optional; confirm the final inclusions and timing.",
  "Bronze Package": "An introductory Victoria Falls combination featuring a sunset cruise and Falls tour. Rainforest lunch may be optional according to the source; confirm exactly what the quoted package includes.",
  "Bungee Jump": "Take the leap from the Victoria Falls Bridge area on a bungee-jumping experience listed by Shearwater. Confirm current operating status, participant and health requirements, and the activity’s exact location.",
  "Bridge Slide": "Ride a cable slide across the gorge area near Victoria Falls Bridge on this Shearwater adventure. Confirm operating conditions, participant requirements and the exact route before booking.",
  "Tandem Bridge Slide": "Experience the bridge slide with a second participant on this tandem option. Confirm tandem availability, participant requirements and operating conditions with Shearwater.",
  "Bridge Swing": "Swing out over the gorge from the Victoria Falls Bridge area on this Shearwater adventure. Confirm current operating status, participant requirements and the exact experience details.",
  "Tandem Bridge Swing": "A tandem version of the bridge swing for two participants. Confirm the tandem setup, eligibility requirements and current availability with Shearwater.",
  "White Water Rafting — High Water": "A seasonal white-water rafting option listed for high-water conditions on the Zambezi. Confirm whether high-water operations are currently running, the available route and the applicable safety requirements.",
  "White Water Rafting — Low Water": "A seasonal white-water rafting option listed for low-water conditions on the Zambezi. Confirm the current river season, route, launch arrangements and safety requirements.",
  "Overnight Rafting": "An extended rafting adventure designed around an overnight trip rather than a standard day outing. Confirm the itinerary, camping or accommodation arrangements, meals, equipment and seasonal availability.",
  "Jetboat": "Take a jetboat ride on the Zambezi for a fast-paced river experience. Confirm the route, departure time, operating conditions and stated park fee before booking.",
  "Riversong Premium Luxury Morning Cruise": "Start the day on Shearwater’s Riversong premium luxury cruise offering. Confirm departure time, cruise duration, refreshments and vessel-specific inclusions.",
  "Riversong Premium Luxury Lunch Cruise": "A daytime Riversong premium luxury cruise paired with a lunch service as indicated by the product name. Confirm menu, departure time, duration and included refreshments.",
  "Riversong Premium Luxury Sunset Cruise": "Enjoy the changing evening light on the Zambezi aboard the Riversong premium luxury cruise offering. Confirm sunset departure time, refreshments and the exact inclusions.",
  "Standard Sunset Cruise": "A standard evening cruise on the Zambezi, suited to guests seeking a river outing around sunset. Confirm the current tariff, departure time, refreshments and any park fees.",
  "Flight of Angels — 12–13 Minutes": "Take a short scenic helicopter flight over Victoria Falls for an aerial view of the waterfall and surrounding gorge. Confirm flight duration, departure arrangements, weight requirements and the conflicting additional fee.",
  "Zambezi Explorer Scenic Flight — 20 Minutes": "A 20-minute scenic flight listed under Shearwater’s catalogue. Because the supplier attribution needs confirmation, verify the actual operator, route, departure point and inclusions before booking.",
  "Zambezi Spectacular — 25 Minutes": "A longer scenic flight listed as a 25-minute experience over the Victoria Falls region. Confirm the route, flight duration, departure arrangements and the conflicting government or fuel surcharge.",
  "Night Game Drive and Shearwater Bush Dinner": "An evening wildlife outing paired with a bush dinner, as named in Shearwater’s listing. Confirm the reserve or route, dinner venue, transfer arrangements and the conflicting park-fee amount.",
  "AM/PM Game Drive": "Choose a morning or afternoon game drive with Shearwater’s listed safari offering. Wildlife sightings cannot be guaranteed; confirm the area visited, departure time and conflicting tariff and park fee.",
  "Safari Game Walks": "Explore the bush on foot with a guided safari walk listed by Shearwater. Confirm the walking area, guide arrangements, minimum age or fitness requirements and the conflicting park fee.",
  "Through the Eyes of an Elephant": "An elephant-focused experience listed by Shearwater, described in the source as a suggested donation rather than a confirmed fixed tariff. Confirm the programme, supplier and guest-facing contribution before booking.",
  "Breakfast with Elephants": "A breakfast experience connected with elephants, as named in Shearwater’s listing. Confirm the venue, animal-welfare format, meal inclusions, transfer arrangements and current availability.",
  "Chobe Day Trip": "A day excursion to Botswana’s Chobe region, known for its wildlife and elephant populations. Confirm border requirements, transport, included meals, park fees and the conflicting source price before booking.",
  "Quad Bike": "Explore designated terrain on a quad-bike outing listed through Shearwater. The source flags this as a third-party activity, so confirm the actual operator, route, safety requirements and inclusions.",
  "Horse Trails": "A guided horse-trail outing listed through Shearwater. Confirm the actual service provider, trail route, rider suitability, safety requirements and the stated park fee.",
  "Rhino Encounter Game Drive": "A wildlife drive marketed around the opportunity to learn about and look for rhinos in their habitat. Confirm the actual operator, reserve, sighting expectations, inclusions and park fee.",
  "Livingstone Island Tour": "Visit Livingstone Island on the Zambezi, subject to seasonal river and access conditions. The listed price is a starting rate; confirm the meal variant, date, fees and actual service provider.",
  "Livingstone Island Return Transfer": "A return transfer associated with a Livingstone Island visit, listed separately from the island experience itself. Confirm pickup point, transfer timing, passenger capacity and provider.",
  "Theatrical Historical Bridge Tour": "Discover the history of Victoria Falls Bridge through a theatrical or guided bridge-focused tour. Confirm the exact programme, access requirements, transfer fee and supplier before booking.",
  "Traditional Village Tour": "A cultural visit intended to introduce guests to local community life and traditions. Confirm the host community, programme, transport and actual activity provider before booking.",
  "Guided Victoria Falls Tour": "Explore Victoria Falls with a guided tour listed by Shearwater. Confirm whether rainforest entry fees are additional, as well as the meeting point, duration and exact inclusions.",
  "Simunye": "A cultural experience listed under the name Simunye. The source does not fully describe the programme, so confirm the experience format, venue, supplier and inclusions before booking.",
  "Victoria Falls Airport Transfer — One Way": "A one-way transfer between Victoria Falls Airport and the agreed destination. Confirm pickup details, drop-off zone, passenger and luggage capacity, and the actual transport provider.",
  "Livingstone Airport Transfer — One Way": "A one-way transfer associated with Livingstone Airport. Confirm the pickup zone, border-crossing arrangements if applicable, passenger and luggage capacity, and transport provider.",
  "Zambezi Explorer Luxury Sunset Cruise": "Cruise the upper Zambezi aboard the Zambezi Explorer for a luxury sunset outing. Confirm the selected deck or service variant, cruise duration, refreshments and the current Pure Africa inclusions.",
  "Pure Africa Sunrise Cruise": "Begin the day on a Pure Africa sunrise cruise on the Zambezi. Confirm the selected vessel or deck option, departure time, duration and the exact inclusions in the current catalogue.",
  "Pure Africa Lunch Cruise": "Enjoy a daytime Pure Africa cruise on the Zambezi with a lunch service as specified in the selected offer. Confirm the vessel or deck option, menu, departure time and current inclusions.",
  "Pure Africa Sunset Signature Cruise": "A signature sunset cruise option from Pure Africa on the Zambezi. Confirm the selected deck, service level, duration, refreshments and the exact inclusions against the latest catalogue.",
  "Pure Africa Dinner Cruise": "An evening Pure Africa cruise paired with a dinner experience. Confirm the exact cruise product, menu, departure time, duration and current catalogue inclusions before booking.",
  "Pure Africa Classic Dinner": "A dining experience listed by Pure Africa in its current catalogue. Confirm the venue, menu, transfer arrangements and what is included in the quoted rate.",
  "The Eatery Waterfront Potjie Dining — Lunch": "A waterfront lunch at The Eatery featuring the operator’s listed dining experience. Confirm the menu, serving format, dietary options and any transfer arrangements against the latest Pure Africa catalogue.",
  "The Eatery Waterfront Potjie Dining — Dinner": "An evening waterfront dining experience at The Eatery featuring the listed Potjie dinner option. Confirm the current menu, inclusions, dietary options and transfer arrangements against the latest Pure Africa catalogue.",
  "Pure Africa Cruise and Dinner Combination — Standard": "Combine a Pure Africa Zambezi cruise with a dinner option in one package. Confirm which cruise and meal are included, the deck or service variant, timing and any compulsory fees.",
  "Pure Africa Cruise and Dinner Combination — Signature": "A signature-level Pure Africa package pairing a Zambezi cruise with dinner. Confirm the exact cruise, dining venue, deck or service variant, schedule and compulsory fees."
};

const describeImportedProduct = (
  operatorName: OperatorCatalogImportItem['operatorName'],
  name: string,
  categorySlug: string,
  inclusions: string[] = [],
): string => {
  const curated = operatorSpecificDescriptions[`${operatorName}::${name}`] || curatedDescriptions[name];
  if (curated) return curated;
  const categoryDescriptions: Record<string, string> = {
    'safari': 'A guided wildlife outing in the Victoria Falls region. Confirm the area, timing, inclusions and any additional fees with the operator.',
    'adventure': 'An active adventure experience in the Victoria Falls region. Confirm operating conditions, participant requirements and any additional fees with the operator.',
    'river-cruises': 'A river experience on the Zambezi. Confirm departure time, duration, refreshments and the exact inclusions with the operator.',
    'scenic-flights': 'An aerial experience over the Victoria Falls region. Confirm flight duration, route, departure arrangements and any additional fees with the operator.',
    'dining': 'A dining experience listed in the operator catalogue. Confirm the venue, menu, dietary options and transfer arrangements before booking.',
    'tours': 'A guided tour in the Victoria Falls region. Confirm the route, meeting point, duration and any entry fees before booking.',
    'culture': 'A cultural experience in the Victoria Falls region. Confirm the programme, venue, host and inclusions before booking.',
    'transfers': 'A transfer service listed for the Victoria Falls region. Confirm pickup and drop-off points, passenger capacity and provider before booking.',
    'livingstone-island': 'A Livingstone Island experience subject to seasonal access conditions. Confirm the selected variant, date, inclusions and additional fees.',
    'packages': 'A combination of experiences listed by the operator. Confirm the exact eligible activities, schedule, exclusions and fees before booking.',
    'wildlife': 'A wildlife-focused experience in the Victoria Falls region. Confirm the format, actual supplier, availability and inclusions before booking.',
  };
  const base = categoryDescriptions[categorySlug] || 'An experience listed in the operator catalogue. Confirm the activity format, inclusions, timing and any additional fees before booking.';
  const confirmedInclusions = inclusions.filter((value) => !/unconfirmed|verify|confirm/i.test(value));
  const inclusionText = confirmedInclusions.length ? ` Listed inclusions: ${confirmedInclusions.join(', ')}.` : '';
  return `${name}: ${base}${inclusionText} Offered by ${operatorName}; details remain subject to the operator’s confirmation.`;
};

const operatorSpecificDescriptions: Record<string, string> = {
  'Wild Horizons::Boma Dinner': 'Enjoy the Boma Dinner experience listed by Wild Horizons. Transfers are excluded according to the supplied summary; confirm the venue, menu, programme and transport arrangements before booking.',
  'Shearwater::Boma Dinner': 'A Boma Dinner option listed through Shearwater. The tariff notes a possible transfer fee, but the source does not confirm whether it is compulsory or who supplies the dinner; verify the venue, fee and provider before booking.',
  'Wild Horizons::Dinner Cruise': 'Enjoy an evening cruise on the Zambezi with dinner, as listed by Wild Horizons. Confirm the vessel, menu, departure time and stated park fee before booking.',
  'Shearwater::Dinner Cruise': 'A Shearwater-listed dinner cruise on the Zambezi. The source has conflicting park-fee figures, so confirm the current tariff, menu, departure time and compulsory fees before booking.',
  'Wild Horizons::Victoria Falls Tour': 'Discover Victoria Falls on a guided tour listed by Wild Horizons. The supplied summary indicates entry or park fees are additional; confirm the current fee, route and meeting point.',
  'Shearwater::Guided Victoria Falls Tour': 'Explore Victoria Falls with the guided tour listed by Shearwater. Confirm the route, meeting point and duration, and whether rainforest entry fees are additional.',
  'Shearwater::AM/PM Game Drive': 'Choose a morning or afternoon game drive from Shearwater’s listed safari options. Wildlife sightings cannot be guaranteed; confirm the area visited and reconcile the conflicting tariff and park-fee figures.',
};

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
  shortDescription: describeImportedProduct(operatorName, name, categorySlug, options.inclusions || []),
  inclusions: [],
  exclusions: ['Draft import: verify current rate, fees, inclusions, availability and operator source before publishing.'],
  mandatoryFees: [],
  sourceReference: operatorName === 'Wild Horizons' ? wh : operatorName === 'Shearwater' ? sh : pa,
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

  // PURE AFRICA — latest supplied catalog is authoritative and overrides older Pure Africa rates only.
  product('Pure Africa', 'Zambezi Explorer Luxury Sunset Cruise', 'river-cruises', 69, {
    authoritativeOverride: true,
    shortDescription: 'Luxury sunset cruise on the Zambezi River, supplied by Pure Africa.',
    sourceReference: pa,
    verificationNotes: ['Authoritative latest Pure Africa catalog rate replaces older Pure Africa listing prices. Confirm inclusions and duration against the supplied catalog before publication.'],
  }),
  product('Pure Africa', 'Pure Africa Sunrise Cruise', 'river-cruises', 92, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Use the latest Pure Africa catalog rate; confirm exact product title, duration and inclusions against the catalog.'],
  }),
  product('Pure Africa', 'Pure Africa Lunch Cruise', 'river-cruises', 92, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Use the latest Pure Africa catalog rate; confirm exact product title, duration and inclusions against the catalog.'],
  }),
  product('Pure Africa', 'Pure Africa Sunset Signature Cruise', 'river-cruises', 110, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Keep distinct from Sunset Luxury; confirm product title and inclusions from the latest catalog.'],
  }),
  product('Pure Africa', 'Pure Africa Dinner Cruise', 'river-cruises', 110, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Use the latest Pure Africa catalog rate; confirm exact product title, duration and inclusions against the catalog.'],
  }),
  product('Pure Africa', 'Pure Africa Classic Dinner', 'dining', 185, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Confirm dining venue, menu, transfers and inclusions against the latest Pure Africa catalog.'],
  }),
  product('Pure Africa', 'The Eatery Waterfront Potjie Dining — Lunch', 'dining', 43, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Latest catalog lists Eatery lunch at $43. Keep separate from dinner and legacy generic Potjie listing; verify exact variant and inclusions.'],
  }),
  product('Pure Africa', 'The Eatery Waterfront Potjie Dining — Dinner', 'dining', 49, {
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['Latest catalog lists Eatery dinner at $49. Keep separate from lunch and legacy generic Potjie listing; verify exact variant and inclusions.'],
  }),
  product('Pure Africa', 'Pure Africa Cruise and Dinner Combination — Standard', 'packages', 110, {
    productType: 'package',
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['The supplied catalog summary contains a $110 cruise-and-dinner combination; confirm exact cruise, meal, inclusions and rate basis before publication.'],
  }),
  product('Pure Africa', 'Pure Africa Cruise and Dinner Combination — Signature', 'packages', 156, {
    productType: 'package',
    authoritativeOverride: true,
    sourceReference: pa,
    verificationNotes: ['The supplied catalog summary contains a $156 cruise-and-dinner combination; confirm exact cruise, meal, inclusions and rate basis before publication.'],
  }),
];


export type OperatorMappingIssue = {
  operator: 'Wild Horizons' | 'Shearwater' | 'Pure Africa';
  found: number;
  matches: Array<{ id: string | null; name: string }>;
};

export function resolveOperatorMappings(
  operators: Array<{ id?: string | null; name?: string | null }>
): { operatorIds: Record<'Wild Horizons' | 'Shearwater' | 'Pure Africa', string | null>; issues: OperatorMappingIssue[] } {
  const normalizeName = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases: Record<'Wild Horizons' | 'Shearwater' | 'Pure Africa', string[]> = {
    'Wild Horizons': ['wild horizons', 'wild horizons victoria falls', 'wild horizons zimbabwe', 'wild horizons safaris'],
    'Shearwater': ['shearwater', 'shearwater victoria falls'],
    'Pure Africa': ['pure africa', 'pure africa experiences'],
  };
  const operatorIds: Record<'Wild Horizons' | 'Shearwater' | 'Pure Africa', string | null> = {
    'Wild Horizons': null, 'Shearwater': null, 'Pure Africa': null,
  };
  const issues: OperatorMappingIssue[] = [];
  for (const canonicalName of Object.keys(aliases) as Array<keyof typeof aliases>) {
    const accepted = new Set(aliases[canonicalName].map(normalizeName));
    const matches = operators.filter((operator) => accepted.has(normalizeName(operator.name)));
    if (matches.length === 1 && matches[0].id) operatorIds[canonicalName] = matches[0].id;
    else issues.push({ operator: canonicalName, found: matches.length, matches: matches.map((operator) => ({ id: operator.id || null, name: String(operator.name || '(unnamed operator)') })) });
  }
  return { operatorIds, issues };
}
