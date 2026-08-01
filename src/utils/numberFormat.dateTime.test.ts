import {
  formatNumberValue,
  isDateFormat,
  isTimeFormat,
  isTextFormat,
  shouldRightAlign,
  formatDate,
  formatTime,
} from './numberFormat';

/**
 * Phase 29a: Date & Time Serial Number Decoding
 *
 * Excel stores dates as serial numbers where day 1 = January 1, 1900.
 * Times are stored as fractional days (0.5 = 12:00 PM).
 * Excel has a leap year bug treating 1900 as a leap year (for Lotus 1-2-3 compat).
 */

// ─── Serial Number Reference Values ──────────────────────────────────────
// Serial 1 = Dec 31, 1899 (but Excel displays it as Jan 1, 1900 due to bug)
// Serial 2 = Jan 1, 1900
// Serial 36526 = Jan 1, 2000
// Serial 44197 = Jan 1, 2021
// Serial 45230 = Oct 31, 2023
// Serial 46234 = Jul 31, 2026

describe('Phase 29a: Date/Time Serial Number Decoding', () => {
  describe('formatDate - Excel date epoch', () => {
    it('serial 1 = Dec 31, 1899 (epoch offset)', () => {
      const result = formatDate(1, 'mm/dd/yyyy');
      expect(result).toContain('1899');
    });

    it('serial 2 = Jan 1, 1900', () => {
      const result = formatDate(2, 'mm/dd/yyyy');
      expect(result).toBe('01/01/1900');
    });

    it('serial 44197 = Jan 1, 2021', () => {
      expect(formatDate(44197, 'mm/dd/yyyy')).toBe('01/01/2021');
    });

    it('serial 36526 = Jan 1, 2000', () => {
      expect(formatDate(36526, 'mm/dd/yyyy')).toBe('01/01/2000');
    });

    it('serial 45230 = Oct 31, 2023', () => {
      expect(formatDate(45230, 'mm/dd/yyyy')).toBe('10/31/2023');
    });

    it('serial 46234 = Jul 31, 2026', () => {
      expect(formatDate(46234, 'mm/dd/yyyy')).toBe('07/31/2026');
    });

    it('serial 61 = Mar 1, 1900', () => {
      expect(formatDate(61, 'mm/dd/yyyy')).toBe('03/01/1900');
    });
  });

  describe('formatDate - MM/DD/YYYY format', () => {
    it('pads month and day with leading zeros', () => {
      expect(formatDate(44197, 'mm/dd/yyyy')).toBe('01/01/2021');
      expect(formatDate(44228, 'mm/dd/yyyy')).toBe('02/01/2021');
    });

    it('does not pad month/day >= 10', () => {
      // Dec 25, 2020 = serial 44190
      expect(formatDate(44190, 'mm/dd/yyyy')).toBe('12/25/2020');
    });
  });

  describe('formatDate - DD/MM/YYYY format (European)', () => {
    it('formats day first then month', () => {
      // Jan 15, 2021 = serial 44211
      expect(formatDate(44211, 'dd/mm/yyyy')).toBe('15/01/2021');
    });
  });

  describe('formatDate - YYYY-MM-DD format (ISO)', () => {
    it('formats as ISO date', () => {
      expect(formatDate(44197, 'yyyy-mm-dd')).toBe('2021-01-01');
    });
  });

  describe('formatDate - DD-MMM-YY format', () => {
    it('formats with abbreviated month and 2-digit year', () => {
      // Jan 1, 2021
      expect(formatDate(44197, 'dd-mmm-yy')).toBe('01-Jan-21');
    });

    it('formats Jul 31, 2026 correctly', () => {
      expect(formatDate(46234, 'dd-mmm-yy')).toBe('31-Jul-26');
    });
  });

  describe('formatDate - MMMM D, YYYY format (full month name)', () => {
    it('formats with full month name', () => {
      expect(formatDate(44197, 'mmmm d, yyyy')).toBe('January 1, 2021');
    });

    it('formats December 25, 2020 correctly', () => {
      expect(formatDate(44190, 'mmmm d, yyyy')).toBe('December 25, 2020');
    });
  });

  describe('formatDate - MM/DD/YY format (2-digit year)', () => {
    it('formats with 2-digit year', () => {
      expect(formatDate(44197, 'mm/dd/yy')).toBe('01/01/21');
    });
  });

  describe('formatDate - month name only', () => {
    it('formats abbreviated month name (MMM-YY)', () => {
      expect(formatDate(44197, 'mmm-yy')).toBe('Jan-21');
    });

    it('formats full month name (MMMM-YYYY)', () => {
      expect(formatDate(44197, 'mmmm-yyyy')).toBe('January-2021');
    });
  });

  describe('formatTime - fractional day handling', () => {
    it('0.5 = 12:00:00 (noon)', () => {
      expect(formatTime(0.5, 'hh:mm:ss')).toBe('12:00:00');
    });

    it('0.25 = 06:00:00', () => {
      expect(formatTime(0.25, 'hh:mm:ss')).toBe('06:00:00');
    });

    it('0.75 = 18:00:00', () => {
      expect(formatTime(0.75, 'hh:mm:ss')).toBe('18:00:00');
    });

    it('0.0 = 00:00:00 (midnight)', () => {
      expect(formatTime(0, 'hh:mm:ss')).toBe('00:00:00');
    });

    it('0.999 = 23:58:34 (near midnight)', () => {
      expect(formatTime(0.999, 'hh:mm:ss')).toBe('23:58:34');
    });
  });

  describe('formatTime - 24-hour format', () => {
    it('formats HH:MM with leading zeros', () => {
      expect(formatTime(0.5, 'hh:mm')).toBe('12:00');
      expect(formatTime(0.25, 'hh:mm')).toBe('06:00');
    });
  });

  describe('formatTime - 12-hour format with AM/PM', () => {
    it('formats with AM indicator for morning', () => {
      // 0.25 = 6:00 AM
      expect(formatTime(0.25, 'h:mm AM/PM')).toBe('6:00 AM');
    });

    it('formats with PM indicator for afternoon', () => {
      // 0.5 = 12:00 PM
      expect(formatTime(0.5, 'h:mm AM/PM')).toBe('12:00 PM');
    });

    it('formats with PM indicator for evening', () => {
      // 0.75 = 6:00 PM
      expect(formatTime(0.75, 'h:mm AM/PM')).toBe('6:00 PM');
    });

    it('0.0 = 12:00 AM (midnight)', () => {
      expect(formatTime(0, 'h:mm AM/PM')).toBe('12:00 AM');
    });
  });

  describe('formatTime - seconds', () => {
    it('formats h:mm:ss', () => {
      expect(formatTime(0.5, 'h:mm:ss AM/PM')).toBe('12:00:00 PM');
    });
  });

  describe('formatNumberValue - date format strings', () => {
    it('formats MM/DD/YYYY correctly', () => {
      expect(formatNumberValue(44197, 'mm/dd/yyyy')).toBe('01/01/2021');
    });

    it('formats DD-MMM-YY correctly', () => {
      expect(formatNumberValue(46234, 'dd-mmm-yy')).toBe('31-Jul-26');
    });

    it('formats MMMM D, YYYY correctly', () => {
      expect(formatNumberValue(44197, 'mmmm d, yyyy')).toBe('January 1, 2021');
    });
  });

  describe('formatNumberValue - time format strings', () => {
    it('formats hh:mm:ss correctly', () => {
      expect(formatNumberValue(0.5, 'hh:mm:ss')).toBe('12:00:00');
    });

    it('formats h:mm AM/PM correctly', () => {
      expect(formatNumberValue(0.25, 'h:mm AM/PM')).toBe('6:00 AM');
    });
  });

  describe('formatNumberValue - combined date+time', () => {
    it('formats MM/DD/YYYY hh:mm', () => {
      // Serial 44197.5 = Jan 1, 2021 12:00 PM
      const result = formatNumberValue(44197.5, 'mm/dd/yyyy hh:mm');
      expect(result).toContain('01/01/2021');
      expect(result).toContain('12:00');
    });
  });

  describe('formatNumberValue - edge cases', () => {
    it('handles negative serial numbers gracefully', () => {
      const result = formatNumberValue(-1, 'mm/dd/yyyy');
      // Negative serials are pre-1900; should not crash
      expect(typeof result).toBe('string');
    });

    it('handles very large serial numbers', () => {
      // Serial 100000 = Nov 20, 2173
      const result = formatNumberValue(100000, 'mm/dd/yyyy');
      expect(result).toContain('2173');
    });
  });

  describe('isDateFormat - extended detection', () => {
    it('detects MM/DD/YYYY format', () => {
      expect(isDateFormat('mm/dd/yyyy')).toBe(true);
    });

    it('detects DD/MM/YYYY format', () => {
      expect(isDateFormat('dd/mm/yyyy')).toBe(true);
    });

    it('detects YYYY-MM-DD format', () => {
      expect(isDateFormat('yyyy-mm-dd')).toBe(true);
    });

    it('detects DD-MMM-YY format', () => {
      expect(isDateFormat('dd-mmm-yy')).toBe(true);
    });

    it('detects MMMM D, YYYY format', () => {
      expect(isDateFormat('mmmm d, yyyy')).toBe(true);
    });

    it('detects DD-MMMM-YYYY format', () => {
      expect(isDateFormat('dd-mmmm-yyyy')).toBe(true);
    });

    it('detects MMM-YY format', () => {
      expect(isDateFormat('mmm-yy')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isDateFormat('MM/DD/YYYY')).toBe(true);
      expect(isDateFormat('DD-MMM-YY')).toBe(true);
    });

    it('returns false for non-date patterns', () => {
      expect(isDateFormat('0.00')).toBe(false);
      expect(isDateFormat('General')).toBe(false);
      expect(isDateFormat('hh:mm:ss')).toBe(false);
      expect(isDateFormat('#,##0')).toBe(false);
      expect(isDateFormat('$#,##0.00')).toBe(false);
    });
  });

  describe('isTimeFormat - extended detection', () => {
    it('detects hh:mm:ss format', () => {
      expect(isTimeFormat('hh:mm:ss')).toBe(true);
    });

    it('detects hh:mm format', () => {
      expect(isTimeFormat('hh:mm')).toBe(true);
    });

    it('detects h:mm:ss format', () => {
      expect(isTimeFormat('h:mm:ss')).toBe(true);
    });

    it('detects h:mm format', () => {
      expect(isTimeFormat('h:mm')).toBe(true);
    });

    it('detects h:mm AM/PM format', () => {
      expect(isTimeFormat('h:mm AM/PM')).toBe(true);
    });

    it('detects h:mm:ss AM/PM format', () => {
      expect(isTimeFormat('h:mm:ss AM/PM')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isTimeFormat('HH:MM:SS')).toBe(true);
      expect(isTimeFormat('H:MM AM/PM')).toBe(true);
    });

    it('returns false for non-time patterns', () => {
      expect(isTimeFormat('0.00')).toBe(false);
      expect(isTimeFormat('General')).toBe(false);
      expect(isTimeFormat('mm/dd/yyyy')).toBe(false);
      expect(isTimeFormat('#,##0')).toBe(false);
    });
  });

  describe('shouldRightAlign - date and time formats', () => {
    it('returns true for MM/DD/YYYY format', () => {
      expect(shouldRightAlign({
        rawValue: '44197',
        computedValue: 44197,
        style: { numberFormat: 'mm/dd/yyyy' },
      })).toBe(true);
    });

    it('returns true for DD-MMM-YY format', () => {
      expect(shouldRightAlign({
        rawValue: '44197',
        computedValue: 44197,
        style: { numberFormat: 'dd-mmm-yy' },
      })).toBe(true);
    });

    it('returns true for hh:mm:ss format', () => {
      expect(shouldRightAlign({
        rawValue: '0.5',
        computedValue: 0.5,
        style: { numberFormat: 'hh:mm:ss' },
      })).toBe(true);
    });

    it('returns true for h:mm AM/PM format', () => {
      expect(shouldRightAlign({
        rawValue: '0.25',
        computedValue: 0.25,
        style: { numberFormat: 'h:mm AM/PM' },
      })).toBe(true);
    });
  });
});

