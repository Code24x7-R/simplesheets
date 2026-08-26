// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Formula Evaluator & Dependency Graph
 *
 * Evaluates parsed formula ASTs against a sheet's cell data.
 * Builds a dependency graph for change propagation and circular reference detection.
 */

import type { Sheet, Cell } from '../types';
import { cellKey } from '../types';
import { parseFormula, extractCellRefs, type ASTNode } from './formulaParser';
import { resolveNameToAST, buildNamedRangeMap } from './namedRangeUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Sentinel values for special error/empty states. */
export const ERR_CIRCULAR = '#CIRC!';
export const ERR_DIV_ZERO = '#DIV/0!';
export const ERR_VALUE = '#VALUE!';
export const ERR_NAME = '#NAME?';
export const ERR_REF = '#REF!';
export const ERR_NA = '#N/A';

type CellValue = string | number | boolean | null;

/** Maps a cell key to the set of cells it depends on (for propagation). */
type DependencyGraph = Map<string, Set<string>>;

/** Maps a cell key to the set of cells that depend on it (reverse deps). */
type ReverseDeps = Map<string, Set<string>>;

// ─── Evaluation Context ──────────────────────────────────────────────────────

interface EvalContext {
  /** Cells available for reference (current sheet). */
  cells: Record<string, Cell>;
  /** All sheets in the workbook (for cross-sheet references). */
  allSheets: Sheet[];
  /** Index of the currently evaluating sheet. */
  activeSheetIndex: number;
  /** Cache of computed results. */
  cache: Map<string, CellValue>;
  /** Current evaluation stack (for circular reference detection). */
  evalStack: Set<string>;
  /** Sheet dimensions (for bounds checking). */
  rowCount: number;
  colCount: number;
  /** Hidden rows for SUBTOTAL visibility filtering. */
  hiddenRows?: Set<number>;
  /** Named ranges lookup map (case-insensitive name → NamedRange). */
  namedRanges: Map<string, import('../types').NamedRange>;
  /** Sheet ID of the currently evaluating sheet (for sheet-scoped names). */
  activeSheetId: string;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Coerces a value to a number for arithmetic.
 * Returns NaN if coercion fails.
 */
function toNumber(val: CellValue): number {
  if (val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const n = parseFloat(val);
  return isNaN(n) ? NaN : n;
}

/**
 * Coerces a value to a string for concatenation.
 */
function toString(val: CellValue): string {
  if (val === null) return '';
  return String(val);
}

/**
 * Determines if a string value is an error code.
 */
function isError(val: CellValue): boolean {
  return typeof val === 'string' && val.startsWith('#') && val.endsWith('!');
}

// ─── AST Evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluates a single AST node in the given context.
 */
/**
 * Resolves a sheet name to its index in the workbook.
 * Returns undefined for same-sheet references (no sheetName).
 */
function resolveSheetIndex(sheetName: string | undefined, ctx: EvalContext): number | undefined {
  if (!sheetName) return undefined;
  const idx = ctx.allSheets.findIndex((s) => s.name === sheetName);
  return idx >= 0 ? idx : undefined;
}

/**
 * Evaluates SUBTOTAL, skipping hidden rows (codes 101-111) and nested SUBTOTAL formulas.
 */
function evaluateSubtotal(node: Extract<ASTNode, { type: 'function' }>, ctx: EvalContext): CellValue {
  const rawCode = toNumber(evaluateNode(node.args[0], ctx));
  if (isNaN(rawCode)) return ERR_VALUE;
  // Excel codes: 1-11 include hidden rows, 101-111 ignore them
  const ignoreHidden = rawCode >= 101;
  const code = ignoreHidden ? rawCode - 100 : rawCode;
  if (code < 1 || code > 11) return ERR_VALUE;

  const values: number[] = [];
  for (let i = 1; i < node.args.length; i++) {
    const arg = node.args[i];
    if (arg.type === 'range') {
      const minRow = Math.min(arg.start.row, arg.end.row);
      const maxRow = Math.max(arg.start.row, arg.end.row);
      const minCol = Math.min(arg.start.col, arg.end.col);
      const maxCol = Math.max(arg.start.col, arg.end.col);
      const sheetIdx = resolveSheetIndex(arg.sheetName, ctx);
      if (arg.sheetName && sheetIdx === undefined) return ERR_REF;
      for (let r = minRow; r <= maxRow; r++) {
        if (ignoreHidden && ctx.hiddenRows?.has(r)) continue;
        for (let c = minCol; c <= maxCol; c++) {
          const sheet = ctx.allSheets[sheetIdx ?? ctx.activeSheetIndex];
          const cell = sheet?.cells[cellKey(r, c)];
          if (cell?.rawValue.startsWith('=SUBTOTAL')) continue;
          const val = evaluateCell(r, c, ctx, sheetIdx);
          const num = toNumber(val);
          if (!isNaN(num)) values.push(num);
        }
      }
    } else {
      const num = toNumber(evaluateNode(arg, ctx));
      if (!isNaN(num)) values.push(num);
    }
  }

  if (values.length === 0) return ERR_VALUE;
  return applySubtotalOp(code, values);
}

/**
 * Applies a SUBTOTAL operation code (1-11) to a set of values.
 */
function applySubtotalOp(code: number, values: number[]): CellValue {
  if (values.length === 0) return ERR_VALUE;
  switch (code) {
    case 1: // AVERAGE
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 2: // COUNT
      return values.length;
    case 3: // COUNTA
      return values.length;
    case 4: // MAX
      return Math.max(...values);
    case 5: // MIN
      return Math.min(...values);
    case 6: // PRODUCT
      return values.reduce((a, b) => a * b, 1);
    case 7: {
      // STDEV
      if (values.length < 2) return ERR_VALUE;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (values.length - 1);
      return Math.sqrt(variance);
    }
    case 8: {
      // STDEVP (population)
      if (values.length < 2) return ERR_VALUE;
      const mean2 = values.reduce((a, b) => a + b, 0) / values.length;
      const variance2 = values.reduce((sum, n) => sum + (n - mean2) ** 2, 0) / values.length;
      return Math.sqrt(variance2);
    }
    case 9: // SUM
      return values.reduce((a, b) => a + b, 0);
    case 10: {
      // VAR
      if (values.length < 2) return ERR_VALUE;
      const mean3 = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((sum, n) => sum + (n - mean3) ** 2, 0) / (values.length - 1);
    }
    case 11: {
      // VARP (population)
      if (values.length < 2) return ERR_VALUE;
      const mean4 = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((sum, n) => sum + (n - mean4) ** 2, 0) / values.length;
    }
    default:
      return ERR_VALUE;
  }
}


function evaluateNode(node: ASTNode, ctx: EvalContext): CellValue {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'string':
      return node.value;

    case 'boolean':
      return node.value;

    case 'cell': {
      const sheetIdx = resolveSheetIndex(node.sheetName, ctx);
      // If a sheet name was specified but not found, return #REF!
      if (node.sheetName && sheetIdx === undefined) return ERR_REF;
      return evaluateCell(node.row, node.col, ctx, sheetIdx);
    }

    /* istanbul ignore next - bare range not valid as value */
    case 'range':
      return ERR_REF;

    /* istanbul ignore next - bare sheet_range not valid as value outside function */
    case 'sheet_range':
      return ERR_REF;

    case 'binary':
      return evaluateBinary(node, ctx);

    case 'unary': {
      const val = evaluateNode(node.operand, ctx);
      if (isError(val)) return val;
      const num = toNumber(val);
      if (isNaN(num)) return ERR_VALUE;
      return node.op === '-' ? -num : num;
    }

    case 'function':
      return evaluateFunction(node, ctx);

    case 'name_ref': {
      // Resolve the named range to its underlying cell/range AST and evaluate that.
      const resolved = resolveNameToAST(node.name, ctx.namedRanges, ctx.activeSheetId);
      if (!resolved) return ERR_NAME;
      // If the name refers to a range, return #REF! when used as a scalar
      // (same behavior as a bare range reference). Functions handle ranges specially.
      if (resolved.type === 'range') return ERR_REF;
      return evaluateNode(resolved, ctx);
    }

    /* istanbul ignore next - all AST node types handled above */
    default:
      return ERR_VALUE;
  }
}

/**
 * Evaluates a cell reference, handling caching and circular detection.
 */
function evaluateCell(row: number, col: number, ctx: EvalContext, sheetIndex?: number): CellValue {
  // Resolve the target sheet (for cross-sheet references)
  const targetIndex = sheetIndex ?? ctx.activeSheetIndex;
  const targetSheet = ctx.allSheets[targetIndex];
  /* istanbul ignore next - invalid sheet index guard */
  if (!targetSheet) return ERR_REF;

  // Bounds check against the target sheet dimensions
  if (row < 0 || row >= targetSheet.rowCount || col < 0 || col >= targetSheet.columnCount) {
    return ERR_REF;
  }

  const key = cellKey(row, col);

  // Always scope the cache key by sheet index to prevent cross-sheet
  // pollution when the shared cache is used across multiple sheets.
  const cacheKey = `${targetIndex}:${key}`;
  if (ctx.cache.has(cacheKey)) {
    return ctx.cache.get(cacheKey)!;
  }

  /* istanbul ignore next - circular reference detection */
  if (ctx.evalStack.has(cacheKey)) {
    return ERR_CIRCULAR;
  }

  const cell = targetSheet.cells[key];
  if (!cell) return null;

  // If it's a formula, evaluate it
  if (cell.rawValue.startsWith('=')) {
    ctx.evalStack.add(cacheKey);
    try {
      const ast = parseFormula(cell.rawValue.slice(1));
      // Create a sub-context for evaluating the other sheet's formula
      const subCtx: EvalContext = {
        ...ctx,
        cells: targetSheet.cells,
        rowCount: targetSheet.rowCount,
        colCount: targetSheet.columnCount,
        activeSheetIndex: targetIndex,
        activeSheetId: targetSheet.id,
      };
      const result = evaluateNode(ast, subCtx);
      ctx.cache.set(cacheKey, result);
      return result;
    } catch {
      /* istanbul ignore next - parse error fallback */
      ctx.cache.set(cacheKey, ERR_VALUE);
      /* istanbul ignore next - parse error fallback */
      return ERR_VALUE;
    } finally {
      ctx.evalStack.delete(cacheKey);
    }
  }

  // Literal value — try to auto-detect type
  const result = autoDetectType(cell.rawValue);
  ctx.cache.set(cacheKey, result);
  return result;
}

/**
 * Parses a date string with flexible separators (/ \ - .) into ISO format YYYY-MM-DD.
 * Supports: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy, dd.mm.yyyy, dd\mm\yyyy, etc.
 * Requires exactly 2 identical separators (2 dots, 2 slashes, 2 backslashes, or 2 dashes).
 * Returns null if the string is not a valid date.
 *
 * Ambiguous cases (where day ≤ 12) are treated as dd/mm/yyyy (Australian locale).
 */
export function parseDateInput(raw: string): string | null {
  const trimmed = raw.trim();

  // Match date patterns with flexible separators: / \ - .
  // Requires exactly 2 of the same separator (backreference \2 ensures consistency)
  // Hyphen at start of character class to avoid being interpreted as a range
  const match = trimmed.match(/^(\d{1,4})([-/\\.])(\d{1,4})\2(\d{1,4})$/);
  if (!match) return null;

  const part1 = match[1];
  const part2 = match[3];
  const part3 = match[4];

  let year: number, month: number, day: number;

  // Determine format based on part lengths
  if (part1.length === 4) {
    // yyyy-mm-dd or yyyy/mm/dd or yyyy.mm.dd
    year = parseInt(part1, 10);
    month = parseInt(part2, 10);
    day = parseInt(part3, 10);
  } else if (part3.length === 4) {
    // dd/mm/yyyy or mm/dd/yyyy (ambiguous when day ≤ 12)
    // Australian locale: treat as dd/mm/yyyy
    day = parseInt(part1, 10);
    month = parseInt(part2, 10);
    year = parseInt(part3, 10);
  } else if (part1.length <= 2 && part2.length <= 2 && part3.length === 2) {
    // 2-digit year: dd/mm/yy or mm/dd/yy — assume dd/mm/yy (Australian)
    day = parseInt(part1, 10);
    month = parseInt(part2, 10);
    year = parseInt(part3, 10);
    // Pivot: years 0-49 → 2000s, 50-99 → 1900s
    year = year <= 49 ? 2000 + year : 1900 + year;
  } else {
    return null;
  }

  // Validate ranges
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 9999) return null;

