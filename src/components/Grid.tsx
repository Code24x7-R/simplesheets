import { useRef, useCallback, useState, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Sheet, Selection } from '../types';
import { cellKey, colToLetter } from '../types';
import type { HighlightedRange } from './FormulaBar';
import type { ReferenceFormat } from '../hooks/useReferenceFormat';
import { ResizeHandle } from './ResizeHandle';
import { formatNumberValue, isNumberFormat, isNumericValue } from '../utils/numberFormat';
import { hasClipboardData } from '../utils/clipboard';

/** Point mode selection range (for visual feedback during formula editing). */
export interface PointModeSelection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Props for clicking a row or column header. */
export interface HeaderSelection {
  type: 'row' | 'col';
  index: number;
}

interface GridProps {
  /** The sheet data to render. */
  sheet: Sheet;
  /** Callback when a cell value is edited. */
  onCellChange?: (row: number, col: number, value: string) => void;
  /** Callback for bulk cell changes (e.g., delete range, paste). */
  onCellsChange?: (changes: Array<{ row: number; col: number; value: string }>) => void;
  /** Currently selected cell (controlled). */
  selectedCell?: { row: number; col: number } | null;
  /** Callback when selection changes. */
  onSelect?: (row: number, col: number) => void;
  /** Callback when the full selection object changes (includes range selections). */
  onSelectionChange?: (selection: Selection | null) => void;
  /** Ranges to highlight (from formula editing). */
  highlightedRanges?: HighlightedRange[];
  /** Whether point mode is active (arrow keys select cells for formula). */
  isPointMode?: boolean;
  /** Current point mode selection for visual feedback. */
  pointSelection?: PointModeSelection | null;
  /** Callback when a cell is picked during point mode. */
  onCellPick?: (row: number, col: number, shiftKey: boolean) => void;
  /** Callback when a row or column header is clicked. */
  onHeaderSelect?: (selection: HeaderSelection) => void;
  /** Callback when a column is resized (index, newWidth). */
  onColumnResize?: (col: number, newWidth: number) => void;
  /** Callback when a row is resized (index, newHeight). */
  onRowResize?: (row: number, newHeight: number) => void;
  /** Reference format for column headers (A1 or R1C1). */
  referenceFormat?: ReferenceFormat;
  // ── Context menu callbacks for row/column headers ──────────────────────
  /** Callback to insert a row above the given index. */
  onInsertRowAbove?: (rowIndex: number) => void;
  /** Callback to insert a row below the given index. */
  onInsertRowBelow?: (rowIndex: number) => void;
  /** Callback to delete the row at the given index. */
  onDeleteRow?: (rowIndex: number) => void;
  /** Callback to insert a column left of the given index. */
  onInsertColLeft?: (colIndex: number) => void;
  /** Callback to insert a column right of the given index. */
  onInsertColRight?: (colIndex: number) => void;
  /** Callback to delete the column at the given index. */
  onDeleteCol?: (colIndex: number) => void;
  /** The range currently on the clipboard (for marching-ants visual feedback). */
  clipboardRange?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    isCut: boolean;
  } | null;
  /** Callback to clear the clipboard (marching ants + data) — called on Esc and typing. */
  onClearClipboard?: () => void;
  /** When true, display formulas instead of computed values (Ctrl + `). */
  showFormulas?: boolean;
}

const ROW_WIDTH = 50; // Width of row number column

const HIGHLIGHT_COLORS = [
  'rgba(59, 130, 246, 0.10)',  // blue
  'rgba(239, 68, 68, 0.10)',   // red
  'rgba(34, 197, 94, 0.10)',   // green
  'rgba(234, 179, 8, 0.10)',   // yellow
  'rgba(168, 85, 247, 0.10)',  // purple
  'rgba(236, 72, 153, 0.10)',  // pink
  'rgba(249, 115, 22, 0.10)',  // orange
  'rgba(6, 182, 212, 0.10)',   // cyan
];

const HIGHLIGHT_BORDER_COLORS = [
  'rgb(59, 130, 246)',
  'rgb(239, 68, 68)',
  'rgb(34, 197, 94)',
  'rgb(234, 179, 8)',
  'rgb(168, 85, 247)',
  'rgb(236, 72, 153)',
  'rgb(249, 115, 22)',
  'rgb(6, 182, 212)',
];

/** Imperative handle for parent to call focus() after paste operations. */
export interface GridHandle {
  focus: () => void;
}

/**
 * Virtualized spreadsheet grid.
 *
 * Renders only the visible cells within the viewport using @tanstack/react-virtual.
 * Supports 10,000+ rows with smooth scrolling.
 */
