/**
 * Fill Series — Pattern Detection and Generation
 *
 * Detects patterns in 3+ contiguous cells and generates extended series values.
 * Supports: arithmetic, geometric, date, and common text patterns (days, months, etc.)
 */

import type { Cell } from '../types';

/** Types of patterns that can be detected. */
export type PatternType = 'arithmetic' | 'geometric' | 'date' | 'dayOfWeek' | 'monthOfYear' | 'textSequence' | 'unknown';

/** Detected pattern information. */
export interface PatternInfo {
  type: PatternType;
  /** The step value for arithmetic series (e.g., 1 for 1,2,3). */
  step?: number;
  /** The ratio for geometric series (e.g., 2 for 1,2,4). */
  ratio?: number;
  /** The date interval in milliseconds. */
  dateInterval?: number;
  /** The text sequence (for day/month patterns). */
  textSequence?: string[];
  /** The index mapping for text sequences. */
  textIndices?: number[];
  /** The original values for reference. */
  originalValues: Array<string | number>;
}

/** Days of the week (full and abbreviated). */
const DAYS_OF_WEEK = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
];

/** Months of the year (full and abbreviated). */
const MONTHS_OF_YEAR = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/** Quarter patterns. */
const QUARTER_PATTERNS = ['q1', 'q2', 'q3', 'q4'];

/**
 * Attempts to parse a string as a number.
 * Handles integers, decimals, and negative numbers.
 */
function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/**
 * Attempts to parse a string as a date.
 * Returns the timestamp in ms, or null if not a valid date.
 */
function parseDate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Checks if a value matches a day of the week pattern.
 * Returns the canonical index (0-6) if matched, or -1.
 */
function matchDayOfWeek(value: string): number {
  const lower = value.trim().toLowerCase();
  const idx = DAYS_OF_WEEK.indexOf(lower);
  if (idx === -1) return -1;
  // Map abbreviated to full index (sun=0, mon=1, etc.)
  return idx % 7;
}

/**
 * Checks if a value matches a month of the year pattern.
 * Returns the canonical index (0-11) if matched, or -1.
 */
function matchMonthOfYear(value: string): number {
  const lower = value.trim().toLowerCase();
  const idx = MONTHS_OF_YEAR.indexOf(lower);
  if (idx === -1) return -1;
  // Map abbreviated to full index
  return idx % 12;
}

/**
 * Checks if a value matches a quarter pattern.
 * Returns the quarter index (0-3) if matched, or -1.
 */
function matchQuarter(value: string): number {
  const lower = value.trim().toLowerCase();
  const idx = QUARTER_PATTERNS.indexOf(lower);
  return idx;
}

/**
 * Detects a pattern in an array of cells.
 * Requires at least 3 cells to establish a pattern.
 *
 * @param cells - Array of cells in order (left-to-right or top-to-bottom).
 * @returns PatternInfo if a pattern is detected, or unknown if no clear pattern.
 */
export function detectPattern(cells: Cell[]): PatternInfo {
  if (cells.length < 3) {
    return { type: 'unknown', originalValues: cells.map((c) => c.rawValue) };
  }

  const rawValues = cells.map((c) => c.rawValue);

  // ─── Check for arithmetic series ─────────────────────────────────
  const numbers = rawValues.map(parseNumber);
  if (numbers.every((n) => n !== null)) {
    const nums = numbers as number[];
    const diffs: number[] = [];
    for (let i = 1; i < nums.length; i++) {
      diffs.push(nums[i] - nums[i - 1]);
    }
    // Check if all differences are equal (within floating point tolerance)
    const allSame = diffs.every((d) => Math.abs(d - diffs[0]) < 1e-9);
    if (allSame) {
      return {
        type: 'arithmetic',
        step: diffs[0],
        originalValues: nums,
      };
    }
  }

  // ─── Check for geometric series ──────────────────────────────────
  if (numbers.every((n) => n !== null)) {
    const nums = numbers as number[];
    // All must be non-zero for geometric
    if (nums.every((n) => n !== 0)) {
      const ratios: number[] = [];
      for (let i = 1; i < nums.length; i++) {
        ratios.push(nums[i] / nums[i - 1]);
      }
      const allSame = ratios.every((r) => Math.abs(r - ratios[0]) < 1e-9);
      if (allSame) {
        return {
          type: 'geometric',
          ratio: ratios[0],
          originalValues: nums,
        };
      }
    }
  }

  // ─── Check for date series ───────────────────────────────────────
  const dates = rawValues.map(parseDate);
  if (dates.every((d) => d !== null)) {
    const dts = dates as number[];
    const intervals: number[] = [];
    for (let i = 1; i < dts.length; i++) {
      intervals.push(dts[i] - dts[i - 1]);
    }
    const allSame = intervals.every((iv) => Math.abs(iv - intervals[0]) < 1000); // 1s tolerance
    if (allSame && intervals[0] !== 0) {
      return {
        type: 'date',
        dateInterval: intervals[0],
        originalValues: rawValues,
      };
    }
  }

  // ─── Check for day of week pattern ───────────────────────────────
  const dayIndices = rawValues.map(matchDayOfWeek);
  if (dayIndices.every((d) => d !== -1)) {
    // Check if they increment by 1 (wrapping around)
    let isSequence = true;
    for (let i = 1; i < dayIndices.length; i++) {
      const expected = (dayIndices[i - 1] + 1) % 7;
      if (dayIndices[i] !== expected) {
        isSequence = false;
        break;
      }
    }
    if (isSequence) {
      return {
        type: 'dayOfWeek',
        textSequence: DAYS_OF_WEEK.slice(0, 7),
        textIndices: dayIndices,
        originalValues: rawValues,
      };
    }
  }

  // ─── Check for month of year pattern ─────────────────────────────
  const monthIndices = rawValues.map(matchMonthOfYear);
  if (monthIndices.every((m) => m !== -1)) {
    let isSequence = true;
    for (let i = 1; i < monthIndices.length; i++) {
      const expected = (monthIndices[i - 1] + 1) % 12;
      if (monthIndices[i] !== expected) {
        isSequence = false;
        break;
      }
    }
    if (isSequence) {
      return {
        type: 'monthOfYear',
        textSequence: MONTHS_OF_YEAR.slice(0, 12),
        textIndices: monthIndices,
        originalValues: rawValues,
      };
    }
  }

  // ─── Check for quarter pattern ───────────────────────────────────
  const quarterIndices = rawValues.map(matchQuarter);
  if (quarterIndices.every((q) => q !== -1)) {
    let isSequence = true;
    for (let i = 1; i < quarterIndices.length; i++) {
      const expected = (quarterIndices[i - 1] + 1) % 4;
      if (quarterIndices[i] !== expected) {
        isSequence = false;
        break;
      }
    }
    if (isSequence) {
      return {
        type: 'textSequence',
        textSequence: QUARTER_PATTERNS,
        textIndices: quarterIndices,
        originalValues: rawValues,
      };
    }
  }

  return { type: 'unknown', originalValues: rawValues };
}

