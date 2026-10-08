import { Router, Request, Response } from 'express';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, asc } from 'drizzle-orm';

const router = Router();

// GET all published products with primary media and operator info
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.isPublished, true))
      .orderBy(schema.products.name);

    const operators = await db.select().from(schema.operators);
    const operatorMap = new Map(operators.map(o => [o.id, o]));

    const mediaList = await db.select().from(schema.mediaAssets);

    const productsWithDetails = products.map(p => {
      const op = p.operatorId ? operatorMap.get(p.operatorId) : null;
      // Get primary media asset or first product image (custom coordinator uploads strictly take precedence)
      const productMedia = mediaList.filter(m => m.ownerId === p.id);
      const customUploads = productMedia.filter(
        m => m.sourceName === 'Coordinator Upload' || m.url.startsWith('data:') || m.url.startsWith('__CHUNKED__:')
      );
      let primaryMedia = p.primaryMediaId ? productMedia.find(m => m.id === p.primaryMediaId) : null;
      if (customUploads.length > 0 && (!primaryMedia || (primaryMedia.sourceName !== 'Coordinator Upload' && !primaryMedia.url.startsWith('data:')))) {
        primaryMedia = customUploads.find(m => m.isPrimary) || customUploads[0];
      }
      if (!primaryMedia) {
        primaryMedia = productMedia.find(m => m.isPrimary) || productMedia[0];
      }

      return {
        ...p,
        operatorName: op?.name || 'Syntuc Partner',
        primaryImageUrl: primaryMedia?.url || null,
        primaryImageAlt: primaryMedia?.altText || p.name,
      };
    });

    res.json(productsWithDetails);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCTS' });
  }
});

// GET single product detail with rooms, variants, and gallery media
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productRecords = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));

    if (productRecords.length === 0) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const product = productRecords[0];

    const operator = product.operatorId
      ? (await db.select().from(schema.operators).where(eq(schema.operators.id, product.operatorId)))[0]
      : null;

    const property = product.propertyId
      ? (await db.select().from(schema.properties).where(eq(schema.properties.id, product.propertyId)))[0]
      : null;

    const rooms = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.productId, product.id));

    const variants = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, product.id));

    const media = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.ownerId, product.id))
      .orderBy(asc(schema.mediaAssets.displayOrder));

    const customUploads = media.filter(
      m => m.sourceName === 'Coordinator Upload' || m.url.startsWith('data:') || m.url.startsWith('__CHUNKED__:')
    );
    let primaryMedia = product.primaryMediaId ? media.find(m => m.id === product.primaryMediaId) : null;
    if (customUploads.length > 0 && (!primaryMedia || (primaryMedia.sourceName !== 'Coordinator Upload' && !primaryMedia.url.startsWith('data:')))) {
      primaryMedia = customUploads.find(m => m.isPrimary) || customUploads[0];
    }
    if (!primaryMedia) {
      primaryMedia = media.find(m => m.isPrimary) || media[0];
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
  } catch (error) {
    console.error('Error fetching product detail:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCT_DETAIL' });
  }
});

// GET categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.displayOrder));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_CATEGORIES' });
  }
});

// GET packages
router.get('/packages', async (req: Request, res: Response) => {
  try {
    const packages = await db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.isPublished, true));
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_PACKAGES' });
  }
});

export default router;
