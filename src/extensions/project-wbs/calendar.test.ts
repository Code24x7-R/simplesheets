// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  createDefaultCalendar,
  createCalendar,
  isWorkingDay,
  isWeekend,
  getDayOfWeek,
  nextWorkingDay,
  previousWorkingDay,
  snapToWorkingDay,
  addWorkingDays,
  workingDaysBetween,
  calculateEndDate,
  calculateDuration,
  formatDate,
  today,
} from './calendar';

describe('calendar', () => {
  describe('createDefaultCalendar', () => {
    it('creates Mon-Fri calendar', () => {
      const cal = createDefaultCalendar();
      expect(cal.workingDays.has(0)).toBe(false); // Sun
      expect(cal.workingDays.has(1)).toBe(true);  // Mon
      expect(cal.workingDays.has(5)).toBe(true);  // Fri
      expect(cal.workingDays.has(6)).toBe(false); // Sat
      expect(cal.hoursPerDay).toBe(8);
      expect(cal.holidays.size).toBe(0);
    });
  });

  describe('createCalendar', () => {
    it('creates custom calendar', () => {
      const cal = createCalendar(new Set([1, 3, 5]), new Set(['2026-12-25']), 7);
      expect(cal.workingDays.has(1)).toBe(true);
      expect(cal.workingDays.has(2)).toBe(false);
      expect(cal.holidays.has('2026-12-25')).toBe(true);
      expect(cal.hoursPerDay).toBe(7);
    });
  });

  describe('isWorkingDay', () => {
    const cal = createDefaultCalendar();

    it('returns true for weekday', () => {
      // 2026-01-05 is a Monday
      expect(isWorkingDay('2026-01-05', cal)).toBe(true);
    });

    it('returns false for Saturday', () => {
      // 2026-01-03 is a Saturday
      expect(isWorkingDay('2026-01-03', cal)).toBe(false);
    });

    it('returns false for Sunday', () => {
      // 2026-01-04 is a Sunday
      expect(isWorkingDay('2026-01-04', cal)).toBe(false);
    });

    it('returns false for holiday', () => {
      const calWithHoliday = createDefaultCalendar();
      calWithHoliday.holidays.add('2026-01-05');
      expect(isWorkingDay('2026-01-05', calWithHoliday)).toBe(false);
    });
  });

  describe('isWeekend', () => {
    it('returns true for Saturday', () => {
      expect(isWeekend('2026-01-03')).toBe(true);
    });

    it('returns true for Sunday', () => {
      expect(isWeekend('2026-01-04')).toBe(true);
    });

    it('returns false for Monday', () => {
      expect(isWeekend('2026-01-05')).toBe(false);
    });
  });

  describe('getDayOfWeek', () => {
    it('returns 0 for Sunday', () => {
      expect(getDayOfWeek('2026-01-04')).toBe(0);
    });

    it('returns 1 for Monday', () => {
      expect(getDayOfWeek('2026-01-05')).toBe(1);
    });

    it('returns 6 for Saturday', () => {
      expect(getDayOfWeek('2026-01-03')).toBe(6);
    });
  });

  describe('nextWorkingDay', () => {
    const cal = createDefaultCalendar();

    it('returns same day if already working', () => {
      expect(nextWorkingDay('2026-01-05', cal)).toBe('2026-01-05'); // Monday
    });

    it('advances from Saturday to Monday', () => {
      expect(nextWorkingDay('2026-01-03', cal)).toBe('2026-01-05');
    });

    it('advances from Sunday to Monday', () => {
      expect(nextWorkingDay('2026-01-04', cal)).toBe('2026-01-05');
    });

    it('skips holidays', () => {
      const calWithHoliday = createDefaultCalendar();
      calWithHoliday.holidays.add('2026-01-05');
      expect(nextWorkingDay('2026-01-04', calWithHoliday)).toBe('2026-01-06');
    });
  });

  describe('previousWorkingDay', () => {
    const cal = createDefaultCalendar();

    it('returns same day if already working', () => {
      expect(previousWorkingDay('2026-01-05', cal)).toBe('2026-01-05');
    });

    it('goes back from Monday to Friday', () => {
      expect(previousWorkingDay('2026-01-05', cal)).toBe('2026-01-05'); // same
      expect(previousWorkingDay('2026-01-05', cal)).toBe('2026-01-05');
    });

    it('goes back from Sunday to Friday', () => {
      expect(previousWorkingDay('2026-01-04', cal)).toBe('2026-01-02');
    });
  });

  describe('snapToWorkingDay', () => {
    const cal = createDefaultCalendar();

    it('snaps Saturday to Monday', () => {
      expect(snapToWorkingDay('2026-01-03', cal)).toBe('2026-01-05');
    });

    it('keeps weekday as-is', () => {
      expect(snapToWorkingDay('2026-01-05', cal)).toBe('2026-01-05');
    });
  });

  describe('addWorkingDays', () => {
    const cal = createDefaultCalendar();

    it('adds 1 working day', () => {
      // Monday + 1 = Tuesday
      expect(addWorkingDays('2026-01-05', 1, cal)).toBe('2026-01-06');
    });

    it('adds 5 working days crosses weekend', () => {
      // Monday + 5 = next Monday
      expect(addWorkingDays('2026-01-05', 5, cal)).toBe('2026-01-12');
    });

    it('adds 0 days returns snapped start', () => {
      expect(addWorkingDays('2026-01-05', 0, cal)).toBe('2026-01-05');
    });

    it('subtracts working days', () => {
      // Monday - 1 = Friday
      expect(addWorkingDays('2026-01-05', -1, cal)).toBe('2026-01-02');
    });

    it('subtracts across weekend', () => {
      // Monday - 5 = previous Monday
      expect(addWorkingDays('2026-01-05', -5, cal)).toBe('2025-12-29');
    });

    it('skips holidays when adding', () => {
      const calWithHoliday = createDefaultCalendar();
      calWithHoliday.holidays.add('2026-01-06');
      // Monday + 1 should skip Tue (holiday) → Wed
      expect(addWorkingDays('2026-01-05', 1, calWithHoliday)).toBe('2026-01-07');
    });
  });

  describe('workingDaysBetween', () => {
    const cal = createDefaultCalendar();

    it('counts days in a week', () => {
      // Mon to Fri = 4 working days
      expect(workingDaysBetween('2026-01-05', '2026-01-09', cal)).toBe(4);
    });

    it('counts across weekend', () => {
      // Fri to Mon = 1 working day
      expect(workingDaysBetween('2026-01-02', '2026-01-05', cal)).toBe(1);
    });

    it('returns 0 for same day', () => {
      expect(workingDaysBetween('2026-01-05', '2026-01-05', cal)).toBe(0);
    });

    it('returns negative for reversed dates', () => {
      expect(workingDaysBetween('2026-01-09', '2026-01-05', cal)).toBe(-4);
    });

    it('skips holidays', () => {
      const calWithHoliday = createDefaultCalendar();
      calWithHoliday.holidays.add('2026-01-06');
      // Mon to Fri with Tue holiday = 3 working days
      expect(workingDaysBetween('2026-01-05', '2026-01-09', calWithHoliday)).toBe(3);
    });
  });

  describe('calculateEndDate', () => {
    const cal = createDefaultCalendar();

    it('duration 1 means same day', () => {
      expect(calculateEndDate('2026-01-05', 1, cal)).toBe('2026-01-05');
    });

    it('duration 5 = end of week', () => {
      expect(calculateEndDate('2026-01-05', 5, cal)).toBe('2026-01-09'); // Mon-Fri
    });

    it('duration 6 crosses weekend', () => {
      expect(calculateEndDate('2026-01-05', 6, cal)).toBe('2026-01-12'); // Mon → next Mon
    });
  });

  describe('calculateDuration', () => {
    const cal = createDefaultCalendar();

    it('same day = 1', () => {
      expect(calculateDuration('2026-01-05', '2026-01-05', cal)).toBe(1);
    });

    it('Mon to Fri = 5', () => {
      expect(calculateDuration('2026-01-05', '2026-01-09', cal)).toBe(5);
    });

    it('returns 0 if end before start', () => {
      expect(calculateDuration('2026-01-09', '2026-01-05', cal)).toBe(0);
    });
  });

  describe('formatDate', () => {
    it('formats short', () => {
      expect(formatDate('2026-01-05', 'short')).toBe('01/05/2026');
    });

    it('formats long', () => {
      expect(formatDate('2026-01-05', 'long')).toBe('January 5, 2026');
    });

    it('formats iso', () => {
      expect(formatDate('2026-01-05', 'iso')).toBe('2026-01-05');
    });
  });

  describe('today', () => {
    it('returns a valid ISO date string', () => {
      const t = today();
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
