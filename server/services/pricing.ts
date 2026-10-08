import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, inArray } from 'drizzle-orm';

export interface RawReservationItemInput {
  productId: string;
  roomId?: string;
  variantId?: string;
  guestCount?: number;
  nightsCount?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
  // Any client-submitted unitPrice or totalPrice will be explicitly ignored
  unitPrice?: any;
  totalPrice?: any;
}

export interface AuthoritativeItemSnapshot {
  productId: string;
  roomId: string | null;
  variantId: string | null;
  snapshotProductName: string;
  snapshotOperatorName: string;
  snapshotProductType: string;
  snapshotUnitPrice: number;
  snapshotPriceBasis: string;
  snapshotCurrency: string;
  guestCount: number;
  nightsCount: number;
  calculatedSubtotal: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes: string | null;
}

export interface AuthoritativePricingResult {
  items: AuthoritativeItemSnapshot[];
  authoritativeTotal: number;
  currency: string;
  isBridgeIncentiveApplied: boolean;
  accommodationNights: number;
  qualifyingActivitiesCount: number;
  bridgeIncentiveQualified: boolean;
}

// Qualifying priority activity names/keywords for Bridge Tour incentive
const QUALIFYING_ACTIVITY_PATTERNS = [
  'quad', // Quad Biking
  'helicopter', // Helicopter Flight (12m or 25m)
  'flight of angels',
  'elephant', // Elephant Interaction
  'sunset cruise', // Sunset Cruise (Zambezi Explorer or school sunset cruise)
];

function isQualifyingPriorityActivity(name: string, slug: string): boolean {
  const lowerName = (name + ' ' + slug).toLowerCase();
  
  // Explicit non-qualifying rules:
  // 1. Bridge Tour itself does NOT count!
  if (lowerName.includes('bridge')) {
    return false;
  }
  // 2. Standard Boat Cruise does NOT count! (Only Sunset Cruise qualifies)
  if (lowerName.includes('boat cruise') && !lowerName.includes('sunset')) {
    return false;
  }

  return QUALIFYING_ACTIVITY_PATTERNS.some(pat => lowerName.includes(pat));
}

