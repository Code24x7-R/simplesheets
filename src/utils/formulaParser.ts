/**
 * Formula Parser for SimpleSheet
 *
 * Converts A1-style formula strings into an AST for evaluation.
 * Supports arithmetic, cell references, ranges, and core functions.
 */

import { colToLetter } from '../types';

// ─── AST Node Types ──────────────────────────────────────────────────────────

export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | CellRefNode
  | RangeNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionNode;

export interface NumberNode {
  type: 'number';
  value: number;
}

export interface StringNode {
  type: 'string';
  value: string;
}

export interface BooleanNode {
  type: 'boolean';
  value: boolean;
}

export interface CellRefNode {
  type: 'cell';
  /** Row index (0-based). */
  row: number;
  /** Column index (0-based). */
  col: number;
  /** Whether the column is absolute ($A). */
  absoluteCol: boolean;
  /** Whether the row is absolute ($1). */
  absoluteRow: boolean;
  /** Sheet name qualifier (e.g., "Sheet1" for Sheet1!A1). Null for same-sheet refs. */
  sheetName?: string;
}

export interface RangeNode {
  type: 'range';
  start: CellRefNode;
  end: CellRefNode;
  /** Sheet name qualifier (e.g., "Sheet1" for Sheet1!A1:B10). Null for same-sheet refs. */
  sheetName?: string;
}

export interface BinaryOpNode {
  type: 'binary';
  op: '+' | '-' | '*' | '/' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>=';
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'unary';
  op: '-' | '+';
  operand: ASTNode;
}

export interface FunctionNode {
  type: 'function';
  name: string;
  args: ASTNode[];
}

