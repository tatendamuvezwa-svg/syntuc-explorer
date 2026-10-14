import { Router, Request, Response } from 'express';
import {
  getCollectionDocs,
  getDocById,
  where,
  getTombstones,
} from '../lib/firestore.ts';
import { getAuthoritativeVariantsForProduct } from '../services/variantCatalog.ts';

const router = Router();

// Canonical Pure Africa catalog entries. These read-only fallbacks appear only when the
// corresponding Firestore product is missing; Firestore records and coordinator edits always win.
export const PURE_AFRICA_FALLBACK_PRODUCTS = [
  {
    "id": "prod_pure_africa_sunrise_cruise",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "Pure Africa Sunrise Cruise",
    "slug": "pure-africa-sunrise-cruise",
    "productType": "activity",
    "categorySlug": "river-cruises",
    "shortDescription": "A two-hour sunrise cruise with breakfast aboard Zambezi Reflections or private vessel Kalunda.",
    "description": "Sunrise Cruise. US$92 per person. Standard timing 06:00–08:00; departures between 05:30 and 10:00 are available on request. Standard vessel: Zambezi Reflections (minimum 4, maximum 30 guests); private option: Kalunda (minimum 2, maximum 6 guests). Includes transfers and English breakfast, or continental breakfast on Kalunda. Excludes the US$12 National Park fee per person. No age restrictions.",
    "location": "Pure Africa Waterfront Jetty, Victoria Falls",
    "duration": "2 hours",
    "basePrice": "92",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "English breakfast (continental breakfast on Kalunda)"
    ],
    "exclusions": [
      "US$12 National Park fee per person"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "06:00–08:00; on request between 05:30 and 10:00",
    "vessels": [
      "Zambezi Reflections",
      "Kalunda (private option)"
    ],
    "capacityNote": "Zambezi Reflections: 4–30 guests; private Kalunda: 2–6 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "Departure times and vessel choice are subject to request confirmation. National Park fee is additional.",
    "primaryMediaId": null,
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": null
  },
  {
    "id": "prod_pure_africa_lunch_cruise",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "Pure Africa Lunch Cruise",
    "slug": "pure-africa-lunch-cruise",
    "productType": "activity",
    "categorySlug": "river-cruises",
    "shortDescription": "A two-hour Zambezi lunch cruise with a three-course meal and beverages.",
    "description": "Lunch Cruise. US$92 per person. Timing 12:00–14:00. Standard vessel: Zambezi Reflections (minimum 4, maximum 30 guests); private option: Kalunda (minimum 2, maximum 6 guests). Includes transfers, three-course lunch and beverages. Excludes the US$12 National Park fee per person. No age restrictions.",
    "location": "Pure Africa Waterfront Jetty, Victoria Falls",
    "duration": "2 hours",
    "basePrice": "92",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "Three-course lunch",
      "Beverages"
    ],
    "exclusions": [
      "US$12 National Park fee per person"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "12:00–14:00",
    "vessels": [
      "Zambezi Reflections",
      "Kalunda (private option)"
    ],
    "capacityNote": "Zambezi Reflections: 4–30 guests; private Kalunda: 2–6 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "National Park fee is additional. Vessel and date require confirmation.",
    "primaryMediaId": null,
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": null
  },
  {
    "id": "prod_zambezi_explorer_cruise",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "Zambezi Explorer Sunset Cruise",
    "slug": "zambezi-explorer-sunset-cruise",
    "productType": "activity",
    "categorySlug": "river-cruises",
    "shortDescription": "Choose Luxury Deck or Signature Top Deck aboard the Zambezi Explorer.",
    "description": "Sunset Cruise aboard Zambezi Explorer. Duration 2 hours. Summer: 16:30–18:30; winter: 16:00–18:00. Luxury Deck (Decks 1 and 2): US$69 per person, capacity 2–116. Signature Deck (Top Deck): US$110 per person, capacity 2–34. Luxury Deck includes transfers, canapés and beverages; Signature Deck includes transfers, canapés and selected premium beverages. Excludes US$12 National Park fee per person. No age restrictions.",
    "location": "Pure Africa Waterfront Jetty, Victoria Falls",
    "duration": "2 hours",
    "basePrice": "69",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "Canapés",
      "Deck-specific beverages"
    ],
    "exclusions": [
      "US$12 National Park fee per person"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "Summer 16:30–18:30; winter 16:00–18:00",
    "vessels": [
      "Zambezi Explorer"
    ],
    "capacityNote": "Luxury Deck: 2–116 guests; Signature Top Deck: 2–34 guests",
    "isPublished": true,
    "isFeatured": true,
    "availabilityNote": "Choose Luxury Deck or Signature Deck. National Park fee is additional.",
    "primaryMediaId": "med_2db2d6add31909b4f3d0adcf",
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": "/uploads/med_2db2d6add31909b4f3d0adcf.jpeg",
    "supportingImageUrls": []
  },
  {
    "id": "prod_pure_africa_dinner_cruise",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "Zambezi Breeze Dinner Cruise",
    "slug": "zambezi-breeze-dinner-cruise",
    "productType": "activity",
    "categorySlug": "river-cruises",
    "shortDescription": "A three-hour dinner cruise aboard Zambezi Breeze with a four-course dinner.",
    "description": "Dinner Cruise. US$110 per person. Timing 17:00–20:00. Vessel: Zambezi Breeze. Capacity 2–70 guests. Includes transfers, four-course dinner and beverages. Excludes US$12 National Park fee per person. No age restrictions.",
    "location": "Pure Africa Waterfront Jetty, Victoria Falls",
    "duration": "3 hours",
    "basePrice": "110",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "Four-course dinner",
      "Beverages"
    ],
    "exclusions": [
      "US$12 National Park fee per person"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "17:00–20:00",
    "vessels": [
      "Zambezi Breeze"
    ],
    "capacityNote": "2–70 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "National Park fee is additional. Departure and availability require confirmation.",
    "primaryMediaId": null,
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": null
  },
  {
    "id": "prod_pure_africa_classic_dinner_cruise",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "Pure Africa Classic Dinner Cruise",
    "slug": "pure-africa-classic-dinner-cruise",
    "productType": "activity",
    "categorySlug": "river-cruises",
    "shortDescription": "A premium dinner cruise aboard Zambezi Reflections, followed by a float at the waterfront jetty.",
    "description": "Classic Dinner Cruise. US$185 per person. Cruise until sunset from 17:00–19:00, then float at Pure Africa Waterfront Jetty from 19:00–20:00. Vessel: Zambezi Reflections. Capacity 2–24 guests. Includes transfers, six-course dinner and a selection of premium beverages. Excludes US$12 National Parks fee per person; beverages after 20:00 are at the guest's own expense. No children under 12 years.",
    "location": "Pure Africa Waterfront Jetty, Victoria Falls",
    "duration": "3 hours",
    "basePrice": "185",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "Six-course dinner",
      "Selection of premium beverages"
    ],
    "exclusions": [
      "US$12 National Parks fee per person",
      "Beverages after 20:00 are at the guest's own expense"
    ],
    "minimumAge": "No children under 12 years",
    "minimumAgeYears": 12,
    "schedule": "17:00–19:00 cruise until sunset; 19:00–20:00 float at the jetty",
    "vessels": [
      "Zambezi Reflections"
    ],
    "capacityNote": "2–24 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "No children under 12. National Parks fee is additional.",
    "primaryMediaId": null,
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": null
  },
  {
    "id": "prod_pure_africa_eatery_lunch",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "The Eatery Lunch Experience",
    "slug": "the-eatery-lunch-experience",
    "productType": "activity",
    "categorySlug": "dining",
    "shortDescription": "A three-course lunch at The Eatery at Pure Africa Waterfront.",
    "description": "The Eatery Lunch Experience. US$43 per person. Timing 12:00–14:00. Duration 2 hours. Location: The Eatery at Pure Africa Waterfront. Capacity 2–40 guests. Includes three-course lunch. Excludes transfers and beverages. No age restrictions.",
    "location": "The Eatery at Pure Africa Waterfront, Victoria Falls",
    "duration": "2 hours",
    "basePrice": "43",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Three-course lunch"
    ],
    "exclusions": [
      "Transfers",
      "Beverages"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "12:00–14:00",
    "capacityNote": "2–40 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "Transfers and beverages are not included.",
    "primaryMediaId": "med_c586325b4fea5fe25236ca20",
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": "/uploads/med_c586325b4fea5fe25236ca20.jpeg"
  },
  {
    "id": "prod_pure_africa_eatery_dinner",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "The Eatery Dinner Experiences",
    "slug": "the-eatery-dinner-experiences",
    "productType": "activity",
    "categorySlug": "dining",
    "shortDescription": "Choose a three-course à la carte dinner or a three-course Potjie dinner.",
    "description": "The Eatery Dinner Experiences. US$49 per person. Timing 18:00–21:00. Duration 3 hours. Location: The Eatery at Pure Africa Waterfront. Capacity 2–40 guests. Choose The Eatery Dinner (three-course à la carte) or The Eatery Potjie Dinner (three-course Potjie). Transfers and beverages are excluded. No age restrictions.",
    "location": "The Eatery at Pure Africa Waterfront, Victoria Falls",
    "duration": "3 hours",
    "basePrice": "49",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Selected three-course dinner: à la carte or Potjie"
    ],
    "exclusions": [
      "Transfers",
      "Beverages"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "18:00–21:00",
    "capacityNote": "2–40 guests",
    "isPublished": true,
    "isFeatured": true,
    "availabilityNote": "Select à la carte or Potjie dinner. Transfers and beverages are excluded. Thumbnail shows the Potjie option.",
    "primaryMediaId": "med_c586325b4fea5fe25236ca20",
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": "/uploads/med_c586325b4fea5fe25236ca20.jpeg"
  },
  {
    "id": "prod_pure_africa_eatery_dinner_sunset_combo",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "The Eatery Dinner & Sunset Cruise Combo",
    "slug": "the-eatery-dinner-sunset-cruise-combo",
    "productType": "activity",
    "categorySlug": "combos",
    "shortDescription": "Combine a Zambezi Explorer sunset cruise with dinner at The Eatery.",
    "description": "The Eatery Dinner & Sunset Cruise Combo. Luxury Deck: US$110 per person; Signature Deck: US$156 per person. Summer 16:30–21:00; winter 16:00–21:00. Duration 5 hours. Combines Zambezi Explorer with The Eatery at Pure Africa Waterfront. Capacity: Luxury Deck 2–40 guests; Signature Deck 2–34 guests. Includes transfers, sunset cruise, cruise beverages, three-course dinner, and complimentary wines, beers and soft drinks at The Eatery. Excludes US$12 National Park fee per person and dinner beverages. No age restrictions.",
    "location": "Zambezi Explorer and The Eatery at Pure Africa Waterfront, Victoria Falls",
    "duration": "5 hours",
    "basePrice": "110",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "Sunset cruise",
      "Cruise beverages",
      "Three-course dinner",
      "Complimentary wines, beers and soft drinks at The Eatery"
    ],
    "exclusions": [
      "US$12 National Park fee per person",
      "Dinner beverages"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "Summer 16:30–21:00; winter 16:00–21:00",
    "vessels": [
      "Zambezi Explorer"
    ],
    "capacityNote": "Luxury Deck: 2–40 guests; Signature Deck: 2–34 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "Choose Luxury Deck or Signature Deck. National Park fee is additional; dinner beverages excluded.",
    "primaryMediaId": "med_2db2d6add31909b4f3d0adcf",
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": "/uploads/med_2db2d6add31909b4f3d0adcf.jpeg",
    "supportingImageUrls": [
      "/uploads/med_c586325b4fea5fe25236ca20.jpeg"
    ]
  },
  {
    "id": "prod_pure_africa_eatery_potjie_sunset_combo",
    "operatorId": "op_pure_africa",
    "propertyId": null,
    "name": "The Eatery Potjie Dinner & Sunset Cruise Combo",
    "slug": "the-eatery-potjie-dinner-sunset-cruise-combo",
    "productType": "activity",
    "categorySlug": "combos",
    "shortDescription": "Combine a Zambezi Explorer sunset cruise with a three-course Potjie dinner at The Eatery.",
    "description": "The Eatery Potjie Dinner & Sunset Cruise Combo. Luxury Deck: US$110 per person; Signature Deck: US$156 per person. Summer 16:30–21:00; winter 16:00–21:00. Duration 5 hours. Combines Zambezi Explorer with The Eatery at Pure Africa Waterfront. Capacity: Luxury Deck 2–40 guests; Signature Deck 2–34 guests. Includes transfers, sunset cruise, cruise beverages, three-course Potjie dinner, and complimentary wines, beers and soft drinks at The Eatery. Excludes US$12 National Park fee per person and beverages at The Eatery. No age restrictions.",
    "location": "Zambezi Explorer and The Eatery at Pure Africa Waterfront, Victoria Falls",
    "duration": "5 hours",
    "basePrice": "110",
    "currency": "USD",
    "priceBasis": "per_person",
    "inclusions": [
      "Transfers",
      "Sunset cruise",
      "Cruise beverages",
      "Three-course Potjie dinner",
      "Complimentary wines, beers and soft drinks at The Eatery"
    ],
    "exclusions": [
      "US$12 National Park fee per person",
      "Beverages at The Eatery"
    ],
    "minimumAge": "No age restrictions",
    "schedule": "Summer 16:30–21:00; winter 16:00–21:00",
    "vessels": [
      "Zambezi Explorer"
    ],
    "capacityNote": "Luxury Deck: 2–40 guests; Signature Deck: 2–34 guests",
    "isPublished": true,
    "isFeatured": false,
    "availabilityNote": "Choose Luxury Deck or Signature Deck. National Park fee is additional; beverages at The Eatery excluded.",
    "primaryMediaId": "med_2db2d6add31909b4f3d0adcf",
    "videoUrl": null,
    "evidenceStatus": "SUPPORTED",
    "operatorName": "Pure Africa",
    "_fallbackImageUrl": "/uploads/med_2db2d6add31909b4f3d0adcf.jpeg",
    "supportingImageUrls": [
      "/uploads/med_c586325b4fea5fe25236ca20.jpeg"
    ]
  }
];

