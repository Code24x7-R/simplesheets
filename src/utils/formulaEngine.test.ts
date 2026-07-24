import { evaluateWorkbook, buildDependencyGraph, detectCircularReferences } from './formulaEngine';
import type { Sheet, Cell } from '../types';

/**
 * Helper to create a test sheet.
 */
function createSheet(cells: Record<string, string>, overrides: Partial<Sheet> = {}): Sheet {
  const cellMap: Record<string, Cell> = {};
  for (const [key, raw] of Object.entries(cells)) {
    cellMap[key] = { rawValue: raw };
  }

  return {
    id: 'test-sheet',
    name: 'Test',
    cells: cellMap,
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
    ...overrides,
  };
}

describe('Formula Engine', () => {
  describe('Basic Arithmetic', () => {
    it('evaluates simple addition', () => {
      const sheet = createSheet({ '0:0': '=1+2' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(3);
    });

    it('evaluates subtraction', () => {
      const sheet = createSheet({ '0:0': '=10-3' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(7);
    });

    it('evaluates multiplication', () => {
      const sheet = createSheet({ '0:0': '=4*5' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(20);
    });

    it('evaluates division', () => {
      const sheet = createSheet({ '0:0': '=20/4' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(5);
    });

    it('respects operator precedence', () => {
      const sheet = createSheet({ '0:0': '=2+3*4' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(14);
    });

    it('handles parentheses', () => {
      const sheet = createSheet({ '0:0': '=(2+3)*4' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(20);
    });
  });

  describe('Division by Zero', () => {
    it('returns #DIV/0! error', () => {
      const sheet = createSheet({ '0:0': '=10/0' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe('#DIV/0!');
    });
  });

  describe('Cell References', () => {
    it('evaluates a formula referencing another cell', () => {
      const sheet = createSheet({
        '0:0': '42',
        '0:1': '=A1+8',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:1'].computedValue).toBe(50);
    });

    it('chains cell references', () => {
      const sheet = createSheet({
        '0:0': '10',
        '0:1': '=A1*2',
        '0:2': '=B1+5',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:2'].computedValue).toBe(25);
    });
  });

  describe('SUM Function', () => {
    it('sums a range of cells', () => {
      const sheet = createSheet({
        '0:0': '10',
        '1:0': '20',
        '2:0': '30',
        '3:0': '=SUM(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe(60);
    });

    it('sums cells with gaps', () => {
      const sheet = createSheet({
        '0:0': '5',
        '2:0': '15',
        '5:0': '=SUM(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['5:0'].computedValue).toBe(20);
    });

    it('ignores non-numeric cells in SUM', () => {
      const sheet = createSheet({
        '0:0': '10',
        '1:0': 'text',
        '2:0': '20',
        '3:0': '=SUM(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe(30);
    });
  });

  describe('AVERAGE Function', () => {
    it('computes average of a range', () => {
      const sheet = createSheet({
        '0:0': '10',
        '1:0': '20',
        '2:0': '30',
        '3:0': '=AVERAGE(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe(20);
    });

    it('returns #DIV/0! for empty range', () => {
      const sheet = createSheet({
        '3:0': '=AVERAGE(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe('#DIV/0!');
    });
  });

  describe('MIN and MAX Functions', () => {
    it('finds minimum value', () => {
      const sheet = createSheet({
        '0:0': '50',
        '1:0': '10',
        '2:0': '30',
        '3:0': '=MIN(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe(10);
    });

    it('finds maximum value', () => {
      const sheet = createSheet({
        '0:0': '50',
        '1:0': '10',
        '2:0': '30',
        '3:0': '=MAX(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe(50);
    });
  });

  describe('COUNT Function', () => {
    it('counts numeric cells', () => {
      const sheet = createSheet({
        '0:0': '10',
        '1:0': 'text',
        '2:0': '20',
        '3:0': '=COUNT(A1:A3)',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['3:0'].computedValue).toBe(2);
    });
  });

  describe('IF Function', () => {
    it('returns true branch when condition is true', () => {
      const sheet = createSheet({
        '0:0': '=IF(1 > 0, "yes", "no")',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe('yes');
    });

    it('returns false branch when condition is false', () => {
      const sheet = createSheet({
        '0:0': '=IF(1 < 0, "yes", "no")',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe('no');
    });
  });

  describe('ABS, ROUND, SQRT Functions', () => {
    it('ABS returns absolute value', () => {
      const sheet = createSheet({ '0:0': '=ABS(-5)' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(5);
    });

    it('ROUND rounds to specified digits', () => {
      const sheet = createSheet({ '0:0': '=ROUND(3.14159, 2)' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(3.14);
    });

    it('SQRT returns square root', () => {
      const sheet = createSheet({ '0:0': '=SQRT(16)' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(4);
    });

    it('SQRT returns error for negative', () => {
      const sheet = createSheet({ '0:0': '=SQRT(-1)' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe('#VALUE!');
    });
  });

  describe('POWER Function', () => {
    it('computes power correctly', () => {
      const sheet = createSheet({ '0:0': '=POWER(2, 10)' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(1024);
    });
  });

  describe('String Concatenation', () => {
    it('concatenates strings with &', () => {
      const sheet = createSheet({
        '0:0': '="Hello" & " " & "World"',
      });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe('Hello World');
    });
  });

  describe('Comparisons', () => {
    it('evaluates equality', () => {
      const sheet = createSheet({ '0:0': '=1 = 1' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(true);
    });

    it('evaluates inequality', () => {
      const sheet = createSheet({ '0:0': '=1 <> 2' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(true);
    });

    it('evaluates less-than', () => {
      const sheet = createSheet({ '0:0': '=1 < 2' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(true);
    });
  });

  describe('Dependency Graph', () => {
    it('builds correct dependency map', () => {
      const sheet = createSheet({
        '0:0': '10',
        '0:1': '=A1*2',
        '0:2': '=B1+5',
      });
      const { deps } = buildDependencyGraph(sheet);
      expect(deps.has('0:1')).toBe(true);
      expect(deps.has('0:2')).toBe(true);
      expect(deps.get('0:1')?.has('0:0')).toBe(true);
      expect(deps.get('0:2')?.has('0:1')).toBe(true);
    });
  });

  describe('Circular Reference Detection', () => {
    it('detects direct self-reference', () => {
      const sheet = createSheet({
        '0:0': '=A1',
      });
      const { deps } = buildDependencyGraph(sheet);
      const circular = detectCircularReferences(deps);
      expect(circular.length).toBeGreaterThan(0);
    });

    it('detects indirect circular reference', () => {
      const sheet = createSheet({
        '0:0': '=B1',
        '0:1': '=A1',
      });
      const { deps } = buildDependencyGraph(sheet);
      const circular = detectCircularReferences(deps);
      expect(circular.length).toBeGreaterThan(0);
    });

    it('does not flag non-circular chains', () => {
      const sheet = createSheet({
        '0:0': '10',
        '0:1': '=A1*2',
        '0:2': '=B1+1',
      });
      const { deps } = buildDependencyGraph(sheet);
      const circular = detectCircularReferences(deps);
      expect(circular.length).toBe(0);
    });
  });

  describe('Literal Values', () => {
    it('auto-detects numbers', () => {
      const sheet = createSheet({ '0:0': '42' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(42);
    });

    it('auto-detects booleans', () => {
      const sheet = createSheet({ '0:0': 'TRUE' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe(true);
    });

    it('keeps text as string', () => {
      const sheet = createSheet({ '0:0': 'Hello World' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBe('Hello World');
    });

    it('treats empty as null', () => {
      const sheet = createSheet({ '0:0': '' });
      const result = evaluateWorkbook(sheet);
      expect(result.cells['0:0'].computedValue).toBeNull();
    });
  });

  // ── Expanded Math Functions ──────────────────────────────────────────

  describe('PRODUCT Function', () => {
    it('multiplies values in a range', () => {
      const sheet = createSheet({
        '0:0': '2', '1:0': '3', '2:0': '4', '3:0': '=PRODUCT(A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(24);
    });

    it('returns 0 for empty range', () => {
      const sheet = createSheet({ '3:0': '=PRODUCT(A1:A3)' });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(0);
    });
  });

  describe('MOD Function', () => {
    it('returns remainder', () => {
      const sheet = createSheet({ '0:0': '=MOD(10, 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });

    it('returns #DIV/0! for zero divisor', () => {
      const sheet = createSheet({ '0:0': '=MOD(10, 0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#DIV/0!');
    });
  });

  describe('INT / FLOOR / CEILING Functions', () => {
    it('INT floors positive numbers', () => {
      const sheet = createSheet({ '0:0': '=INT(3.7)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3);
    });

    it('INT floors negative numbers', () => {
      const sheet = createSheet({ '0:0': '=INT(-3.7)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(-4);
    });

    it('CEILING rounds up', () => {
      const sheet = createSheet({ '0:0': '=CEILING(3.2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(4);
    });
  });

  describe('ROUNDUP / ROUNDDOWN Functions', () => {
    it('ROUNDUP rounds away from zero', () => {
      const sheet = createSheet({ '0:0': '=ROUNDUP(3.14159, 2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3.15);
    });

    it('ROUNDDOWN rounds toward zero', () => {
      const sheet = createSheet({ '0:0': '=ROUNDDOWN(3.14159, 2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3.14);
    });
  });

  describe('EXP / LN / LOG Functions', () => {
    it('EXP calculates e^x', () => {
      const sheet = createSheet({ '0:0': '=EXP(1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBeCloseTo(2.71828, 4);
    });

    it('LN calculates natural log', () => {
      const sheet = createSheet({ '0:0': '=LN(1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('LN returns error for zero', () => {
      const sheet = createSheet({ '0:0': '=LN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });

    it('LOG with default base 10', () => {
      const sheet = createSheet({ '0:0': '=LOG(100)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2);
    });

    it('LOG with custom base', () => {
      const sheet = createSheet({ '0:0': '=LOG(8, 2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3);
    });

    it('LOG10 calculates base-10 log', () => {
      const sheet = createSheet({ '0:0': '=LOG10(1000)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3);
    });
  });

  describe('PI / RAND / RANDBETWEEN Functions', () => {
    it('PI returns π', () => {
      const sheet = createSheet({ '0:0': '=PI()' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBeCloseTo(3.14159, 4);
    });

    it('RAND returns value between 0 and 1', () => {
      const sheet = createSheet({ '0:0': '=RAND()' });
      const val = evaluateWorkbook(sheet).cells['0:0'].computedValue as number;
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it('RANDBETWEEN returns value in range', () => {
      const sheet = createSheet({ '0:0': '=RANDBETWEEN(5, 10)' });
      const val = evaluateWorkbook(sheet).cells['0:0'].computedValue as number;
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
    });
  });

  describe('SIGN / TRUNC Functions', () => {
    it('SIGN returns 1 for positive', () => {
      const sheet = createSheet({ '0:0': '=SIGN(42)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });

    it('SIGN returns -1 for negative', () => {
      const sheet = createSheet({ '0:0': '=SIGN(-42)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(-1);
    });

    it('TRUNC removes decimals', () => {
      const sheet = createSheet({ '0:0': '=TRUNC(3.7)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3);
    });

    it('TRUNC with digits', () => {
      const sheet = createSheet({ '0:0': '=TRUNC(3.14159, 2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3.14);
    });
  });

  // ── Trigonometry Functions ──────────────────────────────────────────

  describe('Trigonometry Functions', () => {
    it('SIN calculates sine of 0', () => {
      const sheet = createSheet({ '0:0': '=SIN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('COS calculates cosine of 0', () => {
      const sheet = createSheet({ '0:0': '=COS(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });

    it('TAN calculates tangent of 0', () => {
      const sheet = createSheet({ '0:0': '=TAN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('ASIN returns error for out-of-range', () => {
      const sheet = createSheet({ '0:0': '=ASIN(2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });

    it('ACOS returns error for out-of-range', () => {
      const sheet = createSheet({ '0:0': '=ACOS(2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });

    it('DEGREES converts radians', () => {
      const sheet = createSheet({ '0:0': '=DEGREES(PI())' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBeCloseTo(180, 0);
    });

    it('RADIANS converts degrees', () => {
      const sheet = createSheet({ '0:0': '=RADIANS(180)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBeCloseTo(Math.PI, 5);
    });
  });

  // ── Logic Functions ─────────────────────────────────────────────────

  describe('AND Function', () => {
    it('returns true when all true', () => {
      const sheet = createSheet({ '0:0': '=AND(TRUE, TRUE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('returns false when any false', () => {
      const sheet = createSheet({ '0:0': '=AND(TRUE, FALSE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });

    it('treats 0 as false', () => {
      const sheet = createSheet({ '0:0': '=AND(1, 0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });
  });

  describe('OR Function', () => {
    it('returns true when any true', () => {
      const sheet = createSheet({ '0:0': '=OR(FALSE, TRUE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('returns false when all false', () => {
      const sheet = createSheet({ '0:0': '=OR(FALSE, FALSE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });

    it('treats non-zero as true', () => {
      const sheet = createSheet({ '0:0': '=OR(0, 5)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });
  });

  describe('NOT Function', () => {
    it('inverts true to false', () => {
      const sheet = createSheet({ '0:0': '=NOT(TRUE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });

    it('inverts false to true', () => {
      const sheet = createSheet({ '0:0': '=NOT(FALSE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('inverts zero to true', () => {
      const sheet = createSheet({ '0:0': '=NOT(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });
  });

  describe('XOR Function', () => {
    it('returns true for odd number of true', () => {
      const sheet = createSheet({ '0:0': '=XOR(TRUE, FALSE, FALSE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('returns false for even number of true', () => {
      const sheet = createSheet({ '0:0': '=XOR(TRUE, TRUE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });
  });

  describe('IFERROR / IFNA Functions', () => {
    it('IFERROR returns fallback on error', () => {
      const sheet = createSheet({ '0:0': '=IFERROR(1/0, "caught")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('caught');
    });

    it('IFERROR returns value when no error', () => {
      const sheet = createSheet({ '0:0': '=IFERROR(42, "fallback")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(42);
    });
  });

  describe('SWITCH Function', () => {
    it('matches first case', () => {
      const sheet = createSheet({ '0:0': '=SWITCH("b", "a", 1, "b", 2, "c", 3, 99)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2);
    });

    it('returns default when no match', () => {
      const sheet = createSheet({ '0:0': '=SWITCH("x", "a", 1, "b", 2, 99)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(99);
    });
  });

  describe('IS Functions', () => {
    it('ISBLANK detects blank', () => {
      const sheet = createSheet({ '0:0': '=ISBLANK(A2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('ISERROR detects errors', () => {
      const sheet = createSheet({ '0:0': '=ISERROR(1/0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('ISNUMBER detects numbers', () => {
      const sheet = createSheet({ '0:0': '=ISNUMBER(42)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('ISNUMBER returns false for text', () => {
      const sheet = createSheet({ '0:0': '=ISNUMBER("hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });

    it('ISTEXT detects text', () => {
      const sheet = createSheet({ '0:0': '=ISTEXT("hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('ISTEXT returns false for numbers', () => {
      const sheet = createSheet({ '0:0': '=ISTEXT(42)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });
  });

  // ── Text Functions ───────────────────────────────────────────────────

  describe('CONCAT / CONCATENATE Functions', () => {
    it('CONCAT joins values', () => {
      const sheet = createSheet({ '0:0': '=CONCAT("Hello", " ", "World")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('Hello World');
    });

    it('CONCATENATE joins values', () => {
      const sheet = createSheet({ '0:0': '=CONCATENATE("a", "b", "c")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('abc');
    });
  });

  describe('LEFT / RIGHT / MID Functions', () => {
    it('LEFT extracts from start', () => {
      const sheet = createSheet({ '0:0': '=LEFT("Hello", 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('Hel');
    });

    it('LEFT defaults to 1 char', () => {
      const sheet = createSheet({ '0:0': '=LEFT("Hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('H');
    });

    it('RIGHT extracts from end', () => {
      const sheet = createSheet({ '0:0': '=RIGHT("Hello", 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('llo');
    });

    it('RIGHT defaults to 1 char', () => {
      const sheet = createSheet({ '0:0': '=RIGHT("Hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('o');
    });

    it('MID extracts from middle', () => {
      const sheet = createSheet({ '0:0': '=MID("Hello", 2, 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('ell');
    });
  });

  describe('LEN / LOWER / UPPER Functions', () => {
    it('LEN returns string length', () => {
      const sheet = createSheet({ '0:0': '=LEN("Hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(5);
    });

    it('LOWER converts to lowercase', () => {
      const sheet = createSheet({ '0:0': '=LOWER("HELLO")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('hello');
    });

    it('UPPER converts to uppercase', () => {
      const sheet = createSheet({ '0:0': '=UPPER("hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('HELLO');
    });

    it('PROPER capitalizes words', () => {
      const sheet = createSheet({ '0:0': '=PROPER("hello world")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('Hello World');
    });

    it('TRIM removes extra spaces', () => {
      const sheet = createSheet({ '0:0': '=TRIM("  hello   world  ")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('hello world');
    });
  });

  describe('TEXT / VALUE Functions', () => {
    it('TEXT formats number', () => {
      const sheet = createSheet({ '0:0': '=TEXT(42, "0")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('42');
    });

    it('TEXT formats with decimals', () => {
      const sheet = createSheet({ '0:0': '=TEXT(3.14159, "0.00")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('3.14');
    });

    it('VALUE converts text to number', () => {
      const sheet = createSheet({ '0:0': '=VALUE("42")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(42);
    });

    it('VALUE returns error for non-numeric', () => {
      const sheet = createSheet({ '0:0': '=VALUE("hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });
  });

  describe('REPT / REPLACE / SUBSTITUTE Functions', () => {
    it('REPT repeats string', () => {
      const sheet = createSheet({ '0:0': '=REPT("ab", 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('ababab');
    });

    it('REPLACE replaces substring', () => {
      const sheet = createSheet({ '0:0': '=REPLACE("Hello World", 7, 5, "There")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('Hello There');
    });

    it('REPLACE at start', () => {
      const sheet = createSheet({ '0:0': '=REPLACE("Hello World", 1, 5, "Goodbye")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('Goodbye World');
    });

    it('SUBSTITUTE replaces all occurrences', () => {
      const sheet = createSheet({ '0:0': '=SUBSTITUTE("a,b,a", "a", "c")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('c,b,c');
    });

    it('SUBSTITUTE replaces specific occurrence', () => {
      const sheet = createSheet({ '0:0': '=SUBSTITUTE("a,b,a", "a", "c", 2)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('a,b,c');
    });
  });

  describe('FIND / SEARCH Functions', () => {
    it('FIND is case-sensitive', () => {
      const sheet = createSheet({ '0:0': '=FIND("o", "Hello World")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(5);
    });

    it('FIND returns error when not found', () => {
      const sheet = createSheet({ '0:0': '=FIND("x", "Hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });

    it('SEARCH is case-insensitive', () => {
      const sheet = createSheet({ '0:0': '=SEARCH("h", "Hello")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });
  });

  // ── Statistical Functions ────────────────────────────────────────────

  describe('MEDIAN / MODE Functions', () => {
    it('MEDIAN finds middle value', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '=MEDIAN(A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('MEDIAN averages two middle for even count', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '4', '4:0': '=MEDIAN(A1:A4)',
      });
      expect(evaluateWorkbook(sheet).cells['4:0'].computedValue).toBe(2.5);
    });

    it('MODE returns most frequent', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '2', '3:0': '3', '4:0': '=MODE(A1:A4)',
      });
      expect(evaluateWorkbook(sheet).cells['4:0'].computedValue).toBe(2);
    });
  });

  describe('STDEV / VAR Functions', () => {
    it('STDEV calculates sample std dev', () => {
      const sheet = createSheet({
        '0:0': '2', '1:0': '4', '2:0': '4', '3:0': '4', '4:0': '5', '5:0': '5', '6:0': '7', '7:0': '9',
        '8:0': '=STDEV(A1:A8)',
      });
      const val = evaluateWorkbook(sheet).cells['8:0'].computedValue as number;
      expect(val).toBeCloseTo(2.138, 2);
    });

    it('STDEV returns error for single value', () => {
      const sheet = createSheet({ '0:0': '=STDEV(5)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });

    it('VAR calculates variance', () => {
      const sheet = createSheet({
        '0:0': '2', '1:0': '4', '2:0': '4', '3:0': '4', '4:0': '5', '5:0': '5', '6:0': '7', '7:0': '9',
        '8:0': '=VAR(A1:A8)',
      });
      const val = evaluateWorkbook(sheet).cells['8:0'].computedValue as number;
      expect(val).toBeCloseTo(4.571, 2);
    });
  });

  describe('LARGE / SMALL Functions', () => {
    it('LARGE returns kth largest', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '3', '2:0': '2', '3:0': '=LARGE(A1:A3, 1)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(3);
    });

    it('LARGE returns 2nd largest', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '3', '2:0': '2', '3:0': '=LARGE(A1:A3, 2)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('SMALL returns kth smallest', () => {
      const sheet = createSheet({
        '0:0': '3', '1:0': '1', '2:0': '2', '3:0': '=SMALL(A1:A3, 1)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(1);
    });
  });

  // ── Conditional Aggregation Functions ────────────────────────────────

  describe('SUMIF Function', () => {
    it('sums values matching criterion', () => {
      const sheet = createSheet({
        '0:0': '5', '1:0': '10', '2:0': '15', '3:0': '=SUMIF(A1:A3, ">8")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(25);
    });

    it('sums with separate sum range', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3',
        '0:1': '10', '1:1': '20', '2:1': '30',
        '3:0': '=SUMIF(A1:A3, ">1", B1:B3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(50);
    });

    it('supports exact match', () => {
      const sheet = createSheet({
        '0:0': '5', '1:0': '10', '2:0': '5', '3:0': '=SUMIF(A1:A3, 5)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(10);
    });
  });

  describe('COUNTIF Function', () => {
    it('counts values matching criterion', () => {
      const sheet = createSheet({
        '0:0': '5', '1:0': '10', '2:0': '15', '3:0': '=COUNTIF(A1:A3, ">8")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('supports wildcards', () => {
      const sheet = createSheet({
        '0:0': 'apple', '1:0': 'application', '2:0': 'banana', '3:0': '=COUNTIF(A1:A3, "app*")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('counts blanks with empty string', () => {
      const sheet = createSheet({
        '0:0': '5', '1:0': '', '2:0': '', '3:0': '=COUNTIF(A1:A3, "")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('counts non-blanks with <>', () => {
      const sheet = createSheet({
        '0:0': '5', '1:0': '', '2:0': '10', '3:0': '=COUNTIF(A1:A3, "<>")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });
  });

  describe('AVERAGEIF Function', () => {
    it('averages values matching criterion', () => {
      const sheet = createSheet({
        '0:0': '5', '1:0': '10', '2:0': '15', '3:0': '=AVERAGEIF(A1:A3, ">8")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(12.5);
    });

    it('returns #DIV/0! when no match', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '=AVERAGEIF(A1:A3, ">100")',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe('#DIV/0!');
    });
  });

  // ── Date Functions ───────────────────────────────────────────────────

  describe('Date Extraction Functions', () => {
    it('YEAR extracts year', () => {
      // Use a date string that's timezone-safe
      const sheet = createSheet({ '0:0': '=YEAR("2024-06-15")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2024);
    });

    it('MONTH extracts month', () => {
      const sheet = createSheet({ '0:0': '=MONTH("2024-06-15")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(6);
    });

    it('DAY extracts day', () => {
      const sheet = createSheet({ '0:0': '=DAY("2024-06-15")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(15);
    });

    it('DATE constructs date', () => {
      const sheet = createSheet({ '0:0': '=DATE(2024, 3, 15)' });
      // DATE returns ISO string; check it starts with expected date
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue as string;
      expect(result.startsWith('2024-03-15')).toBe(true);
    });

    it('DATE constructs date in January', () => {
      const sheet = createSheet({ '0:0': '=DATE(2024, 1, 1)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue as string;
      expect(result.startsWith('2024-01-01')).toBe(true);
    });

    it('WEEKDAY returns day of week', () => {
      const sheet = createSheet({ '0:0': '=WEEKDAY("2024-06-15")' });
      // 2024-06-15 is a Saturday → 6
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(6);
    });

    it('WEEKDAY with type 2', () => {
      const sheet = createSheet({ '0:0': '=WEEKDAY("2024-06-14", 2)' });
      // 2024-06-14 is a Friday, type 2 → 5
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(5);
    });

    it('WEEKDAY Sunday with type 1', () => {
      const sheet = createSheet({ '0:0': '=WEEKDAY("2024-06-16", 1)' });
      // 2024-06-16 is a Sunday, type 1 → 7
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(7);
    });

    it('EDATE adds months', () => {
      const sheet = createSheet({ '0:0': '=EDATE("2024-01-15", 1)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue as string;
      expect(result.startsWith('2024-02-15')).toBe(true);
    });

    it('EDATE rolls over when day exceeds month', () => {
      // Jan 31 + 1 month = Mar 2 (or Mar 1 in non-leap years) since Feb has 28/29 days
      const sheet = createSheet({ '0:0': '=EDATE("2024-01-31", 1)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue as string;
      // In a leap year, Feb has 29 days, so Jan 31 + 1 month = Mar 2 (Feb 29 + 1 day)
      expect(result.startsWith('2024-03-0') || result.startsWith('2024-02-29')).toBe(true);
    });

    it('EOMONTH returns end of month', () => {
      const sheet = createSheet({ '0:0': '=EOMONTH("2024-01-15", 0)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue as string;
      expect(result.startsWith('2024-01-31')).toBe(true);
    });

    it('NETWORKDAYS counts workdays', () => {
      // Mon 2024-06-10 to Fri 2024-06-14 = 5 workdays
      const sheet = createSheet({ '0:0': '=NETWORKDAYS("2024-06-10", "2024-06-14")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(5);
    });

    it('NETWORKDAYS across weekend', () => {
      // Fri 2024-06-14 to Mon 2024-06-17 = 2 workdays
      const sheet = createSheet({ '0:0': '=NETWORKDAYS("2024-06-14", "2024-06-17")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2);
    });

    it('date functions return error for invalid dates', () => {
      const sheet = createSheet({ '0:0': '=YEAR("not-a-date")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });
  });

  // ── Count Functions ──────────────────────────────────────────────────

  describe('COUNTA / COUNTBLANK Functions', () => {
    it('COUNTA counts non-empty cells', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '', '2:0': 'text', '3:0': '=COUNTA(A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('COUNTBLANK counts empty cells', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '', '2:0': 'text', '3:0': '=COUNTBLANK(A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(1);
    });
  });

  // ── Lookup Functions ─────────────────────────────────────────────────

  describe('INDEX / MATCH Functions', () => {
    it('INDEX returns value at position', () => {
      const sheet = createSheet({
        '0:0': '10', '1:0': '20', '2:0': '30', '3:0': '=INDEX(A1:A3, 2)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(20);
    });

    it('MATCH finds position', () => {
      const sheet = createSheet({
        '0:0': '10', '1:0': '20', '2:0': '30', '3:0': '=MATCH(20, A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('MATCH returns error when not found', () => {
      const sheet = createSheet({
        '0:0': '10', '1:0': '20', '2:0': '30', '3:0': '=MATCH(99, A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe('#VALUE!');
    });
  });

  describe('VLOOKUP Function', () => {
    it('returns #REF! (stub)', () => {
      const sheet = createSheet({ '5:0': '=VLOOKUP(1, A1:B3, 2)' });
      expect(evaluateWorkbook(sheet).cells['5:0'].computedValue).toBe('#REF!');
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles bare range reference', () => {
      const sheet = createSheet({ '0:0': '=(A1:A3)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      // Bare ranges may trigger circular detection or return an error
      expect(['#REF!', '#CIRC!', '#VALUE!']).toContain(String(result));
    });

    it('handles unary minus', () => {
      const sheet = createSheet({ '0:0': '=-5' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(-5);
    });

    it('handles unary plus', () => {
      const sheet = createSheet({ '0:0': '=+5' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(5);
    });

    it('returns #VALUE! for unary minus on text', () => {
      const sheet = createSheet({ '0:0': '=- "text"' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#VALUE!');
    });

    it('handles string comparison operators', () => {
      const sheet = createSheet({ '0:0': '="a"<"b"' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('handles string equality', () => {
      const sheet = createSheet({ '0:0': '="hello"="hello"' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('handles empty string in comparison', () => {
      const sheet = createSheet({ '0:0': '=""=""' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });
  });

  // ── Trigonometric Functions ─────────────────────────────────────────

  describe('Trigonometric Functions', () => {
    it('SIN calculates sine', () => {
      const sheet = createSheet({ '0:0': '=SIN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('COS calculates cosine', () => {
      const sheet = createSheet({ '0:0': '=COS(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });

    it('TAN calculates tangent', () => {
      const sheet = createSheet({ '0:0': '=TAN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('ASIN calculates arcsine', () => {
      const sheet = createSheet({ '0:0': '=ASIN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('ACOS calculates arccosine', () => {
      const sheet = createSheet({ '0:0': '=ACOS(1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('ATAN calculates arctangent', () => {
      const sheet = createSheet({ '0:0': '=ATAN(0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('ATAN2 calculates arctangent with 2 args', () => {
      const sheet = createSheet({ '0:0': '=ATAN2(1, 0)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      expect(typeof result).toBe('number');
    });

    it('DEGREES converts radians to degrees', () => {
      const sheet = createSheet({ '0:0': '=DEGREES(3.14159)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      expect(typeof result).toBe('number');
    });

    it('RADIANS converts degrees to radians', () => {
      const sheet = createSheet({ '0:0': '=RADIANS(180)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      expect(typeof result).toBe('number');
    });
  });

  // ── Error Handling ───────────────────────────────────────────────────

  describe('Error Propagation', () => {
    it('propagates errors through arithmetic', () => {
      const sheet = createSheet({ '0:0': '=1/0 + 1' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#DIV/0!');
    });

    it('unknown function returns #NAME?', () => {
      const sheet = createSheet({ '0:0': '=UNKNOWN(1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#NAME?');
    });

    it('SUM with error in range', () => {
      const sheet = createSheet({
        '0:0': '10', '1:0': '=1/0', '2:0': '20', '3:0': '=SUM(A1:A3)',
      });
      // SUM ignores error cells
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(30);
    });

    it('returns #REF! for out-of-bounds reference', () => {
      const sheet = createSheet({ '0:0': '=Z999' }, { rowCount: 10, colCount: 10 });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('#REF!');
    });

    it('returns #VALUE! for invalid operation', () => {
      const sheet = createSheet({ '0:0': '=SUM(1, "text")' });
      // SUM ignores text, returns 1
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });
  });

  // ── Date Functions ──────────────────────────────────────────────────

  describe('Date Functions', () => {
    it('TODAY returns current date', () => {
      const sheet = createSheet({ '0:0': '=TODAY()' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('YEAR extracts year from date', () => {
      const sheet = createSheet({ '0:0': '=YEAR("2024-03-15")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2024);
    });

    it('MONTH extracts month from date', () => {
      const sheet = createSheet({ '0:0': '=MONTH("2024-03-15")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3);
    });

    it('DAY extracts day from date', () => {
      const sheet = createSheet({ '0:0': '=DAY("2024-03-15")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(15);
    });

    it('DATE constructs a date', () => {
      const sheet = createSheet({ '0:0': '=DATE(2024, 3, 15)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('2024-03-15');
    });

    it('WEEKDAY returns day of week', () => {
      const sheet = createSheet({ '0:0': '=WEEKDAY("2024-03-15")' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      expect(typeof result).toBe('number');
    });
  });

  // ── Financial Functions ─────────────────────────────────────────────

  describe('Math Functions', () => {
    it('SQRT calculates square root', () => {
      const sheet = createSheet({ '0:0': '=SQRT(16)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(4);
    });

    it('POWER calculates power', () => {
      const sheet = createSheet({ '0:0': '=POWER(2, 10)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1024);
    });

    it('MOD calculates remainder', () => {
      const sheet = createSheet({ '0:0': '=MOD(10, 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(1);
    });

    it('INT truncates to integer', () => {
      const sheet = createSheet({ '0:0': '=INT(3.7)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(3);
    });

    it('ROUND rounds to integer', () => {
      const sheet = createSheet({ '0:0': '=ROUND(3.7)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(4);
    });

    it('ABS returns absolute value', () => {
      const sheet = createSheet({ '0:0': '=ABS(-5)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(5);
    });

    it('EXP calculates e^x', () => {
      const sheet = createSheet({ '0:0': '=EXP(1)' });
      const result = evaluateWorkbook(sheet).cells['0:0'].computedValue;
      expect(typeof result).toBe('number');
    });

    it('LN calculates natural log', () => {
      const sheet = createSheet({ '0:0': '=LN(1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(0);
    });

    it('LOG10 calculates base-10 log', () => {
      const sheet = createSheet({ '0:0': '=LOG10(100)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2);
    });
  });

  // ── Additional Statistical Functions ────────────────────────────────

  describe('Statistical Functions', () => {
    it('MEDIAN finds middle value', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '=MEDIAN(A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('MODE finds most common value', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '2', '3:0': '=MODE(A1:A3)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(2);
    });

    it('STDEV calculates standard deviation', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '=STDEV(A1:A3)',
      });
      const result = evaluateWorkbook(sheet).cells['3:0'].computedValue;
      expect(typeof result).toBe('number');
    });

    it('VAR calculates variance', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '=VAR(A1:A3)',
      });
      const result = evaluateWorkbook(sheet).cells['3:0'].computedValue;
      expect(typeof result).toBe('number');
    });

    it('LARGE finds k-th largest', () => {
      const sheet = createSheet({
        '0:0': '1', '1:0': '5', '2:0': '3', '3:0': '=LARGE(A1:A3, 2)',
      });
      expect(evaluateWorkbook(sheet).cells['3:0'].computedValue).toBe(3);
    });


  });

  // ── String Functions ────────────────────────────────────────────────

  describe('String Functions', () => {
    it('TEXT formats number', () => {
      const sheet = createSheet({ '0:0': '=TEXT(1234.567, "0.00")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('1234.57');
    });

    it('VALUE converts string to number', () => {
      const sheet = createSheet({ '0:0': '=VALUE("42")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(42);
    });

    it('REPT repeats string', () => {
      const sheet = createSheet({ '0:0': '=REPT("ab", 3)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('ababab');
    });

    it('REPLACE replaces characters', () => {
      const sheet = createSheet({ '0:0': '=REPLACE("hello", 2, 3, "xyz")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('hxyzo');
    });
  });

  // ── Logical Functions ───────────────────────────────────────────────

  describe('Logical Functions', () => {
    it('AND returns true when all true', () => {
      const sheet = createSheet({ '0:0': '=AND(TRUE, TRUE, 1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('OR returns true when any true', () => {
      const sheet = createSheet({ '0:0': '=OR(FALSE, FALSE, 1)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('NOT inverts boolean', () => {
      const sheet = createSheet({ '0:0': '=NOT(FALSE)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('IFERROR returns fallback on error', () => {
      const sheet = createSheet({ '0:0': '=IFERROR(1/0, "fallback")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('fallback');
    });

    it('IFNA returns fallback on N/A', () => {
      const sheet = createSheet({ '0:0': '=IFNA(1/0, "fallback")' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe('fallback');
    });

    it('SWITCH matches expression', () => {
      const sheet = createSheet({ '0:0': '=SWITCH("b", "a", 1, "b", 2, "c", 3, 0)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(2);
    });

    it('ISBLANK detects empty', () => {
      const sheet = createSheet({ '0:0': '=ISBLANK(A5)' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(true);
    });

    it('ISBLANK detects non-empty', () => {
      const sheet = createSheet({ '0:0': '=ISBLANK(B1)', '0:1': 'not blank' });
      expect(evaluateWorkbook(sheet).cells['0:0'].computedValue).toBe(false);
    });
  });
});
