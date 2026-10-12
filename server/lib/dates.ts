/**
 * Timezone-safe date validation and calculation utilities for Syntuc Explorer.
 * Avoids any local timezone conversions that could shift calendar dates by one day.
 */

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Validates that a string is a well-formed ISO calendar date: YYYY-MM-DD.
 */
export function isValidDateString(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 2024 || year > 2035) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Validate days in month (handling leap years)
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Parses a YYYY-MM-DD date string into UTC components safely.
 */
export function parseDate(dateStr: string): ParsedDate | null {
  if (!isValidDateString(dateStr)) return null;
  const parts = dateStr.trim().split('-').map(Number);
  return {
    year: parts[0],
    month: parts[1],
    day: parts[2],
  };
}

/**
 * Formats parsed components back into YYYY-MM-DD.
 */
export function formatDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Calculates exact night count between check-in and check-out dates.
 * Check-in on 10 Oct and check-out on 12 Oct equals 2 nights.
 * Throws an error if check-out is not strictly after check-in.
 */
export function calculateNights(checkInStr: string, checkOutStr: string): number {
  const checkIn = parseDate(checkInStr);
  const checkOut = parseDate(checkOutStr);

  if (!checkIn) {
    throw new Error(`Invalid check-in date format: "${checkInStr}". Expected YYYY-MM-DD.`);
  }
  if (!checkOut) {
    throw new Error(`Invalid check-out date format: "${checkOutStr}". Expected YYYY-MM-DD.`);
  }

  // Use UTC timestamps to avoid any Daylight Saving Time or local timezone shifts
  const utcIn = Date.UTC(checkIn.year, checkIn.month - 1, checkIn.day);
  const utcOut = Date.UTC(checkOut.year, checkOut.month - 1, checkOut.day);

  const diffMs = utcOut - utcIn;
  if (diffMs <= 0) {
    throw new Error(`Check-out date (${checkOutStr}) must be strictly after check-in date (${checkInStr}).`);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.round(diffMs / msPerDay);
  return nights;
}

/**
 * Returns an array of calendar dates for each individual night stayed.
 * E.g. check-in "2026-10-10" and check-out "2026-10-12" returns ["2026-10-10", "2026-10-11"].
 */
export function getStayNightDates(checkInStr: string, checkOutStr: string): string[] {
  const nights = calculateNights(checkInStr, checkOutStr);
  const checkIn = parseDate(checkInStr)!;
  const dates: string[] = [];

  let currentUtc = Date.UTC(checkIn.year, checkIn.month - 1, checkIn.day);
  const msPerDay = 1000 * 60 * 60 * 24;

  for (let i = 0; i < nights; i++) {
    const d = new Date(currentUtc);
    dates.push(formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    currentUtc += msPerDay;
  }

  return dates;
}

/**
 * Determines the lodge safari season for a given calendar date:
 * - Green season: Jan 11 – Mar 31, and Dec 1 – Dec 20
 * - Mid season: Apr 1 – Jun 30, and Nov 1 – Nov 30
 * - High season: Jul 1 – Oct 31, and Dec 21 – Jan 10
 */
export function getSafariSeasonForDate(dateStr: string): 'green' | 'mid' | 'high' {
  const parsed = parseDate(dateStr);
  if (!parsed) return 'high'; // Conservative fallback

  const { month, day } = parsed;

  // Jan: Jan 1-10 is High, Jan 11-31 is Green
  if (month === 1) {
    return day <= 10 ? 'high' : 'green';
  }
  // Feb, Mar: Green
  if (month === 2 || month === 3) {
    return 'green';
  }
  // Apr, May, Jun: Mid
  if (month >= 4 && month <= 6) {
    return 'mid';
  }
  // Jul, Aug, Sep, Oct: High
  if (month >= 7 && month <= 10) {
    return 'high';
  }
  // Nov: Mid
  if (month === 11) {
    return 'mid';
  }
  // Dec: Dec 1-20 is Green, Dec 21-31 is High
  if (month === 12) {
    return day <= 20 ? 'green' : 'high';
  }

  return 'high';
}

/**
 * Determines indicative white-water rafting river season:
 * - High water: Jan 1 – Jul 15
 * - Low water: Jul 16 – Dec 31
 */
export function getRaftingWaterSeason(dateStr: string): 'high_water' | 'low_water' {
  const parsed = parseDate(dateStr);
  if (!parsed) return 'low_water';

  const { month, day } = parsed;
  if (month >= 1 && month <= 6) return 'high_water';
  if (month === 7) return day <= 15 ? 'high_water' : 'low_water';
  return 'low_water';
}