/**
 * Generates the next `count` values in a detected pattern.
 *
 * @param pattern - The detected pattern info.
 * @param count - Number of values to generate.
 * @returns Array of generated values as strings.
 */
export function generateSeries(pattern: PatternInfo, count: number): string[] {
  if (count <= 0) return [];

  switch (pattern.type) {
    case 'arithmetic': {
      const lastValue = pattern.originalValues[pattern.originalValues.length - 1] as number;
      const step = pattern.step!;
      const result: string[] = [];
      for (let i = 1; i <= count; i++) {
        const val = lastValue + step * i;
        // Format: use integer if possible, otherwise preserve decimals
        result.push(Number.isInteger(val) ? String(val) : val.toString());
      }
      return result;
    }

    case 'geometric': {
      const lastValue = pattern.originalValues[pattern.originalValues.length - 1] as number;
      const ratio = pattern.ratio!;
      const result: string[] = [];
      for (let i = 1; i <= count; i++) {
        const val = lastValue * Math.pow(ratio, i);
        result.push(Number.isInteger(val) ? String(val) : parseFloat(val.toFixed(6)).toString());
      }
      return result;
    }

    case 'date': {
      const lastDate = Date.parse(pattern.originalValues[pattern.originalValues.length - 1] as string);
      const interval = pattern.dateInterval!;
      const result: string[] = [];
      for (let i = 1; i <= count; i++) {
        const newDate = new Date(lastDate + interval * i);
        // Format as YYYY-MM-DD (ISO date)
        result.push(newDate.toISOString().split('T')[0]);
      }
      return result;
    }

    case 'dayOfWeek': {
      const lastIdx = pattern.textIndices![pattern.textIndices!.length - 1];
      const seq = pattern.textSequence!;
      const result: string[] = [];
      for (let i = 1; i <= count; i++) {
        const idx = (lastIdx + i) % seq.length;
        // Capitalize first letter (e.g., "monday" -> "Monday")
        const day = seq[idx];
        result.push(day.charAt(0).toUpperCase() + day.slice(1));
      }
      return result;
    }

    case 'monthOfYear': {
      const lastIdx = pattern.textIndices![pattern.textIndices!.length - 1];
      const seq = pattern.textSequence!;
      const result: string[] = [];
      for (let i = 1; i <= count; i++) {
        const idx = (lastIdx + i) % seq.length;
        // Capitalize first letter (e.g., "january" -> "January")
        const month = seq[idx];
        result.push(month.charAt(0).toUpperCase() + month.slice(1));
      }
      return result;
    }

    case 'textSequence': {
      const lastIdx = pattern.textIndices![pattern.textIndices!.length - 1];
      const seq = pattern.textSequence!;
      const result: string[] = [];
      for (let i = 1; i <= count; i++) {
        const idx = (lastIdx + i) % seq.length;
        result.push(seq[idx]);
      }
      return result;
    }

    default: {
      // Unknown pattern: repeat the last value
      const lastVal = pattern.originalValues[pattern.originalValues.length - 1] ?? '';
      return Array(count).fill(String(lastVal));
    }
  }
}

/**
 * Detects pattern and generates fill values for a target range.
 * This is the main entry point for the fill handle feature.
 *
 * @param sourceCells - The cells being dragged from (must be 3+ in a line).
 * @param fillCount - Number of cells to fill.
 * @returns Array of values to fill, or null if no pattern detected.
 */
export function computeFillSeries(sourceCells: Cell[], fillCount: number): string[] | null {
  const pattern = detectPattern(sourceCells);
  if (pattern.type === 'unknown') {
    return null;
  }
  return generateSeries(pattern, fillCount);
}
