import { getDocById, getCollectionDocs } from '../lib/firestore.ts';

export interface RawReservationItemInput {
  productId: string;
  roomId?: string;
  variantId?: string;
  guestCount?: number;
  nightsCount?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
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

const QUALIFYING_ACTIVITY_PATTERNS = [
  'quad',
  'helicopter',
  'flight of angels',
  'elephant',
  'sunset cruise',
];

function isQualifyingPriorityActivity(name: string, slug: string): boolean {
  const lowerName = (name + ' ' + (slug || '')).toLowerCase();

  if (lowerName.includes('bridge')) {
    return false;
  }
  if (lowerName.includes('boat cruise') && !lowerName.includes('sunset')) {
    return false;
  }

  return QUALIFYING_ACTIVITY_PATTERNS.some((pat) => lowerName.includes(pat));
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

  // Fetch all products involved directly from Firestore
  const productMap = new Map<string, any>();
  for (const item of itemsInput) {
    if (!productMap.has(item.productId)) {
      const prod = await getDocById<any>('products', item.productId);
      if (prod) {
        productMap.set(item.productId, prod);
      }
    }
  }

  // Fetch operators from Firestore for snapshot names
  const operators = await getCollectionDocs<any>('operators');
  const operatorMap = new Map<string, string>(operators.map((o) => [o.id, o.name]));

  // Fetch rooms if applicable from Firestore
  const roomIds = itemsInput.map((i) => i.roomId).filter(Boolean) as string[];
  const roomMap = new Map<string, any>();
  for (const rId of roomIds) {
    if (!roomMap.has(rId)) {
      const rm = await getDocById<any>('rooms', rId);
      if (rm) roomMap.set(rId, rm);
    }
  }

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

    const operatorName = product.operatorId
      ? operatorMap.get(product.operatorId) || 'Syntuc Partner'
      : 'Syntuc Partner';
    const guestCount = Math.max(1, raw.guestCount || globalAdults + globalChildren || 1);
    const nights = Math.max(1, raw.nightsCount || 1);

    let unitPrice = Number(product.basePrice || 0);
    let priceBasis = product.priceBasis || 'per_person';
    let subtotal = 0;

    if (product.productType === 'accommodation') {
      totalAccommodationNights += nights;

      if (raw.roomId && roomMap.has(raw.roomId)) {
        const room = roomMap.get(raw.roomId)!;
        unitPrice = Number(room.baseRate || room.pricePerNight || unitPrice);
        priceBasis = 'per_room_night';
      }

      if (priceBasis === 'per_room_night') {
        subtotal = unitPrice * nights;
      } else {
        subtotal = unitPrice * guestCount * nights;
      }
    } else if (product.productType === 'package') {
      subtotal = unitPrice * guestCount;
      if (
        product.duration &&
        (product.duration.includes('3 Night') || product.duration.includes('2 Night'))
      ) {
        totalAccommodationNights += 2;
        qualifyingActivitiesCount += 2;
      }
    } else {
      const lowerName = (product.name + ' ' + (product.slug || '')).toLowerCase();
      if (lowerName.includes('bridge')) {
        hasBridgeTourInCart = true;
        bridgeTourItemIndex = idx;
      } else if (isQualifyingPriorityActivity(product.name, product.slug)) {
        qualifyingActivitiesCount += 1;
      }

      if (priceBasis === 'per_group') {
        subtotal = unitPrice;
      } else {
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

  const bridgeIncentiveQualified =
    totalAccommodationNights >= 2 && qualifyingActivitiesCount >= 2;
  let isBridgeIncentiveApplied = false;

  if (bridgeIncentiveQualified && hasBridgeTourInCart && bridgeTourItemIndex >= 0) {
    resolvedItems[bridgeTourItemIndex].calculatedSubtotal = 0;
    resolvedItems[bridgeTourItemIndex].notes =
      (resolvedItems[bridgeTourItemIndex].notes
        ? resolvedItems[bridgeTourItemIndex].notes + ' | '
        : '') +
      'COMPLIMENTARY Victoria Falls Historic 1905 Bridge Tour Incentive Applied ($0)';
    isBridgeIncentiveApplied = true;
  }

  const authoritativeTotal =
    Math.round(
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