// ─── Token Types ─────────────────────────────────────────────────────────────

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'CELL'
  | 'SHEET_NAME'
  | 'BANG'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'NAMED_VAR'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class FormulaError extends Error {
  constructor(message: string, public pos?: number) {
    super(message);
    this.name = 'FormulaError';
  }
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

/** Supported functions (uppercase). */
const FUNCTIONS = new Set([
  // Math
  'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTBLANK', 'MIN', 'MAX', 'PRODUCT',
  'ABS', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'SQRT', 'POWER', 'MOD', 'INT', 'FLOOR', 'CEILING',
  'EXP', 'LN', 'LOG', 'LOG10', 'PI', 'RAND', 'RANDBETWEEN', 'SIGN', 'TRUNC',
  // Trigonometry
  'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2', 'DEGREES', 'RADIANS',
  // Logic
  'IF', 'AND', 'OR', 'NOT', 'XOR', 'IFERROR', 'IFNA', 'SWITCH', 'ISBLANK', 'ISERROR', 'ISNUMBER', 'ISTEXT',
  // Text
  'CONCAT', 'CONCATENATE', 'LEFT', 'RIGHT', 'MID', 'LEN', 'LOWER', 'UPPER', 'PROPER', 'TRIM',
  'TEXT', 'VALUE', 'REPT', 'REPLACE', 'SUBSTITUTE', 'FIND', 'SEARCH',
  // Statistical
  'MEDIAN', 'MODE', 'STDEV', 'VAR', 'LARGE', 'SMALL', 'RANK', 'QUARTILE', 'PERCENTILE',
  // Conditional aggregation
  'SUMIF', 'COUNTIF', 'AVERAGEIF', 'SUMIFS', 'COUNTIFS', 'AVERAGEIFS',
  // Date
  'NOW', 'TODAY', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'DATE', 'DATEDIF', 'EDATE', 'EOMONTH', 'WEEKDAY', 'NETWORKDAYS',
  // Info
  'ROW', 'COLUMNS', 'ROWS', 'COLUMN',
  // Lookup
  'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'OFFSET', 'INDIRECT',
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers (including decimals and scientific notation)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let num = '';
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i++];
      }
      if (input[i] === 'e' || input[i] === 'E') {
        num += input[i++];
        if (input[i] === '+' || input[i] === '-') num += input[i++];
        while (i < input.length && /[0-9]/.test(input[i])) {
          num += input[i++];
        }
      }
      tokens.push({ type: 'NUMBER', value: num, pos: i - num.length });
      continue;
    }

    // Strings (double-quoted)
    if (ch === '"') {
      let str = '';
      i++; // skip opening quote
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i++];
        }
      }
      if (i >= input.length) {
        throw new FormulaError('Unterminated string literal', i);
      }
      i++; // skip closing quote
      // Check for sheet qualifier: "Sheet Name"!A1
      if (i < input.length && input[i] === '!') {
        i++; // consume '!'
        tokens.push({ type: 'SHEET_NAME', value: str, pos: i - str.length - 3 });
        tokens.push({ type: 'BANG', value: '!', pos: i - 1 });
      } else {
        tokens.push({ type: 'STRING', value: str, pos: i - str.length - 2 });
      }
      continue;
    }

    // Single-quoted strings (used for sheet names with spaces: 'My Sheet'!A1)
    if (ch === "'") {
      let str = '';
      i++; // skip opening quote
      while (i < input.length && input[i] !== "'") {
        str += input[i++];
      }
      if (i >= input.length) {
        throw new FormulaError('Unterminated sheet name', i);
      }
      i++; // skip closing quote
      // Must be followed by "!" to be a sheet qualifier
      if (i < input.length && input[i] === '!') {
        i++; // consume '!'
        tokens.push({ type: 'SHEET_NAME', value: str, pos: i - str.length - 3 });
        tokens.push({ type: 'BANG', value: '!', pos: i - 1 });
      } else {
        throw new FormulaError(`Expected '!' after sheet name '${str}'`, i);
      }
      continue;
    }

    // Boolean literals (must check before cell refs since they start with letters)
    // Accept both cases: TRUE/true, FALSE/false
    const upperSlice4 = input.slice(i, i + 4).toUpperCase();
    const upperSlice5 = input.slice(i, i + 5).toUpperCase();
    if (upperSlice4 === 'TRUE' && !/[A-Za-z]/.test(input[i + 4] ?? '')) {
      tokens.push({ type: 'BOOLEAN', value: 'TRUE', pos: i });
      i += 4;
      continue;
    }
    if (upperSlice5 === 'FALSE' && !/[A-Za-z]/.test(input[i + 5] ?? '')) {
      tokens.push({ type: 'BOOLEAN', value: 'FALSE', pos: i });
      i += 5;
      continue;
    }

    // Cell references (e.g., A1, $A$1, $A1, A$1, B2, AA10)
    // Accept both uppercase and lowercase letters
    if (/[A-Za-z]/.test(ch) || (ch === '$' && /[A-Za-z]/.test(input[i + 1] ?? ''))) {
      let absoluteCol = false;
      const startPos = i;
      if (input[i] === '$') {
        absoluteCol = true;
        i++;
      }
      let ref = '';
      while (i < input.length && /[A-Za-z]/.test(input[i])) {
        ref += input[i++];
      }

      // Check if the word (including trailing digits) is a function name
      // This handles cases like LOG10 which would otherwise be treated as cell ref
      let wordEnd = i;
      while (wordEnd < input.length && /[0-9]/.test(input[wordEnd])) {
        wordEnd++;
      }
      const fullWord = ref + (wordEnd > i ? input.slice(i, wordEnd) : '');
      if (fullWord !== ref && FUNCTIONS.has(fullWord.toUpperCase())) {
        // It's a function name with digits (e.g., LOG10)
        i = wordEnd;
        tokens.push({ type: 'FUNCTION', value: fullWord.toUpperCase(), pos: startPos - (absoluteCol ? 1 : 0) });
        continue;
      }

      // Handle dots in named references (e.g., Hello.World)
      // Consume any dots and following characters as part of the name
      while (i < input.length && input[i] === '.') {
        ref += input[i++]; // add the dot
        while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
          ref += input[i++];
        }
      }

      // Check if followed by digits or $digit (cell ref) or not (function name)
      if (i < input.length && (/[0-9]/.test(input[i]) || (input[i] === '$' && /[0-9]/.test(input[i + 1] ?? '')))) {
        let absoluteRow = false;
        if (input[i] === '$') {
          absoluteRow = true;
          i++;
        }
        let row = '';
        while (i < input.length && /[0-9]/.test(input[i])) {
          row += input[i++];
        }
        // Check for sheet qualifier: word! means this is a sheet name (e.g., Sheet1!A1)
        if (i < input.length && input[i] === '!') {
          // This is a sheet name qualifier — emit SHEET_NAME and BANG
          i++; // consume '!'
          const sheetName = `${absoluteCol ? '$' : ''}${ref}${absoluteRow ? '$' : ''}${row}`;
          tokens.push({ type: 'SHEET_NAME', value: sheetName, pos: startPos });
          tokens.push({ type: 'BANG', value: '!', pos: i - 1 });
        } else {
          // Normalize cell ref to uppercase
          const cellRef = `${absoluteCol ? '$' : ''}${ref.toUpperCase()}${absoluteRow ? '$' : ''}${row}`;
          tokens.push({ type: 'CELL', value: cellRef, pos: startPos });
        }
      } else {
        const upperRef = ref.toUpperCase();
        // Check for sheet qualifier on bare names (e.g., Sheet!A1 where Sheet has no digits)
        if (i < input.length && input[i] === '!') {
          i++; // consume '!'
          tokens.push({ type: 'SHEET_NAME', value: ref, pos: startPos });
          tokens.push({ type: 'BANG', value: '!', pos: i - 1 });
        } else if (FUNCTIONS.has(upperRef)) {
          tokens.push({ type: 'FUNCTION', value: upperRef, pos: startPos });
        } else {
          // Treat as named variable or unknown function
          // (may contain dots, e.g., Hello.World when = is prepended to plain text)
          tokens.push({ type: 'FUNCTION', value: ref, pos: startPos });
        }
      }
      continue;
    }

    // Operators
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch, pos: i });
      i++;
      continue;
    }

    // Comparison operators
    if (ch === '=') {
      tokens.push({ type: 'OPERATOR', value: '=', pos: i });
      i++;
      continue;
    }
    if (ch === '<') {
      if (input[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '<=', pos: i });
        i += 2;
      } else if (input[i + 1] === '>') {
        tokens.push({ type: 'OPERATOR', value: '<>', pos: i });
        i += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: '<', pos: i });
        i++;
      }
      continue;
    }
    if (ch === '>') {
      if (input[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '>=', pos: i });
        i += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: '>', pos: i });
        i++;
      }
      continue;
    }

    // Ampersand (string concatenation)
    if (ch === '&') {
      tokens.push({ type: 'OPERATOR', value: '&', pos: i });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch, pos: i });
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ch, pos: i });
      i++;
      continue;
    }

    // Colon (for ranges)
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ch, pos: i });
      i++;
      continue;
    }

    throw new FormulaError(`Unexpected character '${ch}' at position ${i}`, i);
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

