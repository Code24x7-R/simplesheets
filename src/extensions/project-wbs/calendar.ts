// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Working Calendar Utilities
 *
 * Handles working day calculations, skipping weekends and holidays.
 * All date strings are ISO format (YYYY-MM-DD).
 */

import type { WorkingCalendar } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a default Mon-Fri working calendar with 8h days and no holidays.
 */
export function createDefaultCalendar(): WorkingCalendar {
  return {
    workingDays: new Set([1, 2, 3, 4, 5]), // Mon-Fri
    holidays: new Set(),
    hoursPerDay: 8,
  };
}

/**
 * Create a custom calendar.
 * @param workingDays - Set of day-of-week values (0=Sun ... 6=Sat).
 * @param holidays - Set of ISO date strings to treat as non-working.
 * @param hoursPerDay - Working hours per day.
 */
export function createCalendar(
  workingDays: Set<number>,
  holidays: Set<string> = new Set(),
  hoursPerDay: number = 8,
): WorkingCalendar {
  return { workingDays, holidays, hoursPerDay };
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Check if a date string is a working day.
 * @param dateStr - ISO date string (YYYY-MM-DD).
 * @param calendar - Working calendar.
 */
export function isWorkingDay(dateStr: string, calendar: WorkingCalendar): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  if (!calendar.workingDays.has(dayOfWeek)) return false;
  if (calendar.holidays.has(dateStr)) return false;
  return true;
}

/**
 * Check if a date string is a weekend.
 * @param dateStr - ISO date string.
 */
export function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Get the day of week (0=Sun ... 6=Sat) for a date string.
 * @param dateStr - ISO date string.
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

// ─── Navigation ─────────────────────────────────────────────────────────────

/**
 * Get the next working day on or after the given date.
 * @param dateStr - ISO date string.
 * @param calendar - Working calendar.
 * @returns ISO date string of the next working day.
 */
export function nextWorkingDay(dateStr: string, calendar: WorkingCalendar): string {
  let current = new Date(dateStr + 'T00:00:00');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dayOfWeek = current.getDay();
    const iso = toISO(current);
    if (calendar.workingDays.has(dayOfWeek) && !calendar.holidays.has(iso)) {
      return iso;
    }
    current = new Date(current.getTime() + MS_PER_DAY);
  }
}

/**
 * Get the previous working day on or before the given date.
 * @param dateStr - ISO date string.
 * @param calendar - Working calendar.
 * @returns ISO date string of the previous working day.
 */
export function previousWorkingDay(dateStr: string, calendar: WorkingCalendar): string {
  let current = new Date(dateStr + 'T00:00:00');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dayOfWeek = current.getDay();
    const iso = toISO(current);
    if (calendar.workingDays.has(dayOfWeek) && !calendar.holidays.has(iso)) {
      return iso;
    }
    current = new Date(current.getTime() - MS_PER_DAY);
  }
}

/**
 * Snap a date to the nearest working day.
 * If the date falls on a weekend or holiday, advances to the next working day.
 * @param dateStr - ISO date string.
 * @param calendar - Working calendar.
 * @returns ISO date string snapped to a working day.
 */
export function snapToWorkingDay(dateStr: string, calendar: WorkingCalendar): string {
  return nextWorkingDay(dateStr, calendar);
}

// ─── Arithmetic ─────────────────────────────────────────────────────────────

/**
 * Add working days to a start date, skipping weekends and holidays.
 * @param startDate - ISO date string.
 * @param days - Number of working days to add (can be negative).
 * @param calendar - Working calendar.
 * @returns ISO date string.
 */
export function addWorkingDays(startDate: string, days: number, calendar: WorkingCalendar): string {
  if (days === 0) return snapToWorkingDay(startDate, calendar);

  let current = new Date(startDate + 'T00:00:00');
  let remaining = Math.abs(days);
  const direction = days > 0 ? 1 : -1;

  // Move to first working day if starting on non-working
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dayOfWeek = current.getDay();
    const iso = toISO(current);
    if (calendar.workingDays.has(dayOfWeek) && !calendar.holidays.has(iso)) {
      break;
    }
    current = new Date(current.getTime() + direction * MS_PER_DAY);
  }

  // Count working days
  while (remaining > 0) {
    current = new Date(current.getTime() + direction * MS_PER_DAY);
    const dayOfWeek = current.getDay();
    const iso = toISO(current);
    if (calendar.workingDays.has(dayOfWeek) && !calendar.holidays.has(iso)) {
      remaining--;
    }
  }

  return toISO(current);
}

/**
 * Count working days between two dates (exclusive of start, inclusive of end).
 * @param startDate - ISO date string.
 * @param endDate - ISO date string.
 * @param calendar - Working calendar.
 * @returns Number of working days between the dates.
 */
export function workingDaysBetween(startDate: string, endDate: string, calendar: WorkingCalendar): number {
  if (endDate < startDate) {
    return -workingDaysBetween(endDate, startDate, calendar);
  }

  let count = 0;
  let current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current < end) {
    current = new Date(current.getTime() + MS_PER_DAY);
    const dayOfWeek = current.getDay();
    const iso = toISO(current);
    if (calendar.workingDays.has(dayOfWeek) && !calendar.holidays.has(iso)) {
      count++;
    }
  }

  return count;
}

/**
 * Calculate the end date given a start date and duration in working days.
 * @param startDate - ISO date string.
 * @param duration - Number of working days.
 * @param calendar - Working calendar.
 * @returns ISO date string for the end date.
 */
export function calculateEndDate(startDate: string, duration: number, calendar: WorkingCalendar): string {
  if (duration <= 0) return startDate;
  // Duration of 1 means start and end are the same day
  return addWorkingDays(startDate, duration - 1, calendar);
}

/**
 * Calculate duration in working days given start and end dates.
 * @param startDate - ISO date string.
 * @param endDate - ISO date string.
 * @param calendar - Working calendar.
 * @returns Number of working days between start and end (inclusive).
 */
export function calculateDuration(startDate: string, endDate: string, calendar: WorkingCalendar): number {
  if (endDate < startDate) return 0;
  return workingDaysBetween(startDate, endDate, calendar) + 1;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

/**
 * Format a date string for display.
 * @param dateStr - ISO date string.
 * @param format - Format type.
 * @returns Formatted date string.
 */
export function formatDate(
  dateStr: string,
  format: 'short' | 'long' | 'iso' = 'short',
): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (format === 'iso') return dateStr;

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (format === 'long') {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${monthNames[date.getMonth()]} ${day}, ${year}`;
  }

  // short: MM/DD/YYYY
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

/**
 * Get today's date as an ISO string.
 */
export function today(): string {
  return toISO(new Date());
}

// ─── Internal ───────────────────────────────────────────────────────────────

/**
 * Convert a Date object to ISO date string (YYYY-MM-DD).
 */
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
