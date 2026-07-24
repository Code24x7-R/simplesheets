/**
 * Formula Auto-Complete for SimpleSheet
 *
 * Provides function name matching and signature information
 * for the auto-complete dropdown in the formula bar.
 */

/** Information about a spreadsheet function. */
export interface FunctionInfo {
  /** Function name (uppercase). */
  name: string;
  /** Short description of what the function does. */
  description: string;
  /** Signature showing parameters. */
  signature: string;
  /** Category for grouping. */
  category: string;
}

/** All supported functions with their documentation. */
const FUNCTION_CATALOG: FunctionInfo[] = [
  // Math
  { name: 'SUM', description: 'Adds all numbers in a range', signature: 'SUM(number1, [number2], ...)', category: 'Math' },
  { name: 'AVERAGE', description: 'Returns the average of a range', signature: 'AVERAGE(number1, [number2], ...)', category: 'Math' },
  { name: 'COUNT', description: 'Counts numbers in a range', signature: 'COUNT(value1, [value2], ...)', category: 'Math' },
  { name: 'COUNTA', description: 'Counts non-empty cells', signature: 'COUNTA(value1, [value2], ...)', category: 'Math' },
  { name: 'COUNTBLANK', description: 'Counts empty cells in a range', signature: 'COUNTBLANK(range)', category: 'Math' },
  { name: 'MIN', description: 'Returns the smallest number', signature: 'MIN(number1, [number2], ...)', category: 'Math' },
  { name: 'MAX', description: 'Returns the largest number', signature: 'MAX(number1, [number2], ...)', category: 'Math' },
  { name: 'PRODUCT', description: 'Multiplies all numbers', signature: 'PRODUCT(number1, [number2], ...)', category: 'Math' },
  { name: 'ABS', description: 'Absolute value', signature: 'ABS(number)', category: 'Math' },
  { name: 'ROUND', description: 'Rounds to specified digits', signature: 'ROUND(number, digits)', category: 'Math' },
  { name: 'ROUNDUP', description: 'Rounds up away from zero', signature: 'ROUNDUP(number, digits)', category: 'Math' },
  { name: 'ROUNDDOWN', description: 'Rounds down toward zero', signature: 'ROUNDDOWN(number, digits)', category: 'Math' },
  { name: 'SQRT', description: 'Square root', signature: 'SQRT(number)', category: 'Math' },
  { name: 'POWER', description: 'Number raised to a power', signature: 'POWER(base, exponent)', category: 'Math' },
  { name: 'MOD', description: 'Remainder after division', signature: 'MOD(dividend, divisor)', category: 'Math' },
  { name: 'INT', description: 'Rounds down to nearest integer', signature: 'INT(number)', category: 'Math' },
  { name: 'FLOOR', description: 'Rounds down to multiple', signature: 'FLOOR(number, multiple)', category: 'Math' },
  { name: 'CEILING', description: 'Rounds up to multiple', signature: 'CEILING(number, multiple)', category: 'Math' },
  { name: 'EXP', description: 'e raised to a power', signature: 'EXP(number)', category: 'Math' },
  { name: 'LN', description: 'Natural logarithm', signature: 'LN(number)', category: 'Math' },
  { name: 'LOG', description: 'Logarithm with base', signature: 'LOG(number, [base])', category: 'Math' },
  { name: 'LOG10', description: 'Base-10 logarithm', signature: 'LOG10(number)', category: 'Math' },
  { name: 'PI', description: 'Returns π (3.14159...)', signature: 'PI()', category: 'Math' },
  { name: 'RAND', description: 'Random number between 0 and 1', signature: 'RAND()', category: 'Math' },
  { name: 'RANDBETWEEN', description: 'Random integer in range', signature: 'RANDBETWEEN(bottom, top)', category: 'Math' },
  { name: 'SIGN', description: 'Sign of a number (-1, 0, 1)', signature: 'SIGN(number)', category: 'Math' },
  { name: 'TRUNC', description: 'Truncates to integer', signature: 'TRUNC(number, [digits])', category: 'Math' },

  // Trigonometry
  { name: 'SIN', description: 'Sine of an angle (radians)', signature: 'SIN(angle)', category: 'Trigonometry' },
  { name: 'COS', description: 'Cosine of an angle (radians)', signature: 'COS(angle)', category: 'Trigonometry' },
  { name: 'TAN', description: 'Tangent of an angle (radians)', signature: 'TAN(angle)', category: 'Trigonometry' },
  { name: 'ASIN', description: 'Arcsine (result in radians)', signature: 'ASIN(number)', category: 'Trigonometry' },
  { name: 'ACOS', description: 'Arccosine (result in radians)', signature: 'ACOS(number)', category: 'Trigonometry' },
  { name: 'ATAN', description: 'Arctangent (result in radians)', signature: 'ATAN(number)', category: 'Trigonometry' },
  { name: 'ATAN2', description: 'Arctangent of x/y', signature: 'ATAN2(x, y)', category: 'Trigonometry' },
  { name: 'DEGREES', description: 'Converts radians to degrees', signature: 'DEGREES(radians)', category: 'Trigonometry' },
  { name: 'RADIANS', description: 'Converts degrees to radians', signature: 'RADIANS(degrees)', category: 'Trigonometry' },

  // Logic
  { name: 'IF', description: 'Conditional: if true then A else B', signature: 'IF(condition, trueVal, [falseVal])', category: 'Logic' },
  { name: 'AND', description: 'True if all conditions are true', signature: 'AND(cond1, [cond2], ...)', category: 'Logic' },
  { name: 'OR', description: 'True if any condition is true', signature: 'OR(cond1, [cond2], ...)', category: 'Logic' },
  { name: 'NOT', description: 'Reverses a logical value', signature: 'NOT(condition)', category: 'Logic' },
  { name: 'XOR', description: 'Exclusive OR', signature: 'XOR(cond1, [cond2], ...)', category: 'Logic' },
  { name: 'IFERROR', description: 'Returns value if no error, else alt', signature: 'IFERROR(value, altValue)', category: 'Logic' },
  { name: 'IFNA', description: 'Returns value if not #N/A, else alt', signature: 'IFNA(value, altValue)', category: 'Logic' },
  { name: 'SWITCH', description: 'Matches expression to cases', signature: 'SWITCH(expr, val1, result1, ...)', category: 'Logic' },
  { name: 'ISBLANK', description: 'True if cell is empty', signature: 'ISBLANK(value)', category: 'Logic' },
  { name: 'ISERROR', description: 'True if value is an error', signature: 'ISERROR(value)', category: 'Logic' },
  { name: 'ISNUMBER', description: 'True if value is a number', signature: 'ISNUMBER(value)', category: 'Logic' },
  { name: 'ISTEXT', description: 'True if value is text', signature: 'ISTEXT(value)', category: 'Logic' },

  // Text
  { name: 'CONCAT', description: 'Joins text strings', signature: 'CONCAT(text1, [text2], ...)', category: 'Text' },
  { name: 'CONCATENATE', description: 'Joins text strings (alias)', signature: 'CONCATENATE(text1, ...)', category: 'Text' },
  { name: 'LEFT', description: 'First N characters', signature: 'LEFT(text, [count])', category: 'Text' },
  { name: 'RIGHT', description: 'Last N characters', signature: 'RIGHT(text, [count])', category: 'Text' },
  { name: 'MID', description: 'Substring from position', signature: 'MID(text, start, count)', category: 'Text' },
  { name: 'LEN', description: 'Length of text', signature: 'LEN(text)', category: 'Text' },
  { name: 'LOWER', description: 'Converts to lowercase', signature: 'LOWER(text)', category: 'Text' },
  { name: 'UPPER', description: 'Converts to uppercase', signature: 'UPPER(text)', category: 'Text' },
  { name: 'PROPER', description: 'Capitalizes each word', signature: 'PROPER(text)', category: 'Text' },
  { name: 'TRIM', description: 'Removes extra whitespace', signature: 'TRIM(text)', category: 'Text' },
  { name: 'TEXT', description: 'Formats a number as text', signature: 'TEXT(number, format)', category: 'Text' },
  { name: 'VALUE', description: 'Converts text to number', signature: 'VALUE(text)', category: 'Text' },
  { name: 'REPT', description: 'Repeats text N times', signature: 'REPT(text, count)', category: 'Text' },
  { name: 'REPLACE', description: 'Replaces part of text', signature: 'REPLACE(old, start, count, new)', category: 'Text' },
  { name: 'SUBSTITUTE', description: 'Replaces substring', signature: 'SUBSTITUTE(text, old, new, [nth])', category: 'Text' },
  { name: 'FIND', description: 'Finds text (case-sensitive)', signature: 'FIND(needle, haystack, [start])', category: 'Text' },
  { name: 'SEARCH', description: 'Finds text (case-insensitive)', signature: 'SEARCH(needle, haystack, [start])', category: 'Text' },

  // Statistical
  { name: 'MEDIAN', description: 'Middle value in a set', signature: 'MEDIAN(number1, ...)', category: 'Statistical' },
  { name: 'MODE', description: 'Most frequent value', signature: 'MODE(number1, ...)', category: 'Statistical' },
  { name: 'STDEV', description: 'Standard deviation', signature: 'STDEV(number1, ...)', category: 'Statistical' },
  { name: 'VAR', description: 'Variance', signature: 'VAR(number1, ...)', category: 'Statistical' },
  { name: 'LARGE', description: 'K-th largest value', signature: 'LARGE(range, k)', category: 'Statistical' },
  { name: 'SMALL', description: 'K-th smallest value', signature: 'SMALL(range, k)', category: 'Statistical' },
  { name: 'RANK', description: 'Rank of a number in a set', signature: 'RANK(number, range, [order])', category: 'Statistical' },
  { name: 'QUARTILE', description: 'Quartile of a data set', signature: 'QUARTILE(range, quart)', category: 'Statistical' },
  { name: 'PERCENTILE', description: 'Percentile of a data set', signature: 'PERCENTILE(range, k)', category: 'Statistical' },

  // Conditional aggregation
  { name: 'SUMIF', description: 'Sum cells matching criteria', signature: 'SUMIF(range, criteria, [sumRange])', category: 'Conditional' },
  { name: 'COUNTIF', description: 'Count cells matching criteria', signature: 'COUNTIF(range, criteria)', category: 'Conditional' },
  { name: 'AVERAGEIF', description: 'Average of cells matching criteria', signature: 'AVERAGEIF(range, criteria, [avgRange])', category: 'Conditional' },
  { name: 'SUMIFS', description: 'Sum with multiple criteria', signature: 'SUMIFS(sumRange, critRange1, crit1, ...)', category: 'Conditional' },
  { name: 'COUNTIFS', description: 'Count with multiple criteria', signature: 'COUNTIFS(critRange1, crit1, ...)', category: 'Conditional' },
  { name: 'AVERAGEIFS', description: 'Average with multiple criteria', signature: 'AVERAGEIFS(avgRange, critRange1, crit1, ...)', category: 'Conditional' },

  // Date
  { name: 'NOW', description: 'Current date and time', signature: 'NOW()', category: 'Date' },
  { name: 'TODAY', description: 'Current date', signature: 'TODAY()', category: 'Date' },
  { name: 'YEAR', description: 'Year from a date', signature: 'YEAR(date)', category: 'Date' },
  { name: 'MONTH', description: 'Month from a date', signature: 'MONTH(date)', category: 'Date' },
  { name: 'DAY', description: 'Day from a date', signature: 'DAY(date)', category: 'Date' },
  { name: 'HOUR', description: 'Hour from a time', signature: 'HOUR(time)', category: 'Date' },
  { name: 'MINUTE', description: 'Minute from a time', signature: 'MINUTE(time)', category: 'Date' },
  { name: 'SECOND', description: 'Second from a time', signature: 'SECOND(time)', category: 'Date' },
  { name: 'DATE', description: 'Creates a date', signature: 'DATE(year, month, day)', category: 'Date' },
  { name: 'DATEDIF', description: 'Difference between dates', signature: 'DATEDIF(start, end, unit)', category: 'Date' },
  { name: 'EDATE', description: 'Date N months before/after', signature: 'EDATE(start, months)', category: 'Date' },
  { name: 'EOMONTH', description: 'Last day of month', signature: 'EOMONTH(start, months)', category: 'Date' },
  { name: 'WEEKDAY', description: 'Day of week (1-7)', signature: 'WEEKDAY(date, [type])', category: 'Date' },
  { name: 'NETWORKDAYS', description: 'Working days between dates', signature: 'NETWORKDAYS(start, end, [holidays])', category: 'Date' },

  // Info
  { name: 'ROW', description: 'Row number of a cell', signature: 'ROW([cell])', category: 'Info' },
  { name: 'COLUMNS', description: 'Number of columns in range', signature: 'COLUMNS(range)', category: 'Info' },
  { name: 'ROWS', description: 'Number of rows in range', signature: 'ROWS(range)', category: 'Info' },
  { name: 'COLUMN', description: 'Column number of a cell', signature: 'COLUMN([cell])', category: 'Info' },

  // Lookup
  { name: 'VLOOKUP', description: 'Vertical lookup in a table', signature: 'VLOOKUP(value, table, col, [exact])', category: 'Lookup' },
  { name: 'HLOOKUP', description: 'Horizontal lookup in a table', signature: 'HLOOKUP(value, table, row, [exact])', category: 'Lookup' },
  { name: 'INDEX', description: 'Value at row/col in range', signature: 'INDEX(range, row, [col])', category: 'Lookup' },
  { name: 'MATCH', description: 'Position of value in range', signature: 'MATCH(value, range, [type])', category: 'Lookup' },
  { name: 'OFFSET', description: 'Range offset from a cell', signature: 'OFFSET(cell, rows, cols, [h], [w])', category: 'Lookup' },
  { name: 'INDIRECT', description: 'Reference from text string', signature: 'INDIRECT(refText)', category: 'Lookup' },
];