// GET all published products with primary media and operator info
router.get('/products', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allProducts = await getCollectionDocs<any>('products');
    const visibleFirestoreProducts = allProducts
      .filter((p) => p.isPublished && !tombstones.has(`products_${p.id}`));
    const pureAfricaIds = new Set([...PURE_AFRICA_FALLBACK_PRODUCTS.map((p) => p.id), 'prod_potjie_dining']);
    const canonicalPureAfricaProducts = PURE_AFRICA_FALLBACK_PRODUCTS
      .filter((p) => !tombstones.has(`products_${p.id}`))
      .map((canonical) => {
        const existing = visibleFirestoreProducts.find((p) => p.id === canonical.id);
        return existing
          ? { ...existing, ...canonical, primaryMediaId: existing.primaryMediaId || canonical.primaryMediaId }
          : canonical;
      });
    const products = [
      ...visibleFirestoreProducts.filter((p) => !pureAfricaIds.has(p.id)),
      ...canonicalPureAfricaProducts,
    ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const operators = await getCollectionDocs<any>('operators');
    const operatorMap = new Map(operators.map((o) => [o.id, o]));

    const allMedia = await getCollectionDocs<any>('media_assets');
    const mediaList = allMedia.filter((m) => !tombstones.has(`media_assets_${m.id}`));

    const productsWithDetails = products.map((p) => {
      const op = p.operatorId ? operatorMap.get(p.operatorId) : null;
      const productMedia = mediaList.filter((m) => m.ownerId === p.id);
      let primaryMedia = p.primaryMediaId
        ? productMedia.find((m) => m.id === p.primaryMediaId)
        : null;
      if (!primaryMedia) {
        primaryMedia = productMedia.find((m) => m.isPrimary) || productMedia[0] || null;
      }

      return {
        ...p,
        operatorName: op?.name || 'Syntuc Partner',
        primaryImageUrl: primaryMedia?.url || p._fallbackImageUrl || null,
        primaryImageAlt: primaryMedia?.altText || p.name,
      };
    });

    res.json(productsWithDetails);
  } catch (error) {
    console.error('Error fetching products from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCTS' });
  }
});