export async function calculateAuthoritativePricing(
  itemsInput: RawReservationItemInput[],
  globalAdults: number = 2,
  globalChildren: number = 0
): Promise<AuthoritativePricingResult> {
  if (!itemsInput || itemsInput.length === 0) {
    return {
      items: [],
      authoritativeTotal: 0,
      currency: 'USD',
      isBridgeIncentiveApplied: false,
      accommodationNights: 0,
      qualifyingActivitiesCount: 0,
      bridgeIncentiveQualified: false,
    };
  }

  // Fetch all products involved
  const productIds = itemsInput.map(i => i.productId);
  const fetchedProducts = await db
    .select()
    .from(schema.products)
    .where(inArray(schema.products.id, productIds));

  const productMap = new Map(fetchedProducts.map(p => [p.id, p]));

  // Fetch operators for snapshot names
  const fetchedOperators = await db.select().from(schema.operators);
  const operatorMap = new Map(fetchedOperators.map(o => [o.id, o.name]));

  // Fetch rooms if applicable
  const roomIds = itemsInput.map(i => i.roomId).filter(Boolean) as string[];
  const fetchedRooms = roomIds.length > 0
    ? await db.select().from(schema.rooms).where(inArray(schema.rooms.id, roomIds))
    : [];
  const roomMap = new Map(fetchedRooms.map(r => [r.id, r]));

  // Fetch variants if applicable
  const variantIds = itemsInput.map(i => i.variantId).filter(Boolean) as string[];
  const fetchedVariants = variantIds.length > 0
    ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.id, variantIds))
    : [];
  const variantMap = new Map(fetchedVariants.map(v => [v.id, v]));

  let totalAccommodationNights = 0;
  let qualifyingActivitiesCount = 0;
  let hasBridgeTourInCart = false;
  let bridgeTourItemIndex = -1;

  const resolvedItems: AuthoritativeItemSnapshot[] = [];

  for (let idx = 0; idx < itemsInput.length; idx++) {
    const raw = itemsInput[idx];
    const product = productMap.get(raw.productId);

    if (!product) {
      throw new Error(`Product not found in catalog: ${raw.productId}`);
    }

    const operatorName = product.operatorId ? operatorMap.get(product.operatorId) || 'Syntuc Partner' : 'Syntuc Partner';
    const guestCount = Math.max(1, raw.guestCount || (globalAdults + globalChildren) || 1);
    const nights = Math.max(1, raw.nightsCount || 1);

    let unitPrice = Number(product.basePrice);
    let priceBasis = product.priceBasis;
    let subtotal = 0;

    if (product.productType === 'accommodation') {
      totalAccommodationNights += nights;
      
      // If specific room selected, use authoritative room rate
      if (raw.roomId && roomMap.has(raw.roomId)) {
        const room = roomMap.get(raw.roomId)!;
        unitPrice = Number(room.pricePerNight);
        priceBasis = 'per_room_night';
      }

      if (priceBasis === 'per_room_night') {
        subtotal = unitPrice * nights;
      } else {
        // per_person accommodation
        subtotal = unitPrice * guestCount * nights;
      }
    } else if (product.productType === 'package') {
      // Curated Holiday Package
      subtotal = unitPrice * guestCount;
      if (product.duration && (product.duration.includes('3 Night') || product.duration.includes('2 Night'))) {
        totalAccommodationNights += 2;
        qualifyingActivitiesCount += 2;
      }
    } else {
      // Activity / Experience
      if (raw.variantId && variantMap.has(raw.variantId)) {
        const variant = variantMap.get(raw.variantId)!;
        unitPrice += Number(variant.priceDelta);
      }

      const lowerName = (product.name + ' ' + product.slug).toLowerCase();
      if (lowerName.includes('bridge')) {
        hasBridgeTourInCart = true;
        bridgeTourItemIndex = idx;
      } else if (isQualifyingPriorityActivity(product.name, product.slug)) {
        qualifyingActivitiesCount += 1;
      }

      if (priceBasis === 'per_group') {
        subtotal = unitPrice;
      } else {
        // per_person
        subtotal = unitPrice * guestCount;
      }
    }

    resolvedItems.push({
      productId: product.id,
      roomId: raw.roomId || null,
      variantId: raw.variantId || null,
      snapshotProductName: product.name,
      snapshotOperatorName: operatorName,
      snapshotProductType: product.productType,
      snapshotUnitPrice: unitPrice,
      snapshotPriceBasis: priceBasis,
      snapshotCurrency: product.currency || 'USD',
      guestCount,
      nightsCount: nights,
      calculatedSubtotal: Math.round(subtotal * 100) / 100,
      scheduledDate: raw.scheduledDate || null,
      scheduledTime: raw.scheduledTime || null,
      notes: raw.notes || null,
    });
  }

  // Bridge Tour Incentive Logic:
  // Condition 1: At least 2 nights of accommodation.
  // AND
  // Condition 2: At least 2 qualifying PAID priority activities.
  const bridgeIncentiveQualified = totalAccommodationNights >= 2 && qualifyingActivitiesCount >= 2;
  let isBridgeIncentiveApplied = false;

  if (bridgeIncentiveQualified && hasBridgeTourInCart && bridgeTourItemIndex >= 0) {
    // Zero out the Bridge Tour subtotal (USD 0 complimentary)
    resolvedItems[bridgeTourItemIndex].calculatedSubtotal = 0;
    resolvedItems[bridgeTourItemIndex].notes = 
      (resolvedItems[bridgeTourItemIndex].notes ? resolvedItems[bridgeTourItemIndex].notes + ' | ' : '') +
      'COMPLIMENTARY Victoria Falls Historic 1905 Bridge Tour Incentive Applied ($0)';
    isBridgeIncentiveApplied = true;
  }

  // Calculate sum of authoritative subtotals
  const authoritativeTotal = Math.round(
    resolvedItems.reduce((acc, item) => acc + item.calculatedSubtotal, 0) * 100
  ) / 100;

  return {
    items: resolvedItems,
    authoritativeTotal,
    currency: 'USD',
    isBridgeIncentiveApplied,
    accommodationNights: totalAccommodationNights,
    qualifyingActivitiesCount,
    bridgeIncentiveQualified,
  };
}
