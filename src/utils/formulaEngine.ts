/**
 * Formula Evaluator & Dependency Graph
 *
 * Evaluates parsed formula ASTs against a sheet's cell data.
 * Builds a dependency graph for change propagation and circular reference detection.
 */

import type { Sheet, Cell } from '../types';
import { cellKey } from '../types';
import { parseFormula, extractCellRefs, type ASTNode } from './formulaParser';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Sentinel values for special error/empty states. */
export const ERR_CIRCULAR = '#CIRC!';
export const ERR_DIV_ZERO = '#DIV/0!';
export const ERR_VALUE = '#VALUE!';
export const ERR_NAME = '#NAME?';
export const ERR_REF = '#REF!';

type CellValue = string | number | boolean | null;

/** Maps a cell key to the set of cells it depends on (for propagation). */
type DependencyGraph = Map<string, Set<string>>;

/** Maps a cell key to the set of cells that depend on it (reverse deps). */
type ReverseDeps = Map<string, Set<string>>;

// ─── Evaluation Context ──────────────────────────────────────────────────────

interface EvalContext {
  /** Cells available for reference. */
  cells: Record<string, Cell>;
  /** Cache of computed results. */
  cache: Map<string, CellValue>;
  /** Current evaluation stack (for circular reference detection). */
  evalStack: Set<string>;
  /** Sheet dimensions (for bounds checking). */
  rowCount: number;
  colCount: number;
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
function evaluateNode(node: ASTNode, ctx: EvalContext): CellValue {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'string':
      return node.value;

    case 'boolean':
      return node.value;

    case 'cell':
      return evaluateCell(node.row, node.col, ctx);

    /* istanbul ignore next - bare range not valid as value */
    case 'range':
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

    /* istanbul ignore next - all AST node types handled above */
    default:
      return ERR_VALUE;
  }
}

/**
 * Evaluates a cell reference, handling caching and circular detection.
 */
function evaluateCell(row: number, col: number, ctx: EvalContext): CellValue {
  // Bounds check
  if (row < 0 || row >= ctx.rowCount || col < 0 || col >= ctx.colCount) {
    return ERR_REF;
  }

  const key = cellKey(row, col);

  // Check cache
  if (ctx.cache.has(key)) {
    return ctx.cache.get(key)!;
  }

  /* istanbul ignore next - circular reference detection */
  if (ctx.evalStack.has(key)) {
    return ERR_CIRCULAR;
  }

  const cell = ctx.cells[key];
  if (!cell) return null;

  // If it's a formula, evaluate it
  if (cell.rawValue.startsWith('=')) {
    ctx.evalStack.add(key);
    try {
      const ast = parseFormula(cell.rawValue.slice(1));
      const result = evaluateNode(ast, ctx);
      ctx.cache.set(key, result);
      return result;
    } catch {
      /* istanbul ignore next - parse error fallback */
      ctx.cache.set(key, ERR_VALUE);
      return ERR_VALUE;
    } finally {
      ctx.evalStack.delete(key);
    }
  }

  // Literal value — try to auto-detect type
  const result = autoDetectType(cell.rawValue);
  ctx.cache.set(key, result);
  return result;
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

  // Date (ISO format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
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
function collectRangeValues(node: Extract<ASTNode, { type: 'range' }>, ctx: EvalContext): CellValue[] {
  const values: CellValue[] = [];
  const minRow = Math.min(node.start.row, node.end.row);
  const maxRow = Math.max(node.start.row, node.end.row);
  const minCol = Math.min(node.start.col, node.end.col);
  const maxCol = Math.max(node.start.col, node.end.col);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      values.push(evaluateCell(r, c, ctx));
    }
  }

  return values;
}

/**
 * Evaluates a function call node.
 */
function evaluateFunction(node: Extract<ASTNode, { type: 'function' }>, ctx: EvalContext): CellValue {
  // Collect argument values (handling ranges)
  const argValues: CellValue[][] = [];

  for (const arg of node.args) {
    if (arg.type === 'range') {
      argValues.push(collectRangeValues(arg as Extract<ASTNode, { type: 'range' }>, ctx));
    } else {
      argValues.push([evaluateNode(arg, ctx)]);
    }
  }

  // Flatten for aggregate functions
  const flatValues = argValues.flat().filter((v) => v !== null);

  switch (node.name) {
    case 'SUM': {
      let sum = 0;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n)) sum += n;
      }
      return sum;
    }

    case 'AVERAGE': {
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
      let count = 0;
      for (const v of flatValues) {
        if (typeof v === 'number') count++;
      }
      return count;
    }

    case 'MIN': {
      let min: number | null = null;
      for (const v of flatValues) {
        const n = toNumber(v);
        if (!isNaN(n) && (min === null || n < min)) min = n;
      }
      return min ?? 0;
    }

    case 'MAX': {
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

    case 'TRUE':
      return true;
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

    case 'TEXT': {
      const val = flatValues[0];
      const fmt = toString(flatValues[1] ?? '0');
      if (typeof val === 'number') {
        if (fmt === '0') return String(Math.round(val));
        if (fmt === '0.00') return val.toFixed(2);
        if (fmt.includes('%')) return (val * 100).toFixed(fmt.split('%')[0].split('.')[1]?.length ?? 0) + '%';
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

    // ── Lookup (basic implementations) ────────────────────────────
    case 'VLOOKUP': {
      // Basic stub — full 2D range support needed
      return ERR_REF;
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
 * Evaluates all formulas in a sheet and returns the updated cell state.
 * @param sheet - The sheet to evaluate.
 * @returns EvaluationResult with computed values and circular reference info.
 */
export function evaluateWorkbook(sheet: Sheet): EvaluationResult {
  const ctx: EvalContext = {
    cells: sheet.cells,
    cache: new Map(),
    evalStack: new Set(),
    rowCount: sheet.rowCount,
    colCount: sheet.columnCount,
  };

  const { deps } = buildDependencyGraph(sheet);
  const circularRefs = detectCircularReferences(deps);

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

  return {
    cells: sheet.cells,
    circularRefs,
    success: true,
  };
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