// GET single product detail with rooms, variants, and gallery media
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tombstones = await getTombstones();
    if (tombstones.has(`products_${id}`)) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const firestoreProduct = await getDocById<any>('products', id);
    const canonicalProduct = PURE_AFRICA_FALLBACK_PRODUCTS.find((p) => p.id === id) || null;
    const product = canonicalProduct
      ? { ...(firestoreProduct || {}), ...canonicalProduct, primaryMediaId: firestoreProduct?.primaryMediaId || canonicalProduct.primaryMediaId }
      : firestoreProduct || null;
    if (!product || tombstones.has(`products_${id}`)) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const operator = product.operatorId
      ? await getDocById<any>('operators', product.operatorId)
      : null;

    const property = product.propertyId
      ? await getDocById<any>('properties', product.propertyId)
      : null;

    const allRooms = await getCollectionDocs<any>('rooms');
    const rooms = allRooms.filter(
      (r) => (r.productId === product.id || r.propertyId === product.propertyId) && !tombstones.has(`rooms_${r.id}`)
    );

    const variants = await getAuthoritativeVariantsForProduct(product.id);

    const allMedia = await getCollectionDocs<any>('media_assets');
    let media = allMedia
      .filter((m) => m.ownerId === product.id && !tombstones.has(`media_assets_${m.id}`))
      .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));

    // Fallback catalogue images are committed under data/uploads and served by /uploads.
    // Expose them through the same detail-gallery shape when no product-owned Firestore
    // media records exist; this does not write or mutate Firestore.
    if (media.length === 0 && product._fallbackImageUrl) {
      const fallbackUrls = [
        product._fallbackImageUrl,
        ...(Array.isArray(product.supportingImageUrls) ? product.supportingImageUrls : []),
      ].filter((url, index, all) => typeof url === 'string' && url.length > 0 && all.indexOf(url) === index);
      media = fallbackUrls.map((url, index) => ({
        id: `fallback_${product.id}_${index + 1}`,
        ownerType: 'product',
        ownerId: product.id,
        mediaType: 'IMAGE',
        url,
        thumbnailUrl: url,
        isPrimary: index === 0,
        displayOrder: index,
        caption: index === 0 ? product.name : `Supporting image for ${product.name}`,
        altText: index === 0 ? product.name : `Supporting Pure Africa experience image for ${product.name}`,
        sourceName: 'Pure Africa 2026 catalogue asset',
        verificationState: 'ESTABLISHED',
      }));
    }

    let primaryMedia = product.primaryMediaId
      ? media.find((m) => m.id === product.primaryMediaId)
      : null;
    if (!primaryMedia) {
      primaryMedia = media.find((m) => m.isPrimary) || media[0] || null;
    }

    res.json({
      ...product,
      operator,
      property,
      rooms,
      variants,
      media,
      primaryImageUrl: primaryMedia?.url || product._fallbackImageUrl || null,
      primaryImageAlt: primaryMedia?.altText || product.name,
    });
  } catch (error) {
    console.error('Error fetching product detail from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCT_DETAIL' });
  }
});

// GET authoritative variants for a product
router.get('/products/:id/variants', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const variants = await getAuthoritativeVariantsForProduct(id);
    res.json(variants);
  } catch (error) {
    console.error('Error fetching variants from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_VARIANTS' });
  }
});

// GET categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await getCollectionDocs<any>('categories');
    const sorted = categories.sort(
      (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)
    );
    res.json(sorted);
  } catch (error) {
    console.error('Error fetching categories from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_CATEGORIES' });
  }
});

// GET packages
router.get('/packages', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allPackages = await getCollectionDocs<any>('packages');
    const packages = allPackages.filter(
      (p) => p.isPublished && !tombstones.has(`packages_${p.id}`)
    );
    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PACKAGES' });
  }
});

export default router;
