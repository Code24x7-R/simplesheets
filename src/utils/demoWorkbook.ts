// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Demo Workbook Factory
 *
 * Creates a comprehensive demo workbook with formula examples across
 * every function category. Designed for manual testing and validation.
 * Accessible via File → Load Demo.
 *
 * Layout:
 *   Sheet1 "Formula Guide" — organized sections, each showing a formula's
 *     description (col A), computed result (col B), and syntax (col C).
 *   Sheet2 "Sales Data"     — fixed dataset referenced by Sheet1 for
 *     range, lookup, conditional, and cross-sheet examples.
 */

import type { Workbook, Cell, CellStyle, ChartConfig } from '../types';

type CellMap = Record<string, Cell>;
type Style = Partial<CellStyle>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function cell(rawValue: string, style?: Style): Cell {
  return { rawValue, style: style as CellStyle };
}

/** Places a cell at (row, col) in the map. */
function at(cells: CellMap, row: number, col: number, rawValue: string, style?: Style): void {
  cells[`${row}:${col}`] = cell(rawValue, style);
}

// ─── Sheet 2: Sales Data ────────────────────────────────────────────────────

function buildSalesDataSheet(): {
  cells: CellMap;
  widths: Record<number, number>;
  charts: ChartConfig[];
} {
  const cells: CellMap = {};
  const h: Style = { fontWeight: 'bold', backgroundColor: '#e8f0fe', textAlign: 'center' };

  // Title
  at(cells, 0, 0, 'Sales Data — 2026', { fontWeight: 'bold' });

  // Headers (row 1)
  const headers = ['Product', 'Region', 'Q1', 'Q2', 'Q3', 'Q4'];
  headers.forEach((label, col) => at(cells, 1, col, label, h));

  // Data rows (2–11)
  const data: (string | number)[][] = [
    ['Widget',          'North', 120, 150, 180, 200],
    ['Gadget',          'South',  90, 110, 130, 140],
    ['Gizmo',           'East',  200, 180, 160, 170],
    ['Doohickey',       'North',  75,  85,  95, 105],
    ['Thingamajig',     'West',  300, 320, 280, 290],
    ['Whatchamacallit', 'South',  50,  60,  70,  80],
    ['Sprocket',        'East',  180, 190, 210, 220],
    ['Doodad',          'West',  140, 130, 120, 110],
    ['Gizmo',           'North', 160, 170, 180, 190],
    ['Widget',          'South', 110, 100,  90,  95],
  ];

  data.forEach((rowData, i) => {
    const r = i + 2;
    rowData.forEach((val, col) => {
      at(cells, r, col, String(val), col >= 2 ? { textAlign: 'right' } : undefined);
    });
  });

  // Totals row (row 12)
  at(cells, 12, 0, 'Totals', { fontWeight: 'bold' });
  ['C', 'D', 'E', 'F'].forEach((colLetter, idx) => {
    const col = idx + 2;
    at(cells, 12, col, `=SUM(${colLetter}2:${colLetter}11)`, { fontWeight: 'bold', textAlign: 'right' });
  });

  const charts: ChartConfig[] = [
    {
      id: 'demo-chart-column',
      type: 'column',
      title: 'Quarterly Sales by Product',
      dataRange: 'A1:F11',
      series: [
        { label: 'Q1', dataRange: 'Sheet2!C2:C11', color: '#3B82EF' },
        { label: 'Q2', dataRange: 'Sheet2!D2:D11', color: '#EF4444' },
        { label: 'Q3', dataRange: 'Sheet2!E2:E11', color: '#22C55E' },
        { label: 'Q4', dataRange: 'Sheet2!F2:F11', color: '#EAB308' },
      ],
      xAxisLabel: 'Product',
      yAxisLabel: 'Revenue ($)',
      legendPosition: 'top',
      width: 480,
      height: 300,
      row: 0,
      col: 8,
    },
    {
      id: 'demo-chart-pie',
      type: 'pie',
      title: 'Q1 Sales Share by Region',
      dataRange: 'B1:C11',
      series: [
        { label: 'Q1', dataRange: 'Sheet2!C2:C11', color: '#3B82EF' },
      ],
      legendPosition: 'right',
      width: 380,
      height: 300,
      row: 0,
      col: 16,
    },
    {
      id: 'demo-chart-line',
      type: 'line',
      title: 'Quarterly Sales Trend',
      dataRange: 'A1:F11',
      series: [
        { label: 'Q1', dataRange: 'Sheet2!C2:C11', color: '#3B82EF' },
        { label: 'Q2', dataRange: 'Sheet2!D2:D11', color: '#EF4444' },
        { label: 'Q3', dataRange: 'Sheet2!E2:E11', color: '#22C55E' },
        { label: 'Q4', dataRange: 'Sheet2!F2:F11', color: '#EAB308' },
      ],
      xAxisLabel: 'Product',
      yAxisLabel: 'Revenue ($)',
      legendPosition: 'top',
      width: 480,
      height: 280,
      row: 13,
      col: 8,
    },
    {
      id: 'demo-chart-bar',
      type: 'bar',
      title: 'Q1 vs Q4 Comparison',
      dataRange: 'A1:A11',
      series: [
        { label: 'Q1', dataRange: 'Sheet2!C2:C11', color: '#3B82EF' },
        { label: 'Q4', dataRange: 'Sheet2!F2:F11', color: '#EAB308' },
      ],
      xAxisLabel: 'Revenue ($)',
      yAxisLabel: 'Product',
      legendPosition: 'top',
      width: 480,
      height: 280,
      row: 13,
      col: 16,
    },
  ];

  return {
    cells,
    widths: { 0: 160, 1: 90, 2: 70, 3: 70, 4: 70, 5: 70 },
    charts,
  };
}

