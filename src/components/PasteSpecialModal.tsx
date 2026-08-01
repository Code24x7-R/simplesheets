// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useEffect, useRef, useState } from 'react';

export type PasteMode = 'all' | 'formulas' | 'values' | 'formatting';

export interface PasteSpecialOptions {
  mode: PasteMode;
  transpose: boolean;
  skipBlanks: boolean;
}

interface PasteSpecialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (options: PasteSpecialOptions) => void;
  skipBlanks: boolean;
  onSkipBlanksChange: (value: boolean) => void;
}

/**
 * Paste Special modal — lets the user configure paste options
 * before applying. Supports paste modes (Everything, Formulas,
 * Values, Formatting), transpose, and skip blanks.
 */
export function PasteSpecialModal({
  isOpen,
  onClose,
  onApply,
  skipBlanks,
  onSkipBlanksChange,
}: PasteSpecialModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PasteMode>('all');
  const [transpose, setTranspose] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    modalRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  const handleApply = () => {
    onApply({ mode, transpose, skipBlanks });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Paste Special"
        className="bg-white rounded-lg shadow-xl border border-gray-300 p-5 w-72 outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-base font-semibold text-gray-800 mb-3">Paste Special</h2>

        {/* Paste mode radio buttons */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Paste</p>
          {([
            { value: 'all', label: 'Everything' },
            { value: 'formulas', label: 'Formulas' },
            { value: 'values', label: 'Values' },
            { value: 'formatting', label: 'Formatting' },
          ] as const).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="paste-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {/* Transpose checkbox */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={transpose}
              onChange={(e) => setTranspose(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Transpose</span>
          </label>
        </div>

        {/* Skip blanks checkbox */}
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={skipBlanks}
              onChange={(e) => onSkipBlanksChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Skip blanks</span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Prevent empty cells from overwriting existing data
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            onClick={handleApply}
          >
            Paste
          </button>
        </div>
      </div>
    </div>
  );
}