  // Validate day against month/year
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  // Return ISO format (sorts correctly as text)
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Auto-detects the type of a raw cell value.
 */
function autoDetectType(raw: string): CellValue {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // Boolean
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;

  // Number
  if (/^-?\d*\.?\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Date (flexible separators: dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy, etc.)
  const parsedDate = parseDateInput(trimmed);
  if (parsedDate) {
    return parsedDate;
  }

  // Default: string
  return raw;
}

/**
 * Evaluates a binary operation node.
 */
function evaluateBinary(node: Extract<ASTNode, { type: 'binary' }>, ctx: EvalContext): CellValue {
  // String concatenation
  if (node.op === '&') {
    const left = toString(evaluateNode(node.left, ctx));
    const right = toString(evaluateNode(node.right, ctx));
    return left + right;
  }

  const left = evaluateNode(node.left, ctx);
  const right = evaluateNode(node.right, ctx);

  // Propagate errors
  if (isError(left)) return left;
  if (isError(right)) return right;

  // Comparison operators
  if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
    return compareValues(left, right, node.op as '=' | '<>' | '<' | '>' | '<=' | '>=');
  }

  // Arithmetic
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);

  if (isNaN(leftNum) || isNaN(rightNum)) return ERR_VALUE;

  switch (node.op) {
    case '+': return leftNum + rightNum;
    case '-': return leftNum - rightNum;
    case '*': return leftNum * rightNum;
    case '/':
      if (rightNum === 0) return ERR_DIV_ZERO;
      return leftNum / rightNum;
    /* istanbul ignore next - all operators handled above */
    default:
      return ERR_VALUE;
  }
}

/**
 * Compares two values and returns a boolean.
 */
function compareValues(
  left: CellValue,
  right: CellValue,
  op: '=' | '<>' | '<' | '>' | '<=' | '>='
): boolean {
  // Try numeric comparison first
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);

  if (!isNaN(leftNum) && !isNaN(rightNum) && typeof left !== 'string' && typeof right !== 'string') {
    switch (op) {
      case '=': return leftNum === rightNum;
      case '<>': return leftNum !== rightNum;
      case '<': return leftNum < rightNum;
      case '>': return leftNum > rightNum;
      case '<=': return leftNum <= rightNum;
      case '>=': return leftNum >= rightNum;
    }
  }

  // String comparison
  const leftStr = toString(left);
  const rightStr = toString(right);

  switch (op) {
    case '=': return leftStr === rightStr;
    case '<>': return leftStr !== rightStr;
    case '<': return leftStr < rightStr;
    case '>': return leftStr > rightStr;
    case '<=': return leftStr <= rightStr;
    case '>=': return leftStr >= rightStr;
    /* istanbul ignore next - all operators handled above */
    default: return false;
  }
}

/**
 * Collects all cell values from a range node.
 */
export interface RangeData {
  /** Flattened cell values in row-major order. */
  values: CellValue[];
  /** Number of rows in the range. */
  rows: number;
  /** Number of columns in the range. */
  cols: number;
}

/**
 * Collects values from a 2D range, preserving dimensional information.
 * Used by VLOOKUP/HLOOKUP which need to know row/column structure.
 */
function collectRangeValuesWithShape(node: Extract<ASTNode, { type: 'range' }>, ctx: EvalContext): RangeData {
  const values: CellValue[] = [];
  const minRow = Math.min(node.start.row, node.end.row);
  const maxRow = Math.max(node.start.row, node.end.row);
  const minCol = Math.min(node.start.col, node.end.col);
  const maxCol = Math.max(node.start.col, node.end.col);
  const sheetIdx = resolveSheetIndex(node.sheetName, ctx);
  // If a sheet name was specified but not found, return #REF! for all cells
  /* istanbul ignore next - edge case: sheet name not found */
  if (node.sheetName && sheetIdx === undefined) {
    return { values: [ERR_REF], rows: 0, cols: 0 };
  }

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      values.push(evaluateCell(r, c, ctx, sheetIdx));
    }
  }

  return { values, rows, cols };
}

