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
    id: 'prod_zambezi_explorer_cruise',
    operatorId: 'op_pure_africa',
    propertyId: null,
    name: 'Zambezi Explorer Luxury Sunset Cruise',
    slug: 'zambezi-explorer-luxury-sunset-cruise',
    productType: 'activity',
    categorySlug: 'river-cruises',
    shortDescription: 'A sunset cruise on the Zambezi with two deck experiences.',
    description: 'Enjoy a sunset cruise aboard the Zambezi Explorer. Choose the Luxury Deck or Signature Deck; the selected deck determines the fare and service level.',
    location: 'Pure Africa Waterfront Jetty, Victoria Falls',
    duration: '2 hours (sunset)',
    basePrice: '69',
    currency: 'USD',
    priceBasis: 'per_person',
    inclusions: ['Cruise experience', 'Deck-specific food and beverage service as described by the selected variant'],
    exclusions: ['US$12 National Parks River Conservation Fee per person, charged in addition to the base fare'],
    suitability: ['Couples', 'Families', 'Groups'],
    isPublished: true,
    isFeatured: true,
    availabilityNote: 'Luxury Deck: US$69 + US$12 conservation fee = US$81 per adult. Signature Deck: US$110 + US$12 fee = US$122 per adult. Confirm departure and availability with the Reservations Desk.',
    primaryMediaId: 'med_2db2d6add31909b4f3d0adcf',
    videoUrl: null,
    evidenceStatus: 'SUPPORTED',
    operatorName: 'Pure Africa',
    _fallbackImageUrl: '/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
  },
  {
    id: 'prod_potjie_dining',
    operatorId: 'op_pure_africa',
    propertyId: null,
    name: 'The Eatery Waterfront Potjie Dining',
    slug: 'the-eatery-waterfront-potjie-dining',
    productType: 'activity',
    categorySlug: 'dining',
    shortDescription: 'A traditional potjie dining experience at the waterfront.',
    description: 'Experience The Eatery Waterfront Potjie Dining at Pure Africa. Scheduled dining begins at 18:30 and lasts approximately 2.5 hours.',
    location: 'Pure Africa Waterfront, Victoria Falls',
    duration: '2.5 hours (from 18:30)',
    basePrice: '45',
    currency: 'USD',
    priceBasis: 'per_person',
    inclusions: ['Potjie dining experience as described by the operator'],
    exclusions: ['Any add-ons or services not explicitly listed in the operator confirmation'],
    suitability: ['Couples', 'Families', 'Groups'],
    isPublished: true,
    isFeatured: true,
    availabilityNote: 'US$45 per person. Confirm operating date, menu and availability with the Reservations Desk before confirming.',
    primaryMediaId: 'med_c586325b4fea5fe25236ca20',
    videoUrl: null,
    evidenceStatus: 'SUPPORTED',
    operatorName: 'Pure Africa',
    _fallbackImageUrl: '/uploads/med_c586325b4fea5fe25236ca20.jpeg',
  },
];

// GET all published products with primary media and operator info
router.get('/products', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allProducts = await getCollectionDocs<any>('products');
    const visibleFirestoreProducts = allProducts
      .filter((p) => p.isPublished && !tombstones.has(`products_${p.id}`));
    const existingIds = new Set(visibleFirestoreProducts.map((p) => p.id));
    const products = [
      ...visibleFirestoreProducts,
      ...PURE_AFRICA_FALLBACK_PRODUCTS.filter((p) => !existingIds.has(p.id) && !tombstones.has(`products_${p.id}`)),
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
    const product = firestoreProduct || PURE_AFRICA_FALLBACK_PRODUCTS.find((p) => p.id === id) || null;
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
    const media = allMedia
      .filter((m) => m.ownerId === product.id && !tombstones.has(`media_assets_${m.id}`))
      .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));

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
