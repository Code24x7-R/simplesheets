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

// ─── html2pdf mock ──────────────────────────────────────────────────────────

const mockPdfDoc: JsPdfLike = {
  internal: {
    getNumberOfPages: jest.fn().mockReturnValue(2),
    pageSize: {
      getWidth: jest.fn().mockReturnValue(210),
      getHeight: jest.fn().mockReturnValue(297),
    },
  },
  setPage: jest.fn(),
  setFontSize: jest.fn(),
  setTextColor: jest.fn(),
  text: jest.fn(),
  output: jest.fn().mockReturnValue(new Blob(['pdf'])),
};

const mockGet = jest.fn().mockResolvedValue(mockPdfDoc);
const mockToPdf = jest.fn();
const mockOutputPdf = jest.fn().mockResolvedValue(mockPdfDoc);
const mockFrom = jest.fn().mockReturnThis();
const mockSet = jest.fn().mockReturnThis();
const mockHtml2pdf = jest.fn().mockImplementation(() => ({
  set: mockSet,
  from: mockFrom,
  toPdf: mockToPdf,
  get: mockGet,
  outputPdf: mockOutputPdf,
}));
mockToPdf.mockImplementation(() => Promise.resolve(mockHtml2pdf()));

jest.mock('html2pdf.js', () => ({
  __esModule: true,
  default: mockHtml2pdf,
}), { virtual: true });

// ─── helpers ────────────────────────────────────────────────────────────────

