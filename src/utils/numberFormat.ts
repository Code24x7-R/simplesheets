/**
 * Number format utility for spreadsheet-style cell formatting.
 *
 * Supports common Excel-like format patterns:
 * - "General" → no formatting
 * - "0" → integer
 * - "0.00" → fixed 2 decimals
 * - "#,##0" → thousands separator, integer
 * - "#,##0.00" → thousands separator, 2 decimals
 * - "$#,##0.00" → currency
 * - "_($*#,##0.00_)" → accounting (left-aligned $, right-aligned number)
 * - "0%" → percentage (×100, no decimals)
 * - "0.00%" → percentage with 2 decimals
 * - "0.00E+00" → scientific notation
 * - "mm/dd/yyyy", "dd-mmm-yy", "mmmm d, yyyy" → date formats
 * - "hh:mm:ss", "h:mm AM/PM" → time formats
 * - "@" → text format (preserves literal string)
 *
 * Excel date/time tokens (Phase 29a):
 * - Year: YYYY (4-digit), YY (2-digit)
 * - Month: MMMM (full name), MMM (abbreviated), MM (01-12), M (1-12)
 * - Day: DD (01-31), D (1-31)
 * - Hours: HH/HH (00-23), hh/h (1-12 with AM/PM)
 * - Minutes: mm (00-59), m (0-59) — context-dependent (date vs time)
 * - Seconds: ss (00-59), s (0-59)
 * - AM/PM indicator
 */

/** Regex to detect a text format pattern (@). */
const TEXT_FORMAT_PATTERN = /^@([^;]*(;.*)?)?$/;

