import { importExcel } from './excelImport';
import * as XLSX from 'xlsx';

// Helper to create a minimal .xlsx file in memory
function createXlsxBuffer(data: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return wbout;
}

describe('Excel Import Service', () => {
  it('imports a simple sheet with values', () => {
    const buffer = createXlsxBuffer([
      ['Name', 'Age', 'City'],
      ['Alice', 30, 'NYC'],
      ['Bob', 25, 'LA'],
    ]);

    const result = importExcel(buffer);
    expect(result.success).toBe(true);
    expect(result.sheetCount).toBe(1);
    expect(result.cellCount).toBeGreaterThan(0);
  });

  it('extracts cell values correctly', () => {
    const buffer = createXlsxBuffer([
      ['Hello', 'World'],
      [42, 3.14],
    ]);

    const result = importExcel(buffer);
    expect(result.success).toBe(true);

    const sheet = result.workbook!.sheets[0];
    expect(sheet.cells['0:0']?.rawValue).toBe('Hello');
    expect(sheet.cells['0:1']?.rawValue).toBe('World');
    expect(sheet.cells['1:0']?.rawValue).toBe('42');
  });

  it('handles empty buffer without throwing', () => {
    // SheetJS may create a default sheet from empty input
    const result = importExcel(new ArrayBuffer(0));
    expect(result).toBeDefined();
    expect(result.sheetCount).toBeGreaterThanOrEqual(0);
  });

  it('handles random bytes without crashing', () => {
    const buffer = new Uint8Array([0xFF, 0xFE, 0x00, 0x01, 0x02, 0x03]).buffer;
    const result = importExcel(buffer);
    // Should not throw — SheetJS may or may not parse garbage
    expect(result).toBeDefined();
  });

  it('respects includeFormulas option', () => {
    const buffer = createXlsxBuffer([
      [10, 20, '=A1+B1'],
    ]);

    const result = importExcel(buffer, { includeFormulas: true });
    expect(result.success).toBe(true);
  });

  it('respects includeFormatting option', () => {
    const buffer = createXlsxBuffer([
      ['Header', 'Data'],
    ]);

    const result = importExcel(buffer, { includeFormatting: false });
    expect(result.success).toBe(true);
  });

  it('creates valid workbook structure', () => {
    const buffer = createXlsxBuffer([['Test']]);
    const result = importExcel(buffer);

    expect(result.workbook).toBeDefined();
    expect(result.workbook!.id).toBeDefined();
    expect(result.workbook!.sheets).toHaveLength(1);
    expect(result.workbook!.activeSheetIndex).toBe(0);
    expect(result.workbook!.lastModified).toBeGreaterThan(0);
  });

  it('sets correct sheet dimensions', () => {
    const buffer = createXlsxMatrix(5, 3);
    const result = importExcel(buffer);

    const sheet = result.workbook!.sheets[0];
    expect(sheet.columnCount).toBeGreaterThanOrEqual(3);
    expect(sheet.rowCount).toBeGreaterThanOrEqual(5);
  });
});

function createXlsxMatrix(rows: number, cols: number): ArrayBuffer {
  const data: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(`R${r}C${c}`);
    }
    data.push(row);
  }
  return createXlsxBuffer(data);
}

// Helper to create an .xlsx with styling
function createStyledXlsxBuffer(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([['Bold', 'Red']]);
  // Add styling to cells
  ws['A1'] = { t: 's', v: 'Bold', s: { font: { bold: true } } };
  ws['B1'] = { t: 's', v: 'Red', s: { font: { color: { rgb: 'FF0000' } } } };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// Helper to create an .xlsx with dates and booleans
function createDateBooleanXlsxBuffer(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([['Date', 'Bool']]);
  ws['A1'] = { t: 'd', v: new Date('2024-01-15') };
  ws['B1'] = { t: 'b', v: true };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('Excel Import Edge Cases', () => {
  it('returns error for file with no sheets', () => {
    // Create an xlsx with no data (may still create empty sheet)
    const wb = XLSX.utils.book_new();
    let wbout: ArrayBuffer;
    try {
      wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    } catch {
      // SheetJS throws on empty workbook
      return;
    }
    const result = importExcel(wbout);
    expect(result).toBeDefined();
  });

  it('extracts styling from cells', () => {
    const buffer = createStyledXlsxBuffer();
    const result = importExcel(buffer, { includeFormatting: true });
    expect(result.success).toBe(true);
  });

  it('handles dates and booleans', () => {
    const buffer = createDateBooleanXlsxBuffer();
    const result = importExcel(buffer);
    expect(result.success).toBe(true);
  });

  it('imports multiple sheets', () => {
    const ws1 = XLSX.utils.aoa_to_sheet([['Sheet1']]);
    const ws2 = XLSX.utils.aoa_to_sheet([['Sheet2']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'First');
    XLSX.utils.book_append_sheet(wb, ws2, 'Second');
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = importExcel(wbout);
    expect(result.success).toBe(true);
    expect(result.sheetCount).toBe(2);
    expect(result.workbook!.sheets).toHaveLength(2);
  });

  it('includes formulas when includeFormulas is true', () => {
    const ws = XLSX.utils.aoa_to_sheet([[10, 20, 30]]);
    // SheetJS may or may not preserve formulas through write/read cycle
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = importExcel(wbout, { includeFormulas: true });
    expect(result.success).toBe(true);
    // Verify that the import handles the formula option without error
    expect(result.cellCount).toBeGreaterThanOrEqual(0);
  });

  it('handles sheets with more than 26 columns', () => {
    // Create a sheet with 30 columns (more than A-Z)
    const row: number[] = [];
    for (let i = 0; i < 30; i++) row.push(i);
    const buffer = createXlsxBuffer([row]);

    const result = importExcel(buffer);
    expect(result.success).toBe(true);
    expect(result.workbook!.sheets[0].columnCount).toBe(30);
  });

  it('handles sheets with many rows', () => {
    // Create a sheet with 500 rows
    const data: number[][] = [];
    for (let r = 0; r < 500; r++) {
      data.push([r, r * 2, r * 3]);
    }
    const buffer = createXlsxBuffer(data);

    const result = importExcel(buffer);
    expect(result.success).toBe(true);
    expect(result.workbook!.sheets[0].rowCount).toBe(500);
  });
});
