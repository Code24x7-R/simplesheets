/**
 * Sheet Filter — pure functions for filtering data in a sheet.
 *
 * Filter state tracks which rows are visible based on per-column criteria.
 * Functions are pure — they take data and return new state, never mutate.
 */

import type { Sheet, Cell } from '../types';
import { cellKey } from '../types';

/** Filter condition types. */
export type FilterCondition =
  | { type: 'includes'; values: string[] }       // Checkbox selection (value must be in list)
  | { type: 'contains'; value: string }          // Text contains substring
  | { type: 'notContains'; value: string }       // Text does not contain substring
  | { type: 'equals'; value: string }            // Text equals exactly
  | { type: 'notEquals'; value: string }         // Text not equal
  | { type: 'startsWith'; value: string }        // Text starts with
  | { type: 'endsWith'; value: string }          // Text ends with
  | { type: 'greaterThan'; value: number }       // Number greater than
  | { type: 'lessThan'; value: number }          // Number less than
  | { type: 'greaterOrEqual'; value: number }    // Number >=
  | { type: 'lessOrEqual'; value: number }       // Number <=
  | { type: 'isEmpty' }                          // Cell is empty
  | { type: 'isNotEmpty' }                       // Cell is not empty
  | { type: 'custom'; formula: string };         // Custom formula (advanced)

/** A filter applied to a single column. */
export interface ColumnFilter {
  /** Conditions to evaluate (AND logic between conditions). */
  conditions: FilterCondition[];
  /** Logic type for combining conditions (currently only AND supported). */
  logic?: 'AND' | 'OR';
}

/** Complete filter state for a sheet. */
export interface FilterState {
  /** Whether filter mode is enabled. */
  active: boolean;
  /** Row index of header row (0-based). */
  headerRow: number;
  /** Column filters keyed by column index. */
  filters: Record<number, ColumnFilter>;
  /** Set of hidden row indices (computed from filters). */
  hiddenRows: Set<number>;
  /** Total rows evaluated (excluding header). */
  totalDataRows: number;
  /** Number of visible rows (excluding header). */
  visibleDataRows: number;
}

/**
 * Gets the display value from a cell for filter evaluation.
 * Strips leading single quote (text marker).
 */
function getCellDisplayValue(cell: Cell | undefined): string {
  if (!cell) return '';
  let value = cell.computedValue !== undefined && cell.computedValue !== null
    ? String(cell.computedValue)
    : cell.rawValue;
  if (value.startsWith("'")) {
    value = value.slice(1);
  }
  return value;
}

/**
 * Evaluates a single filter condition against a cell value.
 */
function evaluateCondition(condition: FilterCondition, cellValue: string, _cell: Cell | undefined): boolean {
  const trimmed = cellValue.trim();

  switch (condition.type) {
    case 'includes': {
      // Check if the cell value is in the includes list (case-insensitive)
      const lowerValue = trimmed.toLowerCase();
      return condition.values.some(v => v.toLowerCase() === lowerValue);
    }

    case 'contains':
      return trimmed.toLowerCase().includes(condition.value.toLowerCase());

    case 'notContains':
      return !trimmed.toLowerCase().includes(condition.value.toLowerCase());

    case 'equals':
      return trimmed.toLowerCase() === condition.value.toLowerCase();

    case 'notEquals':
      return trimmed.toLowerCase() !== condition.value.toLowerCase();

    case 'startsWith':
      return trimmed.toLowerCase().startsWith(condition.value.toLowerCase());

    case 'endsWith':
      return trimmed.toLowerCase().endsWith(condition.value.toLowerCase());

    case 'greaterThan': {
      const num = Number(trimmed);
      return !isNaN(num) && num > condition.value;
    }

    case 'lessThan': {
      const num = Number(trimmed);
      return !isNaN(num) && num < condition.value;
    }

    case 'greaterOrEqual': {
      const num = Number(trimmed);
      return !isNaN(num) && num >= condition.value;
    }

    case 'lessOrEqual': {
      const num = Number(trimmed);
      return !isNaN(num) && num <= condition.value;
    }

    case 'isEmpty':
      return trimmed === '';

    case 'isNotEmpty':
      return trimmed !== '';

    case 'custom':
      // Custom formula filter — would need formula engine to evaluate
      // For now, return true (no filtering)
      return true;

    default:
      return true;
  }
}

/**
 * Evaluates all conditions in a column filter against a cell.
 * Uses AND logic (all conditions must be true).
 */
function evaluateColumnFilter(filter: ColumnFilter, cellValue: string, cell: Cell | undefined): boolean {
  if (filter.conditions.length === 0) return true;

  if (filter.logic === 'OR') {
    return filter.conditions.some(cond => evaluateCondition(cond, cellValue, cell));
  }

  // Default: AND logic
  return filter.conditions.every(cond => evaluateCondition(cond, cellValue, cell));
}