/** Regex to detect a number format pattern (contains digits, #, 0, dots, commas). */
const NUMBER_FORMAT_PATTERN = /[0#.,%$E+\-_]/;

/** Month names for date formatting. */
const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Fixed width for the numeric portion in Accounting format.
 * All numbers are right-aligned within this width, ensuring decimal points line up.
 */
const ACCOUNTING_NUM_WIDTH = 15;

/**
 * Checks if a format string is an Accounting format pattern.
 * Accounting format: _($* #,##0.00_);(...)
 * Key feature: left-aligned currency symbol, right-aligned number, dash for zeros.
 */
export function isAccountingFormat(format: string): boolean {
  // Excel accounting format starts with _($ or contains "accounting"
  return format.startsWith('_($') || format.toLowerCase() === 'accounting';
}

/**
 * Extracts the core numeric format from an Accounting format string.
 * e.g., "_($* #,##0.00_);(...)" → "#,##0.00"
 * Falls back to "#,##0.00" if parsing fails.
 */
function extractAccountingCore(format: string): string {
  // Excel accounting format: _($* <positive>_);_($* <negative>_);_($* <zero>_);_(@_)
  // We need the first section's numeric pattern (between $* and _)
  const firstSectionEnd = format.indexOf(';');
  const firstSection = firstSectionEnd !== -1 ? format.slice(0, firstSectionEnd) : format;

  // Find the numeric pattern: look for #,##0.00 or similar
  // Remove accounting-specific characters: _ ( ) $ * space
  const cleaned = firstSection.replace(/[_()$*]/g, '').trim();

  // If we got something that looks like a number format, use it
  if (/^[0#,._]+$/.test(cleaned)) {
    return cleaned;
  }

  // Default to 2 decimal places with thousands separator
  return '#,##0.00';
}

/**
 * Formats a number in Accounting style.
 * - Currency symbol ($) at far-left edge
 * - Number right-aligned in a fixed-width field (decimal points align)
 * - Zero values display as dash (-)
 * - Negative numbers in parentheses
 */
function formatAccounting(num: number, decimals: number, useThousands: boolean): string {
  const prefix = '$';

  // Zero display: dash replaces zero values
  if (num === 0) {
    const dash = '-';
    // Right-align the dash in the fixed-width number field
    const paddedNum = dash.padStart(ACCOUNTING_NUM_WIDTH, ' ');
    return prefix + paddedNum;
  }

  // Format the absolute value of the number
  const absNum = Math.abs(num);
  let numStr = absNum.toFixed(decimals);

  // Add thousands separator
  if (useThousands) {
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    numStr = parts.join('.');
  }

  // Negative numbers in parentheses (no minus sign)
  if (num < 0) {
    numStr = '(' + numStr + ')';
  }

  // Right-align the number in the fixed-width field
  const paddedNum = numStr.padStart(ACCOUNTING_NUM_WIDTH, ' ');

  return prefix + paddedNum;
}

/**
 * Checks if a format string is a number format pattern.
 * Includes date/time formats (which need numeric values to format).
 * Excludes text format (@) which preserves raw string.
 */
export function isNumberFormat(format: string): boolean {
  if (format === 'General') return false;
  if (isTextFormat(format)) return false; // Text format is handled separately
  if (isDateFormat(format) || isTimeFormat(format)) return true;
  return NUMBER_FORMAT_PATTERN.test(format);
}

/**
 * Extracts the currency/prefix and suffix symbols from a format string.
 * Returns the "core" numeric format and prefix/suffix to add.
 */
function parseFormatSymbols(format: string): { core: string; prefix: string; suffix: string } {
  let prefix = '';
  let suffix = '';
  let core = format;

  // Handle currency symbol at start
  if (core.startsWith('$')) {
    prefix = '$';
    core = core.slice(1);
  }

  // Handle percentage at end
  if (core.endsWith('%')) {
    suffix = '%';
    core = core.slice(0, -1);
  }

  return { core, prefix, suffix };
}

/**
 * Counts decimal places from a format core like "#,##0.00" → 2.
 */
function countDecimalPlaces(core: string): number {
  const dotIndex = core.indexOf('.');
  if (dotIndex === -1) return 0;
  // Count zeros after the dot
  let count = 0;
  for (let i = dotIndex + 1; i < core.length; i++) {
    if (core[i] === '0' || core[i] === '#') count++;
    else break;
  }
  return count;
}

/**
 * Checks if a format core uses thousands separator.
 */
function hasThousandsSeparator(core: string): boolean {
  return core.includes(',');
}

/**
 * Formats a numeric value according to a format pattern.
 * @param value - The numeric value to format.
 * @param format - The format pattern string.
 * @returns The formatted string, or the original value if not a number/pattern.
 */
export function formatNumberValue(value: number | string | boolean | null | undefined, format: string): string {
  if (value === null || value === undefined) return '';
  if (format === 'General') return String(value);

  // Handle text format (@) — display raw value without numeric coercion
  if (isTextFormat(format)) {
    return String(value);
  }

  // Parse the numeric value
  let num: number;
  if (typeof value === 'boolean') {
    num = value ? 1 : 0;
  } else if (typeof value === 'number') {
    num = value;
  } else {
    num = parseFloat(value);
    if (isNaN(num)) return String(value); // Not a number, return as-is
  }

  // Handle accounting format
  if (isAccountingFormat(format)) {
    const core = extractAccountingCore(format);
    const decimals = countDecimalPlaces(core);
    const useThousands = hasThousandsSeparator(core);
    return formatAccounting(num, decimals, useThousands);
  }

  // Handle date/time formats using the new parser
  const dtParse = parseDateTimeFormat(format);
  if (dtParse.isDate || dtParse.isTime) {
    if (dtParse.isDate && dtParse.isTime) {
      // Combined date+time: format date portion with integer part, time portion with fractional
      const datePart = Math.floor(num);
      const timePart = num - datePart;
      const dateStr = formatDate(datePart, dtParse.dateTokens.join(''));
      const timeStr = formatTime(timePart, dtParse.timeTokens.join(''));
      return dateStr + timeStr;
    } else if (dtParse.isDate) {
      return formatDate(Math.floor(num), format);
    } else {
      return formatTime(num, format);
    }
  }

  const { core, prefix, suffix } = parseFormatSymbols(format);
  const decimals = countDecimalPlaces(core);
  const useThousands = hasThousandsSeparator(core);
  const isPercent = format.endsWith('%');

  // Apply percentage multiplier
  const adjustedNum = isPercent ? num * 100 : num;

  // Format the number
  let formatted: string;
  if (format.includes('E+') || format.includes('E-')) {
    // Scientific notation
    formatted = adjustedNum.toExponential(decimals);
    // Ensure the exponent has the right format
    formatted = formatted.replace('e', 'E').replace('E+', 'E+').replace('E-', 'E−');
  } else {
    formatted = adjustedNum.toFixed(decimals);
    // Add thousands separator
    if (useThousands) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }
  }

  return prefix + formatted + suffix;
}

/**
 * Formats a number as a date string.
 * Uses Excel's date epoch (day 1 = Jan 1, 1900).
 */
/**
 * Checks if a format string is a text format pattern (forces literal text display).
 * Text format: "@" or sectioned "@;@;@;@"
 */
export function isTextFormat(format: string): boolean {
  return TEXT_FORMAT_PATTERN.test(format);
}

/**
 * Parses an Excel date/time format string and classifies its components.
 * Returns an object describing what type(s) of formatting to apply.
 */
export function parseDateTimeFormat(format: string): {
  isDate: boolean;
  isTime: boolean;
  dateTokens: string[];
  timeTokens: string[];
  separator: string;
} {
  const lower = format.toLowerCase();
  const hasY = lower.includes('y');
  const hasD = lower.includes('d');
  const hasH = lower.includes('h');
  const hasM = lower.includes('m');
  const hasS = lower.includes('s');
  const hasAMPM = lower.includes('a') || lower.includes('p');

  // Date: has year or day markers
  const isDate = hasY || hasD;
  // Time: has hour or seconds markers (m is ambiguous — could be month or minutes)
  const isTime = hasH || hasS || (hasM && hasH) || hasAMPM;

  // Split date and time portions by finding the first time-only marker
  let datePortion = format;
  let timePortion = '';

  if (isDate && isTime) {
    // Combined date+time: split at first 'h' or 's' that signals time
    let timeStart = -1;
    for (let i = 0; i < lower.length; i++) {
      if (lower[i] === 'h' || lower[i] === 's') {
        timeStart = i;
        break;
      }
    }
    if (timeStart > 0) {
      // Include any separator before time (like a space)
      let splitIdx = timeStart;
      while (splitIdx > 0 && /[\s,]/.test(format[splitIdx - 1])) {
        splitIdx--;
      }
      datePortion = format.slice(0, splitIdx);
      timePortion = format.slice(splitIdx);
    }
  } else if (isTime) {
    datePortion = '';
    timePortion = format;
  }

  return {
    isDate,
    isTime,
    dateTokens: datePortion ? tokenizeFormat(datePortion) : [],
    timeTokens: timePortion ? tokenizeFormat(timePortion) : [],
    separator: '',
  };
}

/**
 * Tokenizes a date or time format string into individual formatting tokens.
 * e.g., "mm/dd/yyyy" → ["mm", "/", "dd", "/", "yyyy"]
 * e.g., "h:mm AM/PM" → ["h", ":", "mm", " ", "AM/PM"]
 */
function tokenizeFormat(format: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const lower = format.toLowerCase();

  while (i < format.length) {
    const ch = lower[i];

    // Multi-character tokens
    if (ch === 'y') {
      let count = 0;
      while (i < format.length && lower[i] === 'y') { count++; i++; }
      tokens.push('y'.repeat(count));
    } else if (ch === 'm') {
      let count = 0;
      while (i < format.length && lower[i] === 'm') { count++; i++; }
      tokens.push('m'.repeat(count));
    } else if (ch === 'd') {
      let count = 0;
      while (i < format.length && lower[i] === 'd') { count++; i++; }
      tokens.push('d'.repeat(count));
    } else if (ch === 'h') {
      let count = 0;
      while (i < format.length && lower[i] === 'h') { count++; i++; }
      tokens.push('h'.repeat(count));
    } else if (ch === 's') {
      let count = 0;
      while (i < format.length && lower[i] === 's') { count++; i++; }
      tokens.push('s'.repeat(count));
    } else if (ch === 'a' || ch === 'p') {
      // AM/PM indicator
      if (lower.slice(i, i + 5) === 'am/pm' || lower.slice(i, i + 5) === 'a/p') {
        tokens.push('AM/PM');
        i += 5;
      } else {
        tokens.push('AM/PM');
        i += 2; // 'am' or 'pm'
      }
    } else {
      // Separator character
      tokens.push(format[i]);
      i++;
    }
  }

  return tokens;
}

/**
 * Formats a date serial number using Excel date tokens.
 * Supports: YYYY, YY, MMMM, MMM, MM, M, DD, D
 */
export function formatDate(serialNumber: number, format: string): string {
  // Excel date epoch: Jan 1, 1900 = serial 1 (with the 1900 leap year bug)
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  const date = new Date(excelEpoch.getTime() + serialNumber * msPerDay);

  if (isNaN(date.getTime())) return String(serialNumber);

  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  const day = date.getDate();

  const tokens = tokenizeFormat(format);
  let result = '';

  for (const token of tokens) {
    switch (token.toLowerCase()) {
      case 'yyyy':
        result += String(year);
        break;
      case 'yy':
        result += String(year).slice(2);
        break;
      case 'mmmm':
        result += MONTH_NAMES_LONG[month];
        break;
      case 'mmm':
        result += MONTH_NAMES_SHORT[month];
        break;
      case 'mm':
        result += String(month + 1).padStart(2, '0');
        break;
      case 'm':
        result += String(month + 1);
        break;
      case 'dd':
        result += String(day).padStart(2, '0');
        break;
      case 'd':
        result += String(day);
        break;
      default:
        // Separator or unknown token - pass through as-is
        result += token;
        break;
    }
  }

  return result;
}

/**
 * Formats a fractional day as time using Excel time tokens.
 * Supports: HH, H, hh, h, mm, m, ss, s, AM/PM
 */
export function formatTime(serialNumber: number, format: string): string {
  // Serial number represents fraction of a day (0.5 = noon)
  const totalSeconds = Math.round(serialNumber * 86400) % 86400;
  const hours24 = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Handle AM/PM: determine if 12-hour format is needed
  const is12Hour = format.toLowerCase().includes('am/pm') ||
    format.toLowerCase().includes('a/p');

  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const isPM = hours24 >= 12;

  const tokens = tokenizeFormat(format);
  let result = '';

  for (const token of tokens) {
    switch (token.toLowerCase()) {
      case 'hh':
        result += String(is12Hour ? hours12 : hours24).padStart(2, '0');
        break;
      case 'h':
        result += String(is12Hour ? hours12 : hours24);
        break;
      case 'mm':
        result += String(minutes).padStart(2, '0');
        break;
      case 'm':
        result += String(minutes);
        break;
      case 'ss':
        result += String(seconds).padStart(2, '0');
        break;
      case 's':
        result += String(seconds);
        break;
      case 'am/pm':
        result += isPM ? 'PM' : 'AM';
        break;
      default:
        result += token;
        break;
    }
  }

  return result;
}

/**
 * Determines if a value looks numeric (can be formatted with a number format).
 */
export function isNumericValue(value: unknown): boolean {
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    return value.trim() !== '' && !isNaN(parseFloat(value)) && isFinite(Number(value));
  }
  return false;
}

