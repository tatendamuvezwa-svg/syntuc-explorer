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
    const products = allProducts
      .filter((p) => p.isPublished && !tombstones.has(`products_${p.id}`))
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

    const product = await getDocById<any>('products', id);
    if (!product) {
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
      primaryImageUrl: primaryMedia?.url || null,
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

// GET packages. Preserve Firestore-managed records; expose the frozen operator package catalogue
// only when no published package records exist. No Firestore data is overwritten or seeded.
const CONFIRMED_OPERATOR_PACKAGES = [
  {
    id: 'pkg_shearwater_tick_it_to_adventure', name: 'Tick It To Adventure', slug: 'tick-it-to-adventure',
    tagline: 'A multi-activity Victoria Falls adventure', description: 'Shearwater Adventures combination package with a standard sunset cruise and two additional activities. Confirm the exact activity choices and date-specific availability with the Reservations Desk.',
    durationDays: 1, durationNights: 0, pricePerPerson: '478', currency: 'USD',
    highlights: ['Standard sunset cruise', 'Two additional activities', 'Original operator package price'],
    inclusions: ['Standard sunset cruise', 'Two activities included in the operator package; exact selection requires confirmation'],
    exclusions: ['Any fees or supplements not expressly included by the operator', 'Transport unless confirmed for the selected activities'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Shearwater Adventures', evidenceStatus: 'SUPPORTED', availabilityNote: 'Price and package components require operator confirmation before booking.'
  },
  {
    id: 'pkg_shearwater_raft_and_bungee', name: 'Raft And Bungee', slug: 'raft-and-bungee',
    tagline: 'River adventure and bridge adrenaline', description: 'A Shearwater Adventures combination of white-water rafting and bungee jumping. Seasonal river conditions and the final activity schedule must be confirmed.',
    durationDays: 1, durationNights: 0, pricePerPerson: '347', currency: 'USD',
    highlights: ['White-water rafting', 'Bungee jumping', 'Original operator package price'],
    inclusions: ['White-water rafting', 'Bungee jumping'],
    exclusions: ['Mandatory government or conservation fees unless confirmed included', 'Any unlisted transfers or add-ons'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Shearwater Adventures', evidenceStatus: 'SUPPORTED', availabilityNote: 'Seasonal availability, fees and package inclusions require operator confirmation.'
  },
  {
    id: 'pkg_shearwater_bungee_and_jetboat', name: 'Bungee And Jetboat', slug: 'bungee-and-jetboat',
    tagline: 'Bridge jump meets Zambezi jet boating', description: 'A Shearwater Adventures combination pairing bungee jumping with a Zambezi jetboat experience.',
    durationDays: 1, durationNights: 0, pricePerPerson: '312', currency: 'USD',
    highlights: ['Bungee jumping', 'Jetboat experience', 'Original operator package price'],
    inclusions: ['Bungee jumping', 'Jetboat experience'],
    exclusions: ['Mandatory fees unless confirmed included', 'Any unlisted transfers or add-ons'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Shearwater Adventures', evidenceStatus: 'SUPPORTED', availabilityNote: 'Availability, fees and package inclusions require operator confirmation.'
  },
  {
    id: 'pkg_shearwater_big_air', name: 'Big Air', slug: 'big-air',
    tagline: 'Three iconic Victoria Falls bridge activities', description: 'The Shearwater Adventures Big Air combination featuring the Bridge Swing, Bridge Slide and Bungee Jump.',
    durationDays: 1, durationNights: 0, pricePerPerson: '280', currency: 'USD',
    highlights: ['Bridge Swing', 'Bridge Slide', 'Bungee Jump'],
    inclusions: ['Bridge Swing', 'Bridge Slide', 'Bungee Jump'],
    exclusions: ['Mandatory fees unless confirmed included', 'Any unlisted transfers or add-ons'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Shearwater Adventures', evidenceStatus: 'SUPPORTED', availabilityNote: 'Availability, fees and package inclusions require operator confirmation.'
  },
  {
    id: 'pkg_shearwater_whitewater_rampage', name: 'Zambezi Whitewater Rafting Rampage', slug: 'zambezi-whitewater-rafting-rampage',
    tagline: 'Jetboat thrills and white-water rapids', description: 'A Shearwater Adventures combination of a jetboat experience and rafting through rapids 1–5, subject to river conditions.',
    durationDays: 1, durationNights: 0, pricePerPerson: '204', currency: 'USD',
    highlights: ['Jetboat experience', 'White-water rafting through rapids 1–5', 'River conditions apply'],
    inclusions: ['Jetboat experience', 'White-water rafting through rapids 1–5'],
    exclusions: ['Mandatory river conservation fees unless confirmed included', 'Any unlisted transfers or add-ons'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Shearwater Adventures', evidenceStatus: 'SUPPORTED', availabilityNote: 'River conditions, seasonal operation, fees and final inclusions require operator confirmation.'
  },
  {
    id: 'pkg_shearwater_jetboat_rafting', name: 'Jetboat + Rafting Combo', slug: 'jetboat-rafting-combo',
    tagline: 'Two ways to experience the Zambezi', description: 'A Shearwater Adventures combination pairing a jetboat ride with white-water rafting.',
    durationDays: 1, durationNights: 0, pricePerPerson: '268', currency: 'USD',
    highlights: ['Jetboat experience', 'White-water rafting', 'Original operator package price'],
    inclusions: ['Jetboat experience', 'White-water rafting'],
    exclusions: ['Mandatory river conservation fees unless confirmed included', 'Any unlisted transfers or add-ons'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Shearwater Adventures', evidenceStatus: 'SUPPORTED', availabilityNote: 'River conditions, fees and final inclusions require operator confirmation.'
  },
  {
    id: 'pkg_syntuc_platinum', name: 'Platinum Victoria Falls Experience', slug: 'platinum-victoria-falls-experience',
    tagline: 'A premium highlights itinerary', description: 'A bundled itinerary combining a sunset cruise, helicopter flight, guided Falls tour, Bridge Tour and return transfer. Lunch is optional and must be confirmed separately.',
    durationDays: 1, durationNights: 0, pricePerPerson: '326', currency: 'USD',
    highlights: ['Sunset cruise', 'Helicopter flight', 'Guided Falls tour', 'Bridge Tour and return transfer'],
    inclusions: ['Sunset cruise', 'Helicopter flight', 'Guided Falls tour', 'Bridge Tour', 'Return transfer'],
    exclusions: ['Optional lunch', 'Park, government, fuel or other surcharges not expressly included'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Syntuc Explorer — partner activities', evidenceStatus: 'SUPPORTED', availabilityNote: 'Indicative frozen package price; component prices, fees and availability require confirmation before booking.'
  },
  {
    id: 'pkg_syntuc_gold', name: 'Gold Victoria Falls Experience', slug: 'gold-victoria-falls-experience',
    tagline: 'River, rainforest and bridge heritage', description: 'A bundled itinerary combining a sunset cruise, guided Falls tour and Bridge Tour. Lunch is optional and must be confirmed separately.',
    durationDays: 1, durationNights: 0, pricePerPerson: '247', currency: 'USD',
    highlights: ['Sunset cruise', 'Guided Falls tour', 'Bridge Tour'],
    inclusions: ['Sunset cruise', 'Guided Falls tour', 'Bridge Tour'],
    exclusions: ['Optional lunch', 'Park or other fees not expressly included'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Syntuc Explorer — partner activities', evidenceStatus: 'SUPPORTED', availabilityNote: 'Indicative frozen package price; component prices, fees and availability require confirmation before booking.'
  },
  {
    id: 'pkg_syntuc_silver', name: 'Silver Victoria Falls Experience', slug: 'silver-victoria-falls-experience',
    tagline: 'Three classic Falls experiences', description: 'A bundled itinerary combining a sunset cruise, helicopter flight and guided Falls tour. Lunch is optional and must be confirmed separately.',
    durationDays: 1, durationNights: 0, pricePerPerson: '150', currency: 'USD',
    highlights: ['Sunset cruise', 'Helicopter flight', 'Guided Falls tour'],
    inclusions: ['Sunset cruise', 'Helicopter flight', 'Guided Falls tour'],
    exclusions: ['Optional lunch', 'Park, government, fuel or other fees not expressly included'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Syntuc Explorer — partner activities', evidenceStatus: 'SUPPORTED', availabilityNote: 'Indicative frozen package price; component prices, fees and availability require confirmation before booking.'
  },
  {
    id: 'pkg_syntuc_bronze', name: 'Bronze Victoria Falls Experience', slug: 'bronze-victoria-falls-experience',
    tagline: 'A simple two-experience package', description: 'A two-product package from the previously approved package list. Exact activity selection must be verified by the Reservations Desk; helicopter flight and Bridge Tour are excluded.',
    durationDays: 1, durationNights: 0, pricePerPerson: '75', currency: 'USD',
    highlights: ['Two products in the package', 'Helicopter flight excluded', 'Bridge Tour excluded'],
    inclusions: ['Two products from the approved Bronze package configuration; confirm the exact products before booking'],
    exclusions: ['Helicopter flight', 'Bridge Tour', 'Any fees or transfers not expressly included'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, operatorName: 'Syntuc Explorer — partner activities', evidenceStatus: 'PROVISIONAL', availabilityNote: 'Exact products, fees and current price require confirmation before booking.'
  }
];

router.get('/packages', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allPackages = await getCollectionDocs<any>('packages');
    const packages = allPackages.filter(
      (p) => p.isPublished && !tombstones.has(`packages_${p.id}`)
    );
    if (packages.length > 0) {
      res.json(packages);
      return;
    }
    // Safe read-only fallback: no Firestore writes and no changes to existing records.
    res.json(CONFIRMED_OPERATOR_PACKAGES);
  } catch (error) {
    console.error('Error fetching packages from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PACKAGES' });
  }
});

export default router;