// ─── Cell Reference Parser ──────────────────────────────────────────────────

function parseCellRef(ref: string): { row: number; col: number; absoluteCol: boolean; absoluteRow: boolean } {
  const match = ref.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/i);
  if (!match) throw new FormulaError(`Invalid cell reference: ${ref}`);

  const absoluteCol = match[1] === '$';
  const absoluteRow = match[3] === '$';

  let col = 0;
  for (const ch of match[2].toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }

  return {
    row: parseInt(match[4], 10) - 1,
    col: col - 1,
    absoluteCol,
    absoluteRow,
  };
}

// ─── Recursive Descent Parser ────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new FormulaError(
        `Expected ${type} but got '${token.value || token.type}' at position ${token.pos}`,
        token.pos
      );
    }
    return this.advance();
  }

  /** Entry point: parses the full expression. */
  parse(): ASTNode {
    const node = this.parseExpression();
    this.expect('EOF');
    return node;
  }

  /** Handles addition and subtraction (lowest precedence). */
  private parseExpression(): ASTNode {
    let left = this.parseConcat();

    while (this.current().type === 'OPERATOR' && ['+', '-'].includes(this.current().value)) {
      const op = this.advance().value as '+' | '-';
      const right = this.parseConcat();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  /** Handles string concatenation (&). */
  private parseConcat(): ASTNode {
    let left = this.parseComparison();

    while (this.current().type === 'OPERATOR' && this.current().value === '&') {
      this.advance();
      const right = this.parseComparison();
      left = { type: 'binary', op: '&', left, right };
    }

    return left;
  }

  /** Handles comparison operators (=, <>, <, >, <=, >=). */
  private parseComparison(): ASTNode {
    let left = this.parseTerm();

    while (
      this.current().type === 'OPERATOR' &&
      ['=', '<>', '<', '>', '<=', '>='].includes(this.current().value)
    ) {
      const op = this.advance().value as BinaryOpNode['op'];
      const right = this.parseTerm();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  /** Handles multiplication and division. */
  private parseTerm(): ASTNode {
    let left = this.parseFactor();

    while (this.current().type === 'OPERATOR' && ['*', '/'].includes(this.current().value)) {
      const op = this.advance().value as '*' | '/';
      const right = this.parseFactor();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  /** Handles unary minus/plus. */
  private parseFactor(): ASTNode {
    if (
      this.current().type === 'OPERATOR' &&
      (this.current().value === '-' || this.current().value === '+')
    ) {
      const op = this.advance().value as '-' | '+';
      const operand = this.parseFactor();
      return { type: 'unary', op, operand };
    }

    return this.parsePrimary();
  }

  /** Handles numbers, strings, cell references, ranges, and functions. */
  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case 'NUMBER': {
        this.advance();
        return { type: 'number', value: parseFloat(token.value) };
      }

      case 'STRING': {
        this.advance();
        return { type: 'string', value: token.value };
      }

      case 'BOOLEAN': {
        this.advance();
        return { type: 'boolean', value: token.value === 'TRUE' };
      }

      case 'SHEET_NAME': {
        const sheetName = token.value;
        this.advance(); // consume sheet name
        this.expect('BANG');
        // Next must be a cell or range on the specified sheet
        const nextToken = this.expect('CELL');
        const ref = parseCellRef(nextToken.value);

        // Check if this is part of a range (e.g., Sheet1!A1:B5)
        if (this.current().type === 'COLON') {
          this.advance(); // consume colon
          const endToken = this.expect('CELL');
          const endRef = parseCellRef(endToken.value);
          return {
            type: 'range',
            sheetName,
            start: { type: 'cell', row: ref.row, col: ref.col, absoluteCol: ref.absoluteCol, absoluteRow: ref.absoluteRow, sheetName },
            end: { type: 'cell', row: endRef.row, col: endRef.col, absoluteCol: endRef.absoluteCol, absoluteRow: endRef.absoluteRow, sheetName },
          };
        }

        return { type: 'cell', row: ref.row, col: ref.col, absoluteCol: ref.absoluteCol, absoluteRow: ref.absoluteRow, sheetName };
      }

      case 'CELL': {
        this.advance();
        const ref = parseCellRef(token.value);

        // Check if this is part of a range (e.g., A1:B5)
        if (this.current().type === 'COLON') {
          this.advance(); // consume colon
          const endToken = this.expect('CELL');
          const endRef = parseCellRef(endToken.value);
          return {
            type: 'range',
            start: { type: 'cell', row: ref.row, col: ref.col, absoluteCol: ref.absoluteCol, absoluteRow: ref.absoluteRow },
            end: { type: 'cell', row: endRef.row, col: endRef.col, absoluteCol: endRef.absoluteCol, absoluteRow: endRef.absoluteRow },
          };
        }

        return { type: 'cell', row: ref.row, col: ref.col, absoluteCol: ref.absoluteCol, absoluteRow: ref.absoluteRow };
      }

      case 'FUNCTION': {
        this.advance();
        const name = token.value;
        this.expect('LPAREN');
        const args: ASTNode[] = [];

        if (this.current().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.current().type === 'COMMA') {
            this.advance();
            args.push(this.parseExpression());
          }
        }

        this.expect('RPAREN');
        return { type: 'function', name, args };
      }

      case 'LPAREN': {
        this.advance();
        const expr = this.parseExpression();
        this.expect('RPAREN');
        return expr;
      }

      default:
        throw new FormulaError(
          `Unexpected token '${token.value || token.type}' at position ${token.pos}`,
          token.pos
        );
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parses a formula string (without the leading "=") into an AST.
 * @param formula - The formula body (e.g., "SUM(A1:A10) + B1").
 * @returns The root AST node.
 * @throws FormulaError if the formula is syntactically invalid.
 */
export function parseFormula(formula: string): ASTNode {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Converts a cell reference node to its A1-style string representation.
 * @param node - The CellRefNode to convert.
 * @returns A1-style reference string (e.g., "A1", "$A$1", "$A1", "A$1").
 */
export function cellRefToString(node: CellRefNode): string {
  const colLetter = colToLetter(node.col);
  const rowNumber = node.row + 1;
  const colPart = node.absoluteCol ? `$${colLetter}` : colLetter;
  const rowPart = node.absoluteRow ? `$${rowNumber}` : String(rowNumber);
  return `${colPart}${rowPart}`;
}

/**
 * Converts a range node to its A1-style string representation.
 * @param node - The RangeNode to convert.
 * @returns A1-style range string (e.g., "A1:B5").
 */
export function rangeToString(node: RangeNode): string {
  return `${cellRefToString(node.start)}:${cellRefToString(node.end)}`;
}

/**
 * Adjusts cell references in a formula by a row and column offset.
 * Used during copy-paste operations. Absolute references are not adjusted.
 * @param formula - The formula string (without leading "=").
 * @param rowOffset - Number of rows to shift.
 * @param colOffset - Number of columns to shift.
 * @returns The adjusted formula string.
 */
export function adjustFormulaRefs(formula: string, rowOffset: number, colOffset: number): string {
  if (rowOffset === 0 && colOffset === 0) return formula;

  // Regex to match cell references: optional $ column, column letters, optional $ row, row digits
  // Case-insensitive but NOT preceded by a digit (to avoid matching scientific notation like 1e5)
  const cellRefRegex = /(?<![0-9])(\$?)([A-Za-z]+)(\$?)(\d+)/gi;

  return formula.replace(cellRefRegex, (match, dollarCol: string, col: string, dollarRow: string, row: string) => {
    const absoluteCol = dollarCol === '$';
    const absoluteRow = dollarRow === '$';

    let newCol = col;
    let newRow = row;

    if (!absoluteCol && colOffset !== 0) {
      let colNum = 0;
      for (const ch of col.toUpperCase()) {
        colNum = colNum * 26 + (ch.charCodeAt(0) - 64);
      }
      colNum = colNum - 1 + colOffset;
      if (colNum >= 0) {
        newCol = colToLetter(colNum);
      } else {
        // Out of bounds — return original
        return match;
      }
    } else if (!absoluteCol) {
      // Normalize column letters to uppercase even without offset
      newCol = col.toUpperCase();
    }

    if (!absoluteRow && rowOffset !== 0) {
      const rowNum = parseInt(row, 10) + rowOffset;
      if (rowNum >= 1) {
        newRow = String(rowNum);
      } else {
        return match;
      }
    }

    return `${absoluteCol ? '$' : ''}${newCol.toUpperCase()}${absoluteRow ? '$' : ''}${newRow}`;
  });
}

/**
 * Converts all relative cell references in a formula to cross-sheet references
 * pointing to the specified sheet. Used when pasting formulas across sheets.
 *
 * @param formula - The formula string (without leading "=").
 * @param sheetName - The sheet name to prefix references with.
 * @returns The formula with all relative refs converted to cross-sheet refs.
 *
 * @example
 * // On Sheet1: =A1+B1 -> On Sheet2: =Sheet1!A1+Sheet1!B1
 * prefixRefsWithSheet('A1+B1', 'Sheet1') // returns 'Sheet1!A1+Sheet1!B1'
 */
export function prefixRefsWithSheet(formula: string, sheetName: string): string {
  const sheetPrefix = sheetName.includes(' ') ? `'${sheetName}'!` : `${sheetName}!`;

  // Two-pass approach:
  // 1. Temporarily replace already-qualified cross-sheet refs with placeholders
  // 2. Prefix all remaining relative refs
  // 3. Restore the cross-sheet refs

  // Match cross-sheet references: word!ref or 'word word'!ref
  // Sheet name part is non-capturing and matches both quoted and unquoted names
  const crossSheetRegex = /('[^']*'!|[A-Za-z_][A-Za-z0-9_]*!)(\$?[A-Za-z]+\$?\d+)/gi;

  const placeholders: string[] = [];
  let protectedFormula = formula.replace(crossSheetRegex, (match) => {
    // Use a placeholder that won't match the cell ref regex (no letter followed by digit)
    const placeholder = `§§${placeholders.length}§§`;
    placeholders.push(match);
    return placeholder;
  });

  // Now prefix all remaining relative references
  const cellRefRegex = /(?<![0-9])(\$?[A-Za-z]+\$?\d+)/gi;
  protectedFormula = protectedFormula.replace(cellRefRegex, (match) => {
    return `${sheetPrefix}${match}`;
  });

  // Restore cross-sheet references
  let result = protectedFormula;
  placeholders.forEach((original, idx) => {
    result = result.replace(`§§${idx}§§`, original);
  });

  return result;
}

/**
 * Extracts all cell references from an AST.
 * Useful for building dependency graphs.
 */
export interface CellRef {
  row: number;
  col: number;
  absoluteCol: boolean;
  absoluteRow: boolean;
}

export interface SheetCellRef {
  row: number;
  col: number;
  absoluteCol: boolean;
  absoluteRow: boolean;
  /** Sheet name qualifier, if this is a cross-sheet reference. */
  sheetName?: string;
}

export function extractCellRefs(node: ASTNode): SheetCellRef[] {
  const refs: SheetCellRef[] = [];

  function walk(n: ASTNode): void {
    switch (n.type) {
      case 'cell':
        refs.push({ row: n.row, col: n.col, absoluteCol: n.absoluteCol, absoluteRow: n.absoluteRow, sheetName: n.sheetName });
        break;
      case 'range': {
        const minRow = Math.min(n.start.row, n.end.row);
        const maxRow = Math.max(n.start.row, n.end.row);
        const minCol = Math.min(n.start.col, n.end.col);
        const maxCol = Math.max(n.start.col, n.end.col);
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            refs.push({ row: r, col: c, absoluteCol: n.start.absoluteCol && n.end.absoluteCol, absoluteRow: n.start.absoluteRow && n.end.absoluteRow, sheetName: n.sheetName });
          }
        }
        break;
      }
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'unary':
        walk(n.operand);
        break;
      case 'function':
        n.args.forEach(walk);
        break;
    }
  }

  walk(node);
  return refs;
}
