export interface SchoolTripQuoteInput {
  schoolName: string;
  educationLevel: 'primary' | 'secondary';
  studentCount: number;
  teacherCount: number;
  nightsCount: number;
  accommodationTier: 'budget' | 'rainbow_hotel' | 'none';
  selectedActivities: {
    boatCruise?: boolean;
    crocodileFarm?: boolean;
    rainforestTour?: boolean;
    helicopterFlight?: boolean;
    quadBiking?: boolean;
    airportTour?: boolean;
    elephantInteraction?: boolean;
    gameDrive?: boolean;
    sunsetCruiseDrive?: boolean;
    includeBridgeTour?: boolean;
  };
}

export interface SchoolTripLineItem {
  id: string;
  name: string;
  category: 'accommodation' | 'activity' | 'park_fee';
  unitRate: number;
  rateBasis: string;
  quantity: number;
  subtotal: number;
  isComplimentaryIncentive?: boolean;
  notes?: string;
}

export interface SchoolTripQuoteResult {
  schoolName: string;
  educationLevel: 'primary' | 'secondary';
  studentCount: number;
  teacherCount: number;
  nightsCount: number;
  accommodationTier: string;
  lineItems: SchoolTripLineItem[];
  totalEstimate: number;
  perStudentEstimate: number;
  currency: string;
  bridgeIncentiveQualified: boolean;
  bridgeIncentiveApplied: boolean;
  qualifyingActivitiesCount: number;
  qualificationBreakdown: {
    nightsMet: boolean;
    activitiesMet: boolean;
    qualifyingActivitiesList: string[];
  };
}

