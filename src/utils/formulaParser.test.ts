import { parseFormula, FormulaError, extractCellRefs, adjustFormulaRefs, cellRefToString, rangeToString } from './formulaParser';
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
      expect(ast).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false });
    });

    it('parses cell B3', () => {
      const ast = parseFormula('B3');
      expect(ast).toEqual({ type: 'cell', row: 2, col: 1, absoluteCol: false, absoluteRow: false });
    });

    it('parses multi-letter columns AA1', () => {
      const ast = parseFormula('AA1');
      expect(ast).toEqual({ type: 'cell', row: 0, col: 26, absoluteCol: false, absoluteRow: false });
    });

    it('parses absolute column $A1', () => {
      const ast = parseFormula('$A1');
      expect(ast).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: false });
    });

    it('parses absolute row A$1', () => {
      const ast = parseFormula('A$1');
      expect(ast).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: true });
    });

    it('parses fully absolute $A$1', () => {
      const ast = parseFormula('$A$1');
      expect(ast).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true });
    });
  });

  describe('Ranges', () => {
    it('parses range A1:B5', () => {
      const ast = parseFormula('A1:B5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(ast.start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false });
        expect(ast.end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: false });
      }
    });

    it('parses absolute range $A$1:$B$5', () => {
      const ast = parseFormula('$A$1:$B$5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(ast.start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true });
        expect(ast.end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: true, absoluteRow: true });
      }
    });

    it('parses mixed absolute range $A1:B$5', () => {
      const ast = parseFormula('$A1:B$5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(ast.start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: false });
        expect(ast.end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: true });
      }
    });
  });

  describe('Cross-Sheet References', () => {
    it('parses sheet-qualified cell Sheet1!A1', () => {
      const ast = parseFormula('Sheet1!A1');
      expect(ast).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet1' });
    });

    it('parses sheet-qualified range Sheet2!A1:B5', () => {
      const ast = parseFormula('Sheet2!A1:B5');
      expect(ast.type).toBe('range');
      if (ast.type === 'range') {
        expect(ast.sheetName).toBe('Sheet2');
        expect(ast.start).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' });
        expect(ast.end).toEqual({ type: 'cell', row: 4, col: 1, absoluteCol: false, absoluteRow: false, sheetName: 'Sheet2' });
      }
    });

    it('parses quoted sheet name with spaces', () => {
      const ast = parseFormula("'My Sheet'!A1");
      expect(ast).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: false, absoluteRow: false, sheetName: 'My Sheet' });
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
      expect(ast).toEqual({
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
      expect(ast).toEqual({
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
        expect(ast.left).toEqual({ type: 'cell', row: 0, col: 0, absoluteCol: true, absoluteRow: true });
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
  });
});
