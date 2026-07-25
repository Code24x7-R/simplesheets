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
 * - "0%" → percentage (×100, no decimals)
 * - "0.00%" → percentage with 2 decimals
 * - "0.00E+00" → scientific notation
 * - "mm/dd/yyyy" → date
 * - "hh:mm:ss" → time
 */

/** Regex to detect a number format pattern (contains digits, #, 0, dots, commas). */
const NUMBER_FORMAT_PATTERN = /[0#.,%$E+-]/;

/**
 * Checks if a format string is a number format pattern.
 */
export function isNumberFormat(format: string): boolean {
  if (format === 'General') return false;
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

  // Handle date/time formats
  if (format === 'mm/dd/yyyy' || format === 'mm/dd/yy' || format === 'yyyy-mm-dd') {
    return formatDate(num, format);
  }
  if (format === 'hh:mm:ss' || format === 'hh:mm') {
    return formatTime(num, format);
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
function formatDate(serialNumber: number, format: string): string {
  // Excel date epoch: Jan 1, 1900 = serial 1 (with the 1900 leap year bug)
  // Dec 30, 1899 is day 0; day 1 = Dec 31, 1899; day 2 = Jan 1, 1900
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  const date = new Date(excelEpoch.getTime() + serialNumber * msPerDay);

  if (isNaN(date.getTime())) return String(serialNumber);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (format === 'yyyy-mm-dd') {
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  // mm/dd/yyyy or mm/dd/yy
  if (format.includes('yy') && !format.includes('yyyy')) {
    return `${pad(month)}/${pad(day)}/${String(year).slice(2)}`;
  }
  return `${pad(month)}/${pad(day)}/${year}`;
}

/**
 * Formats a number as a time string.
 */
function formatTime(serialNumber: number, format: string): string {
  // Serial number represents fraction of a day (0.5 = noon)
  const totalSeconds = Math.round(serialNumber * 86400);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (format === 'hh:mm') {
    return `${pad(hours)}:${pad(minutes)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
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
