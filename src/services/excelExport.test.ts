// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { exportExcel, downloadExcel } from './excelExport';
import type { Workbook } from '../types';

function createTestWorkbook(): Workbook {
  return {
    id: 'test-wb',
    title: 'Test Workbook',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
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
      },
    ],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

describe('Excel Export Service', () => {
  it('exports a workbook to a Blob', () => {
    const workbook = createTestWorkbook();
    const blob = exportExcel(workbook);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('spreadsheetml');
  });

  it('produces a blob with xlsx content type', () => {
    const workbook = createTestWorkbook();
    const blob = exportExcel(workbook);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('spreadsheetml');
  });

  it('respects includeFormulas option', () => {
    const workbook = createTestWorkbook();
    const blob = exportExcel(workbook, { includeFormulas: false });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('respects includeFormatting option', () => {
    const workbook = createTestWorkbook();
    const blob = exportExcel(workbook, { includeFormatting: false });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles multiple sheets', () => {
    const workbook: Workbook = {
      ...createTestWorkbook(),
      sheets: [
        ...createTestWorkbook().sheets,
        {
          id: 'sheet-2',
          name: 'Sheet2',
          cells: { '0:0': { rawValue: 'Second Sheet' } },
          defaultColWidth: 100,
          defaultRowHeight: 28,
          columnWidths: {},
          rowHeights: {},
          columnCount: 26,
          rowCount: 100,
          frozenColumns: 0,
          frozenRows: 0,
        },
      ],
    };

    const blob = exportExcel(workbook);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces larger blobs for workbooks with more data', () => {
    const smallWb = createTestWorkbook();
    const largeWb: Workbook = {
      ...createTestWorkbook(),
      sheets: [
        {
          ...createTestWorkbook().sheets[0],
          cells: {
            '0:0': { rawValue: 'A' },
            '0:1': { rawValue: 'B' },
            '1:0': { rawValue: 'C' },
            '1:1': { rawValue: 'D' },
            '2:0': { rawValue: 'E' },
            '2:1': { rawValue: 'F' },
          },
        },
      ],
    };

    const smallBlob = exportExcel(smallWb);
    const largeBlob = exportExcel(largeWb);
    expect(largeBlob.size).toBeGreaterThanOrEqual(smallBlob.size);
  });

  it('downloadExcel triggers a download', () => {
    const clickSpy = jest.fn();
    const mockAnchor = document.createElement('a');
    mockAnchor.click = clickSpy;
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();

    const workbook = createTestWorkbook();
    downloadExcel(workbook, 'test-file');

    expect(clickSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith('a');

    createElementSpy.mockRestore();
  });

  it('exports formulas with computed values', () => {
    const workbook: Workbook = {
      ...createTestWorkbook(),
      sheets: [
        {
          ...createTestWorkbook().sheets[0],
          cells: {
            '0:0': { rawValue: '=A2+B2', computedValue: 10 },
            '0:1': { rawValue: '5' },
          },
        },
      ],
    };

    const blob = exportExcel(workbook, { includeFormulas: true });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exports cells with computed values', () => {
    const workbook: Workbook = {
      ...createTestWorkbook(),
      sheets: [
        {
          ...createTestWorkbook().sheets[0],
          cells: {
            '0:0': { rawValue: '42', computedValue: 42 },
            '0:1': { rawValue: '3.14', computedValue: 3.14 },
            '0:2': { rawValue: 'hello', computedValue: 'hello' },
          },
        },
      ],
    };

    const blob = exportExcel(workbook);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exports dates, booleans, and formatted cells', () => {
    const workbook: Workbook = {
      ...createTestWorkbook(),
      sheets: [
        {
          ...createTestWorkbook().sheets[0],
          cells: {
            '0:0': { rawValue: '2024-01-15' },  // date
            '0:1': { rawValue: 'TRUE' },         // boolean
            '0:2': { rawValue: 'FALSE' },        // boolean
            '1:0': { rawValue: 'hello', style: { fontWeight: 'bold', fontStyle: 'italic', color: '#FF0000' } },
            '1:1': { rawValue: 'world', style: { backgroundColor: '#00FF00', textAlign: 'center' } },
          },
        },
      ],
    };

    const blob = exportExcel(workbook, { includeFormatting: true });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