/**
 * Collects values from a 3D sheet range (Sheet1:Sheet3!A1).
 * Iterates over all sheets between startSheet and endSheet (inclusive)
 * and collects the cell value at the specified position from each.
 */
function collectSheetRangeValues(node: Extract<ASTNode, { type: 'sheet_range' }>, ctx: EvalContext): CellValue[] {
  const values: CellValue[] = [];
  // Find sheet indices for start and end sheets
  const startIdx = ctx.allSheets.findIndex((s) => s.name === node.startSheet);
  const endIdx = ctx.allSheets.findIndex((s) => s.name === node.endSheet);
  // If either sheet not found, return #REF!
  if (startIdx === -1 || endIdx === -1) return [ERR_REF];
  // Iterate from start to end (inclusive), handling either direction
  const step = startIdx <= endIdx ? 1 : -1;
  for (let idx = startIdx; step > 0 ? idx <= endIdx : idx >= endIdx; idx += step) {
    values.push(evaluateCell(node.cell.row, node.cell.col, ctx, idx));
  }
  return values;
}

// ── Helper: Convert Excel serial number to Date ─────────────────
function dateFromSerial(serial: number): Date {
  // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
  const excelEpoch = new Date(1899, 11, 30);
  const d = new Date(excelEpoch.getTime() + serial * 86400000);
  return d;
}

