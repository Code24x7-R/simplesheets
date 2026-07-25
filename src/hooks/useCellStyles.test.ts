import { renderHook, act } from '@testing-library/react';
import { useCellStyles } from './useCellStyles';
import type { Workbook, Selection } from '../types';

function createTestWorkbook(): Workbook {
  return {
    id: 'test',
    title: 'Test',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        cells: {
          '0:0': { rawValue: 'Hello', style: { fontWeight: 'bold' } },
          '0:1': { rawValue: 'World' },
          '1:0': { rawValue: 'Foo' },
          '1:1': { rawValue: 'Bar', style: { color: '#FF0000' } },
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

const mockPushHistory = jest.fn();
const mockSetStatus = jest.fn();

function renderCellStyles(
  workbook: Workbook,
  activeCell: { row: number; col: number } | null,
  selection: Selection | null
) {
  return renderHook(() =>
    useCellStyles({
      activeCell,
      selection,
      workbook,
      pushHistory: mockPushHistory,
      setStatusMessage: mockSetStatus,
    })
  );
}

beforeEach(() => {
  mockPushHistory.mockClear();
  mockSetStatus.mockClear();
});

describe('useCellStyles', () => {
  describe('styleState derivation', () => {
    it('derives style from active cell with style', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, null);
      expect(result.current.styleState.fontWeight).toBe('bold');
    });

    it('derives defaults for cell without style', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, { row: 0, col: 1 }, null);
      expect(result.current.styleState).toEqual({
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: undefined,
        backgroundColor: undefined,
        textAlign: 'left',
        numberFormat: undefined,
      });
    });

    it('derives defaults when no active cell', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, null, null);
      expect(result.current.styleState).toEqual({
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: undefined,
        backgroundColor: undefined,
        textAlign: 'left',
        numberFormat: undefined,
      });
    });
  });

  describe('toggleBoldStyle', () => {
    it('applies bold to selected cells and pushes history', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 1, endRow: 0, endCol: 1,
        anchorRow: 0, anchorCol: 1,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 1 }, selection);

      act(() => {
        result.current.toggleBoldStyle();
      });

      expect(mockPushHistory).toHaveBeenCalledTimes(1);
      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:1'].style?.fontWeight).toBe('bold');
    });

    it('toggles bold off when already bold', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleBoldStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      // Cell 0:0 was already bold, so toggling makes it normal
      // Wait — the hook reads styleState from the active cell, which is bold.
      // toggleBold(bold) = normal. So the applied style should be normal.
      expect(newWb.sheets[0].cells['0:0'].style?.fontWeight).toBe('normal');
    });

    it('does nothing without selection', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, null);

      act(() => {
        result.current.toggleBoldStyle();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });
  });

  describe('toggleItalicStyle', () => {
    it('applies italic to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleItalicStyle();
      });

      expect(mockPushHistory).toHaveBeenCalledTimes(1);
      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.fontStyle).toBe('italic');
    });
  });

  describe('toggleUnderlineStyle', () => {
    it('applies underline to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleUnderlineStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.textDecoration).toBe('underline');
    });
  });

  describe('setTextColor', () => {
    it('sets text color on selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setTextColor('#00FF00');
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.color).toBe('#00FF00');
    });
  });

  describe('setBackgroundColor', () => {
    it('sets background color on selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBackgroundColor('#FFFF00');
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.backgroundColor).toBe('#FFFF00');
    });
  });

  describe('setTextAlign', () => {
    it('sets text alignment on selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setTextAlign('center');
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.textAlign).toBe('center');
    });
  });

  describe('setNumberFormat', () => {
    it('sets number format on selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setNumberFormat('0.00');
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.numberFormat).toBe('0.00');
    });
  });

  describe('clearCellStyles', () => {
    it('removes style from selected cells that have styles', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.clearCellStyles();
      });

      expect(mockPushHistory).toHaveBeenCalledTimes(1);
      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style).toBeUndefined();
    });

    it('does nothing when selected cells have no styles', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 1, endRow: 0, endCol: 1,
        anchorRow: 0, anchorCol: 1,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 1 }, selection);

      act(() => {
        result.current.clearCellStyles();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('does nothing without selection', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, null);

      act(() => {
        result.current.clearCellStyles();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });
  });

  describe('range selection', () => {
    it('applies style to all cells in range', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleItalicStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.fontStyle).toBe('italic');
      expect(newWb.sheets[0].cells['0:1'].style?.fontStyle).toBe('italic');
      expect(newWb.sheets[0].cells['1:0'].style?.fontStyle).toBe('italic');
      expect(newWb.sheets[0].cells['1:1'].style?.fontStyle).toBe('italic');
    });
  });

  describe('status messages', () => {
    it('sets status message on style application', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleBoldStyle();
      });

      expect(mockSetStatus).toHaveBeenCalledWith(expect.stringContaining('Bold'));
      expect(mockSetStatus).toHaveBeenCalledWith(expect.stringContaining('1 cell'));
    });
  });
});
