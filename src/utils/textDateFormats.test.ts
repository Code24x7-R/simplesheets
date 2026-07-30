import { evaluateFormulaPreview } from './formulaEngine';
import type { Workbook, Sheet, Cell } from '../types';

function createTestWorkbook(cells: Record<string, Cell> = {}): Workbook {
  const sheet: Sheet = {
    id: 's1',
    name: 'Sheet1',
    cells,
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
  };
  return {
    id: 'test-wb',
    title: 'Test',
    sheets: [sheet],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

describe('TEXT function - date formatting', () => {
  it('formats date serial number with "dddd" (full day name)', () => {
    // 45000 = 2023-03-15 (a Wednesday)
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "dddd")', wb, 0);
    expect(result).toBe('Wednesday');
  });

  it('formats date serial number with "ddd" (abbreviated day name)', () => {
    // 45000 = 2023-03-15 (a Wednesday)
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "ddd")', wb, 0);
    expect(result).toBe('Wed');
  });

  it('formats date serial number with "ddddd" (abbreviated day name)', () => {
    // 45000 = 2023-03-15 (a Wednesday)
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "ddddd")', wb, 0);
    expect(result).toBe('Wed');
  });

  it('formats date serial number with "mmmm" (full month name)', () => {
    // 45000 = 2023-03-15
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "mmmm")', wb, 0);
    expect(result).toBe('March');
  });

  it('formats date serial number with "mmm" (abbreviated month name)', () => {
    // 45000 = 2023-03-15
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "mmm")', wb, 0);
    expect(result).toBe('Mar');
  });

  it('formats date serial number with "yyyy" (4-digit year)', () => {
    // 45000 = 2023-03-15
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "yyyy")', wb, 0);
    expect(result).toBe('2023');
  });

  it('formats date serial number with "dd/mm/yyyy"', () => {
    // 45000 = 2023-03-15
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000' } });
    const result = evaluateFormulaPreview('TEXT(A1, "dd/mm/yyyy")', wb, 0);
    expect(result).toBe('15/03/2023');
  });

  it('formats date serial number with time format "hh:MM:ss" (MM=minutes)', () => {
    // 45000.5 = 2023-03-15 12:00:00
    const wb = createTestWorkbook({ '0:0': { rawValue: '45000.5' } });
    const result = evaluateFormulaPreview('TEXT(A1, "hh:MM:ss")', wb, 0);
    expect(result).toContain('12:00:00');
  });

  it('TEXT with number and "0" format still works', () => {
    const wb = createTestWorkbook({ '0:0': { rawValue: '42.7' } });
    const result = evaluateFormulaPreview('TEXT(A1, "0")', wb, 0);
    expect(result).toBe('43');
  });

  it('TEXT with number and "0.00" format still works', () => {
    const wb = createTestWorkbook({ '0:0': { rawValue: '42.123' } });
    const result = evaluateFormulaPreview('TEXT(A1, "0.00")', wb, 0);
    expect(result).toBe('42.12');
  });
});
