import { Router, Request, Response } from 'express';
import {
  getCollectionDocs,
  getDocById,
  where,
  getTombstones,
} from '../lib/firestore.ts';
import { getAuthoritativeVariantsForProduct } from '../services/variantCatalog.ts';

const router = Router();

// GET all published products with primary media and operator info
router.get('/products', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allProducts = await getCollectionDocs<any>('products');
    // Live Firestore is the sole source of guest-visible products.
    const products = allProducts
      .filter((p) => p.isPublished === true && !tombstones.has(`products_${p.id}`))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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
        primaryImageUrl: primaryMedia?.url || null,
        primaryImageAlt: primaryMedia?.altText || p.name,
      };
    });

    res.json(productsWithDetails);
  } catch (error: any) {
    console.error('[Guest Catalog API] Failed to read the authoritative published catalogue:', error);
    res.status(503).json({
      error: 'CATALOGUE_UNAVAILABLE',
      message: 'The live catalogue could not be read. No baseline products were returned.',
      diagnosticCode: typeof error?.code === 'string' ? error.code : 'FIRESTORE_READ_FAILED',
    });
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

    const product = await getDocById<any>('products', id);
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
      primaryImageUrl: primaryMedia?.url || null,
      primaryImageAlt: primaryMedia?.altText || product.name,
    });
  } catch (error: any) {
    console.error('[Guest Catalog API] Failed to read product detail from Firestore:', error);
    res.status(503).json({
      error: 'CATALOGUE_UNAVAILABLE',
      message: 'The product details could not be loaded from the live catalogue.',
      diagnosticCode: typeof error?.code === 'string' ? error.code : 'FIRESTORE_READ_FAILED',
    });
  }
});

// GET authoritative variants for a product
router.get('/products/:id/variants', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const variants = await getAuthoritativeVariantsForProduct(id);
    res.json(variants);
  } catch (error) {
    console.warn('Notice fetching variants from catalog service:', error);
    res.json([]);
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
    console.warn('Error fetching categories (using baseline categories):', error);
    const fallbackCategories = [
      { id: 'cat_lodge', displayOrder: 1, slug: 'lodge-resort', type: 'accommodation', name: 'Riverfront Lodges & Resorts' },
      { id: 'cat_hotel', name: 'Town Hotels & Suites', displayOrder: 2, type: 'accommodation', slug: 'hotel' },
      { id: 'cat_safari', type: 'accommodation', displayOrder: 3, slug: 'safari-camp', name: 'Luxury Safari Camps' },
      { id: 'cat_flight', name: 'Helicopter & Scenic Flights', displayOrder: 4, type: 'activity', slug: 'flight-air' },
      { id: 'cat_cruise', slug: 'river-cruises', type: 'activity', name: 'Zambezi River Cruises', displayOrder: 5 },
      { id: 'cat_guided', slug: 'guided-tours', type: 'activity', displayOrder: 6, name: 'Guided Falls & Heritage Tours' },
      { id: 'cat_dining', type: 'activity', slug: 'dining-culinary', displayOrder: 7, name: 'Scenic & Cultural Dining' },
      { id: 'cat_adventure', slug: 'adventure-wildlife', type: 'activity', name: 'Rafting, Wildlife & Adrenaline', displayOrder: 8 },
      { id: 'cat_packages', name: 'Curated Holiday Packages', displayOrder: 9, slug: 'packages', type: 'package' },
    ];
    res.json(fallbackCategories);
  }
});

// GET packages
router.get('/packages', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allPackages = await getCollectionDocs<any>('packages');
    let packages = allPackages.filter(
      (p) => p.isPublished && !tombstones.has(`packages_${p.id}`)
    );

    // If no published packages found in packages collection, also check products collection
    if (packages.length === 0) {
      const allProducts = await getCollectionDocs<any>('products');
      packages = allProducts.filter(
        (p) => (p.productType === 'package' || p.categorySlug === 'packages') && p.isPublished && !tombstones.has(`products_${p.id}`)
      );
    }

    res.json(packages);
  } catch (error: any) {
    console.error('[Guest Catalog API] Failed to read the authoritative package catalogue:', error);
    res.status(503).json({
      error: 'CATALOGUE_UNAVAILABLE',
      message: 'The live package catalogue could not be read. No fallback catalogue was substituted.',
      diagnosticCode: typeof error?.code === 'string' ? error.code : 'FIRESTORE_READ_FAILED',
    });
  }
});

export default router;
