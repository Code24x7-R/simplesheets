// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, useState, useRef } from 'react';
import type { CellStyle, Selection, Workbook } from '../types';
import { cellKey } from '../types';
import {
  type CellStyleState,
  deriveCellStyleState,
  mergeCellStyle,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleWrapText,
  makeBorder,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BORDER_COLOR,
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
  /** Toggle strikethrough on the selected cells. */
  toggleStrikethroughStyle: () => void;
  /** Set text color on the selected cells. */
  setTextColor: (color: string) => void;
  /** Set background color on the selected cells. */
  setBackgroundColor: (color: string) => void;
  /** Set text alignment on the selected cells. */
  setTextAlign: (align: 'left' | 'center' | 'right') => void;
  /** Set number format on the selected cells. */
  setNumberFormat: (format: string) => void;
  /** Toggle text wrapping on the selected cells. */
  toggleWrapTextStyle: () => void;
  /** Clear all styling from the selected cells. */
  clearCellStyles: () => void;
  /** Current border color for the next border application. */
  borderColor: string;
  /** Set the border color for the next border application. */
  setBorderColor: (color: string) => void;
  /** Current border style (e.g., "1px solid"). */
  borderStyle: { width: string; style: string };
  /** Set the border style for the next border application. */
  setBorderStyle: (width: string, style: string) => void;
  /** Apply top border to selected cells. */
  setBorderTop: () => void;
  /** Apply bottom border to selected cells. */
  setBorderBottom: () => void;
  /** Apply left border to selected cells. */
  setBorderLeft: () => void;
  /** Apply right border to selected cells. */
  setBorderRight: () => void;
  /** Apply all borders to selected cells. */
  setBorderAll: () => void;
  /** Apply outside border to selection range. */
  setBorderOutside: () => void;
  /** Clear all borders from selected cells. */
  clearBorders: () => void;
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

  // Border state: current color and style for next border application.
  const [borderColor, setBorderColor] = useState(DEFAULT_BORDER_COLOR);
  const [borderStyle, setBorderStyleState] = useState({
    width: DEFAULT_BORDER_WIDTH,
    style: DEFAULT_BORDER_STYLE,
  });

  // Refs to track latest values synchronously (so setBorderColor + setBorderTop work in sequence)
  const borderColorRef = useRef(DEFAULT_BORDER_COLOR);
  const borderStyleRef = useRef({ width: DEFAULT_BORDER_WIDTH, style: DEFAULT_BORDER_STYLE });

  const setBorderColorWithRef = useCallback((color: string) => {
    borderColorRef.current = color;
    setBorderColor(color);
  }, []);

  const setBorderStyle = useCallback((width: string, style: string) => {
    borderStyleRef.current = { width, style };
    setBorderStyleState({ width, style });
  }, []);

  /** Builds the current border CSS string from the latest ref values. */
  const getCurrentBorder = useCallback(() => {
    return makeBorder(borderStyleRef.current.width, borderStyleRef.current.style, borderColorRef.current);
  }, []);

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

      // Sparse iteration: only visit cells that actually exist in the sheet.
      // This prevents lockups when full rows/columns are selected (e.g., 100k rows).
      for (const [key, existing] of Object.entries(sheet.cells)) {
        const colonIndex = key.indexOf(':');
        const r = parseInt(key.slice(0, colonIndex), 10);
        const c = parseInt(key.slice(colonIndex + 1), 10);
        if (r < minRow || r > maxRow || c < minCol || c > maxCol) continue;

        const currentStyle = deriveCellStyleState(existing?.style);
        const styleUpdate = mutate(currentStyle);
        const merged = mergeCellStyle(existing?.style, styleUpdate);
        newCells[key] = { ...existing, style: merged };
        cellsUpdated++;
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

  const toggleStrikethroughStyle = useCallback(
    () => applyStyle((s) => ({
      textDecoration: s.textDecoration === 'line-through' ? 'none' : 'line-through',
    }), 'Strikethrough'),
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

  const toggleWrapTextStyle = useCallback(
    () => applyStyle((s) => ({ whiteSpace: toggleWrapText(s) }), 'Wrap text'),
    [applyStyle]
  );

  /** Applies a border to a specific edge of all selected cells. */
  const applyBorderEdge = useCallback(
    (edge: 'top' | 'bottom' | 'left' | 'right') => {
      if (!selection) return;
      const borderValue = getCurrentBorder();
      const edgeMap = { top: 'borderTop', bottom: 'borderBottom', left: 'borderLeft', right: 'borderRight' } as const;
      const prop = edgeMap[edge];

      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (const [key, existing] of Object.entries(sheet.cells)) {
        const colonIndex = key.indexOf(':');
        const r = parseInt(key.slice(0, colonIndex), 10);
        const c = parseInt(key.slice(colonIndex + 1), 10);
        if (r < minRow || r > maxRow || c < minCol || c > maxCol) continue;
        const merged = mergeCellStyle(existing?.style, { [prop]: borderValue });
        newCells[key] = { ...existing, style: merged };
        cellsUpdated++;
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
      pushHistory(newWorkbook, `${edge} border`);
      setStatusMessage(`Applied ${edge} border (${cellsUpdated} cell(s))`);
    },
    [selection, workbook, pushHistory, setStatusMessage, getCurrentBorder]
  );

  /** Applies all borders to selected cells. */
  const setBorderAll = useCallback(
    () => {
      if (!selection) return;
      const borderValue = getCurrentBorder();
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (const [key, existing] of Object.entries(sheet.cells)) {
        const colonIndex = key.indexOf(':');
        const r = parseInt(key.slice(0, colonIndex), 10);
        const c = parseInt(key.slice(colonIndex + 1), 10);
        if (r < minRow || r > maxRow || c < minCol || c > maxCol) continue;
        const merged = mergeCellStyle(existing?.style, {
          borderTop: borderValue,
          borderBottom: borderValue,
          borderLeft: borderValue,
          borderRight: borderValue,
        });
        newCells[key] = { ...existing, style: merged };
        cellsUpdated++;
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
      pushHistory(newWorkbook, 'All borders');
      setStatusMessage(`Applied all borders (${cellsUpdated} cell(s))`);
    },
    [selection, workbook, pushHistory, setStatusMessage, getCurrentBorder]
  );

  /** Applies outside border to the selection range. */
  const setBorderOutside = useCallback(
    () => {
      if (!selection) return;
      const borderValue = getCurrentBorder();
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (const [key, existing] of Object.entries(sheet.cells)) {
        const colonIndex = key.indexOf(':');
        const r = parseInt(key.slice(0, colonIndex), 10);
        const c = parseInt(key.slice(colonIndex + 1), 10);
        if (r < minRow || r > maxRow || c < minCol || c > maxCol) continue;
        const updates: Partial<CellStyle> = {};
        if (r === minRow) updates.borderTop = borderValue;
        if (r === maxRow) updates.borderBottom = borderValue;
        if (c === minCol) updates.borderLeft = borderValue;
        if (c === maxCol) updates.borderRight = borderValue;
        const merged = mergeCellStyle(existing?.style, updates);
        newCells[key] = { ...existing, style: merged };
        cellsUpdated++;
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
      pushHistory(newWorkbook, 'Outside borders');
      setStatusMessage(`Applied outside borders (${cellsUpdated} cell(s))`);
    },
    [selection, workbook, pushHistory, setStatusMessage, getCurrentBorder]
  );

  /** Clears all borders from selected cells. */
  const clearBorders = useCallback(
    () => {
      if (!selection) return;
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (const [key, existing] of Object.entries(sheet.cells)) {
        const colonIndex = key.indexOf(':');
        const r = parseInt(key.slice(0, colonIndex), 10);
        const c = parseInt(key.slice(colonIndex + 1), 10);
        if (r < minRow || r > maxRow || c < minCol || c > maxCol) continue;
        if (existing?.style) {
          const { borderTop, borderBottom, borderLeft, borderRight, ...rest } = existing.style;
          newCells[key] = { ...existing, style: Object.keys(rest).length > 0 ? rest : undefined };
          if (borderTop || borderBottom || borderLeft || borderRight) {
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
      pushHistory(newWorkbook, 'Clear borders');
      setStatusMessage(`Cleared borders (${cellsUpdated} cell(s))`);
    },
    [selection, workbook, pushHistory, setStatusMessage]
  );

  const setBorderTop = useCallback(() => applyBorderEdge('top'), [applyBorderEdge]);
  const setBorderBottom = useCallback(() => applyBorderEdge('bottom'), [applyBorderEdge]);
  const setBorderLeft = useCallback(() => applyBorderEdge('left'), [applyBorderEdge]);
  const setBorderRight = useCallback(() => applyBorderEdge('right'), [applyBorderEdge]);

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

      // Sparse iteration: only visit cells that exist and fall within the selection.
      for (const [key, existing] of Object.entries(sheet.cells)) {
        const colonIndex = key.indexOf(':');
        const r = parseInt(key.slice(0, colonIndex), 10);
        const c = parseInt(key.slice(colonIndex + 1), 10);
        if (r < minRow || r > maxRow || c < minCol || c > maxCol) continue;
        if (existing?.style) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { style: _style, ...rest } = existing;
          newCells[key] = rest;
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
    toggleStrikethroughStyle,
    setTextColor,
    setBackgroundColor,
    setTextAlign,
    setNumberFormat,
    toggleWrapTextStyle,
    clearCellStyles,
    borderColor,
    setBorderColor: setBorderColorWithRef,
    borderStyle,
    setBorderStyle,
    setBorderTop,
    setBorderBottom,
    setBorderLeft,
    setBorderRight,
    setBorderAll,
    setBorderOutside,
    clearBorders,
  };
}