// ─── Sheet 1: Formula Guide ─────────────────────────────────────────────────

function buildFormulaGuideSheet(): { cells: CellMap; widths: Record<number, number> } {
  const cells: CellMap = {};
  const S2 = 'Sheet2'; // cross-sheet reference prefix
  const dataRange = `${S2}!C2:C11`; // Q1 sales (10 values)
  const regionRange = `${S2}!B2:B11`;
  const fullRange = `${S2}!A2:F11`;
  const D: Style = { textAlign: 'right' };
  const bh: Style = { fontWeight: 'bold', backgroundColor: '#f1f5f9' };
  const sh: Style = { fontWeight: 'bold', backgroundColor: '#dbeafe', color: '#1e40af' };

  let r = 0;

  // ── Title ──
  at(cells, r, 0, 'SimpleSheet — Formula Reference', { fontWeight: 'bold' });
  at(cells, r, 2, 'Data tables on →', { fontStyle: 'italic', color: '#6b7280' });
  r = 1;
  at(cells, r, 0, 'Comprehensive examples for manual testing & validation', {
    fontStyle: 'italic', color: '#6b7280',
  });
  r = 2;

  // ── Column Headers ──
  at(cells, r, 0, 'Description', bh);
  at(cells, r, 1, 'Result', bh);
  at(cells, r, 2, 'Syntax', bh);
  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── MATH & TRIGONOMETRY ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'MATH & TRIGONOMETRY', sh); r++;

  at(cells, r, 0, 'Sum of range');       at(cells, r, 1, `=SUM(${dataRange})`, D); at(cells, r, 2, 'SUM(range)'); r++;
  at(cells, r, 0, 'Average of range');   at(cells, r, 1, `=AVERAGE(${dataRange})`, D); at(cells, r, 2, 'AVERAGE(range)'); r++;
  at(cells, r, 0, 'Minimum');            at(cells, r, 1, `=MIN(${dataRange})`, D); at(cells, r, 2, 'MIN(range)'); r++;
  at(cells, r, 0, 'Maximum');            at(cells, r, 1, `=MAX(${dataRange})`, D); at(cells, r, 2, 'MAX(range)'); r++;
  at(cells, r, 0, 'Count numbers');      at(cells, r, 1, `=COUNT(${dataRange})`, D); at(cells, r, 2, 'COUNT(range)'); r++;
  at(cells, r, 0, 'Count non‑blank');    at(cells, r, 1, `=COUNTA(${S2}!A2:A11)`, D); at(cells, r, 2, 'COUNTA(range)'); r++;
  at(cells, r, 0, 'Product');            at(cells, r, 1, `=PRODUCT(${S2}!C2:C5)`, D); at(cells, r, 2, 'PRODUCT(range)'); r++;
  at(cells, r, 0, 'Round');              at(cells, r, 1, '=ROUND(3.14159, 2)', D); at(cells, r, 2, 'ROUND(num, digits)'); r++;
  at(cells, r, 0, 'Round up');           at(cells, r, 1, '=ROUNDUP(3.14159, 2)', D); at(cells, r, 2, 'ROUNDUP(num, digits)'); r++;
  at(cells, r, 0, 'Round down');         at(cells, r, 1, '=ROUNDDOWN(3.14159, 2)', D); at(cells, r, 2, 'ROUNDDOWN(num, digits)'); r++;
  at(cells, r, 0, 'Integer part');       at(cells, r, 1, '=INT(7.8)', D); at(cells, r, 2, 'INT(num)'); r++;
  at(cells, r, 0, 'Floor');              at(cells, r, 1, '=FLOOR(7.8)', D); at(cells, r, 2, 'FLOOR(num)'); r++;
  at(cells, r, 0, 'Ceiling');            at(cells, r, 1, '=CEILING(7.2)', D); at(cells, r, 2, 'CEILING(num)'); r++;
  at(cells, r, 0, 'Modulo');             at(cells, r, 1, '=MOD(10, 3)', D); at(cells, r, 2, 'MOD(num, divisor)'); r++;
  at(cells, r, 0, 'Absolute value');     at(cells, r, 1, '=ABS(-42)', D); at(cells, r, 2, 'ABS(num)'); r++;
  at(cells, r, 0, 'Square root');        at(cells, r, 1, '=SQRT(144)', D); at(cells, r, 2, 'SQRT(num)'); r++;
  at(cells, r, 0, 'Power');              at(cells, r, 1, '=POWER(2, 10)', D); at(cells, r, 2, 'POWER(base, exp)'); r++;
  at(cells, r, 0, 'Exponential (e^x)');  at(cells, r, 1, '=EXP(1)', D); at(cells, r, 2, 'EXP(num)'); r++;
  at(cells, r, 0, 'Natural logarithm');  at(cells, r, 1, '=LN(EXP(1))', D); at(cells, r, 2, 'LN(num)'); r++;
  at(cells, r, 0, 'Log base 10');        at(cells, r, 1, '=LOG10(1000)', D); at(cells, r, 2, 'LOG10(num)'); r++;
  at(cells, r, 0, 'Log base N');         at(cells, r, 1, '=LOG(8, 2)', D); at(cells, r, 2, 'LOG(num, base)'); r++;
  at(cells, r, 0, 'Pi constant');        at(cells, r, 1, '=PI()', D); at(cells, r, 2, 'PI()'); r++;
  at(cells, r, 0, 'Sign (+1/0/-1)');     at(cells, r, 1, '=SIGN(-42)', D); at(cells, r, 2, 'SIGN(num)'); r++;
  at(cells, r, 0, 'Truncate');           at(cells, r, 1, '=TRUNC(7.89, 1)', D); at(cells, r, 2, 'TRUNC(num, digits)'); r++;
  at(cells, r, 0, 'Sine (radians)');     at(cells, r, 1, '=SIN(0)', D); at(cells, r, 2, 'SIN(num)'); r++;
  at(cells, r, 0, 'Cosine (radians)');   at(cells, r, 1, '=COS(0)', D); at(cells, r, 2, 'COS(num)'); r++;
  at(cells, r, 0, 'Tangent (radians)');  at(cells, r, 1, '=TAN(0)', D); at(cells, r, 2, 'TAN(num)'); r++;
  at(cells, r, 0, 'Arcsine');            at(cells, r, 1, '=ASIN(0)', D); at(cells, r, 2, 'ASIN(num)'); r++;
  at(cells, r, 0, 'Arccosine');          at(cells, r, 1, '=ACOS(1)', D); at(cells, r, 2, 'ACOS(num)'); r++;
  at(cells, r, 0, 'Arctangent');         at(cells, r, 1, '=ATAN(1)', D); at(cells, r, 2, 'ATAN(num)'); r++;
  at(cells, r, 0, 'Atan2');              at(cells, r, 1, '=ATAN2(1, 1)', D); at(cells, r, 2, 'ATAN2(x, y)'); r++;
  at(cells, r, 0, 'Radians → Degrees');  at(cells, r, 1, '=DEGREES(PI())', D); at(cells, r, 2, 'DEGREES(rad)'); r++;
  at(cells, r, 0, 'Degrees → Radians');  at(cells, r, 1, '=RADIANS(180)', D); at(cells, r, 2, 'RADIANS(deg)'); r++;
  at(cells, r, 0, 'Random 0‑1');         at(cells, r, 1, '=RAND()', D); at(cells, r, 2, 'RAND()'); r++;
  at(cells, r, 0, 'Random in range');    at(cells, r, 1, '=RANDBETWEEN(1, 100)', D); at(cells, r, 2, 'RANDBETWEEN(low, high)'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── LOGICAL ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'LOGICAL', sh); r++;

  at(cells, r, 0, 'IF true');            at(cells, r, 1, '=IF(1>0,"Yes","No")'); at(cells, r, 2, 'IF(test, true_val, false_val)'); r++;
  at(cells, r, 0, 'IF false');           at(cells, r, 1, '=IF(1<0,"Yes","No")'); at(cells, r, 2, 'IF(test, true_val, false_val)'); r++;
  at(cells, r, 0, 'AND (both true)');    at(cells, r, 1, '=AND(1>0, 2>1)'); at(cells, r, 2, 'AND(cond1, cond2)'); r++;
  at(cells, r, 0, 'OR (one true)');      at(cells, r, 1, '=OR(1<0, 2>1)'); at(cells, r, 2, 'OR(cond1, cond2)'); r++;
  at(cells, r, 0, 'NOT');                at(cells, r, 1, '=NOT(1>0)'); at(cells, r, 2, 'NOT(cond)'); r++;
  at(cells, r, 0, 'XOR');                at(cells, r, 1, '=XOR(TRUE, FALSE)'); at(cells, r, 2, 'XOR(cond1, cond2)'); r++;
  at(cells, r, 0, 'IFERROR fallback');   at(cells, r, 1, '=IFERROR(1/0,"Oops")'); at(cells, r, 2, 'IFERROR(val, fallback)'); r++;
  at(cells, r, 0, 'IFNA fallback');      at(cells, r, 1, '=IFNA("#N/A","Missing")'); at(cells, r, 2, 'IFNA(val, fallback)'); r++;
  at(cells, r, 0, 'SWITCH match');       at(cells, r, 1, '=SWITCH(2, 1, "A", 2, "B", "Other")'); at(cells, r, 2, 'SWITCH(expr, val1, res1, …, default)'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── TEXT ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'TEXT', sh); r++;

  at(cells, r, 0, 'Concatenate');        at(cells, r, 1, '=CONCAT("Hello"," ","World")'); at(cells, r, 2, 'CONCAT(a, b, …)'); r++;
  at(cells, r, 0, 'Left 5 chars');       at(cells, r, 1, '=LEFT("Hello World", 5)'); at(cells, r, 2, 'LEFT(text, n)'); r++;
  at(cells, r, 0, 'Right 5 chars');      at(cells, r, 1, '=RIGHT("Hello World", 5)'); at(cells, r, 2, 'RIGHT(text, n)'); r++;
  at(cells, r, 0, 'Mid (start, len)');   at(cells, r, 1, '=MID("Hello World", 7, 5)'); at(cells, r, 2, 'MID(text, start, len)'); r++;
  at(cells, r, 0, 'Length');             at(cells, r, 1, '=LEN("Hello World")', D); at(cells, r, 2, 'LEN(text)'); r++;
  at(cells, r, 0, 'Lowercase');          at(cells, r, 1, '=LOWER("HELLO")'); at(cells, r, 2, 'LOWER(text)'); r++;
  at(cells, r, 0, 'Uppercase');          at(cells, r, 1, '=UPPER("hello")'); at(cells, r, 2, 'UPPER(text)'); r++;
  at(cells, r, 0, 'Proper case');        at(cells, r, 1, '=PROPER("hello world")'); at(cells, r, 2, 'PROPER(text)'); r++;
  at(cells, r, 0, 'Trim extra spaces');  at(cells, r, 1, '=TRIM("  hello  ")'); at(cells, r, 2, 'TRIM(text)'); r++;
  at(cells, r, 0, 'TEXT num→date');      at(cells, r, 1, '=TEXT(45731, "dd/mm/yyyy")'); at(cells, r, 2, 'TEXT(serial, "dd/mm/yyyy")'); r++;
  at(cells, r, 0, 'TEXT NOW→ddd');       at(cells, r, 1, '=TEXT(NOW(), "ddd")'); at(cells, r, 2, 'TEXT(NOW(), "ddd")'); r++;
  at(cells, r, 0, 'TEXT NOW→mmm');       at(cells, r, 1, '=TEXT(NOW(), "mmm")'); at(cells, r, 2, 'TEXT(NOW(), "mmm")'); r++;
  at(cells, r, 0, 'TEXT NOW→yyyy');      at(cells, r, 1, '=TEXT(NOW(), "yyyy")'); at(cells, r, 2, 'TEXT(NOW(), "yyyy")'); r++;
  at(cells, r, 0, 'TEXT num→currency');  at(cells, r, 1, '=TEXT(1234.567, "0.00")'); at(cells, r, 2, 'TEXT(num, "0.00")'); r++;
  at(cells, r, 0, 'TEXT num→percent');   at(cells, r, 1, '=TEXT(0.123, "0.0%")'); at(cells, r, 2, 'TEXT(num, "0.0%")'); r++;
  at(cells, r, 0, 'VALUE text→number');  at(cells, r, 1, '=VALUE("42.5")', D); at(cells, r, 2, 'VALUE(text)'); r++;
  at(cells, r, 0, 'Repeat');             at(cells, r, 1, '=REPT("*", 5)'); at(cells, r, 2, 'REPT(text, n)'); r++;
  at(cells, r, 0, 'Replace');            at(cells, r, 1, '=REPLACE("Hello World", 1, 5, "Hi")'); at(cells, r, 2, 'REPLACE(text, start, len, new)'); r++;
  at(cells, r, 0, 'Substitute');         at(cells, r, 1, '=SUBSTITUTE("Hello World","World","There")'); at(cells, r, 2, 'SUBSTITUTE(text, old, new)'); r++;
  at(cells, r, 0, 'Find (case‑sensitive)'); at(cells, r, 1, '=FIND("o", "Hello World")', D); at(cells, r, 2, 'FIND(find, within)'); r++;
  at(cells, r, 0, 'Search (case‑insensitive)'); at(cells, r, 1, '=SEARCH("world", "Hello World")', D); at(cells, r, 2, 'SEARCH(find, within)'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── DATE & TIME ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'DATE & TIME', sh); r++;

  at(cells, r, 0, 'Current date+time');  at(cells, r, 1, '=NOW()', D); at(cells, r, 2, 'NOW()'); r++;
  at(cells, r, 0, 'Current date');       at(cells, r, 1, '=TODAY()', D); at(cells, r, 2, 'TODAY()'); r++;
  at(cells, r, 0, 'Year from NOW');      at(cells, r, 1, '=YEAR(NOW())', D); at(cells, r, 2, 'YEAR(date)'); r++;
  at(cells, r, 0, 'Month from NOW');     at(cells, r, 1, '=MONTH(NOW())', D); at(cells, r, 2, 'MONTH(date)'); r++;
  at(cells, r, 0, 'Day from NOW');       at(cells, r, 1, '=DAY(NOW())', D); at(cells, r, 2, 'DAY(date)'); r++;
  at(cells, r, 0, 'Hour from NOW');      at(cells, r, 1, '=HOUR(NOW())', D); at(cells, r, 2, 'HOUR(date)'); r++;
  at(cells, r, 0, 'Minute from NOW');    at(cells, r, 1, '=MINUTE(NOW())', D); at(cells, r, 2, 'MINUTE(date)'); r++;
  at(cells, r, 0, 'Second from NOW');    at(cells, r, 1, '=SECOND(NOW())', D); at(cells, r, 2, 'SECOND(date)'); r++;
  at(cells, r, 0, 'Build date');         at(cells, r, 1, '=DATE(2026, 8, 8)'); at(cells, r, 2, 'DATE(year, month, day)'); r++;
  at(cells, r, 0, 'Weekday number');     at(cells, r, 1, '=WEEKDAY(TODAY())', D); at(cells, r, 2, 'WEEKDAY(date)'); r++;
  at(cells, r, 0, 'Add 3 months');       at(cells, r, 1, '=EDATE(TODAY(), 3)'); at(cells, r, 2, 'EDATE(date, months)'); r++;
  at(cells, r, 0, 'End of month');       at(cells, r, 1, '=EOMONTH(TODAY(), 0)'); at(cells, r, 2, 'EOMONTH(date, months)'); r++;
  at(cells, r, 0, 'Working days');       at(cells, r, 1, '=NETWORKDAYS(DATE(2026,8,1), DATE(2026,8,31))', D); at(cells, r, 2, 'NETWORKDAYS(start, end)'); r++;
  at(cells, r, 0, 'Date difference (years)'); at(cells, r, 1, '=DATEDIF(DATE(2020,1,1), DATE(2026,8,8), "Y")', D); at(cells, r, 2, 'DATEDIF(start, end, "Y")'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── STATISTICAL ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'STATISTICAL', sh); r++;

  at(cells, r, 0, 'Median');             at(cells, r, 1, `=MEDIAN(${dataRange})`, D); at(cells, r, 2, 'MEDIAN(range)'); r++;
  at(cells, r, 0, 'Mode');               at(cells, r, 1, '=MODE(1,2,2,3,3,3)', D); at(cells, r, 2, 'MODE(range)'); r++;
  at(cells, r, 0, 'Standard deviation'); at(cells, r, 1, `=STDEV(${dataRange})`, D); at(cells, r, 2, 'STDEV(range)'); r++;
  at(cells, r, 0, 'Variance');           at(cells, r, 1, `=VAR(${dataRange})`, D); at(cells, r, 2, 'VAR(range)'); r++;
  at(cells, r, 0, '2nd largest');        at(cells, r, 1, `=LARGE(${dataRange}, 2)`, D); at(cells, r, 2, 'LARGE(range, k)'); r++;
  at(cells, r, 0, '2nd smallest');       at(cells, r, 1, `=SMALL(${dataRange}, 2)`, D); at(cells, r, 2, 'SMALL(range, k)'); r++;
  at(cells, r, 0, 'Rank of 150');        at(cells, r, 1, `=RANK(150, ${dataRange})`, D); at(cells, r, 2, 'RANK(num, range)'); r++;
  at(cells, r, 0, '1st quartile');       at(cells, r, 1, `=QUARTILE(${dataRange}, 1)`, D); at(cells, r, 2, 'QUARTILE(range, quart)'); r++;
  at(cells, r, 0, '50th percentile');    at(cells, r, 1, `=PERCENTILE(${dataRange}, 0.5)`, D); at(cells, r, 2, 'PERCENTILE(range, k)'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── CONDITIONAL AGGREGATION ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'CONDITIONAL AGGREGATION', sh); r++;

  at(cells, r, 0, 'Sum if North');       at(cells, r, 1, `=SUMIF(${regionRange}, "North", ${dataRange})`, D); at(cells, r, 2, 'SUMIF(range, crit, sum_range)'); r++;
  at(cells, r, 0, 'Count if North');     at(cells, r, 1, `=COUNTIF(${regionRange}, "North")`, D); at(cells, r, 2, 'COUNTIF(range, crit)'); r++;
  at(cells, r, 0, 'Average if North');   at(cells, r, 1, `=AVERAGEIF(${regionRange}, "North", ${dataRange})`, D); at(cells, r, 2, 'AVERAGEIF(range, crit, avg_range)'); r++;
  at(cells, r, 0, 'Sumifs North');       at(cells, r, 1, `=SUMIFS(${dataRange}, ${regionRange}, "North")`, D); at(cells, r, 2, 'SUMIFS(sum_range, crit_range, crit)'); r++;
  at(cells, r, 0, 'Countifs North');     at(cells, r, 1, `=COUNTIFS(${regionRange}, "North")`, D); at(cells, r, 2, 'COUNTIFS(crit_range, crit)'); r++;
  at(cells, r, 0, 'Averageifs North');   at(cells, r, 1, `=AVERAGEIFS(${dataRange}, ${regionRange}, "North")`, D); at(cells, r, 2, 'AVERAGEIFS(avg_range, crit_range, crit)'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── LOOKUP & REFERENCE ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'LOOKUP & REFERENCE', sh); r++;

  at(cells, r, 0, 'VLOOKUP Gizmo Q1');   at(cells, r, 1, `=VLOOKUP("Gizmo", ${fullRange}, 3, FALSE)`, D); at(cells, r, 2, 'VLOOKUP(val, range, col, FALSE)'); r++;
  at(cells, r, 0, 'HLOOKUP');            at(cells, r, 1, `=HLOOKUP("Q2", ${S2}!A1:F2, 2, FALSE)`); at(cells, r, 2, 'HLOOKUP(val, range, row, FALSE)'); r++;
  at(cells, r, 0, 'INDEX 3rd Q1');       at(cells, r, 1, `=INDEX(${dataRange}, 3)`, D); at(cells, r, 2, 'INDEX(range, pos)'); r++;
  at(cells, r, 0, 'MATCH Gizmo');        at(cells, r, 1, `=MATCH("Gizmo", ${S2}!A2:A11, 0)`, D); at(cells, r, 2, 'MATCH(val, range, 0)'); r++;
  at(cells, r, 0, 'Row count');          at(cells, r, 1, `=ROWS(${fullRange})`, D); at(cells, r, 2, 'ROWS(range)'); r++;
  at(cells, r, 0, 'Column count');       at(cells, r, 1, `=COLUMNS(${fullRange})`, D); at(cells, r, 2, 'COLUMNS(range)'); r++;
  at(cells, r, 0, 'Row of range');       at(cells, r, 1, `=ROW(${fullRange})`, D); at(cells, r, 2, 'ROW(range)'); r++;
  at(cells, r, 0, 'Column of range');    at(cells, r, 1, `=COLUMN(${fullRange})`, D); at(cells, r, 2, 'COLUMN(range)'); r++;
  at(cells, r, 0, 'Indirect → number');  at(cells, r, 1, '=INDIRECT("42")', D); at(cells, r, 2, 'INDIRECT(text)'); r++;

  r++;

  // ══════════════════════════════════════════════════════════════════════════
  // ── INFORMATION ──
  // ══════════════════════════════════════════════════════════════════════════
  at(cells, r, 0, 'INFORMATION', sh); r++;

  at(cells, r, 0, 'Is blank');           at(cells, r, 1, '=ISBLANK("")'); at(cells, r, 2, 'ISBLANK(val)'); r++;
  at(cells, r, 0, 'Is error');           at(cells, r, 1, '=ISERROR(1/0)'); at(cells, r, 2, 'ISERROR(val)'); r++;
  at(cells, r, 0, 'Is number');          at(cells, r, 1, '=ISNUMBER(42)'); at(cells, r, 2, 'ISNUMBER(val)'); r++;
  at(cells, r, 0, 'Is text');            at(cells, r, 1, '=ISTEXT("hello")'); at(cells, r, 2, 'ISTEXT(val)'); r++;
  at(cells, r, 0, 'Count blank');        at(cells, r, 1, '=COUNTBLANK(A1:A5)', D); at(cells, r, 2, 'COUNTBLANK(range)'); r++;

  return {
    cells,
    widths: { 0: 220, 1: 160, 2: 320 },
  };
}

// ─── Public Factory ─────────────────────────────────────────────────────────

export function createDemoWorkbook(): Workbook {
  const guide = buildFormulaGuideSheet();
  const sales = buildSalesDataSheet();

  return {
    id: 'demo-wb',
    title: 'SimpleSheet Demo',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Formula Guide',
        cells: guide.cells,
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: guide.widths,
        rowHeights: {},
        columnCount: 26,
        rowCount: 1000,
        frozenColumns: 0,
        frozenRows: 0,
      },
      {
        id: 'sheet-2',
        name: 'Sheet2',
        cells: sales.cells,
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: sales.widths,
        rowHeights: {},
        columnCount: 26,
        rowCount: 1000,
        frozenColumns: 0,
        frozenRows: 0,
        charts: sales.charts,
      },
    ],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}