export const Grid = forwardRef<GridHandle, GridProps>(function Grid(
  { sheet, onCellChange, onCellsChange, onSelect, selectedCell, highlightedRanges = [], isPointMode = false, pointSelection = null, onCellPick, onHeaderSelect, onSelectionChange, onColumnResize, onRowResize, referenceFormat = 'A1', onInsertRowAbove, onInsertRowBelow, onDeleteRow, onInsertColLeft, onInsertColRight, onDeleteCol, clipboardRange, onClearClipboard, showFormulas = false },
  ref
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const editingCellRef = useRef<string | null>(null);
  editingCellRef.current = editingCell;

  // Expose focus() to parent for restoring keyboard navigation after paste
  useImperativeHandle(ref, () => ({
    focus: () => {
      parentRef.current?.focus();
    },
  }), [parentRef]);

  // ─── Resize drag state ───────────────────────────────────────────────
  // Drag tracking via ref (NOT state) so mousemove never triggers re-render.
  // Live preview is done by direct DOM manipulation for zero-lag feedback.
  const resizeDragRef = useRef<{ type: 'col' | 'row'; index: number; originalSize: number; prevSize: number } | null>(null);
  // isResizing is only for handle visibility — toggles twice per drag, not per mousemove.
  const [isResizing, setIsResizing] = useState(false);
  // Hover tracking: which header the mouse is over (drives handle visibility).
  const [hoveredHeader, setHoveredHeader] = useState<{ type: 'col' | 'row'; index: number } | null>(null);

  // ─── Header context menu state ──────────────────────────────────────────
  const [headerContextMenu, setHeaderContextMenu] = useState<{
    type: 'row' | 'col';
    index: number;
    top: number;
    left: number;
  } | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Compute effective selection: prefer internal selection (set by mouse/keyboard),
  // but fall back to selectedCell prop when internal selection doesn't match.
  // This enables keyboard navigation to work immediately when selectedCell is passed.
  const effectiveSelection = useMemo(() => {
    if (selection) return selection;
    if (selectedCell) {
      return {
        type: 'cell' as const,
        startRow: selectedCell.row,
        startCol: selectedCell.col,
        endRow: selectedCell.row,
        endCol: selectedCell.col,
        anchorRow: selectedCell.row,
        anchorCol: selectedCell.col,
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, selectedCell]);

  // Ref to always have the latest selection for global keydown handlers.
  // Falls back to selectedCell prop so shortcuts work even when internal selection
  // is null (e.g., after focus loss to menus/formula bar).
  const selectionRef = useRef<Selection | null>(null);
  selectionRef.current = selection ?? effectiveSelection;

  // Notify parent when the internal selection changes (for style application on ranges)
  useEffect(() => {
    onSelectionChange?.(selection);
  }, [selection, onSelectionChange]);

  const { defaultRowHeight, defaultColWidth, columnWidths, rowHeights, rowCount, columnCount, cells } = sheet;

  // ─── Insert at Cursor Helper ─────────────────────────────────────
  // Inserts text at the cursor position in an input element, replacing
  // any selected text. Falls back to appending at the end.
  const insertAtCursor = useCallback((input: HTMLInputElement, text: string) => {
    const start = input.selectionStart ?? editValue.length;
    const end = input.selectionEnd ?? editValue.length;
    const newValue = editValue.slice(0, start) + text + editValue.slice(end);
    setEditValue(newValue);
    // Move cursor after inserted text (deferred to after state update)
    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + text.length;
    });
  }, [editValue]);

  // ─── Display Value Helper ─────────────────────────────────────────
  // Returns the display string for a cell, applying number formatting if the cell
  // has a numberFormat style and the value is numeric.
  // Strips leading single quote (text marker) per Excel behavior.
  // When showFormulas is true, displays the raw formula instead of computed value.
  const getDisplayValue = useCallback(
    (cell: { rawValue: string; computedValue?: string | number | boolean | null; style?: { numberFormat?: string } } | undefined): string => {
      if (!cell) return '';
      // Show formula if showFormulas is enabled and cell starts with =
      if (showFormulas && cell.rawValue.startsWith('=')) {
        return cell.rawValue;
      }
      let rawDisplay = cell.computedValue !== undefined && cell.computedValue !== null
        ? String(cell.computedValue)
        : cell.rawValue ?? '';
      // Strip leading single quote (text marker) - Excel displays text without the quote
      if (rawDisplay.startsWith("'")) {
        rawDisplay = rawDisplay.slice(1);
      }
      // Apply number format if present and value is numeric
      const format = cell.style?.numberFormat;
      if (format && format !== 'General' && isNumberFormat(format) && isNumericValue(cell.computedValue ?? cell.rawValue)) {
        return formatNumberValue(cell.computedValue ?? cell.rawValue, format);
      }
      return rawDisplay;
    },
    [showFormulas]
  );

  // Row virtualizer — handles vertical scrolling
  /* istanbul ignore next - virtualizer is mocked in tests */
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rowHeights[index] ?? defaultRowHeight,
    overscan: 5,
  });

  // Column virtualizer — handles horizontal scrolling
  /* istanbul ignore next - virtualizer is mocked in tests */
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => columnWidths[index] ?? defaultColWidth,
    overscan: 3,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  // ─── Re-measure virtualizers when dimensions change ──────────────────
  // The virtualizer caches measurements keyed on count/gap/etc., but NOT
  // on estimateSize. When columnWidths or rowHeights change (resize, paste),
  // we must bust the cache so start/size values reflect the new dimensions.
  // Without this, stale start positions cause visual gaps between columns/rows.
  useEffect(() => {
    columnVirtualizer.measure();
    rowVirtualizer.measure();
  }, [columnWidths, rowHeights, columnVirtualizer, rowVirtualizer]);

  // ─── Auto-scroll during POINT mode (Spec §5) ───────────────────────────
  // When the pointed-to cell is outside the viewport, scroll it into view.
  useEffect(() => {
    if (!isPointMode || !pointSelection) return;
    const endRow = pointSelection.endRow;
    const endCol = pointSelection.endCol;
    // Use a small delay to allow the virtualizer to update after state change
    const timer = setTimeout(() => {
      rowVirtualizer.scrollToIndex(endRow, { align: 'auto' });
      columnVirtualizer.scrollToIndex(endCol, { align: 'auto' });
    }, 50);
    return () => clearTimeout(timer);
  }, [isPointMode, pointSelection, rowVirtualizer, columnVirtualizer]);

  // ─── Global Clipboard Shortcuts ──────────────────────────────────────────
  // Handles Ctrl+C/X/V at the window level so they work regardless of which
  // element has focus (formula bar, menu, etc.). Uses selectionRef to avoid
  // stale closures.
  //
  // IMPORTANT: When editing a cell, these shortcuts are NOT intercepted here.
  // The native input handles Ctrl+C/X/V for text-level operations (copy/cut/paste
  // within the cell). This prevents the "copy cell" behavior from activating
  // when the user wants to copy text within the cell.
  useEffect(() => {
    const handleGlobalClipboardKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      // When editing a cell, let the native input handle clipboard keys
      // for text-level operations (copy/cut/paste within the cell)
      if (editingCellRef.current) return;

      const sel = selectionRef.current;
      if (!sel) return;
      switch (e.key) {
        case 'c':
        case 'C':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('simplesheets:copy', {
            detail: {
              startRow: sel.startRow, startCol: sel.startCol,
              endRow: sel.endRow, endCol: sel.endCol,
              selectionType: sel.type,
            },
          }));
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('simplesheets:cut', {
            detail: {
              startRow: sel.startRow, startCol: sel.startCol,
              endRow: sel.endRow, endCol: sel.endCol,
              selectionType: sel.type,
            },
          }));
          break;
        case 'v':
        case 'V':
          // Only intercept if we have internal clipboard data.
          // Otherwise let the native paste event fire so external
          // clipboard data (from other apps) can be pasted.
          if (hasClipboardData()) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('simplesheets:paste', {
              detail: {
                startRow: sel.startRow, startCol: sel.startCol,
                selectionType: sel.type,
              },
            }));
          }
          break;
      }
    };
    window.addEventListener('keydown', handleGlobalClipboardKey);
    return () => window.removeEventListener('keydown', handleGlobalClipboardKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Gets the width of a specific column, accounting for overrides.
   */
  const getColWidth = useCallback(
    (col: number) => columnWidths[col] ?? defaultColWidth,
    [columnWidths, defaultColWidth]
  );

  /**
   * Gets the height of a specific row, accounting for overrides.
   */
  const getRowHeight = useCallback(
    (row: number) => rowHeights[row] ?? defaultRowHeight,
    [rowHeights, defaultRowHeight]
  );

  /**
   * Selects a cell and notifies parent.
   */
  const handleCellSelect = useCallback(
    (row: number, col: number) => {
      const sel: Selection = {
        type: 'cell',
        startRow: row,
        startCol: col,
        endRow: row,
        endCol: col,
        anchorRow: row,
        anchorCol: col,
      };
      setSelection(sel);
      onSelect?.(row, col);
    },
    [onSelect]
  );

  /**
   * Handles clicking a row header — selects the entire row.
   */
  const handleRowHeaderClick = useCallback(
    (row: number, shiftKey: boolean) => {
      if (editingCell) setEditingCell(null);
      onHeaderSelect?.({ type: 'row', index: row });

      if (shiftKey && selection?.type === 'row') {
        // Extend the row range from the anchor
        const anchor = selection.anchorRow;
        const sel: Selection = {
          type: 'row',
          startRow: Math.min(anchor, row),
          startCol: 0,
          endRow: Math.max(anchor, row),
          endCol: columnCount - 1,
          anchorRow: anchor,
          anchorCol: 0,
        };
        setSelection(sel);
      } else {
        const sel: Selection = {
          type: 'row',
          startRow: row,
          startCol: 0,
          endRow: row,
          endCol: columnCount - 1,
          anchorRow: row,
          anchorCol: 0,
        };
        setSelection(sel);
      }
      onSelect?.(row, 0);
    },
    [selection, editingCell, columnCount, onSelect, onHeaderSelect]
  );

  /**
   * Handles clicking a column header — selects the entire column.
   */
  const handleColHeaderClick = useCallback(
    (col: number, shiftKey: boolean) => {
      if (editingCell) setEditingCell(null);
      onHeaderSelect?.({ type: 'col', index: col });

      if (shiftKey && selection?.type === 'col') {
        const anchor = selection.anchorCol;
        const sel: Selection = {
          type: 'col',
          startRow: 0,
          startCol: Math.min(anchor, col),
          endRow: rowCount - 1,
          endCol: Math.max(anchor, col),
          anchorRow: 0,
          anchorCol: anchor,
        };
        setSelection(sel);
      } else {
        const sel: Selection = {
          type: 'col',
          startRow: 0,
          startCol: col,
          endRow: rowCount - 1,
          endCol: col,
          anchorRow: 0,
          anchorCol: col,
        };
        setSelection(sel);
      }
      onSelect?.(0, col);
    },
    [selection, editingCell, rowCount, onSelect, onHeaderSelect]
  );

  /**
   * Opens the header context menu on right-click.
   */
  const handleHeaderContextMenu = useCallback(
    (type: 'row' | 'col', index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setHeaderContextMenu({
        type,
        index,
        top: e.clientY,
        left: e.clientX,
      });
    },
    []
  );

  /**
   * Closes the header context menu when clicking outside.
   */
  useEffect(() => {
    if (!headerContextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [headerContextMenu]);

  /**
   * Starts editing a cell (on double-click or Enter).
   */
  const handleCellEdit = useCallback(
    (row: number, col: number) => {
      const key = cellKey(row, col);
      const cell = cells[key];
      setEditingCell(key);
      setEditValue(cell?.rawValue ?? '');
    },
    [cells]
  );

  /**
   * Handles range selection with shift-click.
   */
  const handleCellMouseDown = useCallback(
    (row: number, col: number, shiftKey: boolean) => {
      // In point mode, clicking a cell picks it for the formula
      if (isPointMode && onCellPick) {
        onCellPick(row, col, shiftKey);
        return;
      }

      /* istanbul ignore next - shift+click row/col extension */
      if (shiftKey && selection) {
        if (selection.type === 'row') {
          // Extend row selection
          const anchor = selection.anchorRow;
          setSelection({
            type: 'row',
            startRow: Math.min(anchor, row),
            startCol: 0,
            endRow: Math.max(anchor, row),
            endCol: columnCount - 1,
            anchorRow: anchor,
            anchorCol: 0,
          });
          onSelect?.(row, 0);
          return;
        }
        if (selection.type === 'col') {
          const anchor = selection.anchorCol;
          setSelection({
            type: 'col',
            startRow: 0,
            startCol: Math.min(anchor, col),
            endRow: rowCount - 1,
            endCol: Math.max(anchor, col),
            anchorRow: 0,
            anchorCol: anchor,
          });
          onSelect?.(0, col);
          return;
        }
        /* istanbul ignore next - cell range extension */
        setSelection({
          ...selection,
          type: 'cell',
          endRow: row,
          endCol: col,
        });
      } else {
        handleCellSelect(row, col);
      }
    },
    [selection, handleCellSelect, columnCount, rowCount, onSelect, isPointMode, onCellPick]
  );

  /**
   * Checks if a cell is within the current selection.
   */
  const isCellSelected = useCallback(
    (row: number, col: number): boolean => {
      if (!selection) return false;
      if (selection.type === 'row') {
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        return row >= minRow && row <= maxRow;
      }
      if (selection.type === 'col') {
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);
        return col >= minCol && col <= maxCol;
      }
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    },
    [selection]
  );

  /**
   * Checks if a row header is part of the current selection.
   */
  const isRowHeaderSelected = useCallback(
    (row: number): boolean => {
      if (!selection) return false;
      if (selection.type === 'row') {
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        return row >= minRow && row <= maxRow;
      }
      if (selection.type === 'cell') {
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        return row >= minRow && row <= maxRow;
      }
      return false;
    },
    [selection]
  );

  /**
   * Checks if a column header is part of the current selection.
   */
  const isColHeaderSelected = useCallback(
    (col: number): boolean => {
      if (!selection) return false;
      if (selection.type === 'col') {
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);
        return col >= minCol && col <= maxCol;
      }
      if (selection.type === 'cell') {
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);
        return col >= minCol && col <= maxCol;
      }
      return false;
    },
    [selection]
  );

  /**
   * Checks if a cell is within any highlighted range and returns the color index.
   */
  const getCellHighlight = useCallback(
    (row: number, col: number): number | null => {
      for (const range of highlightedRanges) {
        if (
          row >= range.startRow &&
          row <= range.endRow &&
          col >= range.startCol &&
          col <= range.endCol
        ) {
          return range.colorIndex;
        }
      }
      return null;
    },
    [highlightedRanges]
  );

  /**
   * Checks if a cell is within the point mode selection range.
   */
  const isInPointSelection = useCallback(
    /* istanbul ignore next - point selection check */
    (row: number, col: number): boolean => {
      /* istanbul ignore next - defensive check */
      if (!pointSelection) return false;
      const minRow = Math.min(pointSelection.startRow, pointSelection.endRow);
      const maxRow = Math.max(pointSelection.startRow, pointSelection.endRow);
      const minCol = Math.min(pointSelection.startCol, pointSelection.endCol);
      const maxCol = Math.max(pointSelection.startCol, pointSelection.endCol);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    },
    [pointSelection]
  );

  /**
   * Commits the current edit, notifies the parent, and exits editing mode.
   */
  // Flag to prevent onBlur from committing when Escape is pressed
  const cancelRef = useRef(false);

  const commitEdit = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    if (editingCell && onCellChange) {
      const [rowStr, colStr] = editingCell.split(':');
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);
      onCellChange(row, col, editValue);
    }
    setEditingCell(null);
  }, [editingCell, editValue, onCellChange]);

  /**
   * Moves the selection in the specified direction after committing an edit.
   * Wraps around row boundaries (e.g., moving right from last column goes to
   * first column of next row).
   */
  const moveSelection = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      const sel = selectionRef.current;
      if (!sel) return;
      let row = sel.endRow;
      let col = sel.endCol;
      switch (direction) {
        case 'up':
          row = Math.max(0, row - 1);
          break;
        case 'down':
          row = Math.min(rowCount - 1, row + 1);
          break;
        case 'left':
          if (col > 0) {
            col = col - 1;
          } else if (row > 0) {
            row = row - 1;
            col = columnCount - 1;
          }
          break;
        case 'right':
          if (col < columnCount - 1) {
            col = col + 1;
          } else if (row < rowCount - 1) {
            row = row + 1;
            col = 0;
          }
          break;
      }
      setSelection({
        type: 'cell',
        startRow: row,
        startCol: col,
        endRow: row,
        endCol: col,
        anchorRow: row,
        anchorCol: col,
      });
      onSelect?.(row, col);
      // Scroll the new cell into view
      rowVirtualizer.scrollToIndex(row);
      columnVirtualizer.scrollToIndex(col);
    },
    [rowCount, columnCount, onSelect, rowVirtualizer, columnVirtualizer]
  );

  /**
   * Starts a resize drag — records original size in a ref (not state) and
   * toggles handle visibility. No re-render of grid content.
   */
  const handleResizeStart = useCallback(
    (type: 'col' | 'row', index: number, currentSize: number) => {
      resizeDragRef.current = { type, index, originalSize: currentSize, prevSize: currentSize };
      setIsResizing(true);
    },
    []
  );

  /**
   * Live preview via direct DOM manipulation — zero re-renders, zero lag.
   * Updates widths/heights and offsets of affected elements in-place.
   */
  const handleResizeMove = useCallback(
    (type: 'col' | 'row', index: number, newSize: number) => {
      const drag = resizeDragRef.current;
      if (!drag || drag.type !== type || drag.index !== index) return;

      const container = parentRef.current;
      if (!container) return;

      // Incremental delta from last mouse position — used to shift adjacent elements.
      // Using incremental (not total) avoids compounding shifts on each mousemove.
      const incrementalDelta = newSize - drag.prevSize;
      // Total delta from drag start — used for absolute sizing and spacer dimensions.
      const totalDelta = newSize - drag.originalSize;
      // Update prevSize for the next mousemove
      drag.prevSize = newSize;

      if (type === 'col') {
        // 1. Update the dragged column's header width (absolute)
        const colHeader = container.querySelector(`[data-col-header="${index}"]`);
        if (colHeader) {
          (colHeader as HTMLElement).style.width = `${newSize}px`;
          (colHeader as HTMLElement).style.minWidth = `${newSize}px`;
        }
        // 2. Update all cells in this column (absolute)
        container.querySelectorAll(`[data-col="${index}"]`).forEach((el) => {
          (el as HTMLElement).style.width = `${newSize}px`;
          (el as HTMLElement).style.minWidth = `${newSize}px`;
        });
        // 3. Shift subsequent columns' left position by incremental delta
        container.querySelectorAll('[data-col-header]').forEach((el) => {
          const colIdx = Number((el as HTMLElement).dataset.colHeader);
          if (colIdx > index) {
            const cur = parseFloat((el as HTMLElement).style.left);
            (el as HTMLElement).style.left = `${cur + incrementalDelta}px`;
          }
        });
        container.querySelectorAll('[data-col]').forEach((el) => {
          const colIdx = Number((el as HTMLElement).dataset.col);
          if (colIdx > index) {
            const cur = parseFloat((el as HTMLElement).style.left);
            (el as HTMLElement).style.left = `${cur + incrementalDelta}px`;
          }
        });
        // 4. Update total width on header row, spacer, and row containers (total delta)
        const totalWidth = columnVirtualizer.getTotalSize() + totalDelta;
        const headerRow = container.querySelector('[data-header-row]');
        if (headerRow) (headerRow as HTMLElement).style.width = `${totalWidth + ROW_WIDTH}px`;
        const spacer = container.querySelector('[data-spacer]');
        if (spacer) (spacer as HTMLElement).style.width = `${totalWidth + ROW_WIDTH}px`;
        container.querySelectorAll('[data-row-container]').forEach((el) => {
          (el as HTMLElement).style.width = `${totalWidth + ROW_WIDTH}px`;
        });
      } else {
        // Row resize — mirror of column logic
        const rowHeader = container.querySelector(`[data-row-header="${index}"]`);
        if (rowHeader) (rowHeader as HTMLElement).style.height = `${newSize}px`;
        const rowContainer = container.querySelector(`[data-row-container="${index}"]`);
        if (rowContainer) (rowContainer as HTMLElement).style.height = `${newSize}px`;
        // Shift subsequent rows' top position by incremental delta
        container.querySelectorAll('[data-row-container]').forEach((el) => {
          const rowIdx = Number((el as HTMLElement).dataset.rowContainer);
          if (rowIdx > index) {
            const cur = parseFloat((el as HTMLElement).style.top);
            (el as HTMLElement).style.top = `${cur + incrementalDelta}px`;
          }
        });
        // Update total height on spacer (total delta)
        const totalHeight = rowVirtualizer.getTotalSize() + totalDelta;
        const spacer = container.querySelector('[data-spacer]');
        if (spacer) (spacer as HTMLElement).style.height = `${totalHeight}px`;
      }
    },
    [columnVirtualizer, rowVirtualizer]
  );

  /**
   * Commits the resize to parent (single history push) and clears drag state.
   */
  const handleResizeEnd = useCallback(
    (type: 'col' | 'row', index: number, newSize: number) => {
      resizeDragRef.current = null;
      setIsResizing(false);
      if (type === 'col') {
        onColumnResize?.(index, newSize);
      } else {
        onRowResize?.(index, newSize);
      }
    },
    [onColumnResize, onRowResize]
  );

  /**
   * Handles copy (Ctrl+C) operation.
   */
  const handleCopy = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selection) return;
      e.preventDefault();
      // Dispatch a custom event that App.tsx can listen for
      window.dispatchEvent(new CustomEvent('simplesheets:copy', {
        detail: {
          startRow: selection.startRow,
          startCol: selection.startCol,
          endRow: selection.endRow,
          endCol: selection.endCol,
          selectionType: selection.type,
        },
      }));
    },
    [selection]
  );

  /**
   * Handles cut (Ctrl+X) operation.
   */
  const handleCut = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selection) return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('simplesheets:cut', {
        detail: {
          startRow: selection.startRow,
          startCol: selection.startCol,
          endRow: selection.endRow,
          endCol: selection.endCol,
          selectionType: selection.type,
        },
      }));
    },
    [selection]
  );

  /**
   * Handles paste (Ctrl+V) operation.
   */
  const handlePaste = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selection) return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('simplesheets:paste', {
        detail: {
          startRow: selection.startRow,
          startCol: selection.startCol,
          selectionType: selection.type,
        },
      }));
    },
    [selection]
  );

  /**
   * Checks if a key is a printable character (letters, numbers, punctuation).
   */
  const isPrintableKey = useCallback((key: string): boolean => {
    if (key.length !== 1) return false;
    const code = key.charCodeAt(0);
    // ASCII printable range 32-126 (space through ~)
    return code >= 32 && code <= 126;
  }, []);

  /**
   * Starts editing a cell with an initial character (Excel-like direct entry).
   */
  const handleCellEditWithChar = useCallback(
    (row: number, col: number, char: string) => {
      // Typing in a new cell clears the clipboard (marching ants)
      onClearClipboard?.();
      const key = cellKey(row, col);
      setEditingCell(key);
      setEditValue(char);
    },
    [onClearClipboard]
  );

  /**
   * Handles keyboard navigation within the grid.
   * Implements Excel-like editing: typing a character starts editing immediately.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If already editing, let the input field handle keys
      if (editingCell) return;

      // Ctrl+ shortcuts handled by global listeners in App.tsx (works regardless of focus).
      // Skip them here to avoid double-firing (e.g., Ctrl+B toggling bold AND typing 'b').
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c': case 'C': case 'x': case 'X': case 'v': case 'V':
          case 'z': case 'Z': case 'y': case 'Y':
          case 'b': case 'B': case 'i': case 'I': case 'u': case 'U':
          case 'h': case 'H': case 'n': case 'N': case 's': case 'S':
          case 'o': case 'O':
            return;
          case 'a': case 'A':
            // Ctrl+A: select all cells in the sheet
            e.preventDefault();
            setSelection({
              type: 'cell',
              startRow: 0,
              startCol: 0,
              endRow: rowCount - 1,
              endCol: columnCount - 1,
              anchorRow: 0,
              anchorCol: 0,
            });
            onSelect?.(0, 0);
            return;
        }
      }

      // Clear clipboard on Esc (spec: marching ants disappear when you press Esc)
      if (e.key === 'Escape') {
        onClearClipboard?.();
        setEditingCell(null);
        return;
      }

      const activeSelection = effectiveSelection;
      if (!activeSelection) return;

      // For range selections, use endRow/endCol as the active position
      // For single-cell selections, startRow/startCol === endRow/endCol
      let row = activeSelection.endRow;
      let col = activeSelection.endCol;

      // Excel-like: typing a printable character starts editing immediately
      if (isPrintableKey(e.key) && activeSelection.type === 'cell') {
        e.preventDefault();
        handleCellSelect(row, col);
        handleCellEditWithChar(row, col, e.key);
        return;
      }

      // When a full row is selected, arrow up/down moves the row selection
      if (activeSelection.type === 'row') {
        // Handle Delete/Backspace for bulk clear (sparse: only existing cells)
        if ((e.key === 'Delete' || e.key === 'Backspace') && onCellsChange) {
          e.preventDefault();
          const sel = activeSelection;
          const minRow = Math.min(sel.startRow, sel.endRow);
          const maxRow = Math.max(sel.startRow, sel.endRow);
          const changes: Array<{ row: number; col: number; value: string }> = [];
          for (const key of Object.keys(cells)) {
            const colonIndex = key.indexOf(':');
            const r = parseInt(key.slice(0, colonIndex), 10);
            const c = parseInt(key.slice(colonIndex + 1), 10);
            if (r >= minRow && r <= maxRow) {
              changes.push({ row: r, col: c, value: '' });
            }
          }
          onCellsChange(changes);
          return;
        }
        switch (e.key) {
          case 'ArrowUp':
            row = Math.max(0, row - 1);
            break;
          case 'ArrowDown':
            row = Math.min(rowCount - 1, row + 1);
            break;
          case 'ArrowLeft':
          case 'ArrowRight':
            // Switch to single-cell selection at the extremes
            col = e.key === 'ArrowLeft' ? 0 : columnCount - 1;
            e.preventDefault();
            handleCellSelect(row, col);
            rowVirtualizer.scrollToIndex(row);
            columnVirtualizer.scrollToIndex(col);
            return;
          case 'Enter':
          case 'F2':
            handleCellSelect(row, 0);
            handleCellEdit(row, 0);
            return;
          case 'Escape':
            setEditingCell(null);
            return;
          default:
            return;
        }
        e.preventDefault();
        setSelection({
          type: 'row',
          startRow: row,
          startCol: 0,
          endRow: row,
          endCol: columnCount - 1,
          anchorRow: row,
          anchorCol: 0,
        });
        onSelect?.(row, 0);
        rowVirtualizer.scrollToIndex(row);
        return;
      }

      // When a full column is selected, arrow left/right moves the column selection
      if (activeSelection.type === 'col') {
        // Handle Delete/Backspace for bulk clear (sparse: only existing cells)
        if ((e.key === 'Delete' || e.key === 'Backspace') && onCellsChange) {
          e.preventDefault();
          const sel = activeSelection;
          const minCol = Math.min(sel.startCol, sel.endCol);
          const maxCol = Math.max(sel.startCol, sel.endCol);
          const changes: Array<{ row: number; col: number; value: string }> = [];
          for (const key of Object.keys(cells)) {
            const colonIndex = key.indexOf(':');
            const r = parseInt(key.slice(0, colonIndex), 10);
            const c = parseInt(key.slice(colonIndex + 1), 10);
            if (c >= minCol && c <= maxCol) {
              changes.push({ row: r, col: c, value: '' });
            }
          }
          onCellsChange(changes);
          return;
        }
        switch (e.key) {
          case 'ArrowLeft':
            col = Math.max(0, col - 1);
            break;
          case 'ArrowRight':
            col = Math.min(columnCount - 1, col + 1);
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            row = e.key === 'ArrowUp' ? 0 : rowCount - 1;
            e.preventDefault();
            handleCellSelect(row, col);
            rowVirtualizer.scrollToIndex(row);
            columnVirtualizer.scrollToIndex(col);
            return;
          case 'Enter':
          case 'F2':
            handleCellSelect(0, col);
            handleCellEdit(0, col);
            return;
          case 'Escape':
            setEditingCell(null);
            return;
          default:
            return;
        }
        e.preventDefault();
        setSelection({
          type: 'col',
          startRow: 0,
          startCol: col,
          endRow: rowCount - 1,
          endCol: col,
          anchorRow: 0,
          anchorCol: col,
        });
        onSelect?.(0, col);
        columnVirtualizer.scrollToIndex(col);
        return;
      }

      // Standard cell-range navigation
      switch (e.key) {
        case 'ArrowUp':
          row = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          row = Math.min(rowCount - 1, row + 1);
          break;
        case 'ArrowLeft':
          col = Math.max(0, col - 1);
          break;
        case 'ArrowRight':
          col = Math.min(columnCount - 1, col + 1);
          break;
        case 'Home':
          col = 0;
          if (e.ctrlKey) row = 0;
          break;
        case 'Enter':
        case 'F2':
          handleCellSelect(row, col);
          handleCellEdit(row, col);
          return;
        case 'Tab':
          // Tab moves right, wrapping to next row; Shift+Tab moves left
          if (e.shiftKey) {
            if (col > 0) {
              col = col - 1;
            } else if (row > 0) {
              row = row - 1;
              col = columnCount - 1;
            }
          } else {
            if (col < columnCount - 1) {
              col = col + 1;
            } else if (row < rowCount - 1) {
              row = row + 1;
              col = 0;
            }
          }
          break;
        case 'Shift':
          // Ignore standalone Shift key
          return;
        case 'F4':
          // Cycle reference style: $A$1 → A$1 → $A1 → A1
          // This requires the formula bar context — handled by FormulaBar
          return;
        case 'Escape':
          setEditingCell(null);
          return;
        case 'Delete':
        case 'Backspace':
          // Clear all cells in the selection (bulk operation, sparse iteration)
          {
            const sel = activeSelection;
            if (sel && onCellsChange) {
              const minRow = Math.min(sel.startRow, sel.endRow);
              const maxRow = Math.max(sel.startRow, sel.endRow);
              const minCol = Math.min(sel.startCol, sel.endCol);
              const maxCol = Math.max(sel.startCol, sel.endCol);
              const changes: Array<{ row: number; col: number; value: string }> = [];
              for (const key of Object.keys(cells)) {
                const colonIndex = key.indexOf(':');
                const r = parseInt(key.slice(0, colonIndex), 10);
                const c = parseInt(key.slice(colonIndex + 1), 10);
                if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
                  changes.push({ row: r, col: c, value: '' });
                }
              }
              onCellsChange(changes);
            } else if (onCellChange) {
              // Fallback: clear single cell
              onCellChange(row, col, '');
            }
          }
          return;
        /* istanbul ignore next - defensive default */
        default:
          return;
      }

      e.preventDefault();

      // Shift+arrow expands the selection range instead of moving the anchor
      if (e.shiftKey && (e.key.startsWith('Arrow'))) {
        setSelection({
          type: 'cell',
          startRow: activeSelection.anchorRow,
          startCol: activeSelection.anchorCol,
          endRow: row,
          endCol: col,
          anchorRow: activeSelection.anchorRow,
          anchorCol: activeSelection.anchorCol,
        });
        onSelect?.(row, col);
      } else {
        setSelection({
          type: 'cell',
          startRow: row,
          startCol: col,
          endRow: row,
          endCol: col,
          anchorRow: row,
          anchorCol: col,
        });
        onSelect?.(row, col);
      }

      // Scroll the edited cell into view
      rowVirtualizer.scrollToIndex(row);
      columnVirtualizer.scrollToIndex(col);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveSelection, editingCell, rowCount, columnCount, handleCellSelect, handleCellEdit, handleCellEditWithChar, handleCopy, handleCut, handlePaste, isPrintableKey, rowVirtualizer, columnVirtualizer, onSelect, onCellChange, onCellsChange, onClearClipboard]
  );

  /**
   * Computes total scrollable dimensions.
   */
  const totalWidth = columnVirtualizer.getTotalSize();
  const totalHeight = rowVirtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className="relative overflow-auto h-full w-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Sticky header row (column letters) */}
      <div
        data-header-row
        className="sticky top-0 z-20 flex"
        style={{ width: totalWidth + ROW_WIDTH, height: defaultRowHeight }}
      >
        {/* Corner cell */}
        <div
          className="sticky left-0 z-30 grid-cell-header border-r border-b border-gray-300 bg-gray-100"
          style={{ width: ROW_WIDTH, minWidth: ROW_WIDTH, height: defaultRowHeight }}
        />
        {/* Column headers */}
        {virtualColumns.map((virtualCol) => {
          const col = virtualCol.index;
          const colSelected = isColHeaderSelected(col);
          const isHovered = hoveredHeader?.type === 'col' && hoveredHeader.index === col;
          const isDragging = isResizing && resizeDragRef.current?.type === 'col' && resizeDragRef.current?.index === col;
          const showHandle = isHovered || isDragging;
          return (
            <div
              key={`col-header-${col}`}
              data-col-header={col}
              className={`grid-cell-header border-b border-gray-300 absolute cursor-pointer select-none ${
                colSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'
              }`}
              style={{
                width: getColWidth(col),
                minWidth: getColWidth(col),
                height: defaultRowHeight,
                left: ROW_WIDTH + virtualCol.start,
              }}
              onMouseEnter={() => setHoveredHeader({ type: 'col', index: col })}
              onMouseLeave={() => setHoveredHeader((prev) => (prev?.type === 'col' ? null : prev))}
              onMouseDown={(e) => {
                // Ignore clicks on the resize handle
                if ((e.target as HTMLElement).closest('.resize-handle')) return;
                handleColHeaderClick(col, e.shiftKey);
              }}
              onContextMenu={(e) => handleHeaderContextMenu('col', col, e)}
            >
              {referenceFormat === 'R1C1' ? String(col + 1) : colToLetter(col)}
              {onColumnResize && (
                <ResizeHandle
                  orientation="column"
                  currentSize={getColWidth(col)}
                  visible={showHandle}
                  onResizeStart={() => handleResizeStart('col', col, getColWidth(col))}
                  onResizeMove={(newWidth) => handleResizeMove('col', col, newWidth)}
                  onResizeEnd={(newWidth) => handleResizeEnd('col', col, newWidth)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Virtualized rows */}
      <div data-spacer style={{ height: totalHeight, width: totalWidth + ROW_WIDTH, position: 'relative' }}>
        {virtualRows.map((virtualRow) => (
          <div
            key={`row-${virtualRow.index}`}
            data-row-container={virtualRow.index}
            className="flex absolute"
            style={{
              top: virtualRow.start,
              height: getRowHeight(virtualRow.index),
              width: totalWidth + ROW_WIDTH,
            }}
          >
            {/* Row number (sticky) */}
            <div
              data-row-header={virtualRow.index}
              className={`sticky left-0 z-10 grid-cell-header border-r border-b border-gray-300 cursor-pointer select-none ${
                isRowHeaderSelected(virtualRow.index)
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-200'
              }`}
              style={{
                width: ROW_WIDTH,
                minWidth: ROW_WIDTH,
                height: getRowHeight(virtualRow.index),
              }}
              onMouseEnter={() => setHoveredHeader({ type: 'row', index: virtualRow.index })}
              onMouseLeave={() => setHoveredHeader((prev) => (prev?.type === 'row' ? null : prev))}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('.resize-handle')) return;
                handleRowHeaderClick(virtualRow.index, e.shiftKey);
              }}
              onContextMenu={(e) => handleHeaderContextMenu('row', virtualRow.index, e)}
            >
              {virtualRow.index + 1}
              {onRowResize && (
                <ResizeHandle
                  orientation="row"
                  currentSize={getRowHeight(virtualRow.index)}
                  visible={
                    (hoveredHeader?.type === 'row' && hoveredHeader.index === virtualRow.index) ||
                    (isResizing && resizeDragRef.current?.type === 'row' && resizeDragRef.current?.index === virtualRow.index)
                  }
                  onResizeStart={() => handleResizeStart('row', virtualRow.index, getRowHeight(virtualRow.index))}
                  onResizeMove={(newHeight) => handleResizeMove('row', virtualRow.index, newHeight)}
                  onResizeEnd={(newHeight) => handleResizeEnd('row', virtualRow.index, newHeight)}
                />
              )}
            </div>

            {/* Virtualized columns */}
            {virtualColumns.map((virtualCol) => {
              const row = virtualRow.index;
              const col = virtualCol.index;
              const key = cellKey(row, col);
              const cell = cells[key];
              const isSelected = isCellSelected(row, col);
              const isEditing = editingCell === key;
              const highlightIdx = getCellHighlight(row, col);
              const inPointSelection = isInPointSelection(row, col);
              const cellStyle: React.CSSProperties = {
                width: getColWidth(col),
                minWidth: getColWidth(col),
                height: getRowHeight(row),
                left: ROW_WIDTH + virtualCol.start,
              };
              // Apply basic cell formatting (font, color, fill, alignment)
              if (cell?.style) {
                if (cell.style.fontWeight) cellStyle.fontWeight = cell.style.fontWeight;
                if (cell.style.fontStyle) cellStyle.fontStyle = cell.style.fontStyle;
                if (cell.style.textDecoration) cellStyle.textDecoration = cell.style.textDecoration;
                if (cell.style.color) cellStyle.color = cell.style.color;
                if (cell.style.backgroundColor) cellStyle.backgroundColor = cell.style.backgroundColor;
                if (cell.style.textAlign) cellStyle.textAlign = cell.style.textAlign;
              }
              // Apply highlight if cell is referenced in formula
              if (highlightIdx !== null) {
                cellStyle.backgroundColor = HIGHLIGHT_COLORS[highlightIdx % HIGHLIGHT_COLORS.length];
                cellStyle.boxShadow = `inset 0 0 0 2px ${HIGHLIGHT_BORDER_COLORS[highlightIdx % HIGHLIGHT_BORDER_COLORS.length]}`;
              }
              // Apply point mode selection highlight (dashed border, 10% fill per Spec §4.2)
              /* istanbul ignore next - point mode selection highlight */
              if (inPointSelection) {
                cellStyle.boxShadow = 'inset 0 0 0 2px rgb(59, 130, 246)';
                cellStyle.outline = '2px dashed rgb(59, 130, 246)';
                cellStyle.outlineOffset = '-2px';
                cellStyle.backgroundColor = 'rgba(59, 130, 246, 0.10)';
              }
              // Highlight cells in the clipboard range with a dashed pulsing border
              if (clipboardRange) {
                const inRange =
                  row >= clipboardRange.startRow &&
                  row <= clipboardRange.endRow &&
                  col >= clipboardRange.startCol &&
                  col <= clipboardRange.endCol;
                if (inRange) {
                  const isTop = row === clipboardRange.startRow;
                  const isBottom = row === clipboardRange.endRow;
                  const isLeft = col === clipboardRange.startCol;
                  const isRight = col === clipboardRange.endCol;
                  const antColor = clipboardRange.isCut ? '#dc2626' : '#2563eb';
                  // Dashed border on each visible edge of the clipboard range
                  if (isTop) cellStyle.borderTop = `2px dashed ${antColor}`;
                  if (isBottom) cellStyle.borderBottom = `2px dashed ${antColor}`;
                  if (isLeft) cellStyle.borderLeft = `2px dashed ${antColor}`;
                  if (isRight) cellStyle.borderRight = `2px dashed ${antColor}`;
                  cellStyle.animation = 'marching-ants 1s ease-in-out infinite';
                }
              }
              return (
                <div
                  key={`cell-${key}`}
                  data-col={col}
                  className={`grid-cell absolute ${isSelected ? 'grid-cell-selected' : ''}`}
                  style={cellStyle}
                  onMouseDown={(e) => handleCellMouseDown(row, col, e.shiftKey)}
                  onDoubleClick={() => handleCellEdit(row, col)}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      autoFocus
                      className="w-full h-full outline-none bg-white border border-blue-500 px-1 font-mono text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onPaste={(e) => {
                        // When editing, always intercept paste and insert at cursor
                        // to prevent the native behavior of replacing all text
                        const text = e.clipboardData?.getData('text/plain');
                        if (text) {
                          e.preventDefault();
                          insertAtCursor(e.currentTarget, text);
                        }
                      }}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                          // Ctrl+A: select all text in the cell
                          e.preventDefault();
                          e.currentTarget.select();
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEdit();
                          // Move selection down (or up with Shift+Enter)
                          if (e.shiftKey) {
                            moveSelection('up');
                          } else {
                            moveSelection('down');
                          }
                          parentRef.current?.focus();
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          commitEdit();
                          // Move selection right (or left with Shift+Tab)
                          if (e.shiftKey) {
                            moveSelection('left');
                          } else {
                            moveSelection('right');
                          }
                          parentRef.current?.focus();
                        } else if (e.key === 'F2') {
                          // F2 toggles edit mode off (Excel behavior)
                          e.preventDefault();
                          commitEdit();
                          parentRef.current?.focus();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelRef.current = true;
                          setEditingCell(null);
                          parentRef.current?.focus();
                        }
                      }}
                    />
                  ) : (
                    <span
                      className={`block w-full h-full px-1 ${
                        cell?.style?.whiteSpace === 'normal'
                          ? 'whitespace-normal break-words'
                          : cell?.style?.whiteSpace === 'pre'
                          ? 'whitespace-pre-wrap break-words'
                          : 'overflow-hidden text-ellipsis'
                      }`}
                      style={cell?.style?.textAlign ? { textAlign: cell.style.textAlign } : undefined}
                    >
                      {getDisplayValue(cell)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ─── POINT Mode Range Resize Handles (Spec §3.3.2, §4.2) ─────────── */}
      {isPointMode && pointSelection && (
        <PointResizeHandles
          pointSelection={pointSelection}
          sheet={sheet}
          rowVirtualizer={rowVirtualizer}
          columnVirtualizer={columnVirtualizer}
          rowCount={rowCount}
          colCount={columnCount}
          onResize={(newSelection) => {
            // Update the point session via the parent callback
            if (onCellPick) {
              onCellPick(newSelection.endRow, newSelection.endCol, false);
            }
          }}
        />
      )}

      {/* Header context menu — rendered via portal to escape overflow clipping */}
      {headerContextMenu &&
        createPortal(
          <div
            ref={headerMenuRef}
            style={{
              position: 'fixed',
              top: headerContextMenu.top,
              left: headerContextMenu.left,
              zIndex: 9999,
            }}
            className="bg-white border border-gray-300 rounded shadow-lg min-w-[160px]"
          >
            {headerContextMenu.type === 'row' ? (
              <>
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onInsertRowAbove?.(headerContextMenu.index);
                    setHeaderContextMenu(null);
                  }}
                >
                  Insert Row Above
                </button>
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onInsertRowBelow?.(headerContextMenu.index);
                    setHeaderContextMenu(null);
                  }}
                >
                  Insert Row Below
                </button>
                <div className="border-t border-gray-200" />
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-red-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onDeleteRow?.(headerContextMenu.index);
                    setHeaderContextMenu(null);
                  }}
                >
                  Delete Row
                </button>
              </>
            ) : (
              <>
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onInsertColLeft?.(headerContextMenu.index);
                    setHeaderContextMenu(null);
                  }}
                >
                  Insert Column Left
                </button>
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onInsertColRight?.(headerContextMenu.index);
                    setHeaderContextMenu(null);
                  }}
                >
                  Insert Column Right
                </button>
                <div className="border-t border-gray-200" />
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-red-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onDeleteCol?.(headerContextMenu.index);
                    setHeaderContextMenu(null);
                  }}
                >
                  Delete Column
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
});

