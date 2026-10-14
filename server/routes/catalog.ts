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

// Exactly 12 founder-approved Syntuc Explorer packages. Do not add supplier/operator
// bundles here. Package prices are quote-based; missing itinerary details are supplied in the
// coordinator's quotation rather than fabricated. Firestore remains authoritative when populated.
const FOUNDER_APPROVED_PACKAGES = [
  {
    id: 'pkg_school_bronze', name: 'Bronze School Explorer', slug: 'bronze-school-explorer',
    tagline: 'A foundational Victoria Falls school trip', description: 'A school-group package built around accommodation, rainforest discovery and supervised group activities.',
    durationDays: 3, durationNights: 2, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['2 days of accommodation', 'Rainforest tour', 'Crocodile farm visit', 'Boat cruise', 'Pool access'],
    inclusions: ['Accommodation for 2 days', 'Rainforest tour', 'Crocodile farm visit', 'Boat cruise', 'Pool access'],
    exclusions: ['Any item not listed in the confirmed quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'School',
    itineraryNote: 'Day-by-day schedule is prepared in the quotation after dates, group size and operator availability are confirmed.'
  },
  {
    id: 'pkg_school_silver', name: 'Silver School Adventure', slug: 'silver-school-adventure',
    tagline: 'An extended school adventure', description: 'Builds on Bronze School Explorer with an extra night and additional supervised adventure and group dining activities.',
    durationDays: 4, durationNights: 3, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['All Bronze School Explorer inclusions', 'Quad biking', 'Bridge tour', 'Braai', 'One extra night'],
    inclusions: ['All Bronze School Explorer inclusions', 'Quad biking', 'Bridge tour', 'Braai', 'One extra night of accommodation'],
    exclusions: ['Any item not listed in the confirmed quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'School',
    itineraryNote: 'Day-by-day schedule is prepared in the quotation after dates, group size and operator availability are confirmed.'
  },
  {
    id: 'pkg_school_gold', name: 'Gold School Experience', slug: 'gold-school-experience',
    tagline: 'The premium school-group experience', description: 'The extended school package with luxury accommodation and premium Victoria Falls experiences.',
    durationDays: 5, durationNights: 4, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['5 days / 4 nights', 'Luxury accommodation', 'Helicopter flight', 'Boma dinner'],
    inclusions: ['Luxury accommodation', 'Helicopter flight', 'Boma dinner'],
    exclusions: ['Any item not listed in the confirmed quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'School',
    itineraryNote: 'Day-by-day schedule is prepared in the quotation after dates, group size and operator availability are confirmed.'
  },
  {
    id: 'pkg_family_bronze', name: 'Bronze Family Escape', slug: 'bronze-family-escape',
    tagline: 'A family-friendly Victoria Falls break', description: 'A family package combining the rainforest, a standard sunset cruise, family accommodation and pool time.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Rainforest visit', 'Standard sunset cruise', 'Family accommodation', 'Pool access'],
    inclusions: ['Rainforest visit', 'Standard sunset cruise', 'Family accommodation', 'Pool access'],
    exclusions: ['Any item not listed in the confirmed quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Family',
    itineraryNote: 'Trip length and day-by-day schedule are tailored in the quotation to family dates and ages.'
  },
  {
    id: 'pkg_family_silver', name: 'Silver Family Adventure', slug: 'silver-family-adventure',
    tagline: 'More time for shared family adventures', description: 'An extended family package that builds on Bronze Family Escape with a Chobe excursion, a suitable family adventure and an extra night.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['All Bronze Family Escape inclusions', 'Chobe excursion', 'Family-suitable adventure activity', 'One extra night'],
    inclusions: ['All Bronze Family Escape inclusions', 'Chobe excursion', 'Family-suitable adventure activity', 'One extra night of accommodation'],
    exclusions: ['Any item not listed in the confirmed quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Family',
    itineraryNote: 'Trip length, age suitability and day-by-day schedule are confirmed in the quotation.'
  },
  {
    id: 'pkg_family_gold', name: 'Gold Family Explorer', slug: 'gold-family-explorer',
    tagline: 'A premium family experience', description: 'A premium family itinerary featuring luxury accommodation, a helicopter flight, a premium sunset cruise and an additional family experience.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Luxury accommodation', 'Helicopter flight', 'Premium sunset cruise', 'Additional family experience'],
    inclusions: ['Luxury accommodation', 'Helicopter flight', 'Premium sunset cruise', 'Additional family experience confirmed in the quotation'],
    exclusions: ['Any item not listed in the confirmed quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Family',
    itineraryNote: 'Trip length, age suitability and day-by-day schedule are confirmed in the quotation.'
  },
  {
    id: 'pkg_corporate_bronze', name: 'Bronze Corporate Retreat', slug: 'bronze-corporate-retreat',
    tagline: 'A tailored team retreat in Victoria Falls', description: 'A corporate group package. Activities, meeting requirements, accommodation and schedule are scoped with the organiser before quotation.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Corporate group planning', 'Schedule tailored to business objectives', 'Quotation prepared for the group'],
    inclusions: ['Requirements discovery and itinerary proposal', 'Only the services explicitly listed in the accepted quotation'],
    exclusions: ['Venue hire, catering, accommodation, transport or activities unless explicitly included in the accepted quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Corporate',
    itineraryNote: 'Day-by-day agenda is prepared after the organiser confirms objectives, dates, group size and requirements.'
  },
  {
    id: 'pkg_corporate_silver', name: 'Silver Corporate Experience', slug: 'silver-corporate-experience',
    tagline: 'A more involved team experience', description: 'A corporate package planned around the team’s objectives, preferred activities and event requirements.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Tailored corporate itinerary', 'Group activity options scoped to requirements', 'Quotation prepared for the group'],
    inclusions: ['Requirements discovery and itinerary proposal', 'Only the services explicitly listed in the accepted quotation'],
    exclusions: ['Venue hire, catering, accommodation, transport or activities unless explicitly included in the accepted quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Corporate',
    itineraryNote: 'Day-by-day agenda is prepared after the organiser confirms objectives, dates, group size and requirements.'
  },
  {
    id: 'pkg_corporate_gold', name: 'Gold Corporate Escape', slug: 'gold-corporate-escape',
    tagline: 'A premium corporate group programme', description: 'A premium corporate itinerary assembled around the organisation’s objectives and approved event brief.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Premium tailored planning', 'Corporate itinerary built around the approved brief', 'Quotation prepared for the group'],
    inclusions: ['Requirements discovery and itinerary proposal', 'Only the services explicitly listed in the accepted quotation'],
    exclusions: ['Venue hire, catering, accommodation, transport or activities unless explicitly included in the accepted quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Corporate',
    itineraryNote: 'Day-by-day agenda is prepared after the organiser confirms objectives, dates, group size and requirements.'
  },
  {
    id: 'pkg_couples_bronze', name: 'Bronze Couples Escape', slug: 'bronze-couples-escape',
    tagline: 'A relaxed getaway for two', description: 'A couples package planned around the preferred travel dates, accommodation style and shared experiences.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Couples-focused trip planning', 'Experience selection based on preferences', 'Quotation prepared for two'],
    inclusions: ['Itinerary proposal for two', 'Only the services explicitly listed in the accepted quotation'],
    exclusions: ['Accommodation, meals, transport and activities unless explicitly included in the accepted quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Couples',
    itineraryNote: 'Day-by-day itinerary and trip length are confirmed in the quotation.'
  },
  {
    id: 'pkg_couples_silver', name: 'Silver Couples Experience', slug: 'silver-couples-experience',
    tagline: 'A more immersive escape for two', description: 'An extended couples itinerary shaped around the experiences the pair wants to prioritise.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Tailored experiences for two', 'Trip schedule shaped around preferences', 'Quotation prepared for two'],
    inclusions: ['Itinerary proposal for two', 'Only the services explicitly listed in the accepted quotation'],
    exclusions: ['Accommodation, meals, transport and activities unless explicitly included in the accepted quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Couples',
    itineraryNote: 'Day-by-day itinerary and trip length are confirmed in the quotation.'
  },
  {
    id: 'pkg_couples_gold', name: 'Gold Couples Retreat', slug: 'gold-couples-retreat',
    tagline: 'A premium private getaway for two', description: 'A premium couples itinerary scoped around preferred accommodation, experiences and travel dates.',
    durationDays: 0, durationNights: 0, pricePerPerson: 'Price available on inquiry', currency: 'USD',
    highlights: ['Premium couples trip planning', 'Experience selection based on preferences', 'Quotation prepared for two'],
    inclusions: ['Itinerary proposal for two', 'Only the services explicitly listed in the accepted quotation'],
    exclusions: ['Accommodation, meals, transport and activities unless explicitly included in the accepted quotation'],
    primaryImageUrl: '/hero.jpg', videoUrl: null, isPublished: true, packageGroup: 'Couples',
    itineraryNote: 'Day-by-day itinerary and trip length are confirmed in the quotation.'
  }
];

router.get('/packages', async (req: Request, res: Response) => {
  try {
    const tombstones = await getTombstones();
    const allPackages = await getCollectionDocs<any>('packages');
    const approvedIds = new Set(FOUNDER_APPROVED_PACKAGES.map((p) => p.id));
    const approvedFirestorePackages = allPackages.filter(
      (p) => approvedIds.has(p.id) && p.isPublished && !tombstones.has(`packages_${p.id}`)
    );
    const firestoreById = new Map(approvedFirestorePackages.map((p) => [p.id, p]));
    // Exactly the 12 founder-approved packages are exposed. Existing approved Firestore
    // records win; missing approved entries use read-only defaults. Unapproved/generated
    // packages are not exposed, and this endpoint never writes or deletes Firestore data.
    res.json(FOUNDER_APPROVED_PACKAGES.map((fallback) => firestoreById.get(fallback.id) || fallback));
  } catch (error) {
    console.error('Error fetching packages from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_PACKAGES' });
  }
});

export default router;
