import { getDocById, getCollectionDocs } from '../lib/firestore.ts';
import { PURE_AFRICA_FALLBACK_PRODUCTS } from '../routes/catalog.ts';
import {
  calculateNights,
  isValidDateString,
  getStayNightDates,
  getSafariSeasonForDate,
  getRaftingWaterSeason,
} from '../lib/dates.ts';
import {
  resolveAuthoritativeVariant,
  getAuthoritativeVariantsForProduct,
  AuthoritativeVariant,
  CompulsoryFee,
} from './variantCatalog.ts';

export interface RawReservationItemInput {
  productId: string;
  roomId?: string;
  variantId?: string;
  guestCount?: number;
  adultsCount?: number;
  childrenCount?: number;
  nightsCount?: number;
  scheduledDate?: string; // Activity date OR check-in date
  checkOutDate?: string;  // Accommodation check-out date
  scheduledTime?: string;
  notes?: string;
  unitPrice?: any;
  totalPrice?: any;
}

export interface ItemFeeBreakdown {
  name: string;
  amount: number;
  currency: string;
  basis: string;
  total: number;
}

export interface AuthoritativeItemSnapshot {
  productId: string;
  roomId: string | null;
  variantId: string | null;
  variantName: string | null;
  roomName: string | null;
  snapshotProductName: string;
  snapshotOperatorName: string;
  snapshotProductType: string;
  snapshotUnitPrice: number;
  snapshotPriceBasis: string;
  snapshotCurrency: string;
  guestCount: number;
  nightsCount: number;
  calculatedSubtotal: number;
  scheduledDate: string | null; // Activity date or check-in date
  checkOutDate: string | null;  // Check-out date for accommodation
  scheduledTime: string | null;
  feeBreakdown: ItemFeeBreakdown[];
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

export interface PricingOptions {
  requireDates?: boolean;
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
  globalChildren: number = 0,
  options?: PricingOptions
): Promise<AuthoritativePricingResult> {
  const requireDates = Boolean(options?.requireDates);

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

  // 1. Fetch all products involved from Firestore
  const productMap = new Map<string, any>();
  for (const item of itemsInput) {
    if (!productMap.has(item.productId)) {
      const prod = await getDocById<any>('products', item.productId) || PURE_AFRICA_FALLBACK_PRODUCTS.find((p) => p.id === item.productId);
      if (prod) {
        productMap.set(item.productId, prod);
      }
    }
  }

  // 2. Fetch operators from Firestore for snapshot names
  const operators = await getCollectionDocs<any>('operators');
  const operatorMap = new Map<string, string>(operators.map((o) => [o.id, o.name]));

  // 3. Fetch rooms if applicable from Firestore
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

  const resolvedItems: AuthoritativeItemSnapshot[] = [];

  for (let idx = 0; idx < itemsInput.length; idx++) {
    const raw = itemsInput[idx];
    const product = productMap.get(raw.productId);

    if (!product) {
      throw new Error(`Product not found in catalog: ${raw.productId}`);
    }

    const operatorName = product.operatorName || (product.operatorId
      ? operatorMap.get(product.operatorId) || 'Syntuc Partner'
      : 'Syntuc Partner');

    const guestCount = Math.max(1, raw.guestCount || globalAdults + globalChildren || 1);

    // Validate room relationship if room specified
    let selectedRoom: any = null;
    if (raw.roomId) {
      selectedRoom = roomMap.get(raw.roomId);
      if (!selectedRoom) {
        throw new Error(`Room option not found: ${raw.roomId}`);
      }
      if (
        selectedRoom.productId !== product.id &&
        selectedRoom.propertyId !== product.propertyId
      ) {
        throw new Error(
          `Security violation: Room ${raw.roomId} does not belong to product ${product.id}.`
        );
      }
    }

    // Resolve authoritative variant
    let selectedVariant: AuthoritativeVariant | null = null;
    if (raw.variantId) {
      selectedVariant = await resolveAuthoritativeVariant(product.id, raw.variantId);
      if (!selectedVariant) {
        throw new Error(`Variant not found or inactive: ${raw.variantId} for ${product.name}`);
      }
    } else {
      // If product has variants but none specified, check for sensible default or auto-selection
      const productVariants = await getAuthoritativeVariantsForProduct(product.id);
      if (productVariants.length > 0) {
        if (product.id === 'prod_white_water_rafting') {
          // Auto-select based on scheduledDate if provided
          const season = raw.scheduledDate ? getRaftingWaterSeason(raw.scheduledDate) : 'high_water';
          selectedVariant = productVariants.find((v) => v.season === season) || productVariants[0];
        } else if (product.id === 'prod_explorers') {
          // If room selected corresponds to chalet or deluxe
          if (raw.roomId === 'rm_explorers_deluxe') {
            selectedVariant = productVariants.find((v) => v.id === 'var_explorers_deluxe_sharing') || productVariants[0];
          } else {
            selectedVariant = productVariants.find((v) => v.id === 'var_explorers_std_sharing') || productVariants[0];
          }
        } else if (product.id === 'prod_olddrift' || product.id === 'prod_elephantcamp') {
          // Default to high season sharing or first available
          selectedVariant = productVariants.find((v) => v.season === 'high' && v.occupancyType === 'sharing') || productVariants[0];
        } else if (product.id === 'prod_zambezi_explorer_cruise') {
          selectedVariant = productVariants.find((v) => v.id === 'var_cruise_luxury_deck') || productVariants[0];
        } else if (product.id === 'prod_simunye_theatre') {
          selectedVariant = productVariants.find((v) => v.id === 'var_simunye_adult') || productVariants[0];
        } else if (product.id.startsWith('prod_pure_africa_')) {
          // Pure Africa products use catalogue variants for vessel/deck/dining selection
          // and mandatory fee calculation. If no variant was supplied, use the first
          // published option as a safe default; guests can explicitly select another.
          selectedVariant = productVariants[0];
        }
      }
    }

    const feeBreakdown: ItemFeeBreakdown[] = [];

    // --- ACCOMMODATION PRICING & DATES ---
    if (product.productType === 'accommodation') {
      const checkInDate = raw.scheduledDate?.trim();
      const checkOutDate = raw.checkOutDate?.trim();

      let nights = Math.max(1, raw.nightsCount || 1);

      if (requireDates) {
        if (!checkInDate || !isValidDateString(checkInDate)) {
          throw new Error(`Check-in date (YYYY-MM-DD) is required for ${product.name}.`);
        }
        if (!checkOutDate || !isValidDateString(checkOutDate)) {
          throw new Error(`Check-out date (YYYY-MM-DD) is required for ${product.name}.`);
        }
        nights = calculateNights(checkInDate, checkOutDate);
      } else if (checkInDate && checkOutDate && isValidDateString(checkInDate) && isValidDateString(checkOutDate)) {
        try {
          nights = calculateNights(checkInDate, checkOutDate);
        } catch (_) {
          nights = Math.max(1, raw.nightsCount || 1);
        }
      }

      totalAccommodationNights += nights;

      // Determine price basis
      let priceBasis = selectedVariant?.priceBasis || product.priceBasis || 'per_room_night';
      let unitPrice = selectedVariant ? selectedVariant.price : Number(product.basePrice || 0);

      if (!selectedVariant && selectedRoom) {
        unitPrice = Number(selectedRoom.pricePerNight || selectedRoom.baseRate || unitPrice);
        priceBasis = 'per_room_night';
      }

      // Check if this accommodation has seasonal nightly rates across calendar dates
      const hasSeasonalCalendar =
        (product.id === 'prod_olddrift' || product.id === 'prod_elephantcamp') &&
        checkInDate &&
        checkOutDate &&
        isValidDateString(checkInDate) &&
        isValidDateString(checkOutDate);

      let subtotal = 0;

      if (hasSeasonalCalendar) {
        // Multi-night seasonal calculation for each night stayed
        const nightDates = getStayNightDates(checkInDate, checkOutDate);
        const occupancy = selectedVariant?.occupancyType || (priceBasis === 'per_single_room_night' ? 'single' : 'sharing');

        let stayBaseSum = 0;
        for (const nDate of nightDates) {
          const season = getSafariSeasonForDate(nDate);

          let nightRate = 1087; // fallback
          if (product.id === 'prod_olddrift') {
            if (season === 'green') nightRate = 835;
            else if (season === 'mid') nightRate = 1042;
            else nightRate = 1087;
          } else if (product.id === 'prod_elephantcamp') {
            if (occupancy === 'single') {
              if (season === 'green') nightRate = 835;
              else if (season === 'mid') nightRate = 1564;
              else nightRate = 1632;
            } else {
              if (season === 'green') nightRate = 835;
              else if (season === 'mid') nightRate = 1042;
              else nightRate = 1087;
            }
          }

          if (occupancy === 'single') {
            stayBaseSum += nightRate; // Per room night
          } else {
            stayBaseSum += nightRate * guestCount; // Per person sharing per night
          }
        }

        subtotal = stayBaseSum;
        unitPrice = Math.round((stayBaseSum / (occupancy === 'single' ? nights : guestCount * nights)) * 100) / 100;

        // Apply $50 conservation levy per person per night
        const levyRate = 50;
        const levyMultiplier = occupancy === 'single' ? 1 : guestCount;
        const levyTotal = levyRate * levyMultiplier * nights;
        subtotal += levyTotal;

        feeBreakdown.push({
          name: 'Conservation & Community Levy',
          amount: levyRate,
          currency: 'USD',
          basis: 'per_person_per_night',
          total: levyTotal,
        });
      } else {
        // Standard room calculation
        if (priceBasis === 'per_single_room_night' || priceBasis === 'per_room_night') {
          // Charged per room per night (NOT multiplied by guests)
          subtotal = unitPrice * nights;
        } else {
          // Charged per person sharing per night
          subtotal = unitPrice * guestCount * nights;
        }

        // Apply any compulsory fees
        if (selectedVariant?.compulsoryFees && selectedVariant.compulsoryFees.length > 0) {
          for (const fee of selectedVariant.compulsoryFees) {
            let feeTotal = 0;
            if (fee.basis === 'per_person_per_night') {
              const count = priceBasis === 'per_single_room_night' ? 1 : guestCount;
              feeTotal = fee.amount * count * nights;
            } else if (fee.basis === 'per_room_night') {
              feeTotal = fee.amount * nights;
            } else {
              feeTotal = fee.amount * guestCount;
            }
            subtotal += feeTotal;
            feeBreakdown.push({
              name: fee.name,
              amount: fee.amount,
              currency: fee.currency,
              basis: fee.basis,
              total: feeTotal,
            });
          }
        }
      }

      resolvedItems.push({
        productId: product.id,
        roomId: raw.roomId || null,
        variantId: selectedVariant?.id || null,
        variantName: selectedVariant?.name || null,
        roomName: selectedRoom?.name || null,
        snapshotProductName: product.name,
        snapshotOperatorName: operatorName,
        snapshotProductType: product.productType,
        snapshotUnitPrice: unitPrice,
        snapshotPriceBasis: priceBasis,
        snapshotCurrency: selectedVariant?.currency || product.currency || 'USD',
        guestCount,
        nightsCount: nights,
        calculatedSubtotal: Math.round(subtotal * 100) / 100,
        scheduledDate: checkInDate || null,
        checkOutDate: checkOutDate || null,
        scheduledTime: raw.scheduledTime || null,
        feeBreakdown,
        notes: raw.notes || null,
      });

    // --- PACKAGE PRICING ---
    } else if (product.productType === 'package') {
      const scheduledDate = raw.scheduledDate?.trim();
      if (requireDates && (!scheduledDate || !isValidDateString(scheduledDate))) {
        throw new Error(`Start date (YYYY-MM-DD) is required for package ${product.name}.`);
      }

      const unitPrice = Number(product.basePrice || 0);
      const subtotal = unitPrice * guestCount;

      if (
        product.duration &&
        (product.duration.includes('3 Night') || product.duration.includes('2 Night'))
      ) {
        totalAccommodationNights += 2;
        qualifyingActivitiesCount += 2;
      }

      resolvedItems.push({
        productId: product.id,
        roomId: null,
        variantId: null,
        variantName: null,
        roomName: null,
        snapshotProductName: product.name,
        snapshotOperatorName: operatorName,
        snapshotProductType: product.productType,
        snapshotUnitPrice: unitPrice,
        snapshotPriceBasis: product.priceBasis || 'per_person',
        snapshotCurrency: product.currency || 'USD',
        guestCount,
        nightsCount: 1,
        calculatedSubtotal: Math.round(subtotal * 100) / 100,
        scheduledDate: scheduledDate || null,
        checkOutDate: raw.checkOutDate || null,
        scheduledTime: raw.scheduledTime || null,
        feeBreakdown,
        notes: raw.notes || null,
      });

    // --- ACTIVITY & TOUR PRICING ---
    } else {
      const scheduledDate = raw.scheduledDate?.trim();

      if (requireDates) {
        if (!scheduledDate || !isValidDateString(scheduledDate)) {
          throw new Error(`A specific activity date (YYYY-MM-DD) is required for ${product.name}.`);
        }
      }

      // Check for incentive qualification (excluding bridge tour and non-sunset boat cruise)
      if (isQualifyingPriorityActivity(product.name, product.slug)) {
        qualifyingActivitiesCount += 1;
      }

      let unitPrice = selectedVariant ? selectedVariant.price : Number(product.basePrice || 0);
      const priceBasis = selectedVariant?.priceBasis || product.priceBasis || 'per_person';

      let subtotal = 0;
      if (priceBasis === 'per_group') {
        subtotal = unitPrice;
      } else {
        subtotal = unitPrice * guestCount;
      }

      // Apply compulsory fees (e.g. $12 National Parks fee for rafting & sunset cruise)
      if (selectedVariant?.compulsoryFees && selectedVariant.compulsoryFees.length > 0) {
        for (const fee of selectedVariant.compulsoryFees) {
          const feeTotal = fee.amount * guestCount;
          subtotal += feeTotal;
          feeBreakdown.push({
            name: fee.name,
            amount: fee.amount,
            currency: fee.currency,
            basis: fee.basis,
            total: feeTotal,
          });
        }
      }

      resolvedItems.push({
        productId: product.id,
        roomId: null,
        variantId: selectedVariant?.id || null,
        variantName: selectedVariant?.name || null,
        roomName: null,
        snapshotProductName: product.name,
        snapshotOperatorName: operatorName,
        snapshotProductType: product.productType,
        snapshotUnitPrice: unitPrice,
        snapshotPriceBasis: priceBasis,
        snapshotCurrency: selectedVariant?.currency || product.currency || 'USD',
        guestCount,
        nightsCount: 1,
        calculatedSubtotal: Math.round(subtotal * 100) / 100,
        scheduledDate: scheduledDate || null,
        checkOutDate: null,
        scheduledTime: raw.scheduledTime || null,
        feeBreakdown,
        notes: raw.notes || null,
      });
    }
  }

  // 1905 Bridge Tour Incentive Eligibility
  // Qualification requirement: >= 2 accommodation nights AND >= 2 qualifying priority activities
  const bridgeIncentiveQualified =
    totalAccommodationNights >= 2 && qualifyingActivitiesCount >= 2;

  // CRITICAL DEFECT FIX (Section 4H):
  // The commercial Historic Bridge Adventures tour (US$64) is a third-party product and
  // MUST NOT be set to $0. The incentive grants complimentary school guiding in educational trips,
  // not zeroing out the commercial third-party adventure tour.
  const isBridgeIncentiveApplied = false;

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
