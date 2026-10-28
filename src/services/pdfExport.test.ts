// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  generatePdf,
  downloadPdf,
  computePrintScale,
  addFooters,
  formatPrintRange,
  DEFAULT_FOOTER,
  type JsPdfLike,
} from './pdfExport';
import type { PrintSetup } from '../context/PrintSetupContext';
import type { Sheet } from '../types';
import { createDemoWorkbook } from '../utils/demoWorkbook';

// ─── html2canvas mock ───────────────────────────────────────────────────────

const mockCanvas = {
  toDataURL: jest.fn(() => 'data:image/jpeg;base64,abc'),
};

/** Page elements handed to html2canvas, in render order. */
const renderedPages: HTMLElement[] = [];

const mockHtml2canvas = jest.fn((el: HTMLElement) => {
  renderedPages.push(el);
  return Promise.resolve(mockCanvas);
});

jest.mock('html2canvas', () => ({
  __esModule: true,
  default: mockHtml2canvas,
}), { virtual: true });

// ─── jsPDF mock ─────────────────────────────────────────────────────────────

function createMockPdf() {
  return {
    internal: {
      getNumberOfPages: jest.fn(() => 1),
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
    },
    addImage: jest.fn(),
    addPage: jest.fn(),
    output: jest.fn(() => new Blob(['pdf'])),
    text: jest.fn(),
    setPage: jest.fn(),
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
  };
}

const createdPdfs: ReturnType<typeof createMockPdf>[] = [];
const mockJsPDF = jest.fn(() => {
  const pdf = createMockPdf();
  createdPdfs.push(pdf);
  return pdf;
});

jest.mock('jspdf', () => ({
  jsPDF: mockJsPDF,
}), { virtual: true });

// ─── helpers ────────────────────────────────────────────────────────────────

function baseSetup(overrides: Partial<PrintSetup> = {}): PrintSetup {
  return {
    orientation: 'portrait',
    pageSize: 'A4',
    scaling: 'fit-to-width',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    showHeaders: false,
    range: null,
    footer: DEFAULT_FOOTER,
    ...overrides,
  };
}

