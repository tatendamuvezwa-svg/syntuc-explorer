import type { OperatorCatalogImportItem } from './operatorCatalogImport.ts';

export type AccommodationClassification = 'Budget' | 'Mid-range' | 'Luxury';

export type AccommodationCandidateItem = OperatorCatalogImportItem & {
  productType: 'accommodation';
  classification: AccommodationClassification;
  fullDescription: string;
};

export const accommodationCatalogImport: AccommodationCandidateItem[] = [
  // ==========================================
  // BUDGET — 8 entries
  // ==========================================
  {
    operatorName: 'Shoestrings Backpackers',
    name: 'Shoestrings Backpackers',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A lively, budget-friendly Victoria Falls stay with accommodation options for travellers who want to explore the destination and connect with fellow visitors.',
    fullDescription:
      'Shoestrings offers a range of accommodation styles in Victoria Falls, from shared dormitories and dome tents to private rooms and family accommodation. Its published accommodation information describes access to a communal self-catering kitchen, swimming pool and Wi-Fi. The property may suit travellers looking for a sociable base while exploring Victoria Falls. Confirm the available room type, current facilities and booking terms directly before making a reservation.',
    inclusions: [],
    exclusions: ['Rates, room inventory, facilities, and booking terms subject to direct supplier confirmation.'],
    mandatoryFees: [],
    sourceReference: 'https://www.shoestringsvicfalls.com/',
    verificationNotes: ['Confirm current room types, facilities, rates and any supplier relationship.'],
  },
  {
    operatorName: 'N1 Hotel & Campsite Victoria Falls',
    name: 'N1 Hotel & Campsite Victoria Falls',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A practical Victoria Falls accommodation option offering hotel rooms alongside campsite and dormitory choices.',
    fullDescription:
      'N1 Hotel & Campsite Victoria Falls lists several accommodation formats, including standard double and twin rooms, family rooms, dormitory beds and camping. Its published property information identifies room facilities and campsite amenities that vary by accommodation type. Travellers should select the appropriate option for their group and confirm current facilities, inclusions, rates and availability before booking.',
    inclusions: [],
    exclusions: ['Operating status, rate basis, room facilities, and campsite amenities vary by unit type; verify before booking.'],
    mandatoryFees: [],
    sourceReference: 'https://www.n1hotel.co.zw/victoriafalls/',
    verificationNotes: ["Confirm current accommodation types, the campsite's operating status, rate basis and inclusions."],
  },
  {
    operatorName: 'Victoria Falls Backpackers Lodge',
    name: 'Victoria Falls Backpackers Lodge',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'An affordable, relaxed base in Victoria Falls for travellers seeking flexible accommodation and access to local experiences.',
    fullDescription:
      'Victoria Falls Backpackers presents itself as an affordable accommodation option with a relaxed, social atmosphere. Its published information describes a range of accommodation choices and an activities desk for visitors planning experiences around Victoria Falls. Travellers should confirm the specific room or camping option, facilities, inclusions and current booking conditions that apply to their stay.',
    inclusions: [],
    exclusions: ['Specific room or camping configuration, facilities, and current booking conditions unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://www.victoriafallsbackpackers.com/',
    verificationNotes: ['Confirm exact accommodation types, facilities and current availability.'],
  },
  {
    operatorName: 'Dzimbahwe Guest Lodge',
    name: 'Dzimbahwe Guest Lodge',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A guest lodge in Victoria Falls offering accommodation options for independent travellers, couples, families and groups.',
    fullDescription:
      'Dzimbahwe Guest Lodge describes itself as a welcoming accommodation property in Victoria Falls, with room options and self-catering accommodation for different travel needs. Its published information also refers to dining, swimming facilities and paid airport transfers. Guests should confirm which facilities and services are available for their chosen accommodation, along with current rates, inclusions and transport arrangements.',
    inclusions: [],
    exclusions: ['Paid airport transfers and specific dining/self-catering services unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://dzimbahweguestlodge.com/',
    verificationNotes: ['Classification must remain Budget. Confirm room categories, service availability and paid-transfer terms.'],
  },
  {
    operatorName: 'Avril Guest Lodge',
    name: 'Avril Guest Lodge',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A budget-oriented guest lodge in Victoria Falls for travellers seeking a straightforward place to stay while exploring the area.',
    fullDescription:
      'Avril Guest Lodge is listed among the accommodation options in Victoria Falls. The available destination-directory listing describes several room types and a bed-and-breakfast offering, with dining and leisure facilities also noted. The current room inventory, inclusions and operating details should be confirmed with the property before this information is presented as definitive to guests.',
    inclusions: [],
    exclusions: ['Bed-and-breakfast offering, room inventory, and leisure facilities require property confirmation.'],
    mandatoryFees: [],
    sourceReference: 'https://wearevictoriafalls.com/where-to-stay-list/',
    verificationNotes: ['Confirm room types, meal inclusions, facilities and current contact details.'],
  },
  {
    operatorName: 'Bhejane Guest Lodge',
    name: 'Bhejane Guest Lodge',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A Victoria Falls lodge offering a comfortable base for travellers visiting the destination for leisure or business.',
    fullDescription:
      'Bhejane Lodge describes its accommodation as modern and welcoming, with guest rooms and facilities intended to support leisure and business stays. Its published information refers to dining, a bar, a swimming pool and Wi-Fi, as well as paid airport-transfer arrangements. Guests should confirm the current room configuration, service availability and applicable inclusions directly with the property.',
    inclusions: [],
    exclusions: ['Airport transfer charges, room configurations, and dining service availability unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://bhejanelodge.com/',
    verificationNotes: ['Confirm the registered property name, room inventory, current facilities and transfer charges.'],
  },
  {
    operatorName: 'Premier Guest Lodge',
    name: 'Premier Guest Lodge',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A guest-lodge option in Victoria Falls for travellers looking for a practical base for their visit.',
    fullDescription:
      'Premier Guest Lodge is included in the Victoria Falls accommodation discovery list. This draft introduces the property as an accommodation option without assuming unverified room features, dining arrangements, location advantages or included services. Before publication, confirm the property’s current accommodation types, facilities, location details and guest inclusions using an authoritative property source.',
    inclusions: [],
    exclusions: ['Detailed property information remains unresolved. Amenity claims must not be added until substantiated.'],
    mandatoryFees: [],
    sourceReference: 'https://wearevictoriafalls.com/where-to-stay-list/',
    verificationNotes: ['Detailed property information remains unresolved. Do not add amenity claims until substantiated.'],
  },
  {
    operatorName: 'Victoria Falls Rest Camp',
    name: 'Victoria Falls Rest Camp',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Budget',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A nature-oriented Victoria Falls stay offering camping and other accommodation options for travellers who prefer a relaxed, informal setting.',
    fullDescription:
      'Victoria Falls Rest Camp describes a range of accommodation choices, including camping, safari tents and self-catering lodges. Its published information highlights tree-lined grounds and access to leisure and dining facilities. The property may suit travellers seeking a flexible stay close to the destination’s attractions. Confirm the specific accommodation type, current facilities, inclusions and rate basis before quoting or accepting a reservation request.',
    inclusions: [],
    exclusions: ['Rate basis, specific unit inventory, and dining access unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://restcampvictoriafalls.com/',
    verificationNotes: ['Confirm current inventory, the exact product name used by the operator and the rate basis for each accommodation type.'],
  },

  // ==========================================
  // MID-RANGE — 8 entries
  // ==========================================
  {
    operatorName: 'Kasambabezi Lodge',
    name: 'Kasambabezi Lodge',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A Victoria Falls lodge combining guest accommodation with dining and leisure facilities in a relaxed setting.',
    fullDescription:
      'Kasambabezi Lodge presents itself as a retreat in Victoria Falls, with accommodation options and shared facilities described on its official website. The published information refers to guest rooms, dining, a bar, a swimming pool, gardens and conference facilities. Travellers should confirm the current room category, inclusions and service availability for their intended dates before submitting a reservation request.',
    inclusions: [],
    exclusions: ['Rates, commercial tier, and room inclusions must be confirmed directly with property.'],
    mandatoryFees: [],
    sourceReference: 'https://kasambabezilodge.com/',
    verificationNotes: ['Classification must remain Mid-range. Do not infer a rate or commercial tier from online price displays.'],
  },
  {
    operatorName: 'Cresta Sprayview',
    name: 'Cresta Sprayview',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A hotel in Victoria Falls with landscaped grounds and accommodation suited to travellers exploring the Falls and surrounding attractions.',
    fullDescription:
      'Cresta Sprayview is part of the Cresta Hotels portfolio in Victoria Falls. Its official property information describes accommodation set within landscaped grounds, with dining and leisure facilities including a swimming pool. The hotel positions itself as a base for visitors exploring Victoria Falls and the surrounding destination. Confirm current room options, inclusions and operating details for the requested dates.',
    inclusions: [],
    exclusions: ['Applicable supplier relationship, current room categories, and inclusions unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://www.crestahotels.com/hotels/zimbabwe/cresta-sprayview',
    verificationNotes: ['Confirm current room categories, inclusions and the applicable supplier relationship.'],
  },
  {
    operatorName: '528 Boutique Hotel',
    name: '528 Boutique Hotel',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A small, design-focused accommodation property in Victoria Falls offering a more personal stay for couples, families and small groups.',
    fullDescription:
      '528 describes itself as a designer bed-and-breakfast property in Victoria Falls, with individually styled accommodation and a range of room configurations. Its official information refers to en-suite rooms, family accommodation and a separate bungalow option. The property emphasises a personalised hosting experience. Confirm the exact room or unit, included breakfast arrangements and current booking conditions before presenting a specific option to guests.',
    inclusions: [],
    exclusions: ['Included breakfast arrangements and bungalow versus main inventory distinction unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://528victoriafalls.com/',
    verificationNotes: ['Confirm the distinction between the main accommodation inventory and the separately described bungalow.'],
  },
  {
    operatorName: 'Pioneers',
    name: 'Pioneers',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A garden-set lodge in Victoria Falls offering a calm accommodation setting for couples, families and other travellers.',
    fullDescription:
      'Pioneers describes its property as a peaceful retreat in Victoria Falls, combining a classic lodge atmosphere with modern guest accommodation. Its published information refers to landscaped gardens, en-suite rooms, family-room options and shared dining and lounge areas. Guests should confirm the available room category, current inclusions and any services required for their stay.',
    inclusions: [],
    exclusions: ['Exact property location, room inventory, and amenities unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://www.pioneersvicfalls.com/',
    verificationNotes: ['Confirm room inventory, current amenities and the exact property location before publishing detailed claims.'],
  },
  {
    operatorName: 'Lokuthula Lodges',
    name: 'Lokuthula Lodges',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A lodge accommodation option in Victoria Falls for travellers seeking a stay with a more independent, residential feel.',
    fullDescription:
      'Lokuthula Lodges is included among the accommodation options associated with Victoria Falls. This draft provides a neutral overview without assuming the configuration of a particular lodge, the facilities included or the services available to every guest. Confirm the exact accommodation unit, current facilities, location, inclusions and applicable booking conditions before presenting a specific option.',
    inclusions: [],
    exclusions: ['Unit configuration, facilities, and relationship to wider hospitality estate unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://wearevictoriafalls.com/where-to-stay-list/',
    verificationNotes: ['Confirm current unit types and the precise relationship between the listed property and any related accommodation or hospitality facilities.'],
  },
  {
    operatorName: 'Miombo Mews',
    name: 'Miombo Mews',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'Self-catering holiday villas in Victoria Falls, offering an independent accommodation option for families and small groups.',
    fullDescription:
      'Miombo Mews describes its accommodation as furnished self-catering villas in Victoria Falls. Its official information refers to villas with separate living and dining areas, kitchen facilities and private outdoor space, alongside shared leisure facilities. This format can suit guests who prefer a more independent stay. Confirm the specific unit, occupancy rules, current facilities and any optional services before submitting a reservation request.',
    inclusions: [],
    exclusions: ['Occupancy limits, breakfast, and transfer options unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://miombomews.com/accommodation/',
    verificationNotes: ['Confirm the current unit inventory, occupancy limits and any breakfast or transfer arrangements relevant to the selected booking.'],
  },
  {
    operatorName: 'Zimbara',
    name: 'Zimbara',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A Victoria Falls accommodation option for travellers comparing mid-range places to stay in the destination.',
    fullDescription:
      'Zimbara is included in the proposed Syntuc Explorer accommodation catalogue as a mid-range candidate. This draft intentionally avoids asserting particular room features, amenities, location advantages or included services until the property identity and current information are confirmed. Once an authoritative source has been identified, the description can be refined to reflect the actual accommodation offering and the needs of prospective guests.',
    inclusions: [],
    exclusions: ['Official property source and property details unresolved; all features unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'Authoritative property URL to be confirmed.',
    verificationNotes: ['Official property source and current property details remain unresolved. Keep unpublished pending verification.'],
  },
  {
    operatorName: 'Shongwe Oasis',
    name: 'Shongwe Oasis',
    categorySlug: 'lodge-resort',
    productType: 'accommodation',
    classification: 'Mid-range',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A garden-centred lodge in Victoria Falls offering a relaxed setting and a range of guest-room options.',
    fullDescription:
      'Shongwe Oasis describes its accommodation as furnished rooms set among gardens and trees around a central swimming pool. Its published room information includes twin, double and triple options, as well as honeymoon accommodation. The property’s surroundings and room variety may appeal to travellers seeking a quieter lodge-style stay. Confirm the exact room category, current inclusions and booking terms before presenting a specific option.',
    inclusions: [],
    exclusions: ['Room availability and property-specific inclusions unconfirmed. Must remain distinct from Shongwe Lookout.'],
    mandatoryFees: [],
    sourceReference: 'https://shongwe-oasis.com/stay/',
    verificationNotes: ['Keep Shongwe Oasis distinct from Shongwe Lookout. Confirm current room availability and property-specific inclusions.'],
  },

  // ==========================================
  // LUXURY — 8 entries
  // ==========================================
  {
    operatorName: 'The Victoria Falls Hotel',
    name: 'The Victoria Falls Hotel',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'An established luxury hotel in Victoria Falls, recognised for its Edwardian style, heritage character and formal hospitality setting.',
    fullDescription:
      'The Victoria Falls Hotel describes itself as a classic luxury hotel with a history dating to 1904. Its official information highlights Edwardian-style architecture, traditional hotel character, accommodation and dining. The property offers a distinctive heritage-oriented option for travellers seeking a classic hotel experience in Victoria Falls. Confirm the selected room category, current inclusions and booking conditions for the intended stay.',
    inclusions: [],
    exclusions: ['Room categories, dining arrangements, and package inclusions subject to operator confirmation.'],
    mandatoryFees: [],
    sourceReference: 'https://www.victoriafallshotel.com/',
    verificationNotes: ['Confirm current room categories, dining arrangements and the exact inclusions attached to each offer.'],
  },
  {
    operatorName: 'Ilala Lodge Hotel',
    name: 'Ilala Lodge Hotel',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A luxury hotel in Victoria Falls with established gardens, guest accommodation and dining close to the destination’s principal attraction.',
    fullDescription:
      'Ilala Lodge Hotel describes itself as a family-run hotel in Victoria Falls, set within established gardens and within walking distance of the Falls. Its published information includes several room and suite categories, along with Cassia Restaurant. The property offers a hotel-based stay for travellers who value convenient access to local attractions and on-site dining. Confirm the exact room category, current inclusions and applicable rates before quoting.',
    inclusions: [],
    exclusions: ['Published public rates must not be copied as confirmed supplier rates without an approved rate source.'],
    mandatoryFees: [],
    sourceReference: 'https://www.ilalalodge.com/',
    verificationNotes: ['Do not copy published public rates into the Syntuc catalogue as confirmed supplier rates without an approved rate source.'],
  },
  {
    operatorName: 'Palm River Hotel',
    name: 'Palm River Hotel',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A luxury riverside hotel in Victoria Falls with accommodation designed around views of the Zambezi River and its surrounding landscape.',
    fullDescription:
      'Palm River Hotel describes its accommodation as a luxury riverside property on the banks of the Zambezi River. Its official accommodation information lists several room and suite categories, as well as a private villa. The hotel presents a contemporary setting that incorporates the surrounding river landscape into the guest experience. Confirm the selected room or suite, current inclusions and any relevant booking conditions before presenting a quote.',
    inclusions: [],
    exclusions: ['Breakfast or other inclusions attached to specific room categories unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://www.palmriverhotel.com/accommodation/',
    verificationNotes: ['Confirm current inventory and the exact breakfast or other inclusions attached to the selected room category.'],
  },
  {
    operatorName: 'Stanley and Livingstone Boutique Hotel',
    name: 'Stanley and Livingstone Boutique Hotel',
    categorySlug: 'hotel',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A luxury boutique accommodation candidate for travellers seeking a more intimate hotel experience around Victoria Falls.',
    fullDescription:
      'Stanley and Livingstone Boutique Hotel is included in the proposed luxury accommodation catalogue. Before making detailed claims about its current rooms, facilities or location, confirm the precise property identity and authoritative operator information. This draft avoids combining details from similarly named safari properties or assuming that every service described in historical listings remains available.',
    inclusions: [],
    exclusions: ['Current trading name, operator identity, and official property source unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'Victoria Falls accommodation directory. Confirm the current official URL and operator before publication.',
    verificationNotes: ['Confirm the current trading name, operator identity and official property source before publication.'],
  },
  {
    operatorName: 'Zambezi Sands River Camp',
    name: 'Zambezi Sands River Camp',
    categorySlug: 'safari-camp',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A luxury river-camp accommodation candidate for travellers seeking a wilderness-oriented stay associated with the Zambezi region.',
    fullDescription:
      'Zambezi Sands River Camp is included in the proposed luxury accommodation catalogue. Its final guest-facing description must be based on current, property-specific evidence covering the accommodation, location, facilities and services actually offered. Until those details are confirmed, the catalogue should not assert a particular tent or suite configuration, included safari activities, meal plan or transport arrangement.',
    inclusions: [],
    exclusions: ['Must not be merged with Victoria Falls River Lodge. Tent configuration, safari activities, meal plan, and transport unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'Victoria Falls accommodation directory. Confirm the official property source and operator before publication.',
    verificationNotes: ['Confirm the exact property identity and operator. Do not merge its record with Victoria Falls River Lodge or another related-looking property without evidence.'],
  },
  {
    operatorName: 'Victoria Falls River Lodge',
    name: 'Victoria Falls River Lodge',
    categorySlug: 'safari-camp',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A luxury riverside safari lodge in the Zambezi wilderness, offering accommodation for travellers seeking a nature-focused stay near Victoria Falls.',
    fullDescription:
      'Victoria Falls River Lodge describes its location on the Zambezi River within the Zimbabwean wilderness near Victoria Falls. Its official information presents several accommodation formats, including luxury tented suites and private villas. The lodge combines a riverside setting with a safari-oriented guest experience. Confirm the selected accommodation type, current inclusions, activity arrangements and booking conditions before presenting a specific offer.',
    inclusions: [],
    exclusions: ['Avoid duplicating related lodge, villa, or tent products as separate suppliers unless required.'],
    mandatoryFees: [],
    sourceReference: 'https://victoriafallsriverlodge.com/',
    verificationNotes: ['Confirm the precise accommodation product and avoid duplicating related lodge, villa or tent products as separate suppliers unless the catalogue specification requires them.'],
  },
  {
    operatorName: 'The Wallow Lodge',
    name: 'The Wallow Lodge',
    categorySlug: 'safari-camp',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'A luxury lodge candidate for travellers seeking an accommodation-led experience around Victoria Falls and its natural surroundings.',
    fullDescription:
      'The Wallow Lodge is included in the proposed luxury accommodation catalogue. Before publication, confirm the current operator description and the exact accommodation product being offered. The final copy should reflect verified details about its setting, accommodation format, facilities and guest services without borrowing features from other lodges or assuming that particular activities or inclusions are part of the stay.',
    inclusions: [],
    exclusions: ['Official source, operator, and wider collection relationships unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'Victoria Falls accommodation directory. Confirm the official property source and operator before publication.',
    verificationNotes: ['Confirm the current official source, operator and relationship to any wider lodge collection before publication.'],
  },
  {
    operatorName: 'Victoria Falls Safari Club',
    name: 'Victoria Falls Safari Club',
    categorySlug: 'safari-camp',
    productType: 'accommodation',
    classification: 'Luxury',
    basePrice: null,
    priceBasis: null,
    shortDescription:
      'An exclusive safari-oriented accommodation option in Victoria Falls, designed for travellers seeking a premium stay with a wilderness outlook.',
    fullDescription:
      'Victoria Falls Safari Club is presented within the Victoria Falls Safari Collection as an exclusive accommodation experience. Published collection information refers to premium rooms, concierge-style service, afternoon tea and a dedicated dining and game-viewing area. Confirm the current room category and which services are included in the specific offer before using these details in a guest-facing quote.',
    inclusions: [],
    exclusions: ['Keep distinct from Victoria Falls Safari Lodge. Specific supplier terms, inclusions, and room categories unconfirmed.'],
    mandatoryFees: [],
    sourceReference: 'https://victoria-falls-safari-collection.com/en-US/accommodation',
    verificationNotes: ['Keep Victoria Falls Safari Club distinct from Victoria Falls Safari Lodge. Verify the exact property record, supplier terms and current inclusions.'],
  },
];

// Preserved canonical existing accommodation identifiers and names
export const PRESERVED_ACCOMMODATION_CANONICALS = [
  { id: 'prod_olddrift', name: 'Old Drift Lodge', operatorName: 'Machaba Safaris', rate: 'US$1,087 per person' },
  { id: 'prod_azambezi', name: "A'Zambezi River Lodge", altName: 'A’Zambezi River Lodge', operatorName: 'Rainbow Tourism Group', rate: 'US$220 per room-night' },
  { id: 'prod_rainbow', name: 'Victoria Falls Rainbow Hotel', operatorName: 'Rainbow Tourism Group', rate: 'US$165 per room-night' },
  { id: 'prod_explorers', name: 'Shearwater Explorers Village', operatorName: 'Shearwater Victoria Falls', rate: 'US$110 per room-night' },
  { id: 'prod_elephantcamp', name: 'The Elephant Camp', operatorName: 'Wild Horizons', rate: 'US$1,087 per room-night' },
];

export const SAFEGUARD_DISTINCTIONS = [
  { candidate: 'Shongwe Oasis', prohibitedMerge: 'Shongwe Lookout' },
  { candidate: 'Victoria Falls Safari Club', prohibitedMerge: 'Victoria Falls Safari Lodge' },
  { candidate: 'Zambezi Sands River Camp', prohibitedMerge: 'Victoria Falls River Lodge' },
];