/** Known time-only format patterns (for fast lookup). */
const TIME_FORMATS_LOWER = ['hh:mm:ss', 'hh:mm', 'h:mm:ss', 'h:mm', 'h:mm am/pm', 'h:mm:ss am/pm'];

/** Known date-only format patterns (for fast lookup). */
const DATE_FORMATS_LOWER = [
  'mm/dd/yyyy', 'mm/dd/yy', 'yyyy-mm-dd', 'dd/mm/yyyy', 'dd-mmm-yyyy', 'mmm-yyyy',
  'dd-mmm-yy', 'mmmm d, yyyy', 'dd-mmmm-yyyy', 'mmmm-yyyy',
];

/**
 * Checks if a format string is a date format pattern.
 * Supports extended date formats (MM/DD/YYYY, DD-MMM-YY, MMMM D, YYYY, etc.)
 */
export function isDateFormat(format: string): boolean {
  const lower = format.toLowerCase().trim();
  // Fast lookup for known patterns
  if (DATE_FORMATS_LOWER.includes(lower)) return true;

  // Heuristic: contains 'y' (year) or 'd' (day) markers
  if (/[yd]/.test(lower)) {
    // Must not be a pure time format (no 'h' or 's')
    if (!/[hs]/.test(lower)) return true;
    // Combined date+time: contains both date and time markers
    if (/[hs]/.test(lower)) return true;
  }
  return false;
}

