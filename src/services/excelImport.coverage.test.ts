import { importExcel, importExcelFile } from './excelImport';
import * as XLSX from 'xlsx';

// Helper to create an .xlsx buffer from a 2D array
function createXlsxBuffer(data: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('excelImport - Options', () => {
  it('imports with includeFormulas false', () => {
    const buffer = createXlsxBuffer([[10, 20, 30]]);
    const result = importExcel(buffer, { includeFormulas: false });
    expect(result.success).toBe(true);
    expect(result.cellCount).toBeGreaterThan(0);
  });

  it('imports with includeFormatting false', () => {
    const buffer = createXlsxBuffer([['Header', 'Data']]);
    const result = importExcel(buffer, { includeFormatting: false });
    expect(result.success).toBe(true);
    // With formatting off, cells should not have style
    const sheet = result.workbook!.sheets[0];
    expect(sheet.cells['0:0']?.style).toBeUndefined();
  });

  it('imports with both options false', () => {
    const buffer = createXlsxBuffer([['A', 'B']]);
    const result = importExcel(buffer, { includeFormulas: false, includeFormatting: false });
    expect(result.success).toBe(true);
  });
});

describe('excelImport - Error Handling', () => {
  it('handles empty buffer without throwing', () => {
    const result = importExcel(new ArrayBuffer(0));
    expect(result).toBeDefined();
    expect(result.sheetCount).toBeGreaterThanOrEqual(0);
  });

  it('handles random bytes without crashing', () => {
    const buffer = new Uint8Array([0xFF, 0xFE, 0x00, 0x01, 0x02, 0x03]).buffer;
    const result = importExcel(buffer);
    expect(result).toBeDefined();
  });
});

describe('excelImportFile', () => {
  it('imports from a File object', async () => {
    const buffer = createXlsxBuffer([['Hello']]);
    // Create a mock File with arrayBuffer support
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = Object.assign(blob, { name: 'test.xlsx', arrayBuffer: () => Promise.resolve(buffer) });

    const result = await importExcelFile(file as unknown as File);
    expect(result.success).toBe(true);
    expect(result.sheetCount).toBe(1);
  });

  it('passes options to importExcel', async () => {
    const buffer = createXlsxBuffer([['Test']]);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = Object.assign(blob, { name: 'test.xlsx', arrayBuffer: () => Promise.resolve(buffer) });

    const result = await importExcelFile(file as unknown as File, { includeFormulas: false, includeFormatting: false });
    expect(result.success).toBe(true);
  });

  it('reads file content correctly', async () => {
    const buffer = createXlsxBuffer([['FileContent']]);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = Object.assign(blob, { name: 'data.xlsx', arrayBuffer: () => Promise.resolve(buffer) });

    const result = await importExcelFile(file as unknown as File);
    expect(result.success).toBe(true);
    const sheet = result.workbook!.sheets[0];
    expect(sheet.cells['0:0']?.rawValue).toBe('FileContent');
  });
});