/** Map for O(1) lookup by name. */
const FUNCTION_MAP = new Map<string, FunctionInfo>();
for (const fn of FUNCTION_CATALOG) {
  FUNCTION_MAP.set(fn.name, fn);
}

/**
 * Searches for functions matching a partial name.
 * @param partial - The partial function name typed by the user (e.g., "SU").
 * @param limit - Maximum number of results to return.
 * @returns Array of matching FunctionInfo, sorted by relevance.
 */
export function searchFunctions(partial: string, limit = 8): FunctionInfo[] {
  if (!partial || partial.length === 0) {
    return FUNCTION_CATALOG.slice(0, limit);
  }

  const upper = partial.toUpperCase();

  // Exact prefix matches first
  const prefixMatches = FUNCTION_CATALOG.filter((fn) => fn.name.startsWith(upper));

  // Then substring matches
  const substringMatches = FUNCTION_CATALOG.filter(
    (fn) => !fn.name.startsWith(upper) && fn.name.includes(upper)
  );

  // Then description matches
  const descMatches = FUNCTION_CATALOG.filter(
    (fn) => !fn.name.includes(upper) && fn.description.toUpperCase().includes(upper)
  );

  return [...prefixMatches, ...substringMatches, ...descMatches].slice(0, limit);
}

/**
 * Gets function info by exact name.
 * @param name - Function name (case-insensitive).
 * @returns FunctionInfo or null if not found.
 */
export function getFunctionInfo(name: string): FunctionInfo | null {
  return FUNCTION_MAP.get(name.toUpperCase()) ?? null;
}

/**
 * Returns all function names (for testing).
 */
export function getAllFunctionNames(): string[] {
  return FUNCTION_CATALOG.map((fn) => fn.name);
}

/**
 * Returns the total number of documented functions.
 */
export function getFunctionCount(): number {
  return FUNCTION_CATALOG.length;
}
