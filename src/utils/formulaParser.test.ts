// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { parseFormula, FormulaError, extractCellRefs, adjustFormulaRefs, prefixRefsWithSheet, cellRefToString, rangeToString } from './formulaParser';

/**
 * Deep-clones an AST node stripping position info (pos/endPos) for comparison.
 * The parser now includes position tracking for cross-sheet navigation;
 * existing structural tests verify shape without positions.
 */
function stripPos<T>(node: T): T {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(stripPos) as T;
  const obj = node as Record<string, unknown>;
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key === 'pos' || key === 'endPos') continue;
    if (obj[key] && typeof obj[key] === 'object') {
      rest[key] = stripPos(obj[key] as T);
    } else {
      rest[key] = obj[key];
    }
  }
  return rest as T;
}
import type { CellRefNode, RangeNode } from './formulaParser';

describe('Formula Parser', () => {
  describe('Numbers', () => {
    it('parses integers', () => {
      const ast = parseFormula('42');
      expect(ast).toEqual({ type: 'number', value: 42 });
    });

    it('parses decimals', () => {
      const ast = parseFormula('3.14');
      expect(ast).toEqual({ type: 'number', value: 3.14 });
    });

    it('parses negative numbers via unary minus', () => {
      const ast = parseFormula('-5');
      expect(ast).toEqual({
        type: 'unary',
        op: '-',
        operand: { type: 'number', value: 5 },
      });
    });

    it('parses scientific notation', () => {
      const ast = parseFormula('1e5');
      expect(ast).toEqual({ type: 'number', value: 100000 });
    });

    it('parses scientific notation with exponent sign', () => {
      const ast = parseFormula('2.5E-3');
      expect(ast).toEqual({ type: 'number', value: 0.0025 });
    });

    it('parses scientific notation with positive exponent', () => {
      const ast = parseFormula('1.5e+2');
      expect(ast).toEqual({ type: 'number', value: 150 });
    });
  });

  describe('Strings', () => {
    it('parses string literals', () => {
      const ast = parseFormula('"hello"');
      expect(ast).toEqual({ type: 'string', value: 'hello' });
    });

    it('parses strings with spaces', () => {
      const ast = parseFormula('"hello world"');
      expect(ast).toEqual({ type: 'string', value: 'hello world' });
    });

    it('parses strings with escaped quotes', () => {
      const ast = parseFormula('"say \\"hello\\""');
      expect(ast).toEqual({ type: 'string', value: 'say "hello"' });
    });

    it('parses strings with escaped backslash', () => {
      const ast = parseFormula('"path\\\\file"');
      expect(ast).toEqual({ type: 'string', value: 'path\\file' });
    });

    it('throws on unterminated string', () => {
      expect(() => parseFormula('"hello')).toThrow(FormulaError);
    });
  });

  describe('Cell References', () => {
    it('parses single cell A1', () => {
      const ast = parseFormula('A1');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false });
    });

    it('parses cell B3', () => {
      const ast = parseFormula('B3');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 2, col: 1, absoluteCol: false, absoluteRow: false });
    });

    it('parses multi-letter columns AA1', () => {
      const ast = parseFormula('AA1');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 26, absoluteCol: false, absoluteRow: false });
    });

    it('parses absolute column $A1', () => {
      const ast = parseFormula('$A1');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: false });
    });

    it('parses absolute row A$1', () => {
      const ast = parseFormula('A$1');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: true });
    });

    it('parses fully absolute $A$1', () => {
      const ast = parseFormula('$A$1');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true });
    });
  });

  describe('Ranges', () => {
    it('parses range A1:B5', () => {
      const ast = parseFormula('A1:B5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(stripPos(ast).start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false });
        expect(stripPos(ast).end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: false });
      }
    });

    it('parses absolute range $A$1:$B$5', () => {
      const ast = parseFormula('$A$1:$B$5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(stripPos(ast).start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true });
        expect(stripPos(ast).end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: true, absoluteRow: true });
      }
    });

    it('parses mixed absolute range $A1:B$5', () => {
      const ast = parseFormula('$A1:B$5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(stripPos(ast).start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: false });
        expect(stripPos(ast).end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: true });
      }
    });
  });

  describe('Cross-Sheet References', () => {
    it('parses sheet-qualified cell Sheet1!A1', () => {
      const ast = parseFormula('Sheet1!A1');
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet1' });
    });

    it('parses sheet-qualified range Sheet2!A1:B5', () => {
      const ast = parseFormula('Sheet2!A1:B5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(ast.sheetName).toBe('Sheet2');
        expect(stripPos(ast).start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' });
        expect(stripPos(ast).end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' });
      }
    });

    it('parses quoted sheet name with spaces', () => {
      const ast = parseFormula("'My Sheet'!A1");
      expect(stripPos(ast)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'My Sheet' });
    });

    it('parses sheet-qualified ref in function SUM(Sheet1!A1:A10)', () => {
      const ast = parseFormula('SUM(Sheet1!A1:A10)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
        expect(ast.args[0].type).toBe('range');
        if (ast.args[0].type === 'range') {
          expect(ast.args[0].sheetName).toBe('Sheet1');
        }
      }
    });

    it('parses cross-sheet range with sheet prefix on BOTH ends (Sheet1!A1:Sheet1!B5)', () => {
      // This is what prefixRefsWithSheet produces: Sheet1!B2:Sheet1!B21
      const ast = parseFormula('Sheet1!A1:Sheet1!B5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(ast.sheetName).toBe('Sheet1');
        expect(stripPos(ast).start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet1' });
        expect(stripPos(ast).end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet1' });
      }
    });

    it('parses cross-sheet SUM with sheet prefix on both range ends', () => {
      // Exact user scenario: =SUM(Sheet1!B2:Sheet1!B21)
      const ast = parseFormula('SUM(Sheet1!B2:Sheet1!B21)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
        expect(ast.args[0].type).toBe('range');
        if (ast.args[0].type === 'range') {
          expect(ast.args[0].sheetName).toBe('Sheet1');
          expect(ast.args[0].start.row).toBe(1); // B2 = row 1
          expect(ast.args[0].start.col).toBe(1); // B = col 1
          expect(ast.args[0].end.row).toBe(20); // B21 = row 20
          expect(ast.args[0].end.col).toBe(1); // B = col 1
        }
      }
    });

    it('parses mixed range: bare ref to cross-sheet ref (A1:Sheet1!B5)', () => {
      const ast = parseFormula('A1:Sheet1!B5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(stripPos(ast).start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false });
        expect(stripPos(ast).end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet1' });
      }
    });
  });

  describe('Arithmetic', () => {
    it('parses addition', () => {
      const ast = parseFormula('1 + 2');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('+');
      }
    });

    it('parses multiplication with correct precedence', () => {
      const ast = parseFormula('2 + 3 * 4');
      // Should be: 2 + (3 * 4)
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('+');
        if (ast.right.type === 'binary') {
          expect(ast.right.op).toBe('*');
        }
      }
    });

    it('parses parentheses for grouping', () => {
      const ast = parseFormula('(2 + 3) * 4');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('*');
        if (ast.left.type === 'binary') {
          expect(ast.left.op).toBe('+');
        }
      }
    });

    it('parses division', () => {
      const ast = parseFormula('10 / 2');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('/');
      }
    });
  });

  describe('Comparisons', () => {
    it('parses equals', () => {
      const ast = parseFormula('A1 = B1');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('=');
      }
    });

    it('parses not-equals', () => {
      const ast = parseFormula('A1 <> B1');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('<>');
      }
    });

    it('parses less-than-or-equal', () => {
      const ast = parseFormula('A1 <= 10');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('<=');
      }
    });

    it('parses greater-than', () => {
      const ast = parseFormula('A1 > 10');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('>');
      }
    });

    it('parses greater-than-or-equal', () => {
      const ast = parseFormula('A1 >= 10');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('>=');
      }
    });
  });

  describe('Boolean Literals', () => {
    it('parses TRUE literal', () => {
      const ast = parseFormula('TRUE');
      expect(ast).toEqual({ type: 'boolean', value: true });
    });

    it('parses FALSE literal', () => {
      const ast = parseFormula('FALSE');
      expect(ast).toEqual({ type: 'boolean', value: false });
    });

    it('parses TRUE in function argument', () => {
      const ast = parseFormula('NOT(TRUE)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.args[0]).toEqual({ type: 'boolean', value: true });
      }
    });
  });

  describe('String Concatenation', () => {
    it('parses ampersand operator', () => {
      const ast = parseFormula('"Hello" & " " & "World"');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('&');
      }
    });
  });

  describe('Functions', () => {
    it('parses SUM function', () => {
      const ast = parseFormula('SUM(A1:A10)');
      expect(stripPos(ast)).toEqual({
        type: 'function',
        name: 'SUM',
        args: [
          {
            type: 'range',
            start: { type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false },
            end: { type: 'cell', row: 9, col: 0, absoluteCol: false, absoluteRow: false },
          },
        ],
      });
    });

    it('parses SUM with absolute references', () => {
      const ast = parseFormula('SUM($A$1:$A$10)');
      expect(stripPos(ast)).toEqual({
        type: 'function',
        name: 'SUM',
        args: [
          {
            type: 'range',
            start: { type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true },
            end: { type: 'cell', row: 9, col: 0, absoluteCol: true, absoluteRow: true },
          },
        ],
      });
    });

    it('parses IF function with three args', () => {
      const ast = parseFormula('IF(A1 > 0, "positive", "negative")');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('IF');
        expect(ast.args).toHaveLength(3);
      }
    });

    it('parses nested functions', () => {
      const ast = parseFormula('SUM(A1:A10) + MAX(B1:B10)');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('+');
      }
    });

    it('parses AVERAGE function', () => {
      const ast = parseFormula('AVERAGE(C1:C5)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('AVERAGE');
      }
    });

    it('parses COUNT function', () => {
      const ast = parseFormula('COUNT(A1:A100)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('COUNT');
      }
    });

    it('parses new functions (AND, OR, CONCAT, etc.)', () => {
      const andAst = parseFormula('AND(A1, B1)');
      expect(andAst.type).toBe('function');
      if (andAst.type === 'function') expect(andAst.name).toBe('AND');

      const orAst = parseFormula('OR(TRUE, FALSE)');
      expect(orAst.type).toBe('function');
      if (orAst.type === 'function') {
        expect(orAst.name).toBe('OR');
        expect(orAst.args).toHaveLength(2);
        expect(orAst.args[0]).toEqual({ type: 'boolean', value: true });
        expect(orAst.args[1]).toEqual({ type: 'boolean', value: false });
      }

      const concatAst = parseFormula('CONCAT(A1, B1)');
      expect(concatAst.type).toBe('function');
      if (concatAst.type === 'function') expect(concatAst.name).toBe('CONCAT');

      const lenAst = parseFormula('LEN(A1)');
      expect(lenAst.type).toBe('function');
      if (lenAst.type === 'function') expect(lenAst.name).toBe('LEN');
    });
  });

  describe('Complex Expressions', () => {
    it('parses SUM with additional arithmetic', () => {
      const ast = parseFormula('SUM(A1:A10) * 2 + 1');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('+');
      }
    });

    it('parses formula with multiple cell refs and operators', () => {
      const ast = parseFormula('A1 + B2 * C3 - D4 / 2');
      // Should respect precedence: A1 + (B2*C3) - (D4/2)
      expect(ast.type).toBe('binary');
    });

    it('parses formulas with absolute refs', () => {
      const ast = parseFormula('$A$1 + B2');
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('+');
        expect(stripPos(ast.left)).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true });
      }
    });
  });

  describe('extractCellRefs', () => {
    it('extracts refs from a simple formula', () => {
      const ast = parseFormula('A1 + B2');
      const refs = extractCellRefs(ast);
      expect(refs).toContainEqual({ row: 0, col: 0, absoluteCol: false, absoluteRow: false });
      expect(refs).toContainEqual({ row: 1, col: 1, absoluteCol: false, absoluteRow: false });
    });

    it('extracts refs preserving absolute markers', () => {
      const ast = parseFormula('$A$1 + B2');
      const refs = extractCellRefs(ast);
      expect(refs).toContainEqual({ row: 0, col: 0, absoluteCol: true, absoluteRow: true });
    });

    it('extracts all refs from a range', () => {
      const ast = parseFormula('SUM(A1:C3)');
      const refs = extractCellRefs(ast);
      expect(refs).toHaveLength(9); // 3x3 range
    });
  });

  describe('Error Cases', () => {
    it('throws on unclosed string', () => {
      expect(() => parseFormula('"unclosed')).toThrow(FormulaError);
    });

    it('throws on unmatched parenthesis', () => {
      expect(() => parseFormula('SUM(A1:A10')).toThrow(FormulaError);
    });

    it('throws on invalid character', () => {
      expect(() => parseFormula('A1 # B1')).toThrow(FormulaError);
    });

    it('parses SUM with no arguments (valid — sums nothing)', () => {
      const ast = parseFormula('SUM()');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
        expect(ast.args).toHaveLength(0);
      }
    });
  });

  describe('adjustFormulaRefs', () => {
    it('returns formula unchanged when offset is 0', () => {
      expect(adjustFormulaRefs('A1 + B2', 0, 0)).toBe('A1 + B2');
    });

    it('shifts relative row references down', () => {
      expect(adjustFormulaRefs('A1', 1, 0)).toBe('A2');
    });

    it('shift relative column references right', () => {
      expect(adjustFormulaRefs('A1', 0, 1)).toBe('B1');
    });

    it('does not shift when both absolute', () => {
      expect(adjustFormulaRefs('$A$1', 1, 1)).toBe('$A$1');
    });

    it('shifts only relative part of mixed reference', () => {
      expect(adjustFormulaRefs('$A1', 1, 1)).toBe('$A2');
    });

    it('shifts only relative row of A$1', () => {
      expect(adjustFormulaRefs('A$1', 0, 1)).toBe('B$1');
    });

    it('handles multi-letter columns', () => {
      expect(adjustFormulaRefs('AA1', 0, 1)).toBe('AB1');
    });

    it('handles multiple refs in formula', () => {
      expect(adjustFormulaRefs('A1 + B2', 1, 1)).toBe('B2 + C3');
    });

    it('handles negative offset', () => {
      expect(adjustFormulaRefs('B2', -1, -1)).toBe('A1');
    });

    it('does not go below row 1', () => {
      expect(adjustFormulaRefs('A1', -1, 0)).toBe('A1');
    });

    it('does not go below column A', () => {
      expect(adjustFormulaRefs('A1', 0, -1)).toBe('A1');
    });

    it('handles scientific notation in formula', () => {
      expect(adjustFormulaRefs('A1 + 1e5', 1, 0)).toBe('A2 + 1e5');
    });

    it('handles range references', () => {
      expect(adjustFormulaRefs('SUM(A1:B2)', 1, 1)).toBe('SUM(B2:C3)');
    });

    it('handles lowercase cell references', () => {
      // Normalizes cell refs to uppercase, preserves function name case
      expect(adjustFormulaRefs('sum(a1:a10)', 1, 0)).toBe('sum(A2:A11)');
    });
  });

  describe('adjustFormulaRefs — cross-sheet reference protection (B-018)', () => {
    it('adjusts cross-sheet ref cell part while preserving sheet prefix (col offset)', () => {
      expect(adjustFormulaRefs('Sheet1!A1', 0, 1)).toBe('Sheet1!B1');
    });

    it('adjusts cross-sheet ref cell part while preserving sheet prefix (row offset)', () => {
      expect(adjustFormulaRefs('Sheet1!A1', 1, 0)).toBe('Sheet1!A2');
    });

    it('adjusts cross-sheet ref cell part with both offsets', () => {
      expect(adjustFormulaRefs('Sheet1!A1', 1, 1)).toBe('Sheet1!B2');
    });

    it('adjusts both cross-sheet and relative refs in mixed formula', () => {
      expect(adjustFormulaRefs('Sheet1!A1+B1', 0, 1)).toBe('Sheet1!B1+C1');
    });

    it('handles multiple cross-sheet refs from different sheets', () => {
      expect(adjustFormulaRefs('Sheet1!A1+Sheet2!B2', 0, 1)).toBe('Sheet1!B1+Sheet2!C2');
    });

    it('handles cross-sheet refs with quoted sheet names', () => {
      expect(adjustFormulaRefs("'My Sheet'!A1+B1", 0, 1)).toBe("'My Sheet'!B1+C1");
    });

    it('handles cross-sheet prefix followed by range', () => {
      expect(adjustFormulaRefs('Sheet1!A1:B5', 0, 1)).toBe('Sheet1!B1:C5');
    });

    it('does NOT corrupt sheet name even with large offsets', () => {
      const result = adjustFormulaRefs('Sheet1!A22', 0, 1);
      expect(result).toBe('Sheet1!B22');
      expect(result).not.toContain('SHEEU');
    });

    it('reproduces and fixes the exact user bug scenario', () => {
      // Cross-sheet paste adds prefix, then same-sheet paste with offset
      const prefixed = prefixRefsWithSheet('A22', 'Sheet1');
      expect(prefixed).toBe('Sheet1!A22');
      const result = adjustFormulaRefs(prefixed, 0, 1);
      expect(result).toBe('Sheet1!B22');
    });

    it('handles cross-sheet ref with absolute cell reference', () => {
      expect(adjustFormulaRefs('Sheet1!$A$1', 0, 1)).toBe('Sheet1!$A$1');
    });

    it('handles cross-sheet ref with absolute row', () => {
      expect(adjustFormulaRefs('Sheet1!A$1', 0, 1)).toBe('Sheet1!B$1');
    });
  });

  describe('Case-insensitive parsing', () => {
    it('parses lowercase function names', () => {
      const ast = parseFormula('sum(A1:A10)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
      }
    });

    it('parses mixed case function names', () => {
      const ast = parseFormula('Sum(A1:A10)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
      }
    });

    it('parses lowercase cell references', () => {
      const ast = parseFormula('a1+b2');
      expect(ast.type).toBe('binary');
    });

    it('parses lowercase boolean literals', () => {
      const ast = parseFormula('if(a1>0, true, false)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('IF');
      }
    });

    it('handles the user scenario: =sum(A2+B2)', () => {
      // This was the exact formula the user reported as broken
      const ast = parseFormula('sum(A2+B2)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
        expect(ast.args).toHaveLength(1);
      }
    });

    it('parses lowercase log10', () => {
      const ast = parseFormula('log10(100)');
      expect(ast.type).toBe('function');
      if (ast.type === 'function') {
        expect(ast.name).toBe('LOG10');
      }
    });
  });

  describe('cellRefToString', () => {
    it('converts relative reference', () => {
      const node: CellRefNode = { type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false };
      expect(cellRefToString(node)).toBe('A1');
    });

    it('converts absolute column reference', () => {
      const node: CellRefNode = { type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: false };
      expect(cellRefToString(node)).toBe('$A1');
    });

    it('converts absolute row reference', () => {
      const node: CellRefNode = { type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: true };
      expect(cellRefToString(node)).toBe('A$1');
    });

    it('converts fully absolute reference', () => {
      const node: CellRefNode = { type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true };
      expect(cellRefToString(node)).toBe('$A$1');
    });

    it('handles multi-letter columns', () => {
      const node: CellRefNode = { type: 'cell', row: 9, col: 26, absoluteCol: false, absoluteRow: false };
      expect(cellRefToString(node)).toBe('AA10');
    });
  });

  describe('rangeToString', () => {
    it('converts range to string', () => {
      const node: RangeNode = {
        type: 'range',
        start: { type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false },
        end: { type: 'cell', row: 9, col: 0, absoluteCol: false, absoluteRow: false },
      };
      expect(rangeToString(node)).toBe('A1:A10');
    });

    it('converts absolute range to string', () => {
      const node: RangeNode = {
        type: 'range',
        start: { type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true },
        end: { type: 'cell', row: 4, col: 1, absoluteCol: true, absoluteRow: true },
      };
      expect(rangeToString(node)).toBe('$A$1:$B$5');
    });

    it('emits sheet prefix on range', () => {
      const node: RangeNode = {
        type: 'range',
        sheetName: 'Sheet2',
        start: { type: 'cell', row: 1, col: 2, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' },
        end: { type: 'cell', row: 10, col: 2, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' },
      };
      expect(rangeToString(node)).toBe('Sheet2!C2:C11');
    });

    it('emits sheet prefix on absolute range', () => {
      const node: RangeNode = {
        type: 'range',
        sheetName: 'Sheet2',
        start: { type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true, sheetName: 'Sheet2' },
        end: { type: 'cell', row: 4, col: 1, absoluteCol: true, absoluteRow: true, sheetName: 'Sheet2' },
      };
      expect(rangeToString(node)).toBe('Sheet2!$A$1:$B$5');
    });
  });

  describe('cellRefToString with sheet name', () => {
    it('emits sheet prefix on relative cell', () => {
      const node: CellRefNode = { type: 'cell', row: 1, col: 2, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' };
      expect(cellRefToString(node)).toBe('Sheet2!C2');
    });

    it('emits sheet prefix on absolute cell', () => {
      const node: CellRefNode = { type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true, sheetName: 'Sheet2' };
      expect(cellRefToString(node)).toBe('Sheet2!$A$1');
    });
  });
});

// ─── Cross-Sheet Reference Prefixing ────────────────────────────────

describe('prefixRefsWithSheet', () => {
  it('prefixes simple relative reference', () => {
    expect(prefixRefsWithSheet('A1', 'Sheet1')).toBe('Sheet1!A1');
  });

  it('prefixes multiple references in a formula', () => {
    expect(prefixRefsWithSheet('A1+B1', 'Sheet1')).toBe('Sheet1!A1+Sheet1!B1');
  });

  it('preserves absolute reference markers', () => {
    expect(prefixRefsWithSheet('$A$1', 'Sheet1')).toBe('Sheet1!$A$1');
  });

  it('handles mixed absolute and relative references', () => {
    expect(prefixRefsWithSheet('A1+$B2', 'Sheet1')).toBe('Sheet1!A1+Sheet1!$B2');
  });

  it('does not modify already-qualified cross-sheet references', () => {
    // Sheet2!A1 should NOT be modified (it already has a sheet prefix)
    expect(prefixRefsWithSheet('Sheet2!A1+B1', 'Sheet1')).toBe('Sheet2!A1+Sheet1!B1');
  });

  it('handles sheet names with spaces (quoted)', () => {
    expect(prefixRefsWithSheet('A1', 'My Sheet')).toBe("'My Sheet'!A1");
  });

  it('handles multi-letter column references', () => {
    expect(prefixRefsWithSheet('AA1+AB2', 'Data')).toBe('Data!AA1+Data!AB2');
  });

  it('handles function calls with references', () => {
    expect(prefixRefsWithSheet('SUM(A1:A10)', 'Sheet1')).toBe('SUM(Sheet1!A1:Sheet1!A10)');
  });

  it('handles empty formula', () => {
    expect(prefixRefsWithSheet('', 'Sheet1')).toBe('');
  });

  it('handles formula with no references', () => {
    expect(prefixRefsWithSheet('42+10', 'Sheet1')).toBe('42+10');
  });
});

// ─── Complex Formula Patterns ─────────────────────────────────────────
// Verifies that common real-world formula patterns parse correctly.

describe('Complex Formula Patterns', () => {
  describe('Pattern 1: +C10+D10 (addition with + prefix)', () => {
    it('parses + prefix as unary plus', () => {
      const ast = parseFormula('+C10+D10');
      // Should be: unary+(C10) + D10
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('+');
        expect(ast.left.type).toBe('unary');
        if (ast.left.type === 'unary') {
          expect(ast.left.op).toBe('+');
        }
        expect(ast.right.type).toBe('cell');
      }
    });

    it('extracts both cell references', () => {
      const ast = parseFormula('+C10+D10');
      const refs = extractCellRefs(ast);
      expect(refs).toHaveLength(2);
      expect(refs[0].row).toBe(9); // C10 = row 9 (0-indexed)
      expect(refs[0].col).toBe(2); // C = col 2
      expect(refs[1].row).toBe(9); // D10 = row 9
      expect(refs[1].col).toBe(3); // D = col 3
    });
  });

  describe('Pattern 2: +F4/100 (division with + prefix)', () => {
    it('parses +F4/100 correctly', () => {
      const ast = parseFormula('+F4/100');
      // Should be: (unary+(F4)) / 100
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('/');
        expect(ast.left.type).toBe('unary');
        expect(ast.right.type).toBe('number');
        if (ast.right.type === 'number') {
          expect(ast.right.value).toBe(100);
        }
      }
    });

    it('extracts F4 reference', () => {
      const ast = parseFormula('+F4/100');
      const refs = extractCellRefs(ast);
      expect(refs).toHaveLength(1);
      expect(refs[0].row).toBe(3); // F4 = row 3
      expect(refs[0].col).toBe(5); // F = col 5
    });
  });

  describe('Pattern 3: =(A17+D17)*0.25 (parenthesized expression)', () => {
    it('parses parenthesized addition with multiplication', () => {
      // Note: parseFormula expects the formula without the leading '='
      const ast = parseFormula('(A17+D17)*0.25');
      // Should be: (A17 + D17) * 0.25
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('*');
        expect(ast.left.type).toBe('binary');
        if (ast.left.type === 'binary') {
          expect(ast.left.op).toBe('+');
        }
        expect(ast.right.type).toBe('number');
        if (ast.right.type === 'number') {
          expect(ast.right.value).toBe(0.25);
        }
      }
    });

    it('extracts both cell references', () => {
      // Note: parseFormula expects the formula without the leading '='
      const ast = parseFormula('(A17+D17)*0.25');
      const refs = extractCellRefs(ast);
      expect(refs).toHaveLength(2);
      expect(refs[0].row).toBe(16); // A17 = row 16
      expect(refs[0].col).toBe(0); // A = col 0
      expect(refs[1].row).toBe(16); // D17 = row 16
      expect(refs[1].col).toBe(3); // D = col 3
    });
  });

  describe('Pattern 4: =-F15 (unary minus on cell)', () => {
    it('parses unary minus on cell reference', () => {
      // Note: parseFormula expects the formula without the leading '='
      const ast = parseFormula('-F15');
      // Should be: unary-(F15)
      expect(ast.type).toBe('unary');
      if (ast.type === 'unary') {
        expect(ast.op).toBe('-');
        expect(ast.operand.type).toBe('cell');
        if (ast.operand.type === 'cell') {
          expect(ast.operand.row).toBe(14); // F15 = row 14
          expect(ast.operand.col).toBe(5); // F = col 5
        }
      }
    });

    it('extracts F15 reference', () => {
      // Note: parseFormula expects the formula without the leading '='
      const ast = parseFormula('-F15');
      const refs = extractCellRefs(ast);
      expect(refs).toHaveLength(1);
      expect(refs[0].row).toBe(14); // F15 = row 14
      expect(refs[0].col).toBe(5); // F = col 5
    });
  });

  describe('Pattern 5: Edge cases', () => {
    it('parses double unary minus --F15', () => {
      const ast = parseFormula('--F15');
      // Should be: unary-(unary-(F15))
      expect(ast.type).toBe('unary');
      if (ast.type === 'unary') {
        expect(ast.op).toBe('-');
        expect(ast.operand.type).toBe('unary');
      }
    });

    it('parses explicit unary plus +F15', () => {
      const ast = parseFormula('+F15');
      // Should be: unary+(F15)
      expect(ast.type).toBe('unary');
      if (ast.type === 'unary') {
        expect(ast.op).toBe('+');
        expect(ast.operand.type).toBe('cell');
      }
    });

    it('parses nested parentheses ((A1+B1)*C1)', () => {
      // Note: parseFormula expects the formula without the leading '='
      const ast = parseFormula('((A1+B1)*C1)');
      // Should be: (A1 + B1) * C1
      expect(ast.type).toBe('binary');
      if (ast.type === 'binary') {
        expect(ast.op).toBe('*');
      }
    });
  });
});

