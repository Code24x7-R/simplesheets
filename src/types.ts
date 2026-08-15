// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
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

  /** Top border as a CSS border string (e.g., "1px solid #000000"). */
  borderTop?: string;

  /** Bottom border as a CSS border string. */
  borderBottom?: string;

  /** Left border as a CSS border string. */
  borderLeft?: string;

  /** Right border as a CSS border string. */
  borderRight?: string;
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

  /** Charts embedded in this sheet. */
  charts?: ChartConfig[];
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

  /** Extension data persisted with the workbook. Keyed by extension ID. */
  extensions?: Record<string, ExtensionData>;
}

/**
 * Base interface for all extension data stored in a workbook.
 * Extensions store their serialized state here for persistence.
 */
export interface ExtensionData {
  /** Extension identifier (e.g., 'project-wbs'). */
  extensionId: string;
  /** Data schema version for forward compatibility. */
  schemaVersion: string;
  /** Extension-specific serialized data. */
  data: unknown;
}

/**
 * Data stored by the Project/WBS extension.
 * Holds the project model and sheet-to-project mapping configuration.
 */
export interface ProjectExtensionData {
  extensionId: 'project-wbs';
  schemaVersion: '1.0.0';
  data: {
    /** The project model (tasks, risks, resources). */
    project: ProjectModel | null;
    /** Column mapping from sheet columns to project fields. */
    columnMapping: ColumnMapping | null;
    /** ID of the sheet that is the source of project data. */
    sourceSheetId: string | null;
  };
}

/**
 * Serializable subset of the Project model for persistence.
 * Mirrors the Project type but with simpler structure for JSON.
 * This is the normalized schema — all project data is stored here.
 */
export interface ProjectModel {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  tasks: TaskRow[];
  risks: RiskRow[];
  resources: ResourceRow[];
}

/**
 * Serializable resource row.
 */
export interface ResourceRow {
  id: string;
  name: string;
  role: string;
  costRate: number;
  costCurrency: string;
  availability: number;
  color: string;
}

/**
 * Serializable task row (flat structure from sheet data).
 */
export interface TaskRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  parentId: string | null;
  dependencies: string[]; // Predecessor task IDs
  progress: number;
  resourceId: string | null;
  isMilestone: boolean;
  color: string;
  notes: string;
}

/**
 * Serializable risk row.
 */
export interface RiskRow {
  id: string;
  title: string;
  category: string;
  probability: number;
  impact: number;
  status: string;
  ownerId: string | null;
  mitigationPlan: string;
  notes: string;
}

/**
 * Maps spreadsheet columns to project model fields.
 * Used by the sheet-to-project converter.
 */
export interface ColumnMapping {
  /** Column index for task name/description. */
  taskCol: number;
  /** Column index for start date. */
  startDateCol: number;
  /** Column index for end date. */
  endDateCol: number;
  /** Column index for duration (alternative to end date). */
  durationCol: number | null;
  /** Column index for parent task reference. */
  parentCol: number | null;
  /** Column index for dependency reference. */
  dependencyCol: number | null;
  /** Column index for progress (0-100). */
  progressCol: number | null;
  /** Column index for resource assignment. */
  resourceCol: number | null;
  /** Column index for milestone flag. */
  milestoneCol: number | null;
  /** Column index for task color. */
  colorCol: number | null;
  /** Column index for notes/description. */
  notesCol: number | null;
  /** Row index of the header row (null = auto-detect). */
  headerRow: number | null;
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

  /** Filter state snapshot (for undo/redo of filter operations). */
  filterState?: unknown;

  /** Selection snapshot (for undo/redo to preserve grid selection). */
  gridSelection?: unknown;
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
 * Chart type enumeration.
 */
export type ChartType = 'bar' | 'column' | 'line' | 'pie' | 'area' | 'scatter';

/**
 * Legend positioning options.
 */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

/**
 * A single data series in a chart.
 */
export interface ChartSeries {
  /** Display name for this series (shown in legend). */
  label: string;
  /** Cell range containing the data values (e.g., "A1:A10"). */
  dataRange: string;
  /** Optional custom color (hex string). Auto-assigned if omitted. */
  color?: string;
}

/**
 * Configuration for a chart embedded in a sheet.
 */
export interface ChartConfig {
  /** Unique identifier for this chart. */
  id: string;
  /** The type of chart to render. */
  type: ChartType;
  /** Chart title displayed above the visualization. */
  title: string;
  /** Source data range (e.g., "A1:B10"). */
  dataRange: string;
  /** Data series configurations. */
  series: ChartSeries[];
  /** Label for the x-axis (category axis). */
  xAxisLabel?: string;
  /** Label for the y-axis (value axis). */
  yAxisLabel?: string;
  /** Position of the legend. */
  legendPosition: LegendPosition;
  /** Width of the chart in pixels. */
  width: number;
  /** Height of the chart in pixels. */
  height: number;
  /** Row position on the sheet (for floating placement). */
  row: number;
  /** Column position on the sheet (for floating placement). */
  col: number;
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
