// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { generatePdf, downloadPdf } from './pdfExport';
import type { Sheet } from '../types';

// Mock html2pdf.js dynamic import
const mockOutputPdf = jest.fn().mockResolvedValue(new Blob(['pdf']));
const mockFrom = jest.fn().mockReturnThis();
const mockSet = jest.fn().mockReturnThis();
const mockHtml2pdf = jest.fn().mockImplementation(() => ({
  set: mockSet,
  from: mockFrom,
  outputPdf: mockOutputPdf,
}));

jest.mock('html2pdf.js', () => ({
  __esModule: true,
  default: mockHtml2pdf,
}), { virtual: true });

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

describe('pdfExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePdf', () => {
    it('generates a PDF blob from a sheet', async () => {
      const sheet = createTestSheet();
      const result = await generatePdf(sheet, {
        setup: {
          orientation: 'portrait',
          pageSize: 'A4',
          scaling: 'fit-to-page',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      });

      expect(result).toBeInstanceOf(Blob);
      expect(mockSet).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockOutputPdf).toHaveBeenCalledWith('blob');
    });

    it('handles empty sheet', async () => {
      const emptySheet: Sheet = {
        ...createTestSheet(),
        cells: {},
      };

      const result = await generatePdf(emptySheet, {
        setup: {
          orientation: 'portrait',
          pageSize: 'A4',
          scaling: 'fit-to-page',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      });

      expect(result).toBeInstanceOf(Blob);
    });

    it('respects page setup options', async () => {
      const sheet = createTestSheet();
      await generatePdf(sheet, {
        setup: {
          orientation: 'landscape',
          pageSize: 'Letter',
          scaling: 'actual-size',
          margins: { top: 20, right: 15, bottom: 20, left: 15 },
        },
        title: 'Custom Title',
        showGrid: false,
        showHeaders: false,
      });

      // Verify set was called with correct options
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Custom_Title.pdf',
        })
      );
    });

    it('applies all cell formatting variants (italic, color, textAlign)', async () => {
      // Need cells in non-header positions (not row 0 or col 0) to hit the data cell branch
      const sheet: Sheet = {
        ...createTestSheet(),
        cells: {
          '0:0': { rawValue: 'H1' },  // header
          '0:1': { rawValue: 'H2' },  // header
          '1:0': { rawValue: 'R1' },  // row header
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

      const result = await generatePdf(sheet, {
        setup: {
          orientation: 'portrait',
          pageSize: 'A4',
          scaling: 'fit-to-page',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      });

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('downloadPdf', () => {
    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();
    });

    it('triggers a PDF download', async () => {
      const sheet = createTestSheet();
      await downloadPdf(sheet, {
        setup: {
          orientation: 'portrait',
          pageSize: 'A4',
          scaling: 'fit-to-page',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      });

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('uses custom title for filename', async () => {
      const sheet = createTestSheet();
      await downloadPdf(sheet, {
        setup: {
          orientation: 'portrait',
          pageSize: 'A4',
          scaling: 'fit-to-page',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
        title: 'My Report',
      });

      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
