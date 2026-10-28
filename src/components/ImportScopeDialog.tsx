// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { IncomingImport, ImportScope, ImportScopeOptions } from '../utils/importScope';

interface ImportScopeDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** The parsed import being applied. */
  imported: IncomingImport;
  /** Called with the user's chosen scope and (for CSV) parse options. */
  onConfirm: (options: ImportScopeOptions) => void;
  /** Called when the dialog is dismissed. */
  onCancel: () => void;
}

const DELIMITER_OPTIONS: { value: string; label: string }[] = [
  { value: ',', label: 'Comma (,)' },
  { value: '\t', label: 'Tab' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '|', label: 'Pipe (|)' },
];

const SCOPE_OPTIONS: { value: ImportScope; label: string; description: string }[] = [
  { value: 'replace', label: 'Replace workbook', description: 'Discard the current workbook and open the imported data.' },
  { value: 'new-sheets', label: 'Add as new sheet(s)', description: 'Append the imported sheets to the current workbook.' },
  { value: 'insert', label: 'Insert at active cell', description: 'Paste the imported data starting at the active cell.' },
];

/**
 * Modal shown after an Import (not Open) to choose where the data lands and,
 * for CSV/TSV, the delimiter and header-row handling.
 */
export function ImportScopeDialog({ isOpen, imported, onConfirm, onCancel }: ImportScopeDialogProps) {
  const [scope, setScope] = useState<ImportScope>('replace');
  const [hasHeader, setHasHeader] = useState(false);
  const [delimiter, setDelimiter] = useState(imported.detectedDelimiter ?? ',');
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScope('replace');
      setHasHeader(false);
      setDelimiter(imported.detectedDelimiter ?? ',');
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [isOpen, imported]);

  if (!isOpen) return null;

  const totalCells = imported.workbook.sheets.reduce((acc, s) => acc + Object.keys(s.cells).length, 0);
  const sheetCount = imported.workbook.sheets.length;
  const isCsv = imported.kind === 'csv';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ scope, hasHeader, delimiter });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    // Keep global shortcuts (Ctrl+C/X/V/S, etc.) from firing while the modal is open.
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import Data"
        className="bg-white rounded-lg shadow-xl w-[440px] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold">Import Data</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500">
            {sheetCount} sheet{sheetCount === 1 ? '' : 's'} · {totalCells} cell{totalCells === 1 ? '' : 's'}
            {imported.fileName ? ` · ${imported.fileName}` : ''}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-gray-600 mb-1">Import into</legend>
            {SCOPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer ${
                  scope === option.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="import-scope"
                  value={option.value}
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                  className="mt-0.5"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {isCsv && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-gray-600 mb-1">CSV options</legend>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="flex-1">Delimiter</span>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DELIMITER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                />
                First row is a header
              </label>
            </fieldset>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