// ── Helper: Format a date using Excel-style format codes ────────
function formatDate(d: Date, fmt: string): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  const weekday = d.getDay();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  // Count consecutive format characters
  const countChars = (s: string, start: number, char: string): number => {
    let count = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === char) count++;
      else break;
    }
    return count;
  };

  let result = '';
  let i = 0;
  while (i < fmt.length) {
    const ch = fmt[i];
    if (ch === 'd') {
      const n = countChars(fmt, i, 'd');
      if (n <= 2) result += String(day).padStart(n, '0');
      else if (n === 3 || n >= 5) result += dayNamesShort[weekday]; // ddd or ddddd = abbreviated
      else result += dayNames[weekday]; // dddd = full
      i += n;
    } else if (ch === 'm') {
      const n = countChars(fmt, i, 'm');
      if (n <= 2) result += String(month + 1).padStart(n, '0');
      else if (n === 3 || n >= 5) result += monthNamesShort[month]; // mmm or mmmmm = abbreviated
      else result += monthNames[month]; // mmmm = full
      i += n;
    } else if (ch === 'y') {
      const n = countChars(fmt, i, 'y');
      if (n <= 2) result += String(year).slice(-2);
      else result += String(year).padStart(4, '0');
      i += n;
    } else if (ch === 'h') {
      const n = countChars(fmt, i, 'h');
      const h12 = hours % 12 || 12;
      result += String(h12).padStart(n, '0');
      i += n;
    } else if (ch === 'H') {
      const n = countChars(fmt, i, 'H');
      result += String(hours).padStart(n, '0');
      i += n;
    } else if (ch === 'M') {
      const n = countChars(fmt, i, 'M');
      result += String(minutes).padStart(n, '0');
      i += n;
    } else if (ch === 's') {
      const n = countChars(fmt, i, 's');
      result += String(seconds).padStart(n, '0');
      i += n;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

/**
 * Evaluates a function call node.
 */
function evaluateFunction(node: Extract<ASTNode, { type: 'function' }>, ctx: EvalContext): CellValue {
  // SUBTOTAL requires special handling: skip hidden rows and nested SUBTOTALs.
  // Must intercept before generic arg flattening to preserve row position info.
  if (node.name === 'SUBTOTAL') {
    return evaluateSubtotal(node, ctx);
  }

  // Collect argument values (handling ranges)
  const argValues: CellValue[][] = [];
  // Track shape of range arguments for VLOOKUP/HLOOKUP
  const argShapes: Array<RangeData | null> = [];

  for (const arg of node.args) {
    // Resolve named range references to their underlying cell/range AST first,
    // so they participate in range expansion just like direct range references.
    let resolvedArg = arg;
    if (arg.type === 'name_ref') {
      const resolved = resolveNameToAST(arg.name, ctx.namedRanges, ctx.activeSheetId);
      if (!resolved) {
        argValues.push([ERR_NAME]);
        argShapes.push(null);
        continue;
      }
      resolvedArg = resolved;
    }

    if (resolvedArg.type === 'range') {
      const shape = collectRangeValuesWithShape(resolvedArg as Extract<ASTNode, { type: 'range' }>, ctx);
      argValues.push(shape.values);
      argShapes.push(shape.rows > 0 && shape.cols > 0 ? shape : null);
    } else if (resolvedArg.type === 'sheet_range') {
      argValues.push(collectSheetRangeValues(resolvedArg as Extract<ASTNode, { type: 'sheet_range' }>, ctx));
      argShapes.push(null); // 3D ranges don't have simple shape
    } else {
      argValues.push([evaluateNode(resolvedArg, ctx)]);
      argShapes.push(null);
    }
  }

  // Flatten for aggregate functions
  const flatValues = argValues.flat().filter((v) => v !== null);

  // Helper: return the first error value if any (Excel error propagation)
  const firstError = flatValues.find((v) => typeof v === 'string' && v.startsWith('#'));

  // Helper: get the shape of argument at index (for lookup functions)
  const getArgShape = (idx: number): RangeData | null => argShapes[idx] ?? null;

  switch (node.name) {
    case 'SUM': {
      if (firstError) return firstError;
      let sum = 0;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n)) sum += n;
      }
      return sum;
    }

    case 'AVERAGE': {
      if (firstError) return firstError;
      let sum = 0;
      let count = 0;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n)) {
          sum += n;
          count++;
        }
      }
      if (count === 0) return ERR_DIV_ZERO;
      return sum / count;
    }

    case 'COUNT': {
      if (firstError) return firstError;
      let count = 0;
      for (const v of flatValues) {
        if (typeof v === 'number') count++;
      }
      return count;
    }

    case 'MIN': {
      if (firstError) return firstError;
      let min: number | null = null;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n) && (min === null || n < min)) min = n;
      }
      return min ?? 0;
    }

    case 'MAX': {
      if (firstError) return firstError;
      let max: number | null = null;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n) && (max === null || n > max)) max = n;
      }
      return max ?? 0;
    }

    case 'IF': {
      if (argValues.length < 2) return ERR_VALUE;
      const condition = argValues[0]?.[0];
      const truthy = condition === true || (typeof condition === 'number' && condition !== 0 && !isNaN(toNumber(condition)));
      if (truthy) return argValues[1]?.[0] ?? null;
      return argValues[2]?.[0] ?? false;
    }

    case 'ABS': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.abs(n);
    }

    case 'ROUND': {
      const n = toNumber(flatValues[0] ?? 0);
      const digits = toNumber(flatValues[1] ?? 0);
      if (isNaN(n)) return ERR_VALUE;
      const factor = Math.pow(10, digits);
      return Math.round(n * factor) / factor;
    }

    case 'SQRT': {
      const n = toNumber(flatValues[0] ?? 0);
      if (isNaN(n) || n < 0) return ERR_VALUE;
      return Math.sqrt(n);
    }

    case 'POWER': {
      const base = toNumber(flatValues[0] ?? 0);
      const exp = toNumber(flatValues[1] ?? 0);
      if (isNaN(base) || isNaN(exp)) return ERR_VALUE;
      return Math.pow(base, exp);
    }

    // ── Expanded Math ──────────────────────────────────────────────
    case 'PRODUCT': {
      let prod = 1;
      let hasValue = false;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n)) { prod *= n; hasValue = true; }
      }
      return hasValue ? prod : 0;
    }

    case 'ROUNDUP': {
      const n = toNumber(flatValues[0] ?? 0);
      const digits = toNumber(flatValues[1] ?? 0);
      if (isNaN(n)) return ERR_VALUE;
      const factor = Math.pow(10, digits);
      return Math.ceil(Math.abs(n) * factor) / factor * Math.sign(n);
    }

    case 'ROUNDDOWN': {
      const n = toNumber(flatValues[0] ?? 0);
      const digits = toNumber(flatValues[1] ?? 0);
      if (isNaN(n)) return ERR_VALUE;
      const factor = Math.pow(10, digits);
      return Math.floor(Math.abs(n) * factor) / factor * Math.sign(n);
    }

    case 'MOD': {
      const a = toNumber(flatValues[0] ?? 0);
      const b = toNumber(flatValues[1] ?? 1);
      if (isNaN(a) || isNaN(b) || b === 0) return ERR_DIV_ZERO;
      return a - b * Math.floor(a / b);
    }

    case 'INT': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.floor(n);
    }

    case 'FLOOR': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.floor(n);
    }

    case 'CEILING': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.ceil(n);
    }

    case 'EXP': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.exp(n);
    }

    case 'LN': {
      const n = toNumber(flatValues[0] ?? 1);
      if (isNaN(n) || n <= 0) return ERR_VALUE;
      return Math.log(n);
    }

    case 'LOG': {
      const n = toNumber(flatValues[0] ?? 1);
      const base = toNumber(flatValues[1] ?? 10);
      if (isNaN(n) || n <= 0 || isNaN(base) || base <= 0) return ERR_VALUE;
      return Math.log(n) / Math.log(base);
    }

    case 'LOG10': {
      const n = toNumber(flatValues[0] ?? 1);
      if (isNaN(n) || n <= 0) return ERR_VALUE;
      return Math.log10(n);
    }

    case 'PI':
      return Math.PI;

    case 'RAND':
      return Math.random();

    case 'RANDBETWEEN': {
      const low = Math.ceil(toNumber(flatValues[0] ?? 0));
      const high = Math.floor(toNumber(flatValues[1] ?? 0));
      return Math.floor(Math.random() * (high - low + 1)) + low;
    }

    case 'SIGN': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.sign(n);
    }

    case 'TRUNC': {
      const n = toNumber(flatValues[0] ?? 0);
      const digits = toNumber(flatValues[1] ?? 0);
      if (isNaN(n)) return ERR_VALUE;
      const factor = Math.pow(10, digits);
      return Math.trunc(n * factor) / factor;
    }

    // ── Trigonometry ───────────────────────────────────────────────
    case 'SIN': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.sin(n);
    }
    case 'COS': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.cos(n);
    }
    case 'TAN': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.tan(n);
    }
    case 'ASIN': {
      const n = toNumber(flatValues[0] ?? 0);
      if (isNaN(n) || Math.abs(n) > 1) return ERR_VALUE;
      return Math.asin(n);
    }
    case 'ACOS': {
      const n = toNumber(flatValues[0] ?? 0);
      if (isNaN(n) || Math.abs(n) > 1) return ERR_VALUE;
      return Math.acos(n);
    }
    case 'ATAN': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : Math.atan(n);
    }
    case 'ATAN2': {
      const x = toNumber(flatValues[0] ?? 0);
      const y = toNumber(flatValues[1] ?? 0);
      return isNaN(x) || isNaN(y) ? ERR_VALUE : Math.atan2(y, x);
    }
    case 'DEGREES': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : n * (180 / Math.PI);
    }
    case 'RADIANS': {
      const n = toNumber(flatValues[0] ?? 0);
      return isNaN(n) ? ERR_VALUE : n * (Math.PI / 180);
    }

    // ── Logic ─────────────────────────────────────────────────────
    case 'AND': {
      for (const v of flatValues) {
        if (v === false || v === 0 || toString(v).toUpperCase() === 'FALSE') return false;
      }
      return true;
    }

    case 'OR': {
      for (const v of flatValues) {
        if (v === true || (typeof v === 'number' && v !== 0)) return true;
        if (toString(v).toUpperCase() === 'TRUE') return true;
      }
      return false;
    }

    case 'NOT': {
      if (flatValues.length === 0) return ERR_VALUE;
      const v = flatValues[0];
      if (v === true) return false;
      if (v === false) return true;
      if (typeof v === 'number') return v === 0;
      return !(toString(v).toUpperCase() === 'TRUE');
    }

    case 'XOR': {
      let trueCount = 0;
      for (const v of flatValues) {
        if (v === true || (typeof v === 'number' && v !== 0 && !isNaN(toNumber(v)))) trueCount++;
        else if (toString(v).toUpperCase() === 'TRUE') trueCount++;
      }
      return trueCount % 2 === 1;
    }

    case 'IFERROR': {
      const val = flatValues[0];
      const fallback = flatValues[1] ?? '';
      if (isError(val)) return fallback;
      return val;
    }

    case 'IFNA': {
      const val = flatValues[0];
      const fallback = flatValues[1] ?? '';
      if (val === '#N/A' || isError(val)) return fallback;
      return val;
    }

    /* istanbul ignore next - parser treats TRUE/FALSE as boolean literals, not function calls */
    case 'TRUE':
      return true;
    /* istanbul ignore next - parser treats TRUE/FALSE as boolean literals, not function calls */
    case 'FALSE':
      return false;

    case 'SWITCH': {
      if (flatValues.length < 2) return ERR_VALUE;
      const expr = flatValues[0];
      for (let i = 1; i < flatValues.length - 1; i += 2) {
        if (toString(expr) === toString(flatValues[i])) {
          return flatValues[i + 1] ?? null;
        }
      }
      return flatValues[flatValues.length - 1];
    }

    case 'ISBLANK':
      return flatValues.length === 0 || flatValues[0] === null || flatValues[0] === '';
    case 'ISERROR':
      return flatValues.length > 0 && isError(flatValues[0]);
    case 'ISNUMBER':
      return flatValues.length > 0 && typeof flatValues[0] === 'number';
    case 'ISTEXT':
      return flatValues.length > 0 && typeof flatValues[0] === 'string' && !isError(flatValues[0]);

    // ── Text ──────────────────────────────────────────────────────
    case 'CONCAT':
    case 'CONCATENATE': {
      return flatValues.map(v => toString(v)).join('');
    }

    case 'LEFT': {
      const str = toString(flatValues[0] ?? '');
      const chars = toNumber(flatValues[1] ?? 1);
      return str.slice(0, Math.max(0, chars));
    }

    case 'RIGHT': {
      const str = toString(flatValues[0] ?? '');
      const chars = toNumber(flatValues[1] ?? 1);
      return chars > 0 ? str.slice(-chars) : '';
    }

    case 'MID': {
      const str = toString(flatValues[0] ?? '');
      const start = toNumber(flatValues[1] ?? 1) - 1;
      const chars = toNumber(flatValues[2] ?? 0);
      return str.slice(start, start + Math.max(0, chars));
    }

    case 'LEN': {
      return toString(flatValues[0] ?? '').length;
    }

    case 'LOWER': {
      return toString(flatValues[0] ?? '').toLowerCase();
    }

    case 'UPPER': {
      return toString(flatValues[0] ?? '').toUpperCase();
    }

    case 'PROPER': {
      return toString(flatValues[0] ?? '').replace(/\b\w/g, c => c.toUpperCase());
    }

    case 'TRIM': {
      return toString(flatValues[0] ?? '').trim().replace(/\s+/g, ' ');
    }
    case 'CLEAN': {
      // Remove non-printable characters (ASCII 0-31)
      // eslint-disable-next-line no-control-regex
      return toString(flatValues[0] ?? '').replace(/[\u0000-\u001f]/g, '');
    }

    case 'TEXT': {
      const val = flatValues[0];
      const fmt = toString(flatValues[1] ?? '0');
      if (typeof val === 'number') {
        // Check if format is a date format (contains date-related codes)
        if (/[dmyhsDMyHsS]/.test(fmt)) {
          // Treat number as a date serial number and format as date
          const d = dateFromSerial(val);
          if (!isNaN(d.getTime())) {
            return formatDate(d, fmt);
          }
        }
        if (fmt === '0') return String(Math.round(val));
        if (fmt === '0.00') return val.toFixed(2);
        if (fmt.includes('%')) return (val * 100).toFixed(fmt.split('%')[0].split('.')[1]?.length ?? 0) + '%';
      }
      // Handle string values that can be parsed as dates (e.g., output of NOW() / TODAY())
      if (typeof val === 'string' && val) {
        const d = new Date(val);
        if (!isNaN(d.getTime()) && /[dmyhsDMyHsS]/.test(fmt)) {
          return formatDate(d, fmt);
        }
      }
      return toString(val);
    }

    case 'VALUE': {
      const n = toNumber(toString(flatValues[0] ?? ''));
      return isNaN(n) ? ERR_VALUE : n;
    }

    case 'REPT': {
      const str = toString(flatValues[0] ?? '');
      const count = toNumber(flatValues[1] ?? 0);
      return str.repeat(Math.max(0, Math.floor(count)));
    }

    case 'REPLACE': {
      const str = toString(flatValues[0] ?? '');
      const start = toNumber(flatValues[1] ?? 1) - 1;
      const chars = toNumber(flatValues[2] ?? 0);
      const newText = toString(flatValues[3] ?? '');
      return str.slice(0, start) + newText + str.slice(start + chars);
    }

    case 'SUBSTITUTE': {
      const str = toString(flatValues[0] ?? '');
      const oldStr = toString(flatValues[1] ?? '');
      const newStr = toString(flatValues[2] ?? '');
      const occurrence = toNumber(flatValues[3] ?? 0);
      if (occurrence > 0) {
        let count = 0;
        return str.split(oldStr).map((part, i, arr) => {
          if (i === arr.length - 1) return part;
          count++;
          return part + (count === occurrence ? newStr : oldStr);
        }).join('');
      }
      return str.split(oldStr).join(newStr);
    }

    case 'FIND': {
      const find = toString(flatValues[0] ?? '');
      const within = toString(flatValues[1] ?? '');
      const startPos = toNumber(flatValues[2] ?? 1) - 1;
      const idx = within.indexOf(find, Math.max(0, startPos));
      return idx >= 0 ? idx + 1 : ERR_VALUE;
    }

    case 'SEARCH': {
      const find = toString(flatValues[0] ?? '').toLowerCase();
      const within = toString(flatValues[1] ?? '').toLowerCase();
      const startPos = toNumber(flatValues[2] ?? 1) - 1;
      const idx = within.indexOf(find, Math.max(0, startPos));
      return idx >= 0 ? idx + 1 : ERR_VALUE;
    }

    // ── Statistical ────────────────────────────────────────────────
    case 'MEDIAN': {
      const nums = flatValues.map(v => toNumber(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return ERR_VALUE;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }

    case 'MODE': {
      const nums = flatValues.map(v => toNumber(v)).filter(n => !isNaN(n));
      if (nums.length === 0) return ERR_VALUE;
      const counts = new Map<number, number>();
      for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
      let maxCount = 0;
      let mode = nums[0];
      for (const [num, count] of counts) {
        if (count > maxCount) { maxCount = count; mode = num; }
      }
      return mode;
    }

    case 'STDEV': {
      const nums = flatValues.map(v => toNumber(v)).filter(n => !isNaN(n));
      if (nums.length < 2) return ERR_VALUE;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (nums.length - 1);
      return Math.sqrt(variance);
    }

    case 'VAR': {
      const nums = flatValues.map(v => toNumber(v)).filter(n => !isNaN(n));
      if (nums.length < 2) return ERR_VALUE;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (nums.length - 1);
    }

    case 'LARGE': {
      const nums = flatValues.map(v => toNumber(v)).filter(n => !isNaN(n)).sort((a, b) => b - a);
      const k = toNumber(flatValues[flatValues.length - 1] ?? 1);
      if (k < 1 || k > nums.length) return ERR_VALUE;
      return nums[k - 1];
    }

    case 'SMALL': {
      const nums = flatValues.map(v => toNumber(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      const k = toNumber(flatValues[flatValues.length - 1] ?? 1);
      if (k < 1 || k > nums.length) return ERR_VALUE;
      return nums[k - 1];
    }

    // ── Conditional Aggregation ────────────────────────────────────
    case 'SUMIF': {
      if (argValues.length < 2) return ERR_VALUE;
      const range = argValues[0] ?? [];
      const criterion = argValues[1]?.[0];
      const sumRange = argValues.length >= 3 ? argValues[2] : range;
      let sum = 0;
      for (let i = 0; i < range.length; i++) {
        const val = range[i];
        const sumVal = sumRange[i] ?? val;
        if (matchesCriterion(val, criterion)) {
          const n = toNumber(sumVal);
          if (!isNaN(n)) sum += n;
        }
      }
      return sum;
    }

    case 'COUNTIF': {
      if (argValues.length < 2) return ERR_VALUE;
      const range = argValues[0] ?? [];
      const criterion = argValues[1]?.[0];
      let count = 0;
      for (const val of range) {
        if (matchesCriterion(val, criterion)) count++;
      }
      return count;
    }

    case 'AVERAGEIF': {
      if (argValues.length < 2) return ERR_VALUE;
      const range = argValues[0] ?? [];
      const criterion = argValues[1]?.[0];
      const avgRange = argValues.length >= 3 ? argValues[2] : range;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < range.length; i++) {
        const val = range[i];
        const avgVal = avgRange[i] ?? val;
        if (matchesCriterion(val, criterion)) {
          const n = toNumber(avgVal);
          if (!isNaN(n)) { sum += n; count++; }
        }
      }
      return count === 0 ? ERR_DIV_ZERO : sum / count;
    }

    // ── Date ──────────────────────────────────────────────────────
    case 'NOW':
      return new Date().toISOString();
    case 'TODAY': {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    case 'YEAR': {
      const d = new Date(toString(flatValues[0] ?? ''));
      return isNaN(d.getTime()) ? ERR_VALUE : d.getFullYear();
    }

    case 'MONTH': {
      const d = new Date(toString(flatValues[0] ?? ''));
      return isNaN(d.getTime()) ? ERR_VALUE : d.getMonth() + 1;
    }
    case 'DAY': {
      const d = new Date(toString(flatValues[0] ?? ''));
      return isNaN(d.getTime()) ? ERR_VALUE : d.getDate();
    }
    case 'HOUR': {
      const d = new Date(toString(flatValues[0] ?? ''));
      return isNaN(d.getTime()) ? ERR_VALUE : d.getHours();
    }
    case 'MINUTE': {
      const d = new Date(toString(flatValues[0] ?? ''));
      return isNaN(d.getTime()) ? ERR_VALUE : d.getMinutes();
    }
    case 'SECOND': {
      const d = new Date(toString(flatValues[0] ?? ''));
      return isNaN(d.getTime()) ? ERR_VALUE : d.getSeconds();
    }

    case 'DATE': {
      const year = toNumber(flatValues[0] ?? 2000);
      const month = toNumber(flatValues[1] ?? 1) - 1;
      const day = toNumber(flatValues[2] ?? 1);
      const d = new Date(year, month, day);
      // Format as YYYY-MM-DD using local date components (avoid timezone shift)
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    case 'WEEKDAY': {
      const d = new Date(toString(flatValues[0] ?? ''));
      if (isNaN(d.getTime())) return ERR_VALUE;
      const type = toNumber(flatValues[1] ?? 1);
      if (type === 1) return d.getDay() === 0 ? 7 : d.getDay();
      if (type === 2) return (d.getDay() + 6) % 7 + 1; // Mon=1, Tue=2, ..., Sun=7
      return d.getDay() === 0 ? 7 : d.getDay();
    }

    case 'EDATE': {
      const d = new Date(toString(flatValues[0] ?? ''));
      const months = toNumber(flatValues[1] ?? 0);
      if (isNaN(d.getTime())) return ERR_VALUE;
      d.setMonth(d.getMonth() + months);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    case 'EOMONTH': {
      const d = new Date(toString(flatValues[0] ?? ''));
      const months = toNumber(flatValues[1] ?? 0);
      if (isNaN(d.getTime())) return ERR_VALUE;
      d.setMonth(d.getMonth() + months + 1, 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    case 'NETWORKDAYS': {
      const start = new Date(toString(flatValues[0] ?? ''));
      const end = new Date(toString(flatValues[1] ?? ''));
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return ERR_VALUE;
      let count = 0;
      const d = new Date(start);
      while (d <= end) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    }

    // ── Info ──────────────────────────────────────────────────────
    case 'ROW': {
      const rangeArg = node.args.find(a => a.type === 'range') as Extract<ASTNode, { type: 'range' }> | undefined;
      if (rangeArg) return rangeArg.end.row + 1;
      return flatValues.length > 0 ? toNumber(flatValues[0]) + 1 : 0;
    }
    case 'COLUMN': {
      const rangeArg = node.args.find(a => a.type === 'range') as Extract<ASTNode, { type: 'range' }> | undefined;
      if (rangeArg) return rangeArg.end.col + 1;
      return flatValues.length > 0 ? toNumber(flatValues[0]) + 1 : 0;
    }
    case 'ROWS': {
      const rangeArg = node.args.find(a => a.type === 'range') as Extract<ASTNode, { type: 'range' }> | undefined;
      if (rangeArg) return Math.abs(rangeArg.end.row - rangeArg.start.row) + 1;
      return flatValues.length > 0 ? toNumber(flatValues[0]) : 0;
    }
    case 'COLUMNS': {
      const rangeArg = node.args.find(a => a.type === 'range') as Extract<ASTNode, { type: 'range' }> | undefined;
      if (rangeArg) return Math.abs(rangeArg.end.col - rangeArg.start.col) + 1;
      return flatValues.length > 0 ? toNumber(flatValues[0]) : 0;
    }

    // ── Expanded counts ───────────────────────────────────────────
    case 'COUNTA': {
      let count = 0;
      for (const v of flatValues) {
        if (v !== null && v !== '') count++;
      }
      return count;
    }

    case 'COUNTBLANK': {
      let count = 0;
      const allValues = argValues.flat();
      for (const v of allValues) {
        if (v === null || v === '') count++;
      }
      return count;
    }

    // ── Lookup ────────────────────────────────────────────────────
    case 'VLOOKUP': {
      if (argValues.length < 3) return ERR_VALUE;
      const lookupVal = argValues[0]?.[0];
      const table = argValues[1] ?? [];
      const colIdx = toNumber(argValues[2]?.[0] ?? 1);
      // Excel 4th arg: TRUE/omit = approximate (default), FALSE = exact
      // exactMatch = true means do exact match (4th arg was FALSE)
      const exactMatch = argValues.length >= 4 ? Boolean(argValues[3]?.[0]) === false : false;
      if (colIdx < 1) return ERR_VALUE;
      // Get range dimensions for proper 2D navigation
      const shape = getArgShape(1);
      const rows = shape?.rows ?? 0;
      const cols = shape?.cols ?? 0;
      if (rows === 0 || cols === 0) return ERR_REF;
      if (colIdx > cols) return ERR_REF;
      const numLookup = toNumber(lookupVal);
      let bestRow = -1;
      for (let r = 0; r < rows; r++) {
        const cellVal = table[r * cols];
        if (cellVal === undefined) break;
        if (exactMatch) {
          // Exact match: return first exact match
          if (toString(cellVal) === toString(lookupVal)) {
            const resultIdx = r * cols + (colIdx - 1);
            return table[resultIdx] ?? ERR_NA;
          }
        } else {
          // Approximate match: find largest value <= lookupVal
          // Excel requires first column sorted ascending for correct results
          const numCell = toNumber(cellVal);
          if (!isNaN(numCell) && !isNaN(numLookup) && numCell <= numLookup) {
            bestRow = r; // Track the best candidate
          }
        }
      }
      // For approximate match, return the best candidate found
      if (!exactMatch && bestRow >= 0) {
        const resultIdx = bestRow * cols + (colIdx - 1);
        return table[resultIdx] ?? ERR_NA;
      }
      return ERR_NA;
    }

    case 'HLOOKUP': {
      if (argValues.length < 3) return ERR_VALUE;
      const lookupVal = argValues[0]?.[0];
      const table = argValues[1] ?? [];
      const rowIdx = toNumber(argValues[2]?.[0] ?? 1);
      // Excel 4th arg: TRUE/omit = approximate (default), FALSE = exact
      // exactMatch = true means do exact match (4th arg was FALSE)
      const exactMatch = argValues.length >= 4 ? Boolean(argValues[3]?.[0]) === false : false;
      if (rowIdx < 1) return ERR_VALUE;
      // Get range dimensions for proper 2D navigation
      const shape = getArgShape(1);
      const rows = shape?.rows ?? 0;
      const cols = shape?.cols ?? 0;
      if (rows === 0 || cols === 0) return ERR_REF;
      if (rowIdx > rows) return ERR_REF;
      const numLookup = toNumber(lookupVal);
      let bestCol = -1;
      for (let c = 0; c < cols; c++) {
        const cellVal = table[c];
        if (cellVal === undefined) break;
        if (exactMatch) {
          // Exact match: return first exact match
          if (toString(cellVal) === toString(lookupVal)) {
            const resultIdx = (rowIdx - 1) * cols + c;
            return table[resultIdx] ?? ERR_NA;
          }
        } else {
          // Approximate match: find largest value <= lookupVal
          // Excel requires first row sorted ascending for correct results
          const numCell = toNumber(cellVal);
          if (!isNaN(numCell) && !isNaN(numLookup) && numCell <= numLookup) {
            bestCol = c; // Track the best candidate
          }
        }
      }
      // For approximate match, return the best candidate found
      if (!exactMatch && bestCol >= 0) {
        const resultIdx = (rowIdx - 1) * cols + bestCol;
        return table[resultIdx] ?? ERR_NA;
      }
      return ERR_NA;
    }

    case 'OFFSET': {
      // Simplified: returns a value from a flat range at given row/col offset
      if (argValues.length < 3) return ERR_VALUE;
      const baseRange = argValues[0] ?? [];
      const rowOffset = toNumber(argValues[1]?.[0] ?? 0);
      const colOffset = toNumber(argValues[2]?.[0] ?? 0);
      if (baseRange.length === 0) return ERR_REF;
      const cols = Math.max(1, Math.floor(Math.sqrt(baseRange.length)));
      const baseRow = 0;
      const baseCol = 0;
      const targetIdx = (baseRow + rowOffset) * cols + (baseCol + colOffset);
      if (targetIdx < 0 || targetIdx >= baseRange.length) return ERR_REF;
      return baseRange[targetIdx];
    }

    case 'INDIRECT': {
      // Simplified: resolves a text reference to a value from the sheet context
      if (argValues.length < 1) return ERR_VALUE;
      const refText = toString(argValues[0]?.[0] ?? '');
      if (!refText) return ERR_REF;
      // If the refText matches a value in the sheet, return it
      // Full implementation would resolve cell refs from text — this is a stub
      const asNum = Number(refText);
      if (!isNaN(asNum)) return asNum;
      return refText;
    }

    case 'RANK': {
      if (argValues.length < 2) return ERR_VALUE;
      const number = toNumber(argValues[0]?.[0] ?? 0);
      if (isNaN(number)) return ERR_VALUE;
      const range = argValues[1] ?? [];
      const nums = range.map(v => toNumber(v)).filter(n => !isNaN(n));
      if (nums.length === 0) return ERR_VALUE;
      const order = argValues.length >= 3 ? toNumber(argValues[2]?.[0] ?? 0) : 0;
      const sorted = [...nums].sort((a, b) => order === 0 ? b - a : a - b);
      const idx = sorted.indexOf(number);
      return idx >= 0 ? idx + 1 : ERR_VALUE;
    }

    case 'QUARTILE': {
      if (argValues.length < 2) return ERR_VALUE;
      const range = argValues[0] ?? [];
      const quart = toNumber(argValues[1]?.[0] ?? 0);
      if (quart < 0 || quart > 4) return ERR_VALUE;
      const nums = range.map(v => toNumber(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return ERR_VALUE;
      if (quart === 0) return nums[0];
      if (quart === 4) return nums[nums.length - 1];
      const pos = (nums.length - 1) * (quart / 4);
      const base = Math.floor(pos);
      const rest = pos - base;
      if (base + 1 < nums.length) {
        return nums[base] + rest * (nums[base + 1] - nums[base]);
      }
      return nums[base];
    }

    case 'PERCENTILE': {
      if (argValues.length < 2) return ERR_VALUE;
      const range = argValues[0] ?? [];
      const k = toNumber(argValues[1]?.[0] ?? 0);
      if (k < 0 || k > 1) return ERR_VALUE;
      const nums = range.map(v => toNumber(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return ERR_VALUE;
      if (k === 0) return nums[0];
      if (k === 1) return nums[nums.length - 1];
      const pos = (nums.length - 1) * k;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (base + 1 < nums.length) {
        return nums[base] + rest * (nums[base + 1] - nums[base]);
      }
      return nums[base];
    }

    case 'SUMIFS': {
      if (argValues.length < 3) return ERR_VALUE;
      const sumRange = argValues[0] ?? [];
      let sum = 0;
      // argValues[1..] come in pairs: critRange, criterion
      const pairCount = Math.floor((argValues.length - 1) / 2);
      for (let i = 0; i < sumRange.length; i++) {
        let allMatch = true;
        for (let p = 0; p < pairCount; p++) {
          const critRange = argValues[1 + p * 2] ?? [];
          const criterion = argValues[2 + p * 2]?.[0];
          const critVal = critRange[i];
          if (!matchesCriterion(critVal, criterion)) { allMatch = false; break; }
        }
        if (allMatch) {
          const n = toNumber(sumRange[i]);
          if (!isNaN(n)) sum += n;
        }
      }
      return sum;
    }

    case 'COUNTIFS': {
      if (argValues.length < 2) return ERR_VALUE;
      // argValues[0..] come in pairs: critRange, criterion
      const flatVals = argValues[0] ?? [];
      let count = 0;
      const pairCount = Math.floor(argValues.length / 2);
      for (let i = 0; i < flatVals.length; i++) {
        let allMatch = true;
        for (let p = 0; p < pairCount; p++) {
          const critRange = argValues[p * 2] ?? [];
          const criterion = argValues[p * 2 + 1]?.[0];
          const critVal = critRange[i];
          if (!matchesCriterion(critVal, criterion)) { allMatch = false; break; }
        }
        if (allMatch) count++;
      }
      return count;
    }

    case 'AVERAGEIFS': {
      if (argValues.length < 3) return ERR_VALUE;
      const avgRange = argValues[0] ?? [];
      let sum = 0;
      let count = 0;
      const pairCount = Math.floor((argValues.length - 1) / 2);
      for (let i = 0; i < avgRange.length; i++) {
        let allMatch = true;
        for (let p = 0; p < pairCount; p++) {
          const critRange = argValues[1 + p * 2] ?? [];
          const criterion = argValues[2 + p * 2]?.[0];
          const critVal = critRange[i];
          if (!matchesCriterion(critVal, criterion)) { allMatch = false; break; }
        }
        if (allMatch) {
          const n = toNumber(avgRange[i]);
          if (!isNaN(n)) { sum += n; count++; }
        }
      }
      return count === 0 ? ERR_DIV_ZERO : sum / count;
    }

    case 'DATEDIF': {
      if (argValues.length < 3) return ERR_VALUE;
      const start = new Date(toString(argValues[0]?.[0] ?? ''));
      const end = new Date(toString(argValues[1]?.[0] ?? ''));
      const unit = toString(argValues[2]?.[0] ?? '').toUpperCase();
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return ERR_VALUE;
      switch (unit) {
        case 'Y': {
          let years = end.getFullYear() - start.getFullYear();
          if (new Date(start.getFullYear() + years, start.getMonth(), start.getDate()) > end) years--;
          return years;
        }
        case 'M': {
          let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          if (new Date(start.getFullYear(), start.getMonth() + months, start.getDate()) > end) months--;
          return months;
        }
        case 'D': {
          const msPerDay = 1000 * 60 * 60 * 24;
          return Math.round((end.getTime() - start.getTime()) / msPerDay);
        }
        default: return ERR_VALUE;
      }
    }

    case 'INDEX': {
      if (argValues.length < 2) return ERR_VALUE;
      const range = argValues[0] ?? [];
      const row = toNumber(argValues[1]?.[0] ?? 1) - 1;
      const col = argValues.length >= 3 ? toNumber(argValues[2]?.[0] ?? 1) - 1 : 0;
      if (col === 0 && range.length > row) return range[row];
      return ERR_REF;
    }

    case 'MATCH': {
      if (argValues.length < 2) return ERR_VALUE;
      const lookupVal = argValues[0]?.[0];
      const range = argValues[1] ?? [];
      const matchType = toNumber(argValues[2]?.[0] ?? 0);
      for (let i = 0; i < range.length; i++) {
        if (matchType === 0) {
          if (toString(lookupVal) === toString(range[i])) return i + 1;
        }
      }
      return ERR_VALUE;
    }

    default:
      return ERR_NAME;
  }
}

/**
 * Checks if a value matches a criterion for COUNTIF/SUMIF/AVERAGEIF.
 * Supports: exact match, numeric comparison (>5, <10, >=3, <=2, <>value),
 * wildcards (* and ?), and blank/non-blank.
 */
function matchesCriterion(value: CellValue, criterion: CellValue): boolean {
  const strVal = toString(value);
  const strCrit = toString(criterion);

  // Blank check
  if (strCrit === '' || strCrit === '<>') {
    if (strCrit === '') return value === null || value === '';
    if (strCrit === '<>') return value !== null && value !== '';
  }

  // Numeric comparison operators
  const compMatch = strCrit.match(/^(>=|<=|<>|>|<|=)(.+)$/);
  if (compMatch) {
    const op = compMatch[1];
    const compareVal = toNumber(compMatch[2]);
    const numVal = toNumber(value);
    if (isNaN(numVal) || isNaN(compareVal)) return false;
    switch (op) {
      case '>': return numVal > compareVal;
      case '<': return numVal < compareVal;
      case '>=': return numVal >= compareVal;
      case '<=': return numVal <= compareVal;
      case '=': return numVal === compareVal;
      case '<>': return numVal !== compareVal;
    }
  }

  // Wildcard matching
  if (strCrit.includes('*') || strCrit.includes('?')) {
    const regex = new RegExp('^' + strCrit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return regex.test(strVal);
  }

  // Exact match
  return strVal === strCrit;
}

// ─── Dependency Graph ────────────────────────────────────────────────────────

/**
 * Builds a dependency graph for all formula cells in a sheet.
 * Cross-sheet references are excluded from the intra-sheet dependency graph
 * (they cannot create cycles within this sheet).
 */
export function buildDependencyGraph(sheet: Sheet): { deps: DependencyGraph; reverseDeps: ReverseDeps } {
  const deps: DependencyGraph = new Map();
  const reverseDeps: ReverseDeps = new Map();

  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.rawValue.startsWith('=')) {
      try {
        const ast = parseFormula(cell.rawValue.slice(1));
        const refs = extractCellRefs(ast);
        const depSet = new Set<string>();

        for (const ref of refs) {
          // Skip cross-sheet references — they don't create intra-sheet cycles
          if (ref.sheetName) continue;
          const depKey = cellKey(ref.row, ref.col);
          depSet.add(depKey);

          // Build reverse dependency
          if (!reverseDeps.has(depKey)) {
            reverseDeps.set(depKey, new Set());
          }
          reverseDeps.get(depKey)!.add(key);
        }

        deps.set(key, depSet);
      } catch {
        // Invalid formula — no deps to track
      }
    }
  }

  return { deps, reverseDeps };
}

/**
 * Detects circular references in the dependency graph.
 * Returns an array of cell keys that are part of a cycle.
 */
export function detectCircularReferences(deps: DependencyGraph): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const circular: string[] = [];

  function visit(key: string): boolean {
    if (recursionStack.has(key)) {
      circular.push(key);
      return true;
    }
    if (visited.has(key)) return false;

    visited.add(key);
    recursionStack.add(key);

    const depSet = deps.get(key);
    if (depSet) {
      for (const dep of depSet) {
        if (visit(dep)) {
          if (!circular.includes(key)) {
            circular.push(key);
          }
        }
      }
    }

    recursionStack.delete(key);
    return false;
  }

  for (const key of deps.keys()) {
    if (!visited.has(key)) {
      visit(key);
    }
  }

  return circular;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface EvaluationResult {
  /** Updated cells with computed values. */
  cells: Record<string, Cell>;
  /** Cells that had circular references. */
  circularRefs: string[];
  /** Whether evaluation completed without fatal errors. */
  success: boolean;
}

/**
 * Evaluates all formulas in the active sheet of a workbook and returns the updated cell state.
 * Supports cross-sheet references via the workbook's sheet list.
 * @param workbook - The workbook containing all sheets.
 * @param activeSheetIndex - Index of the sheet to evaluate.
 * @returns EvaluationResult with computed values and circular reference info.
 */
export function evaluateWorkbook(workbook: import('../types').Workbook, activeSheetIndex: number, hiddenRows?: Set<number>): EvaluationResult {
  const sheets = workbook.sheets;
  if (activeSheetIndex < 0 || activeSheetIndex >= sheets.length) {
    return { cells: {}, circularRefs: [], success: false };
  }

  // Build named range lookup map once for the whole workbook.
  const namedRanges = buildNamedRangeMap(workbook.namedRanges ?? []);

  // Shared evaluation context across all sheets
  // This allows cross-sheet references to read computed values from other sheets
  const sharedCache = new Map<string, CellValue>();
  const allCircularRefs: string[] = [];

  // Evaluate ALL sheets so cross-sheet references have computed values available.
  // The order matters: sheets referenced by other sheets should be evaluated first.
  // We use a simple multi-pass approach: evaluate sheets with no cross-sheet deps first,
  // then evaluate sheets that reference others.
  const evaluatedSheets = new Set<number>();

  // Helper to evaluate a single sheet given the shared context
  const evaluateSheet = (sheetIndex: number) => {
    const sheet = sheets[sheetIndex];
    if (!sheet) return;

    const ctx: EvalContext = {
      cells: sheet.cells,
      allSheets: sheets,
      activeSheetIndex: sheetIndex,
      cache: sharedCache,
      evalStack: new Set(),
      rowCount: sheet.rowCount,
      colCount: sheet.columnCount,
      hiddenRows,
      namedRanges,
      activeSheetId: sheet.id,
    };

    const { deps } = buildDependencyGraph(sheet);
    const circularRefs = detectCircularReferences(deps);
    allCircularRefs.push(...circularRefs);

    // Topological sort for evaluation order
    const evaluationOrder = topologicalSort(deps, sheet.cells);

    // Evaluate all formula cells
    for (const key of evaluationOrder) {
      const cell = sheet.cells[key];
      if (cell?.rawValue.startsWith('=')) {
        try {
          const ast = parseFormula(cell.rawValue.slice(1));
          const result = evaluateNode(ast, ctx);
          cell.computedValue = result;
        } catch {
          cell.computedValue = ERR_VALUE;
        }
      } else {
        cell.computedValue = autoDetectType(cell.rawValue);
      }
    }

    // Mark circular references
    for (const key of circularRefs) {
      const cell = sheet.cells[key];
      if (cell) {
        cell.computedValue = ERR_CIRCULAR;
      }
    }

    evaluatedSheets.add(sheetIndex);
  };

  // First pass: evaluate sheets that have no cross-sheet dependencies
  for (let i = 0; i < sheets.length; i++) {
    if (!hasCrossSheetDeps(sheets[i])) {
      evaluateSheet(i);
    }
  }

  // Second pass: evaluate sheets with cross-sheet dependencies
  // (they can now read computed values from the first-pass sheets)
  for (let i = 0; i < sheets.length; i++) {
    if (!evaluatedSheets.has(i)) {
      evaluateSheet(i);
    }
  }

  const activeSheet = sheets[activeSheetIndex];
  return {
    cells: activeSheet?.cells ?? {},
    circularRefs: allCircularRefs,
    success: true,
  };
}

/**
 * Evaluates a formula string against the current workbook for live preview.
 * Used by the FormulaWizard to display the computed result of the formula
 * being built, without committing it to any cell.
 *
 * @param formula - Formula string WITHOUT the leading '=' (e.g., "SUM(A1,B1)")
 * @param workbook - The current workbook
 * @param activeSheetIndex - Index of the active sheet
 * @returns The computed value (string | number | boolean | null)
 */
export function evaluateFormulaPreview(
  formula: string,
  workbook: import('../types').Workbook,
  activeSheetIndex: number,
  hiddenRows?: Set<number>,
): string | number | boolean | null {
  if (!formula) return null;

  const sheets = workbook.sheets;
  if (activeSheetIndex < 0 || activeSheetIndex >= sheets.length) return null;

  const sharedCache = new Map<string, CellValue>();
  const namedRanges = buildNamedRangeMap(workbook.namedRanges ?? []);

  // Evaluate all sheets so cross-sheet references resolve to computed values
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const ctx: EvalContext = {
      cells: sheet.cells,
      allSheets: sheets,
      activeSheetIndex: i,
      cache: sharedCache,
      evalStack: new Set(),
      rowCount: sheet.rowCount,
      colCount: sheet.columnCount,
      hiddenRows,
      namedRanges,
      activeSheetId: sheet.id,
    };
    const { deps } = buildDependencyGraph(sheet);
    const evaluationOrder = topologicalSort(deps, sheet.cells);
    for (const key of evaluationOrder) {
      const cell = sheet.cells[key];
      if (cell?.rawValue.startsWith('=')) {
        try {
          const ast = parseFormula(cell.rawValue.slice(1));
          const result = evaluateNode(ast, ctx);
          sharedCache.set(`${i}:${key}`, result);
        } catch {
          /* istanbul ignore next - defensive: evaluateNode catches parse errors internally */
          sharedCache.set(`${i}:${key}`, ERR_VALUE);
        }
      } else {
        sharedCache.set(`${i}:${key}`, autoDetectType(cell.rawValue));
      }
    }
  }

  // Now evaluate the preview formula against the active sheet context
  const activeSheet = sheets[activeSheetIndex];
  const previewCtx: EvalContext = {
    cells: activeSheet.cells,
    allSheets: sheets,
    activeSheetIndex,
    cache: sharedCache,
    evalStack: new Set(),
    rowCount: activeSheet.rowCount,
    colCount: activeSheet.columnCount,
    hiddenRows,
    namedRanges,
    activeSheetId: activeSheet.id,
  };

  try {
    const ast = parseFormula(formula);
    return evaluateNode(ast, previewCtx);
  } catch {
    return null;
  }
}

/**
 * Checks if a sheet has any cross-sheet formula dependencies.
 */
function hasCrossSheetDeps(sheet: Sheet): boolean {
  for (const cell of Object.values(sheet.cells)) {
    if (!cell.rawValue.startsWith('=')) continue;
    try {
      const ast = parseFormula(cell.rawValue.slice(1));
      const refs = extractCellRefs(ast);
      if (refs.some((ref) => ref.sheetName)) return true;
    } catch {
      // Invalid formula — skip
    }
  }
  return false;
}

/**
 * Topologically sorts formula cells so dependencies are evaluated before dependents.
 */
function topologicalSort(deps: DependencyGraph, cells: Record<string, Cell>): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(key: string): void {
    if (visited.has(key)) return;
    visited.add(key);

    const depSet = deps.get(key);
    if (depSet) {
      for (const dep of depSet) {
        if (deps.has(dep)) {
          visit(dep);
        }
      }
    }

    order.push(key);
  }

  // Visit all formula cells
  for (const key of Object.keys(cells)) {
    if (cells[key]?.rawValue.startsWith('=')) {
      visit(key);
    }
  }

  // Also include non-formula cells that might be referenced
  for (const key of Object.keys(cells)) {
    if (!order.includes(key)) {
      order.push(key);
    }
  }

  return order;
}
