import { useRef, useCallback, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Sheet, Selection } from '../types';
import { cellKey, colToLetter } from '../types';
import type { HighlightedRange } from './FormulaBar';
import { ResizeHandle } from './ResizeHandle';

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
  /** Currently selected cell (controlled). */
  selectedCell?: { row: number; col: number } | null;
  /** Callback when selection changes. */
  onSelect?: (row: number, col: number) => void;
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
}

const ROW_WIDTH = 50; // Width of row number column

const HIGHLIGHT_COLORS = [
  'rgba(59, 130, 246, 0.25)',  // blue
  'rgba(239, 68, 68, 0.25)',   // red
  'rgba(34, 197, 94, 0.25)',   // green
  'rgba(234, 179, 8, 0.25)',   // yellow
  'rgba(168, 85, 247, 0.25)',  // purple
  'rgba(236, 72, 153, 0.25)',  // pink
  'rgba(249, 115, 22, 0.25)',  // orange
  'rgba(6, 182, 212, 0.25)',   // cyan
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

/**
 * Virtualized spreadsheet grid.
 *
 * Renders only the visible cells within the viewport using @tanstack/react-virtual.
 * Supports 10,000+ rows with smooth scrolling.
 */
export function Grid({ sheet, onCellChange, onSelect, selectedCell, highlightedRanges = [], isPointMode = false, pointSelection = null, onCellPick, onHeaderSelect, onColumnResize, onRowResize }: GridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ─── Resize drag state ───────────────────────────────────────────────
  // Drag tracking via ref (NOT state) so mousemove never triggers re-render.
  // Live preview is done by direct DOM manipulation for zero-lag feedback.
  const resizeDragRef = useRef<{ type: 'col' | 'row'; index: number; originalSize: number; prevSize: number } | null>(null);
  // isResizing is only for handle visibility — toggles twice per drag, not per mousemove.
  const [isResizing, setIsResizing] = useState(false);
  // Hover tracking: which header the mouse is over (drives handle visibility).
  const [hoveredHeader, setHoveredHeader] = useState<{ type: 'col' | 'row'; index: number } | null>(null);

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

  const { defaultRowHeight, defaultColWidth, columnWidths, rowHeights, rowCount, columnCount, cells } = sheet;

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
      const key = cellKey(row, col);
      setEditingCell(key);
      setEditValue(char);
    },
    []
  );

  /**
   * Handles keyboard navigation within the grid.
   * Implements Excel-like editing: typing a character starts editing immediately.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If already editing, let the input field handle keys
      if (editingCell) return;

      // Handle Ctrl+C, Ctrl+V, Ctrl+X
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
          case 'C':
            handleCopy(e);
            return;
          case 'x':
          case 'X':
            handleCut(e);
            return;
          case 'v':
          case 'V':
            handlePaste(e);
            return;
          /* istanbul ignore next - parent handles undo/redo */
          case 'z':
          case 'Z':
            return;
          /* istanbul ignore next - parent handles undo/redo */
          case 'y':
          case 'Y':
            return;
        }
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
      /* istanbul ignore next - row/col header keyboard navigation */
      if (activeSelection.type === 'row') {
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
      /* istanbul ignore next - col header keyboard navigation */
      if (activeSelection.type === 'col') {
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
        case 'Escape':
          setEditingCell(null);
          return;
        case 'Delete':
        case 'Backspace':
          // Clear cell contents without entering edit mode
          if (onCellChange) {
            onCellChange(row, col, '');
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
    [effectiveSelection, editingCell, rowCount, columnCount, handleCellSelect, handleCellEdit, handleCellEditWithChar, handleCopy, handleCut, handlePaste, isPrintableKey, rowVirtualizer, columnVirtualizer, onSelect, onCellChange]
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
            >
              {colToLetter(col)}
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
              // Apply highlight if cell is referenced in formula
              if (highlightIdx !== null) {
                cellStyle.backgroundColor = HIGHLIGHT_COLORS[highlightIdx % HIGHLIGHT_COLORS.length];
                cellStyle.boxShadow = `inset 0 0 0 2px ${HIGHLIGHT_BORDER_COLORS[highlightIdx % HIGHLIGHT_BORDER_COLORS.length]}`;
              }
              // Apply point mode selection highlight (dashed border)
              /* istanbul ignore next - point mode selection highlight */
              if (inPointSelection) {
                cellStyle.boxShadow = 'inset 0 0 0 2px rgb(59, 130, 246)';
                cellStyle.backgroundColor = 'rgba(59, 130, 246, 0.15)';
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
                      autoFocus
                      className="w-full h-full outline-none bg-white border border-blue-500 px-1 font-mono text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEdit();
                          // Return focus to the grid so arrow keys work
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
                    <span>
                      {cell?.computedValue !== undefined && cell?.computedValue !== null
                        ? String(cell.computedValue)
                        : cell?.rawValue ?? ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