export function calculateSchoolTripQuote(input: SchoolTripQuoteInput): SchoolTripQuoteResult {
  const {
    schoolName,
    educationLevel,
    studentCount,
    teacherCount,
    nightsCount,
    accommodationTier,
    selectedActivities,
  } = input;

  const lineItems: SchoolTripLineItem[] = [];
  const isPrimary = educationLevel === 'primary';

  // 1. Accommodation
  if (accommodationTier === 'budget') {
    // USD 15 per child per night
    const rate = 15;
    const qty = studentCount * nightsCount;
    const subtotal = rate * qty;
    lineItems.push({
      id: 'acc_budget',
      name: 'Budget Educational Lodge (Khulula / Teak / Reynard / Letsatsi)',
      category: 'accommodation',
      unitRate: rate,
      rateBasis: 'USD 15 / student / night',
      quantity: qty,
      subtotal,
      notes: `Starting commercial tariff for ${studentCount} students across ${nightsCount} nights`,
    });
  } else if (accommodationTier === 'rainbow_hotel') {
    // USD 130 per room shared by two children
    const ratePerRoom = 130;
    const roomsRequired = Math.ceil(studentCount / 2);
    const qty = roomsRequired * nightsCount;
    const subtotal = ratePerRoom * qty;
    lineItems.push({
      id: 'acc_rainbow',
      name: 'Victoria Falls Rainbow Hotel (Educational Shared Tier)',
      category: 'accommodation',
      unitRate: ratePerRoom,
      rateBasis: 'USD 130 / room shared by 2 students / night',
      quantity: qty,
      subtotal,
      notes: `${roomsRequired} rooms allocated for ${studentCount} students across ${nightsCount} nights`,
    });
  }

  // Track qualifying priority activities for Bridge Tour
  const qualifyingActivitiesList: string[] = [];

  // 2. Activities
  // A. Boat cruise: USD 10/child + park fee (primary $1, secondary $4). DOES NOT count toward Bridge Tour!
  if (selectedActivities.boatCruise) {
    const cruiseRate = 10;
    lineItems.push({
      id: 'act_boat_cruise',
      name: 'Standard Zambezi River Boat Cruise',
      category: 'activity',
      unitRate: cruiseRate,
      rateBasis: 'USD 10 / student',
      quantity: studentCount,
      subtotal: cruiseRate * studentCount,
      notes: 'Zambezi educational cruise. Does NOT qualify for Bridge Tour incentive.',
    });

    // Park fee
    const parkFeeRate = isPrimary ? 1 : 4;
    lineItems.push({
      id: 'fee_boat_cruise_park',
      name: `Zambezi River Park Fee (${isPrimary ? 'Primary USD 1' : 'Secondary USD 4'})`,
      category: 'park_fee',
      unitRate: parkFeeRate,
      rateBasis: `USD ${parkFeeRate} / student`,
      quantity: studentCount,
      subtotal: parkFeeRate * studentCount,
    });
  }

  // B. Crocodile Farm: Primary USD 3, Secondary USD 4
  if (selectedActivities.crocodileFarm) {
    const rate = isPrimary ? 3 : 4;
    lineItems.push({
      id: 'act_croc_farm',
      name: `Crocodile Farm Educational Visit (${isPrimary ? 'Primary' : 'Secondary'})`,
      category: 'activity',
      unitRate: rate,
      rateBasis: `USD ${rate} / student`,
      quantity: studentCount,
      subtotal: rate * studentCount,
    });
  }

  // C. Rainforest Tour:
  // Primary USD 1, Secondary USD 4, Adult/Teacher USD 7.
  // Teacher rule: 1 teacher per 20 students gets half-price exemption at USD 4. Applies ONLY to Rainforest Tour!
  if (selectedActivities.rainforestTour) {
    const studentRate = isPrimary ? 1 : 4;
    lineItems.push({
      id: 'act_rainforest_students',
      name: `Victoria Falls Rainforest Guided Walking Tour (${isPrimary ? 'Primary' : 'Secondary'})`,
      category: 'activity',
      unitRate: studentRate,
      rateBasis: `USD ${studentRate} / student`,
      quantity: studentCount,
      subtotal: studentRate * studentCount,
    });

    if (teacherCount > 0) {
      // 1 exempt teacher per 20 students
      const eligibleExemptCount = Math.min(teacherCount, Math.floor(studentCount / 20));
      const regularTeacherCount = teacherCount - eligibleExemptCount;

      if (eligibleExemptCount > 0) {
        lineItems.push({
          id: 'act_rainforest_teachers_exempt',
          name: 'Rainforest Tour Teacher Exemption (1 per 20 students)',
          category: 'activity',
          unitRate: 4,
          rateBasis: 'USD 4 / exempt teacher',
          quantity: eligibleExemptCount,
          subtotal: 4 * eligibleExemptCount,
          notes: 'Special 50% discount rule applied for qualifying teacher chaperones',
        });
      }

      if (regularTeacherCount > 0) {
        lineItems.push({
          id: 'act_rainforest_teachers_std',
          name: 'Rainforest Tour Teacher Entry (Standard)',
          category: 'activity',
          unitRate: 7,
          rateBasis: 'USD 7 / teacher',
          quantity: regularTeacherCount,
          subtotal: 7 * regularTeacherCount,
        });
      }
    }
  }

  // D. Quad Biking: USD 10/child (PRIORITY QUALIFYING ACTIVITY)
  if (selectedActivities.quadBiking) {
    lineItems.push({
      id: 'act_quad_biking',
      name: 'Supervised Educational Quad Biking',
      category: 'activity',
      unitRate: 10,
      rateBasis: 'USD 10 / student',
      quantity: studentCount,
      subtotal: 10 * studentCount,
      notes: 'Priority qualifying activity for Bridge Tour incentive',
    });
    qualifyingActivitiesList.push('Supervised Quad Biking');
  }

  // E. School Helicopter Flight: USD 70/child (PRIORITY QUALIFYING ACTIVITY)
  if (selectedActivities.helicopterFlight) {
    lineItems.push({
      id: 'act_helicopter',
      name: 'School Educational Helicopter Flight',
      category: 'activity',
      unitRate: 70,
      rateBasis: 'USD 70 / person',
      quantity: studentCount,
      subtotal: 70 * studentCount,
      notes: 'Special school tariff. Priority qualifying activity for Bridge Tour incentive.',
    });
    qualifyingActivitiesList.push('Helicopter Flight');
  }

  // F. Elephant Interaction: Primary USD 10, Secondary USD 20 (PRIORITY QUALIFYING ACTIVITY)
  if (selectedActivities.elephantInteraction) {
    const rate = isPrimary ? 10 : 20;
    lineItems.push({
      id: 'act_elephant',
      name: `Elephant Interaction Sanctuary (${isPrimary ? 'Primary' : 'Secondary'})`,
      category: 'activity',
      unitRate: rate,
      rateBasis: `USD ${rate} / student`,
      quantity: studentCount,
      subtotal: rate * studentCount,
      notes: 'Priority qualifying activity for Bridge Tour incentive',
    });
    qualifyingActivitiesList.push('Elephant Interaction');
  }

  // G. Standalone Game Drive: USD 15/child (PRIORITY QUALIFYING ACTIVITY)
  if (selectedActivities.gameDrive) {
    lineItems.push({
      id: 'act_game_drive',
      name: 'Zambezi National Park Safari Game Drive',
      category: 'activity',
      unitRate: 15,
      rateBasis: 'USD 15 / student',
      quantity: studentCount,
      subtotal: 15 * studentCount,
      notes: 'Priority qualifying activity for Bridge Tour incentive. Open 4x4 guided wildlife safari.',
    });
    qualifyingActivitiesList.push('Safari Game Drive');
  }

  // Legacy/Historical Package: Sunset Cruise and Game Drive (Explicitly Non-Qualifying per Rule 11)
  if (selectedActivities.sunsetCruiseDrive) {
    lineItems.push({
      id: 'act_sunset_cruise_drive',
      name: 'Sunset Cruise and Game Drive (Historical Package — Deactivated)',
      category: 'activity',
      unitRate: 25,
      rateBasis: 'USD 25 / student',
      quantity: studentCount,
      subtotal: 25 * studentCount,
      notes: 'Historical package. Explicitly NON-QUALIFYING for Bridge Tour incentive.',
    });
    // Rule 11: "The inactive Sunset Cruise + Game Drive package is: NON-QUALIFYING"
  }

  // H. Airport Educational Tour: USD 3/child
  if (selectedActivities.airportTour) {
    lineItems.push({
      id: 'act_airport_tour',
      name: 'Airport Educational Aviation Tour',
      category: 'activity',
      unitRate: 3,
      rateBasis: 'USD 3 / student',
      quantity: studentCount,
      subtotal: 3 * studentCount,
    });
  }

  // Bridge Tour Incentive Qualification Check:
  // Condition 1: At least 2 nights of accommodation.
  // AND
  // Condition 2: At least 2 qualifying PAID priority activities (Quad Biking, Helicopter Flight, Elephant Interaction, Sunset Cruise).
  const nightsMet = nightsCount >= 2 && accommodationTier !== 'none';
  const activitiesMet = qualifyingActivitiesList.length >= 2;
  const bridgeIncentiveQualified = nightsMet && activitiesMet;
  let bridgeIncentiveApplied = false;

  // I. Bridge Tour:
  if (selectedActivities.includeBridgeTour) {
    if (bridgeIncentiveQualified) {
      // Free USD 0!
      bridgeIncentiveApplied = true;
      lineItems.push({
        id: 'act_bridge_tour_free',
        name: 'Victoria Falls Historic 1905 Bridge Tour',
        category: 'activity',
        unitRate: 0,
        rateBasis: 'COMPLIMENTARY ($0)',
        quantity: studentCount,
        subtotal: 0,
        isComplimentaryIncentive: true,
        notes: 'Complimentary incentive reward applied! (Qualified via >= 2 nights accommodation + 2 qualifying priority activities)',
      });
    } else {
      // Standard school rate USD 20/child
      lineItems.push({
        id: 'act_bridge_tour_std',
        name: 'Victoria Falls Historic 1905 Bridge Tour (Standard Tariff)',
        category: 'activity',
        unitRate: 20,
        rateBasis: 'USD 20 / student',
        quantity: studentCount,
        subtotal: 20 * studentCount,
        notes: 'Standard educational tariff. Note: requires 2 nights + 2 priority activities for $0 waiver.',
      });
    }
  }

  const totalEstimate = Math.round(
    lineItems.reduce((acc, item) => acc + item.subtotal, 0) * 100
  ) / 100;

  const perStudentEstimate = studentCount > 0 ? Math.round((totalEstimate / studentCount) * 100) / 100 : 0;

  return {
    schoolName: schoolName || 'Educational Delegation',
    educationLevel,
    studentCount,
    teacherCount,
    nightsCount,
    accommodationTier,
    lineItems,
    totalEstimate,
    perStudentEstimate,
    currency: 'USD',
    bridgeIncentiveQualified,
    bridgeIncentiveApplied,
    qualifyingActivitiesCount: qualifyingActivitiesList.length,
    qualificationBreakdown: {
      nightsMet,
      activitiesMet,
      qualifyingActivitiesList,
    },
  };
}
