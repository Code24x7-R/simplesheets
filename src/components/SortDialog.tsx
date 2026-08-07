// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useCallback } from 'react';
import { colToLetter } from '../types';
import type { SortDirection } from '../utils/sheetSort';

/**
 * A single sort level — which column and which direction.
 * Mirrors the SortColumn type but with a key for React list rendering.
 */
export interface SortLevel {
  key: string;
  column: number;
  direction: SortDirection;
}

interface SortDialogProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Callback to close without sorting. */
  onClose: () => void;
  /** Total number of columns in the sheet (for the column dropdown). */
  columnCount: number;
  /** Pre-selected column (defaults to the active cell's column). */
  defaultColumn: number;
  /** Pre-selected direction (defaults based on which button was clicked). */
  defaultDirection: SortDirection;
  /** Whether to pre-check "has header row". */
  defaultHasHeader: boolean;
  /** Number of rows in the selection/range (for the info label). */
  rowCount: number;
  /** Callback when the user confirms the sort. */
  onApply: (levels: Array<{ column: number; direction: SortDirection }>, hasHeader: boolean) => void;
}

/** Generate a stable unique key for a sort level. */
let levelCounter = 0;
function nextLevelKey(): string {
  return `sort-level-${++levelCounter}`;
}

/**
 * Multi-level Sort dialog.
 *
 * Provides:
 *  - A "Has header row" checkbox (first row stays pinned when checked).
 *  - One or more sort levels, each with a column dropdown and direction toggle.
 *  - "Add level" / "Remove level" buttons for multi-column sorts.
 *  - Apply / Cancel actions.
 *
 * Parity: mirrors Excel's Sort dialog and Google Sheets' "Sort range" dialog.
 */
export function SortDialog({
  isOpen,
  onClose,
  columnCount,
  defaultColumn,
  defaultDirection,
  defaultHasHeader,
  rowCount,
  onApply,
}: SortDialogProps) {
  const [levels, setLevels] = useState<SortLevel[]>([
    { key: nextLevelKey(), column: defaultColumn, direction: defaultDirection },
  ]);
  const [hasHeader, setHasHeader] = useState(defaultHasHeader);

  const handleAddLevel = useCallback(() => {
    setLevels((prev) => [
      ...prev,
      { key: nextLevelKey(), column: 0, direction: 'asc' },
    ]);
  }, []);

  const handleRemoveLevel = useCallback((key: string) => {
    setLevels((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const handleColumnChange = useCallback((key: string, column: number) => {
    setLevels((prev) => prev.map((l) => (l.key === key ? { ...l, column } : l)));
  }, []);

  const handleDirectionChange = useCallback((key: string, direction: SortDirection) => {
    setLevels((prev) => prev.map((l) => (l.key === key ? { ...l, direction } : l)));
  }, []);

  const handleApply = useCallback(() => {
    // Remove empty/duplicate handling — just pass all levels through
    const specs = levels.map((l) => ({ column: l.column, direction: l.direction }));
    onApply(specs, hasHeader);
    onClose();
  }, [levels, hasHeader, onApply, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleApply, onClose]
  );

  if (!isOpen) return null;

  // Build column options: A, B, C, ... up to columnCount
  const columnOptions: number[] = [];
  for (let c = 0; c < columnCount; c++) {
    columnOptions.push(c);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-96 sm:w-[28rem] p-5 space-y-4 mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Sort Range</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Info label */}
        <p className="text-sm text-gray-500">
          Sorting {rowCount} row{rowCount !== 1 ? 's' : ''}. Add criteria below in priority order.
        </p>

        {/* Has header row */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="sort-has-header"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
            className="w-5 h-5 min-w-[20px] min-h-[20px]"
          />
          <label htmlFor="sort-has-header" className="text-sm font-medium">
            Data has header row
          </label>
        </div>

        {/* Sort levels */}
        <div className="space-y-3">
          {levels.map((level, index) => (
            <div key={level.key} className="flex items-center gap-2">
              {/* Level label */}
              <span className="text-xs text-gray-400 w-12 shrink-0">
                {index === 0 ? 'Sort by' : 'Then by'}
              </span>

              {/* Column dropdown */}
              <select
                value={level.column}
                onChange={(e) => handleColumnChange(level.key, parseInt(e.target.value, 10))}
                className="flex-1 border border-gray-200 rounded px-2 py-2 text-sm min-h-[40px]"
                aria-label={`Sort column ${index + 1}`}
              >
                {columnOptions.map((c) => (
                  <option key={c} value={c}>
                    {colToLetter(c)}
                  </option>
                ))}
              </select>

              {/* Direction toggle */}
              <div className="flex border border-gray-200 rounded overflow-hidden">
                <button
                  className={`px-3 py-2 text-sm min-w-[40px] min-h-[40px] ${
                    level.direction === 'asc'
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleDirectionChange(level.key, 'asc')}
                  aria-label="Sort ascending"
                  title="Ascending (A→Z)"
                >
                  A→Z
                </button>
                <button
                  className={`px-3 py-2 text-sm min-w-[40px] min-h-[40px] border-l border-gray-200 ${
                    level.direction === 'desc'
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleDirectionChange(level.key, 'desc')}
                  aria-label="Sort descending"
                  title="Descending (Z→A)"
                >
                  Z→A
                </button>
              </div>

              {/* Remove button (only if more than one level) */}
              {levels.length > 1 && (
                <button
                  onClick={() => handleRemoveLevel(level.key)}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none p-1 min-w-[32px] min-h-[32px]"
                  aria-label="Remove sort level"
                  title="Remove this sort level"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add level button */}
        <button
          onClick={handleAddLevel}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium py-1"
        >
          + Add another sort column
        </button>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            className="flex-1 py-3 rounded border border-gray-200 hover:bg-gray-50 text-sm font-medium min-h-[44px]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium min-h-[44px]"
            onClick={handleApply}
          >
            Sort
          </button>
        </div>
      </div>
    </div>
  );
}
