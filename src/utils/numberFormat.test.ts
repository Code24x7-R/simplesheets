import {
  formatNumberValue,
  isNumberFormat,
  isNumericValue,
} from './numberFormat';

describe('isNumberFormat', () => {
  it('returns false for General', () => {
    expect(isNumberFormat('General')).toBe(false);
  });

  it('returns true for numeric patterns', () => {
    expect(isNumberFormat('0.00')).toBe(true);
    expect(isNumberFormat('#,##0')).toBe(true);
    expect(isNumberFormat('$#,##0.00')).toBe(true);
    expect(isNumberFormat('0.00%')).toBe(true);
    expect(isNumberFormat('0.00E+00')).toBe(true);
    expect(isNumberFormat('mm/dd/yyyy')).toBe(false); // date, not numeric pattern
  });
});

describe('isNumericValue', () => {
  it('returns true for numbers', () => {
    expect(isNumericValue(42)).toBe(true);
    expect(isNumericValue(3.14)).toBe(true);
    expect(isNumericValue(-100)).toBe(true);
  });

  it('returns true for numeric strings', () => {
    expect(isNumericValue('42')).toBe(true);
    expect(isNumericValue('3.14')).toBe(true);
    expect(isNumericValue('-100')).toBe(true);
  });

  it('returns false for non-numeric strings', () => {
    expect(isNumericValue('hello')).toBe(false);
    expect(isNumericValue('')).toBe(false);
    expect(isNumericValue('  ')).toBe(false);
  });

  it('returns true for booleans', () => {
    expect(isNumericValue(true)).toBe(true);
    expect(isNumericValue(false)).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isNumericValue(null)).toBe(false);
    expect(isNumericValue(undefined)).toBe(false);
  });
});

describe('formatNumberValue', () => {
  it('General format returns the value as-is', () => {
    expect(formatNumberValue(42, 'General')).toBe('42');
    expect(formatNumberValue(3.14159, 'General')).toBe('3.14159');
  });

  it('formats with fixed decimals (0.00)', () => {
    expect(formatNumberValue(3.14159, '0.00')).toBe('3.14');
    expect(formatNumberValue(42, '0.00')).toBe('42.00');
    expect(formatNumberValue(0.5, '0.00')).toBe('0.50');
  });

  it('formats with 4 decimals (0.0000)', () => {
    expect(formatNumberValue(3.14159, '0.0000')).toBe('3.1416');
  });

  it('formats integer (0)', () => {
    expect(formatNumberValue(42.9, '0')).toBe('43');
    expect(formatNumberValue(42.4, '0')).toBe('42');
  });

  it('formats with thousands separator (#,##0)', () => {
    expect(formatNumberValue(1234567, '#,##0')).toBe('1,234,567');
    expect(formatNumberValue(1000, '#,##0')).toBe('1,000');
    expect(formatNumberValue(999, '#,##0')).toBe('999');
  });

  it('formats with thousands separator and decimals (#,##0.00)', () => {
    expect(formatNumberValue(1234567.89, '#,##0.00')).toBe('1,234,567.89');
    expect(formatNumberValue(1000.5, '#,##0.00')).toBe('1,000.50');
  });

  it('formats currency ($#,##0.00)', () => {
    expect(formatNumberValue(1234.56, '$#,##0.00')).toBe('$1,234.56');
    expect(formatNumberValue(0.99, '$#,##0.00')).toBe('$0.99');
  });

  it('formats percentage (0%)', () => {
    expect(formatNumberValue(0.25, '0%')).toBe('25%');
    expect(formatNumberValue(1, '0%')).toBe('100%');
  });

  it('formats percentage with decimals (0.00%)', () => {
    expect(formatNumberValue(0.2567, '0.00%')).toBe('25.67%');
    expect(formatNumberValue(0.5, '0.00%')).toBe('50.00%');
  });

  it('formats scientific notation (0.00E+00)', () => {
    const result = formatNumberValue(123456, '0.00E+00');
    expect(result).toContain('E');
    expect(result).toContain('1');
  });

  it('formats negative numbers', () => {
    expect(formatNumberValue(-42.5, '0.00')).toBe('-42.50');
    // Currency prefix is placed before the minus sign
    const negCurrency = formatNumberValue(-1000, '$#,##0.00');
    expect(negCurrency).toContain('-');
    expect(negCurrency).toContain('1,000.00');
  });

  it('formats string numbers', () => {
    expect(formatNumberValue('42.5', '0.00')).toBe('42.50');
    expect(formatNumberValue('1000', '#,##0')).toBe('1,000');
  });

  it('returns original value for non-numeric strings', () => {
    expect(formatNumberValue('hello', '0.00')).toBe('hello');
  });

  it('formats dates (mm/dd/yyyy)', () => {
    // Serial 1 = Dec 31, 1899 (Excel epoch off-by-one for pre-March dates)
    expect(formatNumberValue(1, 'mm/dd/yyyy')).toContain('1899');
    // Serial 44197 = Jan 1, 2021
    expect(formatNumberValue(44197, 'mm/dd/yyyy')).toContain('2021');
  });

  it('formats dates (mm/dd/yy)', () => {
    // Short year format
    const result = formatNumberValue(44197, 'mm/dd/yy');
    expect(result).toContain('21'); // 2021 -> 21
    expect(result).toContain('/');
  });

  it('formats dates (yyyy-mm-dd)', () => {
    const result = formatNumberValue(44197, 'yyyy-mm-dd');
    expect(result).toContain('2021');
    expect(result).toContain('-');
  });

  it('formats scientific notation with negative exponent', () => {
    const result = formatNumberValue(0.001, '0.00E+00');
    expect(result).toContain('E');
    // Uses Unicode minus sign (U+2212) for negative exponents
    expect(result).toContain('−');
  });

  it('formats time (hh:mm:ss)', () => {
    // 0.5 = noon
    expect(formatNumberValue(0.5, 'hh:mm:ss')).toBe('12:00:00');
    // 0.25 = 6:00 AM
    expect(formatNumberValue(0.25, 'hh:mm:ss')).toBe('06:00:00');
  });

  it('formats time (hh:mm)', () => {
    expect(formatNumberValue(0.5, 'hh:mm')).toBe('12:00');
  });

  it('handles empty/null values', () => {
    expect(formatNumberValue(null, '0.00')).toBe('');
    expect(formatNumberValue(undefined, '0.00')).toBe('');
  });
});
