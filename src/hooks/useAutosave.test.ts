import { renderHook } from '@testing-library/react';
import { useAutosave } from './useAutosave';
import { autosaveWorkbook } from '../services/storageService';
import type { Workbook } from '../types';

// Mock storageService
jest.mock('../services/storageService', () => ({
  autosaveWorkbook: jest.fn(),
}));

const testWorkbook: Workbook = {
  id: 'test-wb',
  title: 'Test',
  sheets: [
    {
      id: 's1',
      name: 'Sheet1',
      cells: {},
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

describe('useAutosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not autosave on first render', () => {
    renderHook(() => useAutosave(testWorkbook));
    jest.advanceTimersByTime(1000);
    expect(autosaveWorkbook).not.toHaveBeenCalled();
  });

  it('autosaves after debounce delay on workbook change', () => {
    const { rerender } = renderHook((props) => useAutosave(props.workbook), {
      initialProps: { workbook: testWorkbook },
    });

    // Change the workbook
    const newWorkbook = { ...testWorkbook, lastModified: Date.now() + 1000 };
    rerender({ workbook: newWorkbook });

    // Should not have called yet (debounce)
    expect(autosaveWorkbook).not.toHaveBeenCalled();

    // Advance past debounce delay
    jest.advanceTimersByTime(600);

    expect(autosaveWorkbook).toHaveBeenCalledWith(newWorkbook);
  });

  it('resets debounce timer on rapid changes', () => {
    const { rerender } = renderHook((props) => useAutosave(props.workbook), {
      initialProps: { workbook: testWorkbook },
    });

    // Make multiple rapid changes
    rerender({ workbook: { ...testWorkbook, lastModified: 1 } });
    jest.advanceTimersByTime(300);
    rerender({ workbook: { ...testWorkbook, lastModified: 2 } });
    jest.advanceTimersByTime(300);
    rerender({ workbook: { ...testWorkbook, lastModified: 3 } });

    // Should not have called yet (timer keeps resetting)
    expect(autosaveWorkbook).not.toHaveBeenCalled();

    // Advance past final debounce
    jest.advanceTimersByTime(600);

    // Should only call once with the latest workbook
    expect(autosaveWorkbook).toHaveBeenCalledTimes(1);
    expect(autosaveWorkbook).toHaveBeenCalledWith(expect.objectContaining({ lastModified: 3 }));
  });

  it('cleans up timer on unmount', () => {
    const { rerender, unmount } = renderHook((props) => useAutosave(props.workbook), {
      initialProps: { workbook: testWorkbook },
    });

    rerender({ workbook: { ...testWorkbook, lastModified: 1 } });
    unmount();

    // Advance past debounce — should not call because timer was cleaned up
    jest.advanceTimersByTime(1000);
    expect(autosaveWorkbook).not.toHaveBeenCalled();
  });
});