describe('NameRefNode (named ranges)', () => {
  it('parses a bare identifier as a name_ref', () => {
    const ast = parseFormula('SalesData');
    expect(ast.type).toBe('name_ref');
    if (ast.type === 'name_ref') {
      expect(ast.name).toBe('SalesData');
    }
  });

  it('parses a name_ref with underscores and dots', () => {
    const ast = parseFormula('Sales_Data.Q1');
    expect(ast.type).toBe('name_ref');
    if (ast.type === 'name_ref') {
      expect(ast.name).toBe('Sales_Data.Q1');
    }
  });

  it('parses a name_ref used in binary expression', () => {
    const ast = parseFormula('SalesData+1');
    expect(ast.type).toBe('binary');
    if (ast.type === 'binary') {
      expect(ast.op).toBe('+');
      expect(ast.left.type).toBe('name_ref');
      if (ast.left.type === 'name_ref') {
        expect(ast.left.name).toBe('SalesData');
      }
    }
  });

  it('parses a name_ref as a function argument', () => {
    const ast = parseFormula('SUM(SalesData)');
    expect(ast.type).toBe('function');
    if (ast.type === 'function') {
      expect(ast.name).toBe('SUM');
      expect(ast.args).toHaveLength(1);
      expect(ast.args[0].type).toBe('name_ref');
    }
  });

  it('parses a function call normally (followed by parenthesis)', () => {
    const ast = parseFormula('SUM(A1:A10)');
    expect(ast.type).toBe('function');
    if (ast.type === 'function') {
      expect(ast.name).toBe('SUM');
      expect(ast.args[0].type).toBe('range');
    }
  });

  it('does not produce cell refs in extractCellRefs for a name_ref', () => {
    const ast = parseFormula('SUM(SalesData, A1)');
    const refs = extractCellRefs(ast);
    // Only A1 should be extracted; SalesData is a name_ref (resolved at eval time).
    expect(refs).toHaveLength(1);
    expect(refs[0].row).toBe(0);
    expect(refs[0].col).toBe(0);
  });
});