describe('Phase 29b: Text Format (@)', () => {
  describe('isTextFormat', () => {
    it('returns true for bare @ symbol', () => {
      expect(isTextFormat('@')).toBe(true);
    });

    it('returns true for @ with semicolons (multi-section)', () => {
      expect(isTextFormat('@;@;@;@')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isTextFormat('')).toBe(false);
    });

    it('returns false for non-text formats', () => {
      expect(isTextFormat('0.00')).toBe(false);
      expect(isTextFormat('General')).toBe(false);
      expect(isTextFormat('mm/dd/yyyy')).toBe(false);
      expect(isTextFormat('$#,##0.00')).toBe(false);
    });
  });

  describe('formatNumberValue - text format preserves raw value', () => {
    it('preserves leading zeros (ZIP code)', () => {
      expect(formatNumberValue('00123', '@')).toBe('00123');
    });

    it('preserves credit card number as text', () => {
      expect(formatNumberValue('1234567890123456', '@')).toBe('1234567890123456');
    });

    it('preserves ID with leading zeros', () => {
      expect(formatNumberValue('00042', '@')).toBe('00042');
    });

    it('does not apply numeric formatting to text-formatted cells', () => {
      // Without text format, "00123" would become "123"
      expect(formatNumberValue('00123', '@')).not.toBe('123');
    });
  });

  describe('shouldRightAlign - text format', () => {
    it('returns false for text-formatted cell (text is left-aligned)', () => {
      expect(shouldRightAlign({
        rawValue: '00123',
        computedValue: '00123',
        style: { numberFormat: '@' },
      })).toBe(false);
    });

    it('returns false for text format even with numeric-looking value', () => {
      expect(shouldRightAlign({
        rawValue: '42',
        computedValue: '42',
        style: { numberFormat: '@' },
      })).toBe(false);
    });
  });
});
