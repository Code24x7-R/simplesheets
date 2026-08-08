// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Range Picker
 *
 * Modal dialog that lets the user select a range for a consumer app.
 * Provides a text input with live validation and displays sheet tabs
 * for reference. The user types or pastes a range and confirms.
 *
 * Follows the ColumnRowSizeModal / ChartDialog range picker pattern.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Workbook } from '../../types';
import { colToLetter } from '../../types';
import { parseRangeWithSheet } from '../../utils/chartData';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SheetLinkRangePickerProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Optional prompt text shown in the dialog. */
  prompt?: string;
  /** The workbook (for sheet names and validation). */
  workbook: Workbook;
  /** Called with the selected range string (e.g., "Sheet1!A1:D10"). */
  onConfirm: (range: string) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SheetLinkRangePicker({
  isOpen,
  prompt,
  workbook,
  onConfirm,
  onCancel,
}: SheetLinkRangePickerProps) {
  const [rangeInput, setRangeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get available sheet names for display
  const sheetNames = useMemo(() => {
    return workbook.sheets.map(s => s.name);
  }, [workbook]);

  // Validate the range input
  const validateRange = useCallback((input: string): { valid: boolean; normalized: string; error: string | null } => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, normalized: '', error: 'Enter a range (e.g., A1:D10)' };
    }

    try {
      const parsed = parseRangeWithSheet(trimmed);

      // Validate sheet name if specified
      if (parsed.sheetName) {
        const sheetExists = workbook.sheets.some(
          s => s.name.toLowerCase() === parsed.sheetName!.toLowerCase()
        );
        if (!sheetExists) {
          return { valid: false, normalized: trimmed, error: `Sheet "${parsed.sheetName}" not found` };
        }
      }

      // Validate cell references (basic check)
      if (parsed.startRow < 0 || parsed.startCol < 0) {
        return { valid: false, normalized: trimmed, error: 'Invalid cell reference' };
      }

      // Normalize the range string
      const sheetPrefix = parsed.sheetName ? `${parsed.sheetName}!` : '';
      const startRef = `${colToLetter(parsed.startCol)}${parsed.startRow + 1}`;
      const endRef = `${colToLetter(parsed.endCol)}${parsed.endRow + 1}`;
      const normalized = parsed.startRow === parsed.endRow && parsed.startCol === parsed.endCol
        ? `${sheetPrefix}${startRef}`
        : `${sheetPrefix}${startRef}:${endRef}`;

      return { valid: true, normalized, error: null };
    } catch {
      return { valid: false, normalized: trimmed, error: 'Invalid range format. Use A1 notation.' };
    }
  }, [workbook]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRangeInput(value);

    // Live validation (only show error if user has typed something substantial)
    if (value.trim().length > 2) {
      const result = validateRange(value);
      setError(result.valid ? null : result.error);
    } else {
      setError(null);
    }
  }, [validateRange]);

  const handleConfirm = useCallback(() => {
    const result = validateRange(rangeInput);
    if (result.valid) {
      onConfirm(result.normalized);
      setRangeInput('');
      setError(null);
    } else {
      setError(result.error || 'Invalid range');
    }
  }, [rangeInput, validateRange, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleConfirm, onCancel]);

  const handleSheetClick = useCallback((sheetName: string) => {
    // Insert sheet name into the input at cursor position or append
    setRangeInput(prev => {
      if (prev.includes('!')) {
        // Replace existing sheet prefix
        return `${sheetName}!${prev.slice(prev.indexOf('!') + 1)}`;
      }
      return `${sheetName}!${prev}`;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[480px] max-w-[90vw] p-6 space-y-4 mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-labelledby="range-picker-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="range-picker-title" className="text-lg font-bold text-gray-900">
            Select Range
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Prompt text */}
        {prompt && (
          <p className="text-sm text-gray-600">{prompt}</p>
        )}

        {/* Sheet tabs reference */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Available Sheets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {sheetNames.map(name => (
              <button
                key={name}
                className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                onClick={() => handleSheetClick(name)}
                title={`Insert ${name}!`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Range input */}
        <div>
          <label htmlFor="range-input" className="block text-xs font-medium text-gray-500 mb-1.5">
            Cell Range (A1 notation)
          </label>
          <input
            id="range-input"
            type="text"
            className={`w-full border rounded px-3 py-3 text-sm min-h-[44px] font-mono ${
              error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
            } focus:outline-none focus:ring-2 transition-colors`}
            value={rangeInput}
            onChange={handleInputChange}
            placeholder="e.g., Sheet1!A1:D10"
            autoFocus
          />
          {error && (
            <p className="text-xs text-red-600 mt-1.5">{error}</p>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-400">
          Type a range in A1 notation. Click a sheet name above to prefix it.
          Press Enter to confirm, Escape to cancel.
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            className="flex-1 py-3 rounded border border-gray-200 hover:bg-gray-50 text-sm font-medium min-h-[44px] transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-3 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium min-h-[44px] transition-colors"
            onClick={handleConfirm}
            disabled={!rangeInput.trim() || !!error}
          >
            Select Range
          </button>
        </div>
      </div>
    </div>
  );
}