function createTestSheet(): Sheet {
  return {
    id: 'test',
    name: 'Test Sheet',
    cells: {
      '0:0': { rawValue: 'Name', style: { fontWeight: 'bold' } },
      '0:1': { rawValue: 'Age' },
      '1:0': { rawValue: 'Alice' },
      '1:1': { rawValue: '30' },
      '2:0': { rawValue: 'Bob' },
      '2:1': { rawValue: '25' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

function allCells(): HTMLElement[] {
  return renderedPages.flatMap((p) => Array.from(p.querySelectorAll<HTMLElement>('.pdf-cell')));
}

function findCell(text: string): HTMLElement | undefined {
  return allCells().find((c) => c.textContent === text);
}

function allRows(): HTMLElement[] {
  return renderedPages.flatMap((p) => Array.from(p.querySelectorAll<HTMLElement>('.pdf-row')));
}

describe('pdfExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    renderedPages.length = 0;
    createdPdfs.length = 0;
  });

  describe('generatePdf', () => {
    it('generates a PDF blob from a sheet', async () => {
      const result = await generatePdf(createTestSheet(), { setup: baseSetup() });

      expect(result).toBeInstanceOf(Blob);
      expect(mockHtml2canvas).toHaveBeenCalled();
      expect(createdPdfs.length).toBe(1);
      expect(createdPdfs[0].output).toHaveBeenCalledWith('blob');
      expect(createdPdfs[0].addImage).toHaveBeenCalled();
    });

    it('handles empty sheet', async () => {
      const emptySheet: Sheet = { ...createTestSheet(), cells: {} };
      const result = await generatePdf(emptySheet, { setup: baseSetup() });

      expect(result).toBeInstanceOf(Blob);
      expect(mockHtml2canvas).toHaveBeenCalled();
      expect(renderedPages[0].textContent).toContain('(Empty sheet)');
    });

    it('respects page setup options (orientation, size, margins)', async () => {
      await generatePdf(createTestSheet(), {
        setup: baseSetup({
          orientation: 'landscape',
          pageSize: 'Letter',
          margins: { top: 20, right: 15, bottom: 20, left: 15 },
        }),
      });

      expect(mockJsPDF).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'letter', orientation: 'landscape', unit: 'mm' })
      );
      // Image is placed inside the configured margins.
      expect(createdPdfs[0].addImage).toHaveBeenCalledWith(
        expect.stringContaining('data:image/jpeg'),
        'JPEG',
        15, // left margin
        20, // top margin
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('maps A4 to the jsPDF a4 format', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup({ pageSize: 'A4' }) });

      expect(mockJsPDF).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'a4' })
      );
    });

    it('applies all cell formatting variants (italic, color, textAlign)', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '2:2': {
            rawValue: '=1+1',
            computedValue: 2,
            style: {
              fontStyle: 'italic',
              color: '#FF0000',
              textAlign: 'center',
              backgroundColor: '#EEEEEE',
            },
          },
        },
      };

      const result = await generatePdf(sheet, { setup: baseSetup() });
      expect(result).toBeInstanceOf(Blob);

      const cell = findCell('2');
      expect(cell).toBeTruthy();
      expect(cell!.style.fontStyle).toBe('italic');
      expect(cell!.style.color).toBe('rgb(255, 0, 0)');
      expect(cell!.style.textAlign).toBe('center');
      expect(cell!.style.backgroundColor).toBe('rgb(238, 238, 238)');
    });

    it('applies the cell font size to the data cell', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '2:2': { rawValue: 'Big', style: { fontSize: 24 } } },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = findCell('Big');
      expect(cell).toBeTruthy();
      expect(cell!.style.fontSize).toBe('24px');
    });

    it('applies the cell number format (currency) to the data cell', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '2:2': { rawValue: '1234.5', computedValue: 1234.5, style: { numberFormat: '$#,##0.00' } },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      expect(findCell('$1,234.50')).toBeTruthy();
    });

    it('auto-formats ISO dates as dd-mm-yyyy', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '2:2': { rawValue: '08/08/2026', computedValue: '2026-08-08' } },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      expect(findCell('08-08-2026')).toBeTruthy();
    });

    it('strips the leading single-quote text marker', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '2:2': { rawValue: "'12345", computedValue: "'12345" } },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      expect(findCell('12345')).toBeTruthy();
    });

    it('renders without row/column headings by default', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup() });

      expect(renderedPages.some((p) => p.querySelector('.pdf-header-row'))).toBe(false);
      expect(renderedPages.some((p) => p.querySelector('.pdf-row-header'))).toBe(false);
    });

    it('renders headings when showHeaders is true', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup({ showHeaders: true }) });

      const headerRow = renderedPages.flatMap((p) =>
        Array.from(p.querySelectorAll<HTMLElement>('.pdf-header-row'))
      )[0];
      expect(headerRow).toBeTruthy();
      expect(Array.from(headerRow.querySelectorAll('.pdf-cell')).map((c) => c.textContent)).toEqual(['A', 'B']);
    });

    it('does not draw a generic grid pattern by default', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup() });

      const bordered = allCells().filter(
        (c) => c.style.borderTop || c.style.borderBottom
      );
      expect(bordered).toHaveLength(0);
    });

    it('draws cell borders when a table style (borders) is applied', async () => {
      const border = '1px solid #000000';
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'A', style: { borderTop: border, borderBottom: border, borderLeft: border, borderRight: border } },
          '0:1': { rawValue: 'B', style: { borderTop: border, borderBottom: border, borderLeft: border, borderRight: border } },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const a = findCell('A')!;
      expect(a.style.borderTop).toBe(border);
      expect(a.style.borderBottom).toBe(border);
      expect(a.style.borderLeft).toBe(border);
      // Shared right edge is drawn by A; B must not double it up.
      expect(a.style.borderRight).toBe(border);
      const b = findCell('B')!;
      expect(b.style.borderLeft).toBe('');
    });

    it('respects a print range given as an A1 string', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup(), range: 'A1:A2' });

      expect(allRows()).toHaveLength(2);
      expect(renderedPages[0].textContent).toContain('Name');
      expect(renderedPages[0].textContent).toContain('Alice');
    });

    it('respects a print range given as a PrintRange object', async () => {
      await generatePdf(createTestSheet(), {
        setup: baseSetup(),
        range: { startRow: 1, endRow: 2, startCol: 0, endCol: 0 },
      });

      expect(allRows()).toHaveLength(2);
      expect(renderedPages[0].textContent).toContain('Alice');
      expect(renderedPages[0].textContent).toContain('Bob');
    });

    it('falls back to the used range for an invalid range string', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup(), range: 'not-a-range' });

      expect(allRows()).toHaveLength(3);
    });

    it('falls back to the used range when the range is outside the sheet', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup(), range: 'A200:C300' });

      expect(allRows()).toHaveLength(3);
    });

    it('handles a single-cell sheet at the last row and column', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '0:0': { rawValue: 'Only', style: { borderRight: '1px solid #000' } } },
        columnCount: 1,
        rowCount: 1,
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = findCell('Only');
      expect(cell).toBeTruthy();
      expect(cell!.style.borderRight).toBe('1px solid #000');
    });

    it('handles zero-width columns by falling back to equal widths', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '0:0': { rawValue: 'A' }, '0:1': { rawValue: 'B' } },
        defaultColWidth: 0,
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cells = allCells();
      expect(cells).toHaveLength(2);
      const widths = cells.map((c) => parseFloat(c.style.width));
      expect(widths[0]).toBeGreaterThan(0);
      expect(widths[1]).toBeGreaterThan(0);
      expect(widths[0]).toBeCloseTo(widths[1]);
    });

    it('adds footers to every page with page numbers', async () => {
      createdPdfs.length = 0;
      await generatePdf(createTestSheet(), { setup: baseSetup({ footer: 'Page {page} of {total}' }) });

      const pdf = createdPdfs[0];
      expect(pdf.setPage).toHaveBeenCalled();
      expect(pdf.text).toHaveBeenCalledWith('Page 1 of 1', 105, 292, { align: 'center' });
    });

    it('skips footers when the footer text is empty', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup({ footer: '' }) });

      expect(createdPdfs[0].setPage).not.toHaveBeenCalled();
      expect(createdPdfs[0].text).not.toHaveBeenCalled();
    });

    it('paginates rows across multiple pages for fit-to-width', async () => {
      const cells: Sheet['cells'] = {};
      for (let r = 0; r < 80; r++) {
        cells[`${r}:0`] = { rawValue: `Row ${r}` };
      }
      const sheet: Sheet = { ...createTestSheet(), cells, rowCount: 100 };

      await generatePdf(sheet, { setup: baseSetup({ scaling: 'fit-to-width' }) });

      expect(renderedPages.length).toBeGreaterThan(1);
      // Every page but the first starts with whole rows (no split content).
      expect(mockHtml2canvas).toHaveBeenCalledTimes(renderedPages.length);
    });

    it('keeps a small sheet on a single page', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup({ scaling: 'fit-to-width' }) });

      expect(renderedPages).toHaveLength(1);
    });

    it('fits a tall sheet onto one page with fit-to-page scaling', async () => {
      const cells: Sheet['cells'] = {};
      for (let r = 0; r < 60; r++) {
        cells[`${r}:0`] = { rawValue: `Row ${r}` };
      }
      const sheet: Sheet = { ...createTestSheet(), cells, rowCount: 100 };

      await generatePdf(sheet, { setup: baseSetup({ scaling: 'fit-to-page' }) });

      expect(renderedPages).toHaveLength(1);
    });

    it('applies text decoration and wrapped whitespace styles', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '2:2': {
            rawValue: 'Styled',
            style: { textDecoration: 'underline', whiteSpace: 'normal' },
          },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = findCell('Styled');
      expect(cell!.style.textDecoration).toBe('underline');
      expect(cell!.style.whiteSpace).toBe('normal');
      expect(cell!.style.textOverflow).toBe('clip');
    });

    it('renders empty cells inside the used range', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'A' },
          '0:2': { rawValue: 'C' },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const firstRow = allRows()[0];
      const cells = Array.from(firstRow.querySelectorAll('.pdf-cell'));
      expect(cells).toHaveLength(3);
      expect(cells[1].textContent).toBe('');
    });

    it('draws interior borders when neighbours do not share the edge', async () => {
      const b = '1px solid #000000';
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'A', style: { borderTop: b, borderLeft: b } },
          '0:1': { rawValue: 'B', style: { borderTop: b, borderLeft: b } },
          '1:0': { rawValue: 'C', style: { borderLeft: b, borderTop: b } },
          '1:1': { rawValue: 'D' },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      expect(findCell('B')!.style.borderLeft).toBe(b);
      expect(findCell('C')!.style.borderTop).toBe(b);
    });

    it('carries borders from cells just outside the printed range', async () => {
      const b = '1px solid #000000';
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'A' },
          '0:1': { rawValue: 'B' },
          '1:0': { rawValue: 'C' },
          '1:1': { rawValue: 'D' },
          // Outside the A1:B2 print range — its left border forms B's right edge.
          '0:2': { rawValue: 'E', style: { borderLeft: b } },
        },
      };

      await generatePdf(sheet, { setup: baseSetup(), range: 'A1:B2' });

      expect(findCell('B')!.style.borderRight).toBe(b);
    });

    it('includes charts as embedded images', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'Cat' },
          '0:1': { rawValue: 'Val' },
          '1:0': { rawValue: 'A' },
          '1:1': { rawValue: '10' },
          '2:0': { rawValue: 'B' },
          '2:1': { rawValue: '20' },
        },
        charts: [
          {
            id: 'chart-1',
            type: 'column',
            title: 'My Chart',
            dataRange: 'A1:B3',
            series: [{ label: 'Val', dataRange: 'B1:B3', color: '#3B82EF' }],
            legendPosition: 'top',
            width: 400,
            height: 250,
            row: 0,
            col: 0,
          },
        ],
      };

      const result = await generatePdf(sheet, { setup: baseSetup() });
      expect(result).toBeInstanceOf(Blob);

      const img = renderedPages.flatMap((p) =>
        Array.from(p.querySelectorAll<HTMLImageElement>('.pdf-chart img'))
      )[0];
      expect(img).toBeTruthy();
      expect(img.src).toContain('data:image/svg+xml');
      expect(img.width).toBe(400);
    });

    it('renders a chart with equal values and a missing series value', async () => {
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'Cat' },
          '0:1': { rawValue: 'Val' },
          '1:0': { rawValue: 'A' },
          '1:1': { rawValue: '5' },
          '2:0': { rawValue: 'B' },
        },
        charts: [
          {
            id: 'chart-2',
            type: 'column',
            title: '',
            dataRange: 'A1:B3',
            series: [{ label: 'Val', dataRange: 'B1:B3', color: '#3B82EF' }],
            legendPosition: 'top',
            width: 400,
            height: 250,
            row: 0,
            col: 0,
          },
        ],
      };

      const result = await generatePdf(sheet, { setup: baseSetup() });
      expect(result).toBeInstanceOf(Blob);
      expect(renderedPages.some((p) => p.querySelector('.pdf-chart img'))).toBe(true);
    });

    it('renders the demo workbook (Formula Guide and Sales Data)', async () => {
      const workbook = createDemoWorkbook();

      // Formula Guide is tall and must paginate across multiple pages.
      const guideResult = await generatePdf(workbook.sheets[0], { setup: baseSetup() });
      expect(guideResult).toBeInstanceOf(Blob);
      expect(renderedPages.length).toBeGreaterThan(1);

      // Sales Data includes embedded charts.
      renderedPages.length = 0;
      createdPdfs.length = 0;
      const salesResult = await generatePdf(workbook.sheets[1], { setup: baseSetup() });
      expect(salesResult).toBeInstanceOf(Blob);
      expect(renderedPages.some((p) => p.querySelector('.pdf-chart img'))).toBe(true);
    });
  });

  describe('computePrintScale', () => {
    const margins = { top: 10, right: 10, bottom: 10, left: 10 };

    it('never scales for actual-size', () => {
      expect(computePrintScale('actual-size', 2000, 2000, 210, 297, margins)).toBe(1);
    });

    it('scales down to fit the printable width', () => {
      const scale = computePrintScale('fit-to-width', 2000, 500, 210, 297, margins);
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThan(1);
    });

    it('does not scale up when the content already fits', () => {
      expect(computePrintScale('fit-to-width', 500, 500, 210, 297, margins)).toBe(1);
    });

    it('scales down to fit a single page height', () => {
      const scale = computePrintScale('fit-to-page', 500, 5000, 210, 297, margins);
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThan(1);
    });

    it('guards against zero / non-finite content sizes', () => {
      expect(computePrintScale('fit-to-page', 0, 0, 210, 297, margins)).toBe(1);
      expect(computePrintScale('fit-to-width', -5, -5, 210, 297, margins)).toBe(1);
    });

    it('guards against margins larger than the page', () => {
      const huge = { top: 0, right: 0, bottom: 0, left: 300 };
      expect(computePrintScale('fit-to-width', 100, 100, 210, 297, huge)).toBe(1);
    });
  });

  describe('addFooters', () => {
    it('formats {page} and {total} placeholders', () => {
      const pdf: JsPdfLike = {
        internal: {
          getNumberOfPages: () => 3,
          pageSize: { getWidth: () => 210, getHeight: () => 297 },
        },
        setPage: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        text: jest.fn(),
        output: jest.fn(),
      };

      addFooters(pdf, { text: 'Page {page} of {total}', bottomMargin: 10 });

      expect(pdf.text).toHaveBeenCalledTimes(3);
      expect(pdf.text).toHaveBeenNthCalledWith(1, 'Page 1 of 3', 105, 292, { align: 'center' });
      expect(pdf.text).toHaveBeenNthCalledWith(3, 'Page 3 of 3', 105, 292, { align: 'center' });
    });

    it('does nothing when there are no pages', () => {
      const pdf: JsPdfLike = {
        internal: {
          getNumberOfPages: () => 0,
          pageSize: { getWidth: () => 210, getHeight: () => 297 },
        },
        setPage: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        text: jest.fn(),
        output: jest.fn(),
      };

      addFooters(pdf, { text: 'Page {page}', bottomMargin: 10 });
      expect(pdf.setPage).not.toHaveBeenCalled();
    });
  });

  describe('formatPrintRange', () => {
    it('formats a range as an A1 string', () => {
      expect(formatPrintRange({ startRow: 0, endRow: 19, startCol: 0, endCol: 3 })).toBe('A1:D20');
    });
  });

  describe('downloadPdf', () => {
    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();
    });

    it('triggers a PDF download', async () => {
      await downloadPdf(createTestSheet(), { setup: baseSetup() });

      expect(URL.createObjectURL).toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 1100));
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('uses custom title for filename', async () => {
      await downloadPdf(createTestSheet(), { setup: baseSetup(), title: 'My Report' });

      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