/**
 * Checks if a format string is a time format pattern.
 * Supports extended time formats (HH:MM, H:MM AM/PM, etc.)
 */
export function isTimeFormat(format: string): boolean {
  const lower = format.toLowerCase().trim();
  // Fast lookup for known patterns
  if (TIME_FORMATS_LOWER.includes(lower)) return true;

  // Heuristic: contains 'h' (hour) or 's' (seconds) or AM/PM marker
  if (/[hs]/.test(lower) || lower.includes('am/pm') || lower.includes('a/p')) {
    return true;
  }
  return false;
}

/**
 * Determines if a cell should be automatically right-aligned.
 * In spreadsheets, numbers, dates, and times are right-aligned by default.
 * Returns false if the user has explicitly set a text alignment.
 */
export function shouldRightAlign(cell: {
  rawValue: string;
  computedValue?: string | number | boolean | null;
  style?: { textAlign?: string; numberFormat?: string };
} | undefined): boolean {
  if (!cell) return false;

  // If user explicitly set alignment, respect their choice
  if (cell.style?.textAlign) return false;

  // Text format (@) — always left-aligned (text is left-aligned by default)
  const format = cell.style?.numberFormat;
  if (format && isTextFormat(format)) {
    return false;
  }

  // Check if the numberFormat is a date, time, or accounting format
  if (format && (isDateFormat(format) || isTimeFormat(format) || isAccountingFormat(format))) {
    return true;
  }

  // Check if the value is numeric (numbers are right-aligned by default)
  const value = cell.computedValue !== undefined && cell.computedValue !== null
    ? cell.computedValue
    : cell.rawValue;

  return isNumericValue(value);
}
