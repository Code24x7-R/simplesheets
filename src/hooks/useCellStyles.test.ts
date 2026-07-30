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
        whiteSpace: 'nowrap',
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
        whiteSpace: 'nowrap',
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

  describe('border operations', () => {
    it('applies top border to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderTop();
      });

      expect(mockPushHistory).toHaveBeenCalledTimes(1);
      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderTop).toBe('1px solid #000000');
    });

    it('applies bottom border to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderBottom();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderBottom).toBe('1px solid #000000');
    });

    it('applies left border to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderLeft();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderLeft).toBe('1px solid #000000');
    });

    it('applies right border to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderRight();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderRight).toBe('1px solid #000000');
    });

    it('applies all borders to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderAll();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      const style = newWb.sheets[0].cells['0:0'].style;
      expect(style?.borderTop).toBe('1px solid #000000');
      expect(style?.borderBottom).toBe('1px solid #000000');
      expect(style?.borderLeft).toBe('1px solid #000000');
      expect(style?.borderRight).toBe('1px solid #000000');
    });

    it('applies outside borders to selection range', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderOutside();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      // Top-left corner: top + left
      expect(newWb.sheets[0].cells['0:0'].style?.borderTop).toBe('1px solid #000000');
      expect(newWb.sheets[0].cells['0:0'].style?.borderLeft).toBe('1px solid #000000');
      // Bottom-right corner: bottom + right
      expect(newWb.sheets[0].cells['1:1'].style?.borderBottom).toBe('1px solid #000000');
      expect(newWb.sheets[0].cells['1:1'].style?.borderRight).toBe('1px solid #000000');
    });

    it('clears borders from selected cells', () => {
      const workbook = createTestWorkbook();
      // Add a cell with borders
      workbook.sheets[0].cells['0:0'].style = { ...workbook.sheets[0].cells['0:0'].style, borderTop: '1px solid #000000' };
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.clearBorders();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderTop).toBeUndefined();
    });

    it('uses custom border color', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderColor('#FF0000');
        result.current.setBorderTop();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderTop).toBe('1px solid #FF0000');
    });

    it('does nothing without selection', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, null);

      act(() => {
        result.current.setBorderTop();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('exposes borderColor and borderStyle state', () => {
      const workbook = createTestWorkbook();
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, null);

      expect(result.current.borderColor).toBe('#000000');
      expect(result.current.borderStyle).toEqual({ width: '1px', style: 'solid' });
    });

    it('updates border style with setBorderStyle', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setBorderStyle('2px', 'dashed');
        result.current.setBorderTop();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.borderTop).toBe('2px dashed #000000');
    });

    it('returns early when no cells updated in border operation', () => {
      const workbook = createTestWorkbook();
      // Selection range with no existing cells
      const selection: Selection = {
        type: 'cell',
        startRow: 10, startCol: 10, endRow: 12, endCol: 12,
        anchorRow: 10, anchorCol: 10,
      };
      const { result } = renderCellStyles(workbook, { row: 10, col: 10 }, selection);

      act(() => {
        result.current.setBorderTop();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('setBorderAll returns early when no cells updated', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 10, startCol: 10, endRow: 12, endCol: 12,
        anchorRow: 10, anchorCol: 10,
      };
      const { result } = renderCellStyles(workbook, { row: 10, col: 10 }, selection);

      act(() => {
        result.current.setBorderAll();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('setBorderOutside returns early when no cells updated', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 10, startCol: 10, endRow: 12, endCol: 12,
        anchorRow: 10, anchorCol: 10,
      };
      const { result } = renderCellStyles(workbook, { row: 10, col: 10 }, selection);

      act(() => {
        result.current.setBorderOutside();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('clearBorders returns early when no cells updated', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 10, startCol: 10, endRow: 12, endCol: 12,
        anchorRow: 10, anchorCol: 10,
      };
      const { result } = renderCellStyles(workbook, { row: 10, col: 10 }, selection);

      act(() => {
        result.current.clearBorders();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('clearBorders skips cells without borders', () => {
      const workbook = createTestWorkbook();
      // Cell 0:0 exists but has no border — clearBorders should not count it
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.clearBorders();
      });

      // cellsUpdated stays 0 because cell 0:0 has no borders → no history push
      expect(mockPushHistory).not.toHaveBeenCalled();
    });

    it('clearCellStyles returns early when no cells updated', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 10, startCol: 10, endRow: 12, endCol: 12,
        anchorRow: 10, anchorCol: 10,
      };
      const { result } = renderCellStyles(workbook, { row: 10, col: 10 }, selection);

      act(() => {
        result.current.clearCellStyles();
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
    });
  });

  describe('toggleStrikethroughStyle', () => {
    it('applies strikethrough to selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleStrikethroughStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.textDecoration).toBe('line-through');
    });

    it('toggles strikethrough off when already strikethrough', () => {
      const workbook = createTestWorkbook();
      workbook.sheets[0].cells['0:0'].style = { ...workbook.sheets[0].cells['0:0'].style, textDecoration: 'line-through' };
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleStrikethroughStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.textDecoration).toBe('none');
    });
  });

  describe('toggleWrapTextStyle', () => {
    it('toggles wrap text on selected cells', () => {
      const workbook = createTestWorkbook();
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleWrapTextStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.whiteSpace).toBe('normal');
    });

    it('toggles wrap text off when already normal', () => {
      const workbook = createTestWorkbook();
      workbook.sheets[0].cells['0:0'].style = { ...workbook.sheets[0].cells['0:0'].style, whiteSpace: 'normal' };
      const selection: Selection = {
        type: 'cell',
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleWrapTextStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      expect(newWb.sheets[0].cells['0:0'].style?.whiteSpace).toBe('nowrap');
    });
  });

  describe('sparse iteration (performance)', () => {
    it('only touches existing cells when a full column is selected', () => {
      const workbook = createTestWorkbook();
      // Simulate selecting an entire column (0 to 99999 rows)
      const selection: Selection = {
        type: 'col',
        startRow: 0, startCol: 0, endRow: 99999, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setNumberFormat('0.00');
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      // Only the existing cells in column 0 should be styled (not 100k empty cells)
      const styledCells = Object.values(newWb.sheets[0].cells).filter(
        (cell) => (cell as { style?: { numberFormat?: string } }).style?.numberFormat === '0.00'
      );
      // The test workbook has cells at 0:0, 1:0 (and 21:0 for Grand Total)
      expect(styledCells.length).toBeLessThan(30);
      expect(styledCells.length).toBeGreaterThan(0);
    });

    it('only touches existing cells when a full row is selected', () => {
      const workbook = createTestWorkbook();
      // Simulate selecting an entire row (0 to 25 columns)
      const selection: Selection = {
        type: 'row',
        startRow: 0, startCol: 0, endRow: 0, endCol: 25,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.toggleBoldStyle();
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      const styledCells = Object.values(newWb.sheets[0].cells).filter(
        (cell) => (cell as { style?: { fontWeight?: string } }).style?.fontWeight === 'bold'
      );
      // Only existing cells in row 0 should be styled (headers row has ~6 cells)
      expect(styledCells.length).toBeLessThan(10);
      expect(styledCells.length).toBeGreaterThan(0);
    });

    it('does not create empty cells for large selections', () => {
      const workbook = createTestWorkbook();
      // Column 0 has cells (0:0 and 1:0), but selection spans 100k rows
      const selection: Selection = {
        type: 'col',
        startRow: 0, startCol: 0, endRow: 99999, endCol: 0,
        anchorRow: 0, anchorCol: 0,
      };
      const { result } = renderCellStyles(workbook, { row: 0, col: 0 }, selection);

      act(() => {
        result.current.setTextAlign('right');
      });

      const newWb = mockPushHistory.mock.calls[0][0];
      // The total cell count should not explode — only existing cells get styled
      const totalCells = Object.keys(newWb.sheets[0].cells).length;
      // Original workbook has 4 cells; should not become 100k
      expect(totalCells).toBeLessThan(10);
      // Verify the existing cells in column 0 got styled
      expect(newWb.sheets[0].cells['0:0']?.style?.textAlign).toBe('right');
      expect(newWb.sheets[0].cells['1:0']?.style?.textAlign).toBe('right');
    });
  });
});