// ─── POINT Mode Range Resize Handles ──────────────────────────────────────

interface PointResizeHandlesProps {
  pointSelection: PointModeSelection;
  sheet: Sheet;
  rowVirtualizer: { getVirtualItems: () => { index: number; start: number }[] };
  columnVirtualizer: { getVirtualItems: () => { index: number; start: number }[] };
  rowCount: number;
  colCount: number;
  onResize: (newSelection: PointModeSelection) => void;
}

/**
 * Calculates the pixel position of a cell in the grid.
 */
function getCellPixelPosition(
  row: number,
  col: number,
  sheet: Sheet,
  rowVirtualizer: { getVirtualItems: () => { index: number; start: number }[] },
  columnVirtualizer: { getVirtualItems: () => { index: number; start: number }[] }
): { top: number; left: number; width: number; height: number } | null {
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();
  const virtualRow = virtualRows.find((vr) => vr.index === row);
  const virtualCol = virtualCols.find((vc) => vc.index === col);
  if (!virtualRow || !virtualCol) return null;
  return {
    top: virtualRow.start,
    left: ROW_WIDTH + virtualCol.start,
    width: getColWidthLocal(col, sheet),
    height: getRowHeightLocal(row, sheet),
  };
}

function getColWidthLocal(col: number, sheet: Sheet): number {
  return sheet.columnWidths[col] ?? sheet.defaultColWidth;
}

