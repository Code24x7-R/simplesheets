/**
 * SimpleSheet — Core Data Model
 *
 * These types define the in‑memory representation of a workbook.
 * Everything in the app (grid, formulas, import/export) operates on these structures.
 */

/**
 * Represents the visual styling of a cell.
 * All properties are optional; unset values inherit from the sheet default.
 */
export interface CellStyle {
  /** CSS font-weight value (e.g., "bold", "normal", 700). */
  fontWeight?: 'normal' | 'bold' | number;

  /** CSS font-style value. */
  fontStyle?: 'normal' | 'italic';

  /** CSS text-decoration value. */
  textDecoration?: 'none' | 'underline' | 'line-through';

  /** Text color as a hex string (e.g., "#FF0000"). */
  color?: string;

  /** Background color as a hex string. */
  backgroundColor?: string;

  /** Horizontal text alignment. */
  textAlign?: 'left' | 'center' | 'right';

  /** Number format pattern (e.g., "0.00", "mm/dd/yyyy"). */
  numberFormat?: string;

  /** Text wrapping behavior. 'nowrap' truncates with ellipsis (default), 'normal' wraps. */
  whiteSpace?: 'normal' | 'nowrap' | 'pre';
}

/**
 * A single cell in the spreadsheet grid.
 * Cells are sparse — if a cell has no data, it simply doesn't exist in the map.
 */
export interface Cell {
  /**
   * The raw user input. For formulas this starts with "=".
   * For literal values, this is the string representation.
   */
  rawValue: string;

  /**
   * The computed/display value after formula evaluation.
   * Equal to rawValue for non‑formula cells.
   */
  computedValue?: string | number | boolean | null;

  /** Visual style for this cell. */
  style?: CellStyle;
}

/**
 * Represents a single sheet (tab) within a workbook.
 */
export interface Sheet {
  /** Unique identifier for this sheet. */
  id: string;

  /** Display name shown on the tab. */
  name: string;

  /**
   * Sparse cell storage keyed by "row:col" (e.g., "0:0" for A1).
   * Only cells with data are present.
   */
  cells: Record<string, Cell>;

  /** Default column width in pixels. */
  defaultColWidth: number;

  /** Default row height in pixels. */
  defaultRowHeight: number;

  /** Per‑column width overrides (column index → width in px). */
  columnWidths: Record<number, number>;

  /** Per‑row height overrides (row index → height in px). */
  rowHeights: Record<number, number>;

  /** Total number of columns in this sheet. */
  columnCount: number;

  /** Total number of rows in this sheet. */
  rowCount: number;

  /** Frozen column count (0 = none frozen). */
  frozenColumns: number;

  /** Frozen row count (0 = none frozen). */
  frozenRows: number;
}

/**
 * The top‑level workbook containing one or more sheets.
 */
export interface Workbook {
  /** Unique identifier for this workbook. */
  id: string;

  /** Display title of the workbook. */
  title: string;

  /** Ordered list of sheets. */
  sheets: Sheet[];

  /** Index of the currently active sheet. */
  activeSheetIndex: number;

  /** Timestamp of last modification (epoch ms). */
  lastModified: number;
}

/**
 * Represents a snapshot of workbook state stored for undo/redo.
 */
export interface HistoryEntry {
  /** Snapshot of the entire workbook state at this point in time. */
  workbook: Workbook;

  /** Human‑readable description of the action (e.g., "Edit cell A1"). */
  description: string;

  /** Timestamp when this entry was created (epoch ms). */
  timestamp: number;
}

/**
 * Represents a rectangular selection of cells on the grid.
 */
export interface Selection {
  /** The kind of selection — a cell range, full row(s), or full column(s). */
  type: 'cell' | 'row' | 'col';

  /** Starting row index (0‑based). */
  startRow: number;

  /** Starting column index (0‑based). */
  startCol: number;

  /** Ending row index (inclusive). */
  endRow: number;

  /** Ending column index (inclusive). */
  endCol: number;

  /** The row/col where the user started the selection (for shift‑click behavior). */
  anchorRow: number;

  /** The column where the user started the selection. */
  anchorCol: number;
}

/**
 * Creates a cell key from row and column indices.
 * @param row - Zero‑based row index.
 * @param col - Zero‑based column index.
 * @returns The key string (e.g., "0:0" for A1).
 */
export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Converts a column index to its A1‑style letter(s).
 * @param col - Zero‑based column index (0 → "A", 26 → "AA").
 * @returns The column letter(s).
 */
export function colToLetter(col: number): string {
  let result = '';
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Converts a cell reference string (e.g., "B3") to row/col indices.
 * @param ref - A1‑style cell reference.
 * @returns Tuple of [row, col] (zero‑based).
 */
export function refToRowCol(ref: string): [number, number] {
  const match = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);

  let col = 0;
  for (const ch of match[1].toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }

  return [parseInt(match[2], 10) - 1, col - 1];
}
