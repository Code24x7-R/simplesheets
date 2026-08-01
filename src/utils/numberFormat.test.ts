import {
  formatNumberValue,
  isNumberFormat,
  isNumericValue,
  isDateFormat,
  isTimeFormat,
  isAccountingFormat,
  shouldRightAlign,
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
    // Date/time formats are also "number formats" in the sense that they
    // require numeric values to format (so Grid applies them)
    expect(isNumberFormat('mm/dd/yyyy')).toBe(true);
    expect(isNumberFormat('hh:mm:ss')).toBe(true);
  });

  it('returns false for text format (@)', () => {
    expect(isNumberFormat('@')).toBe(false);
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

describe('isDateFormat', () => {
  it('returns true for date format patterns', () => {
    expect(isDateFormat('mm/dd/yyyy')).toBe(true);
    expect(isDateFormat('mm/dd/yy')).toBe(true);
    expect(isDateFormat('yyyy-mm-dd')).toBe(true);
    expect(isDateFormat('dd/mm/yyyy')).toBe(true);
    expect(isDateFormat('dd-mmm-yyyy')).toBe(true);
    expect(isDateFormat('mmm-yyyy')).toBe(true);
  });

  it('returns false for non-date patterns', () => {
    expect(isDateFormat('0.00')).toBe(false);
    expect(isDateFormat('General')).toBe(false);
    expect(isDateFormat('hh:mm:ss')).toBe(false);
    expect(isDateFormat('#,##0')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isDateFormat('MM/DD/YYYY')).toBe(true);
    expect(isDateFormat('YYYY-MM-DD')).toBe(true);
  });
});

describe('isTimeFormat', () => {
  it('returns true for time format patterns', () => {
    expect(isTimeFormat('hh:mm:ss')).toBe(true);
    expect(isTimeFormat('hh:mm')).toBe(true);
    expect(isTimeFormat('h:mm:ss')).toBe(true);
    expect(isTimeFormat('h:mm')).toBe(true);
  });

  it('returns false for non-time patterns', () => {
    expect(isTimeFormat('0.00')).toBe(false);
    expect(isTimeFormat('General')).toBe(false);
    expect(isTimeFormat('mm/dd/yyyy')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isTimeFormat('HH:MM:SS')).toBe(true);
    expect(isTimeFormat('HH:MM')).toBe(true);
  });
});

describe('shouldRightAlign', () => {
  it('returns false for undefined cell', () => {
    expect(shouldRightAlign(undefined)).toBe(false);
  });

  it('returns true for numeric values', () => {
    expect(shouldRightAlign({ rawValue: '42', computedValue: 42 })).toBe(true);
    expect(shouldRightAlign({ rawValue: '3.14', computedValue: 3.14 })).toBe(true);
    expect(shouldRightAlign({ rawValue: '-100', computedValue: -100 })).toBe(true);
    expect(shouldRightAlign({ rawValue: '0', computedValue: 0 })).toBe(true);
  });

  it('returns false for non-numeric text values', () => {
    expect(shouldRightAlign({ rawValue: 'hello' })).toBe(false);
    expect(shouldRightAlign({ rawValue: 'world', computedValue: 'world' })).toBe(false);
  });

  it('returns true for cells with date format', () => {
    expect(shouldRightAlign({ rawValue: '44197', computedValue: 44197, style: { numberFormat: 'mm/dd/yyyy' } })).toBe(true);
    expect(shouldRightAlign({ rawValue: '44197', computedValue: 44197, style: { numberFormat: 'yyyy-mm-dd' } })).toBe(true);
    expect(shouldRightAlign({ rawValue: '44197', computedValue: 44197, style: { numberFormat: 'mm/dd/yy' } })).toBe(true);
  });

  it('returns true for cells with time format', () => {
    expect(shouldRightAlign({ rawValue: '0.5', computedValue: 0.5, style: { numberFormat: 'hh:mm:ss' } })).toBe(true);
    expect(shouldRightAlign({ rawValue: '0.25', computedValue: 0.25, style: { numberFormat: 'hh:mm' } })).toBe(true);
  });

  it('returns false when textAlign is explicitly set', () => {
    expect(shouldRightAlign({ rawValue: '42', computedValue: 42, style: { textAlign: 'left' } })).toBe(false);
    expect(shouldRightAlign({ rawValue: '42', computedValue: 42, style: { textAlign: 'center' } })).toBe(false);
    expect(shouldRightAlign({ rawValue: '42', computedValue: 42, style: { textAlign: 'right' } })).toBe(false);
  });

  it('returns true for numeric strings without computed value', () => {
    expect(shouldRightAlign({ rawValue: '123.45' })).toBe(true);
    expect(shouldRightAlign({ rawValue: '1000' })).toBe(true);
  });

  it('returns true for boolean values', () => {
    expect(shouldRightAlign({ rawValue: 'TRUE', computedValue: true })).toBe(true);
    expect(shouldRightAlign({ rawValue: 'FALSE', computedValue: false })).toBe(true);
  });

  it('returns false for empty cells', () => {
    expect(shouldRightAlign({ rawValue: '' })).toBe(false);
  });

  it('returns true for date-formatted cell even with non-numeric raw value', () => {
    expect(shouldRightAlign({ rawValue: 'N/A', style: { numberFormat: 'mm/dd/yyyy' } })).toBe(true);
  });

  it('returns true for accounting-formatted cells', () => {
    expect(shouldRightAlign({ rawValue: '1234.56', computedValue: 1234.56, style: { numberFormat: '_($*#,##0.00_);_($*(#,##0.00);_($* "-"??_);_(@_)' } })).toBe(true);
  });
});

describe('isAccountingFormat', () => {
  it('returns true for Excel accounting format string', () => {
    expect(isAccountingFormat('_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)')).toBe(true);
    expect(isAccountingFormat('_($*#,##0.00_);_($*(#,##0.00);_($* "-"??_);_(@_)')).toBe(true);
  });

  it('returns true for short "accounting" keyword', () => {
    expect(isAccountingFormat('accounting')).toBe(true);
    expect(isAccountingFormat('Accounting')).toBe(true);
  });

  it('returns false for non-accounting formats', () => {
    expect(isAccountingFormat('$#,##0.00')).toBe(false);
    expect(isAccountingFormat('0.00')).toBe(false);
    expect(isAccountingFormat('General')).toBe(false);
    expect(isAccountingFormat('#,##0.00')).toBe(false);
  });
});

describe('formatNumberValue - Accounting format', () => {
  const ACCT_FORMAT = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';

  it('formats positive numbers with $ left-aligned and number right-aligned', () => {
    const result = formatNumberValue(1234.56, ACCT_FORMAT);
    expect(result.startsWith('$')).toBe(true);
    expect(result.endsWith('1,234.56')).toBe(true);
    // $ should be at the start
    expect(result.indexOf('$')).toBe(0);
  });

  it('displays dash for zero values', () => {
    const result = formatNumberValue(0, ACCT_FORMAT);
    expect(result.startsWith('$')).toBe(true);
    expect(result.includes('-')).toBe(true);
    expect(result).not.toContain('0.00');
  });

  it('formats negative numbers in parentheses', () => {
    const result = formatNumberValue(-1234.56, ACCT_FORMAT);
    expect(result.startsWith('$')).toBe(true);
    expect(result.includes('(1,234.56)')).toBe(true);
    expect(result).not.toContain('-');
  });

  it('formats integer values with 2 decimal places', () => {
    const result = formatNumberValue(100, ACCT_FORMAT);
    expect(result.endsWith('100.00')).toBe(true);
  });

  it('formats large numbers with thousands separator', () => {
    const result = formatNumberValue(1234567.89, ACCT_FORMAT);
    expect(result.endsWith('1,234,567.89')).toBe(true);
  });

  it('right-aligns numbers within fixed width (decimal alignment)', () => {
    const result1 = formatNumberValue(1.23, ACCT_FORMAT);
    const result2 = formatNumberValue(12345.67, ACCT_FORMAT);
    // Find position of the decimal point in each result
    const dot1 = result1.indexOf('.');
    const dot2 = result2.indexOf('.');
    // Decimal points should be at the same position (right-aligned in fixed-width field)
    expect(dot1).toBe(dot2);
  });

  it('formats string numbers correctly', () => {
    const result = formatNumberValue('42.5', ACCT_FORMAT);
    expect(result.endsWith('42.50')).toBe(true);
  });

  it('handles null/empty values', () => {
    expect(formatNumberValue(null, ACCT_FORMAT)).toBe('');
    expect(formatNumberValue(undefined, ACCT_FORMAT)).toBe('');
  });
});