function getRowHeightLocal(row: number, sheet: Sheet): number {
  return sheet.rowHeights[row] ?? sheet.defaultRowHeight;
}

/**
 * Renders 6px corner handles for resizing a POINT mode range selection.
 * Per Spec §4.2: 6px filled squares on the 4 corners.
 */
function PointResizeHandles({
  pointSelection,
  sheet,
  rowVirtualizer,
  columnVirtualizer,
  rowCount: _rowCount,
  colCount: _colCount,
  onResize,
}: PointResizeHandlesProps) {
  const minRow = Math.min(pointSelection.startRow, pointSelection.endRow);
  const maxRow = Math.max(pointSelection.startRow, pointSelection.endRow);
  const minCol = Math.min(pointSelection.startCol, pointSelection.endCol);
  const maxCol = Math.max(pointSelection.startCol, pointSelection.endCol);

  // Get pixel positions for the 4 corners
  const tl = getCellPixelPosition(minRow, minCol, sheet, rowVirtualizer, columnVirtualizer);
  const tr = getCellPixelPosition(minRow, maxCol, sheet, rowVirtualizer, columnVirtualizer);
  const bl = getCellPixelPosition(maxRow, minCol, sheet, rowVirtualizer, columnVirtualizer);
  const br = getCellPixelPosition(maxRow, maxCol, sheet, rowVirtualizer, columnVirtualizer);

  if (!tl || !tr || !bl || !br) return null;

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: 'rgb(59, 130, 246)',
    border: '1px solid white',
    borderRadius: 1,
    zIndex: 30,
    cursor: 'nwse-resize',
  };

  // Calculate handle positions (centered on corners)
  const handles = [
    { id: 'tl', top: tl.top - 3, left: tl.left - 3, cursor: 'nwse-resize', corner: 'tl' as const },
    { id: 'tr', top: tr.top - 3, left: tr.left + tr.width - 3, cursor: 'nesw-resize', corner: 'tr' as const },
    { id: 'bl', top: bl.top + bl.height - 3, left: bl.left - 3, cursor: 'nesw-resize', corner: 'bl' as const },
    { id: 'br', top: br.top + br.height - 3, left: br.left + br.width - 3, cursor: 'nwse-resize', corner: 'br' as const },
  ];

  const handleMouseDown = (e: React.MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startRow = pointSelection.startRow;
    const startCol = pointSelection.startCol;
    const endRow = pointSelection.endRow;
    const endCol = pointSelection.endCol;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Convert pixel delta to cell delta (approximate)
      const avgColWidth = sheet.defaultColWidth;
      const avgRowHeight = sheet.defaultRowHeight;
      const dCol = Math.round(deltaX / avgColWidth);
      const dRow = Math.round(deltaY / avgRowHeight);

      let newStartRow = startRow;
      let newStartCol = startCol;
      let newEndRow = endRow;
      let newEndCol = endCol;

      switch (corner) {
        case 'tl':
          newStartRow = Math.max(0, startRow + dRow);
          newStartCol = Math.max(0, startCol + dCol);
          break;
        case 'tr':
          newStartRow = Math.max(0, startRow + dRow);
          newEndCol = Math.max(0, endCol + dCol);
          break;
        case 'bl':
          newEndRow = Math.max(0, endRow + dRow);
          newStartCol = Math.max(0, startCol + dCol);
          break;
        case 'br':
          newEndRow = Math.max(0, endRow + dRow);
          newEndCol = Math.max(0, endCol + dCol);
          break;
      }

      onResize({
        startRow: newStartRow,
        startCol: newStartCol,
        endRow: newEndRow,
        endCol: newEndCol,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <>
      {handles.map((h) => (
        <div
          key={h.id}
          style={{ ...handleStyle, top: h.top, left: h.left, cursor: h.cursor }}
          onMouseDown={(e) => handleMouseDown(e, h.corner)}
        />
      ))}
    </>
  );
}