function baseSetup(overrides: Partial<PrintSetup> = {}): PrintSetup {
  return {
    orientation: 'portrait',
    pageSize: 'A4',
    scaling: 'fit-to-page',
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

/** Captures the HTML element passed to html2pdf. */
function captureHtml(): { get: () => HTMLElement | null } {
  let captured: HTMLElement | null = null;
  mockFrom.mockImplementation((el: HTMLElement) => {
    captured = el;
    return mockHtml2pdf();
  });
  return { get: () => captured };
}

describe('pdfExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOutputPdf.mockResolvedValue(mockPdfDoc);
    (mockPdfDoc.output as jest.Mock).mockReturnValue(new Blob(['pdf']));
    (mockPdfDoc.internal.getNumberOfPages as jest.Mock).mockReturnValue(2);
  });

  describe('generatePdf', () => {
    it('generates a PDF blob from a sheet', async () => {
      const sheet = createTestSheet();
      const result = await generatePdf(sheet, { setup: baseSetup() });

      expect(result).toBeInstanceOf(Blob);
      expect(mockSet).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      // Render, grab the live jsPDF document, then serialise via output('blob').
      expect(mockToPdf).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith('pdf');
      expect(mockPdfDoc.output).toHaveBeenCalledWith('blob');
    });

    it('handles empty sheet', async () => {
      const emptySheet: Sheet = { ...createTestSheet(), cells: {} };
      const result = await generatePdf(emptySheet, { setup: baseSetup() });
      expect(result).toBeInstanceOf(Blob);
    });

    it('respects page setup options', async () => {
      const sheet = createTestSheet();
      await generatePdf(sheet, {
        setup: baseSetup({
          orientation: 'landscape',
          pageSize: 'Letter',
          scaling: 'actual-size',
          margins: { top: 20, right: 15, bottom: 20, left: 15 },
        }),
        title: 'Custom Title',
        showHeaders: true,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Custom_Title.pdf',
          jsPDF: expect.objectContaining({ format: 'letter', orientation: 'landscape' }),
        })
      );
    });

    it('maps A4 to jsPDF a4 format', async () => {
      const sheet = createTestSheet();
      await generatePdf(sheet, { setup: baseSetup({ pageSize: 'A4' }) });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          jsPDF: expect.objectContaining({ format: 'a4' }),
        })
      );
    });

    it('applies all cell formatting variants (italic, color, textAlign)', async () => {
      const html = captureHtml();
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

      const cell = Array.from(html.get()!.querySelectorAll('.pdf-cell')).find(
        (t) => t.textContent === '2'
      ) as HTMLElement;
      expect(cell).toBeTruthy();
      expect(cell.style.fontStyle).toBe('italic');
      expect(cell.style.color).toBe('rgb(255, 0, 0)');
      expect(cell.style.textAlign).toBe('center');
      expect(cell.style.backgroundColor).toBe('rgb(238, 238, 238)');
    });

    it('applies the cell font size to the data cell', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '2:2': { rawValue: 'Big', style: { fontSize: 24 } } },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = Array.from(html.get()!.querySelectorAll('.pdf-cell')).find(
        (t) => t.textContent === 'Big'
      ) as HTMLElement;
      expect(cell).toBeTruthy();
      expect(cell.style.fontSize).toBe('24px');
    });

    it('applies the cell number format (currency) to the data cell', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '2:2': { rawValue: '1234.5', computedValue: 1234.5, style: { numberFormat: '$#,##0.00' } },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = Array.from(html.get()!.querySelectorAll('.pdf-cell')).find(
        (t) => t.textContent === '$1,234.50'
      ) as HTMLElement;
      expect(cell).toBeTruthy();
    });

    it('auto-formats ISO dates as dd-mm-yyyy', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '2:2': { rawValue: '08/08/2026', computedValue: '2026-08-08' } },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = Array.from(html.get()!.querySelectorAll('.pdf-cell')).find(
        (t) => t.textContent === '08-08-2026'
      ) as HTMLElement;
      expect(cell).toBeTruthy();
    });

    it('strips the leading single-quote text marker', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '2:2': { rawValue: "'12345", computedValue: "'12345" } },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = Array.from(html.get()!.querySelectorAll('.pdf-cell')).find(
        (t) => t.textContent === '12345'
      ) as HTMLElement;
      expect(cell).toBeTruthy();
    });

    it('renders without row/column headings by default', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup() });

      expect(html.get()!.querySelector('.pdf-header-row')).toBeNull();
      expect(html.get()!.querySelector('.pdf-row-header')).toBeNull();
    });

    it('renders headings when showHeaders is true', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup({ showHeaders: true }) });

      expect(html.get()!.querySelector('.pdf-header-row')).not.toBeNull();
      expect(html.get()!.querySelector('.pdf-row-header')).not.toBeNull();
      // Column letters appear in the heading row.
      const headerRow = html.get()!.querySelector('.pdf-header-row') as HTMLElement;
      const headerCells = Array.from(headerRow.querySelectorAll('.pdf-cell')).map(
        (c) => c.textContent
      );
      expect(headerCells).toEqual(['A', 'B']);
    });

    it('does not draw a generic grid pattern by default', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup() });

      const bordered = Array.from(html.get()!.querySelectorAll('.pdf-cell')).filter(
        (c) => (c as HTMLElement).style.borderTop || (c as HTMLElement).style.borderBottom
      );
      expect(bordered).toHaveLength(0);
    });

    it('draws cell borders when a table style (borders) is applied', async () => {
      const html = captureHtml();
      const border = '1px solid #000000';
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'A', style: { borderTop: border, borderBottom: border, borderLeft: border, borderRight: border } },
          '0:1': { rawValue: 'B', style: { borderTop: border, borderBottom: border, borderLeft: border, borderRight: border } },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cells = Array.from(html.get()!.querySelectorAll('.pdf-cell')) as HTMLElement[];
      const a = cells.find((c) => c.textContent === 'A')!;
      expect(a.style.borderTop).toBe(border);
      expect(a.style.borderBottom).toBe(border);
      expect(a.style.borderLeft).toBe(border);
      // Shared right edge is drawn by A; B must not double it up.
      expect(a.style.borderRight).toBe(border);
      const b = cells.find((c) => c.textContent === 'B')!;
      expect(b.style.borderLeft).toBe('');
    });

    it('respects a print range given as an A1 string', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup({ range: null }), range: 'A1:A2' });

      const rows = html.get()!.querySelectorAll('.pdf-row');
      // Only rows 1 and 2 (no header row).
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('Name');
      expect(rows[1].textContent).toContain('Alice');
    });

    it('respects a print range given as a PrintRange object', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), {
        setup: baseSetup(),
        range: { startRow: 1, endRow: 2, startCol: 0, endCol: 0 },
      });

      const rows = html.get()!.querySelectorAll('.pdf-row');
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('Alice');
      expect(rows[1].textContent).toContain('Bob');
    });

    it('falls back to the used range for an invalid range string', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup(), range: 'not-a-range' });

      expect(html.get()!.querySelectorAll('.pdf-row').length).toBe(3);
    });

    it('falls back to the used range when the range is outside the sheet', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup(), range: 'A200:C300' });

      expect(html.get()!.querySelectorAll('.pdf-row').length).toBe(3);
    });

    it('handles a single-cell sheet at the last row and column', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '0:0': { rawValue: 'Only', style: { borderRight: '1px solid #000' } } },
        columnCount: 1,
        rowCount: 1,
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cell = html.get()!.querySelector('.pdf-cell') as HTMLElement;
      expect(cell.textContent).toBe('Only');
      expect(cell.style.borderRight).toBe('1px solid #000');
    });

    it('handles zero-width columns by falling back to equal widths', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: { '0:0': { rawValue: 'A' }, '0:1': { rawValue: 'B' } },
        defaultColWidth: 0,
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const cells = Array.from(html.get()!.querySelectorAll('.pdf-cell')) as HTMLElement[];
      expect(cells).toHaveLength(2);
      expect(cells[0].style.flex).toBe('0 0 50%');
      expect(cells[1].style.flex).toBe('0 0 50%');
    });

    it('adds footers to every page with page numbers', async () => {
      const sheet = createTestSheet();
      await generatePdf(sheet, { setup: baseSetup({ footer: 'Page {page} of {total}' }) });

      expect(mockPdfDoc.setPage).toHaveBeenCalledTimes(2);
      expect(mockPdfDoc.text).toHaveBeenCalledWith(
        'Page 1 of 2',
        105,
        292,
        { align: 'center' }
      );
      expect(mockPdfDoc.text).toHaveBeenCalledWith(
        'Page 2 of 2',
        105,
        292,
        { align: 'center' }
      );
    });

    it('skips footers when the footer text is empty', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup({ footer: '' }) });

      expect(mockPdfDoc.setPage).not.toHaveBeenCalled();
      expect(mockPdfDoc.text).not.toHaveBeenCalled();
    });

    it('marks rows as unbreakable for automatic page breaks', async () => {
      await generatePdf(createTestSheet(), { setup: baseSetup() });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pagebreak: expect.objectContaining({ avoid: ['.pdf-row'] }),
        })
      );
    });

    it('applies zoom scaling when the content is larger than the page', async () => {
      const html = captureHtml();
      const rectSpy = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ width: 2000, height: 2000 } as DOMRect);
      try {
        await generatePdf(createTestSheet(), { setup: baseSetup({ scaling: 'fit-to-page' }) });

        const container = html.get()!;
        // The zoom branch keeps the CSS width at the natural size and applies
        // `zoom` to shrink it. jsdom ignores `zoom`, so assert the width.
        expect(container.style.width).toBe('2000px');
      } finally {
        rectSpy.mockRestore();
      }
    });

    it('does not zoom when the content already fits', async () => {
      const html = captureHtml();
      const rectSpy = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ width: 200, height: 200 } as DOMRect);
      try {
        await generatePdf(createTestSheet(), { setup: baseSetup({ scaling: 'fit-to-page' }) });
        expect(html.get()!.style.getPropertyValue('zoom')).toBe('');
        expect(html.get()!.style.width).toBe('100%');
      } finally {
        rectSpy.mockRestore();
      }
    });

    it('applies fit-to-width scaling without re-measuring height', async () => {
      const html = captureHtml();
      const rectSpy = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ width: 2000, height: 5000 } as DOMRect);
      try {
        await generatePdf(createTestSheet(), { setup: baseSetup({ scaling: 'fit-to-width' }) });
        expect(html.get()!.style.width).toBe('2000px');
      } finally {
        rectSpy.mockRestore();
      }
    });

    it('keeps actual size (no zoom) and uses max-content width', async () => {
      const html = captureHtml();
      await generatePdf(createTestSheet(), { setup: baseSetup({ scaling: 'actual-size' }) });

      const container = html.get()!;
      expect(container.style.getPropertyValue('zoom')).toBe('');
      expect(container.style.display).toBe('inline-block');
      expect(container.style.width).toBe('auto');
    });

    it('applies text decoration and wrapped whitespace styles', async () => {
      const html = captureHtml();
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

      const cell = Array.from(html.get()!.querySelectorAll('.pdf-cell')).find(
        (t) => t.textContent === 'Styled'
      ) as HTMLElement;
      expect(cell.style.textDecoration).toBe('underline');
      expect(cell.style.whiteSpace).toBe('normal');
      expect(cell.style.textOverflow).toBe('clip');
    });

    it('renders empty cells inside the used range', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'A' },
          '0:2': { rawValue: 'C' },
        },
      };

      await generatePdf(sheet, { setup: baseSetup() });

      const firstRow = html.get()!.querySelector('.pdf-row') as HTMLElement;
      const cells = Array.from(firstRow.querySelectorAll('.pdf-cell'));
      expect(cells).toHaveLength(3);
      expect(cells[1].textContent).toBe('');
    });

    it('draws interior borders when neighbours do not share the edge', async () => {
      const html = captureHtml();
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

      const cells = Array.from(html.get()!.querySelectorAll('.pdf-cell')) as HTMLElement[];
      const cellB = cells.find((c) => c.textContent === 'B')!;
      const cellC = cells.find((c) => c.textContent === 'C')!;
      expect(cellB.style.borderLeft).toBe(b);
      expect(cellC.style.borderTop).toBe(b);
    });

    it('carries borders from cells just outside the printed range', async () => {
      const html = captureHtml();
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

      const rows = Array.from(html.get()!.querySelectorAll('.pdf-row')) as HTMLElement[];
      const cellB = Array.from(rows[0].querySelectorAll('.pdf-cell')).find(
        (c) => c.textContent === 'B'
      ) as HTMLElement;
      expect(cellB.style.borderRight).toBe(b);
    });

    it('includes charts as embedded images', async () => {
      const html = captureHtml();
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

      const img = html.get()!.querySelector('.pdf-chart img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('data:image/svg+xml');
      expect(img.width).toBe(400);
    });

    it('renders a chart with equal values and a missing series value', async () => {
      const html = captureHtml();
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'Cat' },
          '0:1': { rawValue: 'Val' },
          '1:0': { rawValue: 'A' },
          '1:1': { rawValue: '5' },
          '2:0': { rawValue: 'B' },
          // B2 intentionally missing → series value falls back to 0.
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
      expect(html.get()!.querySelector('.pdf-chart img')).toBeTruthy();
    });
  });

  describe('computePrintScale', () => {
    const margins = { top: 10, right: 10, bottom: 10, left: 10 };

    it('never scales for actual-size', () => {
      expect(computePrintScale('actual-size', 2000, 2000, 210, 297, margins)).toBe(1);
    });

    it('scales down to fit the printable width', () => {
      // A4 portrait inner width ≈ 190mm ≈ 718px.
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
      // Revocation is deferred so the browser can start the download.
      await new Promise((r) => setTimeout(r, 1100));
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('uses custom title for filename', async () => {
      await downloadPdf(createTestSheet(), { setup: baseSetup(), title: 'My Report' });

      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
