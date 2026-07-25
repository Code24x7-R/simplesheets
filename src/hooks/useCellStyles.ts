import { useCallback } from 'react';
import type { Cell, CellStyle, Selection, Workbook } from '../types';
import { cellKey } from '../types';
import {
  type CellStyleState,
  deriveCellStyleState,
  mergeCellStyle,
  toggleBold,
  toggleItalic,
  toggleUnderline,
} from './useCellStyle';

interface UseCellStylesParams {
  activeCell: { row: number; col: number } | null;
  selection: Selection | null;
  workbook: Workbook;
  pushHistory: (workbook: Workbook, description: string) => void;
  setStatusMessage: (msg: string) => void;
}

interface UseCellStylesReturn {
  /** The current style state derived from the active cell (for UI toggle indicators). */
  styleState: CellStyleState;
  /** Toggle bold on the selected cells. */
  toggleBoldStyle: () => void;
  /** Toggle italic on the selected cells. */
  toggleItalicStyle: () => void;
  /** Cycle underline/strikethrough on the selected cells. */
  toggleUnderlineStyle: () => void;
  /** Set text color on the selected cells. */
  setTextColor: (color: string) => void;
  /** Set background color on the selected cells. */
  setBackgroundColor: (color: string) => void;
  /** Set text alignment on the selected cells. */
  setTextAlign: (align: 'left' | 'center' | 'right') => void;
  /** Set number format on the selected cells. */
  setNumberFormat: (format: string) => void;
  /** Clear all styling from the selected cells. */
  clearCellStyles: () => void;
}

/**
 * Provides cell style manipulation functions that integrate with the
 * workbook history system. All functions push a history entry so the
 * style change can be undone.
 */
export function useCellStyles({
  activeCell,
  selection,
  workbook,
  pushHistory,
  setStatusMessage,
}: UseCellStylesParams): UseCellStylesReturn {
  // Derive the current style state from the active cell for UI toggle indicators.
  const styleState = deriveCellStyleState(activeCell
    ? workbook.sheets[workbook.activeSheetIndex].cells[cellKey(activeCell.row, activeCell.col)]?.style
    : undefined);

  /** Applies a style mutation function to all selected cells. */
  const applyStyle = useCallback(
    (mutate: (current: CellStyleState) => Partial<CellStyle>, description: string) => {
      if (!selection) return;

      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const key = cellKey(r, c);
          const existing = newCells[key];
          const currentStyle = deriveCellStyleState(existing?.style);
          const styleUpdate = mutate(currentStyle);

          // Don't create empty cells just for style — only update existing or merge
          const merged = mergeCellStyle(existing?.style, styleUpdate);
          if (existing) {
            newCells[key] = { ...existing, style: merged };
          } else {
            // Create a cell with empty value but with style
            const newCell: Cell = { rawValue: '', style: merged };
            newCells[key] = newCell;
          }
          cellsUpdated++;
        }
      }

      if (cellsUpdated === 0) return;

      const newSheets = workbook.sheets.map((s, idx) =>
        idx === workbook.activeSheetIndex ? { ...s, cells: newCells } : s
      );
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWorkbook, description);
      setStatusMessage(`${description} (${cellsUpdated} cell(s))`);
    },
    [selection, workbook, pushHistory, setStatusMessage]
  );

  const toggleBoldStyle = useCallback(
    () => applyStyle((s) => ({ fontWeight: toggleBold(s) }), 'Bold'),
    [applyStyle]
  );

  const toggleItalicStyle = useCallback(
    () => applyStyle((s) => ({ fontStyle: toggleItalic(s) }), 'Italic'),
    [applyStyle]
  );

  const toggleUnderlineStyle = useCallback(
    () => applyStyle((s) => ({ textDecoration: toggleUnderline(s) }), 'Underline'),
    [applyStyle]
  );

  const setTextColor = useCallback(
    (color: string) => applyStyle(() => ({ color }), `Text color ${color}`),
    [applyStyle]
  );

  const setBackgroundColor = useCallback(
    (color: string) => applyStyle(() => ({ backgroundColor: color }), `Fill color ${color}`),
    [applyStyle]
  );

  const setTextAlign = useCallback(
    (align: 'left' | 'center' | 'right') =>
      applyStyle(() => ({ textAlign: align }), `Align ${align}`),
    [applyStyle]
  );

  const setNumberFormat = useCallback(
    (format: string) => applyStyle(() => ({ numberFormat: format }), `Number format ${format}`),
    [applyStyle]
  );

  const clearCellStyles = useCallback(
    () => {
      if (!selection) return;
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const key = cellKey(r, c);
          const existing = newCells[key];
          if (existing?.style) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { style: _style, ...rest } = existing;
            newCells[key] = rest;
            cellsUpdated++;
          }
        }
      }

      if (cellsUpdated === 0) return;

      const newSheets = workbook.sheets.map((s, idx) =>
        idx === workbook.activeSheetIndex ? { ...s, cells: newCells } : s
      );
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWorkbook, 'Clear styles');
      setStatusMessage(`Cleared styles (${cellsUpdated} cell(s))`);
    },
    [selection, workbook, pushHistory, setStatusMessage]
  );

  return {
    styleState,
    toggleBoldStyle,
    toggleItalicStyle,
    toggleUnderlineStyle,
    setTextColor,
    setBackgroundColor,
    setTextAlign,
    setNumberFormat,
    clearCellStyles,
  };
}