/**
 * Computes which rows should be hidden based on the filter criteria.
 * Header row is never hidden.
 *
 * @param sheet - The sheet data.
 * @param headerRow - Row index of the header row.
 * @param filters - Column filters keyed by column index.
 * @returns A Set of row indices that should be hidden.
 */
export function computeHiddenRows(
  sheet: Sheet,
  headerRow: number,
  filters: Record<number, ColumnFilter>,
): Set<number> {
  const hiddenRows = new Set<number>();
  const filterColumns = Object.keys(filters).map(Number);

  if (filterColumns.length === 0) return hiddenRows;

  for (let r = 0; r < sheet.rowCount; r++) {
    if (r === headerRow) continue; // Never hide header

    // Check if this row passes ALL column filters
    let rowVisible = true;

    for (const col of filterColumns) {
      const filter = filters[col];
      const cell = sheet.cells[cellKey(r, col)];
      const cellValue = getCellDisplayValue(cell);

      if (!evaluateColumnFilter(filter, cellValue, cell)) {
        rowVisible = false;
        break; // AND logic - any filter failing hides the row
      }
    }

    if (!rowVisible) {
      hiddenRows.add(r);
    }
  }

  return hiddenRows;
}

/**
 * Creates a complete FilterState from a sheet and column filters.
 */
export function createFilterState(
  sheet: Sheet,
  headerRow: number,
  filters: Record<number, ColumnFilter>,
): FilterState {
  const hiddenRows = computeHiddenRows(sheet, headerRow, filters);
  const totalDataRows = sheet.rowCount - headerRow - 1;
  const visibleDataRows = Math.max(0, totalDataRows - hiddenRows.size);

  return {
    active: Object.keys(filters).length > 0,
    headerRow,
    filters,
    hiddenRows,
    totalDataRows,
    visibleDataRows,
  };
}

/**
 * Gets the unique values in a column (for checkbox filter).
 * Excludes the header row.
 *
 * @param sheet - The sheet data.
 * @param column - Column index.
 * @param headerRow - Row index of header row.
 * @returns Array of unique values sorted alphabetically.
 */
export function getUniqueValues(sheet: Sheet, column: number, headerRow: number): string[] {
  const values = new Set<string>();

  for (let r = headerRow + 1; r < sheet.rowCount; r++) {
    const cell = sheet.cells[cellKey(r, column)];
    if (cell) {
      const value = getCellDisplayValue(cell);
      if (value.trim() !== '') {
        values.add(value);
      }
    }
  }

  return Array.from(values).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Clears the filter for a specific column.
 */
export function clearColumnFilter(
  filters: Record<number, ColumnFilter>,
  column: number,
): Record<number, ColumnFilter> {
  const newFilters = { ...filters };
  delete newFilters[column];
  return newFilters;
}

/**
 * Clears all filters.
 */
export function clearAllFilters(): Record<number, ColumnFilter> {
  return {};
}

/**
 * Checks if a row is visible (not hidden).
 */
export function isRowVisible(filterState: FilterState | null, rowIndex: number): boolean {
  if (!filterState || !filterState.active) return true;
  return !filterState.hiddenRows.has(rowIndex);
}

/**
 * Gets the visible rows in order (for rendering).
 * Returns array of actual row indices in display order.
 */
export function getVisibleRowIndices(
  filterState: FilterState | null,
  rowCount: number,
): number[] {
  if (!filterState || !filterState.active) {
    // Return all rows
    const rows: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      rows.push(r);
    }
    return rows;
  }

  const rows: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    if (!filterState.hiddenRows.has(r)) {
      rows.push(r);
    }
  }
  return rows;
}

/**
 * Maps a display row index to the actual row index (when filter is active).
 */
export function displayToActualRow(
  filterState: FilterState | null,
  displayRowIndex: number,
  rowCount: number,
): number {
  if (!filterState || !filterState.active) return displayRowIndex;

  let visibleIndex = 0;
  for (let r = 0; r < rowCount; r++) {
    if (!filterState.hiddenRows.has(r)) {
      if (visibleIndex === displayRowIndex) {
        return r;
      }
      visibleIndex++;
    }
  }

  // Out of bounds - return last valid row
  return rowCount - 1;
}

/**
 * Maps an actual row index to display row index (when filter is active).
 * Returns -1 if the row is hidden.
 */
export function actualToDisplayRow(
  filterState: FilterState | null,
  actualRowIndex: number,
  rowCount: number,
): number {
  if (!filterState || !filterState.active) return actualRowIndex;

  let displayIndex = 0;
  for (let r = 0; r < rowCount; r++) {
    if (!filterState.hiddenRows.has(r)) {
      if (r === actualRowIndex) {
        return displayIndex;
      }
      displayIndex++;
    }
  }

  return -1; // Row is hidden
}
