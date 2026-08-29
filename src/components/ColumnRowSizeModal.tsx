// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useCallback, useEffect } from 'react';
import { NumericInput } from './NumericInput';

interface ColumnRowSizeModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Callback to close the modal without applying. */
  onClose: () => void;
  /** Initial mode to open in. */
  initialType?: 'col' | 'row';
  /** Current column index (zero-based) of the active cell. */
  currentCol: number;
  /** Current row index (zero-based) of the active cell. */
  currentRow: number;
  /** The sheet's default column width in pixels. */
  defaultColWidth: number;
  /** The sheet's default row height in pixels. */
  defaultRowHeight: number;
  /** Callback when the user applies a size.
   *  - `type`: 'col' or 'row'
   *  - `size`: new width/height in pixels
   *  - `applyToAll`: if true, sets the default size for all columns/rows.
   *     If false, resizes only the current column/row.
   *  - `index`: the column or row index (only meaningful when applyToAll is false).
   */
  onApply: (params: {
    type: 'col' | 'row';
    size: number;
    applyToAll: boolean;
    index: number;
  }) => void;
}

/** Preset widths for columns (pixels). */
const COLUMN_PRESETS = [50, 80, 100, 150, 200];

/** Preset heights for rows (pixels). */
const ROW_PRESETS = [20, 28, 40, 60, 80];

/** Minimum allowed size (pixels). */
const MIN_SIZE = 10;

/** Maximum allowed size (pixels). */
const MAX_SIZE = 500;

/**
 * Touch-friendly modal for setting exact column widths or row heights.
 * Provides a numeric input plus preset buttons for common sizes.
 * On mobile devices this is far easier than drag-based resize handles.
 *
 * The user can choose to apply the size to the current column/row only,
 * or set it as the default for all columns/rows.
 */
export function ColumnRowSizeModal({
  isOpen,
  onClose,
  initialType = 'col',
  currentCol,
  currentRow,
  defaultColWidth,
  defaultRowHeight,
  onApply,
}: ColumnRowSizeModalProps) {
  const [type, setType] = useState<'col' | 'row'>(initialType);
  const [applyToAll, setApplyToAll] = useState(false);
  const [size, setSize] = useState(type === 'col' ? defaultColWidth : defaultRowHeight);

  // Sync type/size when the initialType or default dimensions change
  // while the modal stays mounted.
  useEffect(() => {
    setType(initialType);
    setSize(initialType === 'col' ? defaultColWidth : defaultRowHeight);
  }, [initialType, defaultColWidth, defaultRowHeight]);

  const handleApply = useCallback(() => {
    const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
    const index = type === 'col' ? currentCol : currentRow;
    onApply({ type, size: clamped, applyToAll, index });
    onClose();
  }, [type, size, applyToAll, currentCol, currentRow, onApply, onClose]);

  // Reset state whenever the modal opens
  if (!isOpen) return null;

  const presets = type === 'col' ? COLUMN_PRESETS : ROW_PRESETS;
  const label = type === 'col' ? 'Column Width' : 'Row Height';
  const unit = 'px';

  const handleTypeChange = (newType: 'col' | 'row') => {
    setType(newType);
    // Reset size to the relevant default when switching modes
    setSize(newType === 'col' ? defaultColWidth : defaultRowHeight);
  };

  const handlePresetClick = (value: number) => {
    setSize(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-80 sm:w-96 p-5 space-y-4 mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Column / Row Size</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Type toggle: Column vs Row */}
        <div>
          <label className="block text-sm font-medium mb-1">Resize</label>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-3 rounded border text-sm font-medium min-h-[44px] ${
                type === 'col'
                  ? 'bg-blue-100 border-blue-500 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => handleTypeChange('col')}
            >
              Column
            </button>
            <button
              className={`flex-1 py-3 rounded border text-sm font-medium min-h-[44px] ${
                type === 'row'
                  ? 'bg-blue-100 border-blue-500 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => handleTypeChange('row')}
            >
              Row
            </button>
          </div>
        </div>

        {/* Preset buttons */}
        <div>
          <label className="block text-sm font-medium mb-1">Presets</label>
          <div className="flex flex-wrap gap-2">
            {presets.map((value) => (
              <button
                key={value}
                className={`px-3 py-2 rounded border text-sm min-h-[44px] min-w-[52px] ${
                  size === value
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handlePresetClick(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Custom size input */}
        <div>
          <label htmlFor="size-input" className="block text-sm font-medium mb-1">{label} ({unit})</label>
          <NumericInput
            id="size-input"
            value={size}
            onChange={(v) => setSize(v)}
            className="w-full border border-gray-200 rounded px-3 py-3 text-base min-h-[44px]"
            min={MIN_SIZE}
            max={MAX_SIZE}
            placeholder={String(type === 'col' ? defaultColWidth : defaultRowHeight)}
          />
        </div>

        {/* Apply to all toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apply-to-all"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="w-5 h-5 min-w-[20px] min-h-[20px]"
          />
          <label htmlFor="apply-to-all" className="text-sm">
            {type === 'col' ? 'Set as default for all columns' : 'Set as default for all rows'}
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
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
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
