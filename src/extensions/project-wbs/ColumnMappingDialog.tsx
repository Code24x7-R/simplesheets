// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Column Mapping Dialog
 *
 * Allows users to confirm and adjust auto-detected column mappings
 * for converting a sheet to a project plan.
 */

import { useState } from 'react';
import type { Sheet, ColumnMapping } from '../../types';
import { detectColumnMapping } from './sheetToProject';

interface ColumnMappingDialogProps {
  sheet: Sheet;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  taskCol: 'Task Name',
  startDateCol: 'Start Date',
  endDateCol: 'End Date',
  durationCol: 'Duration',
  parentCol: 'Parent Task',
  dependencyCol: 'Dependencies',
  progressCol: 'Progress (%)',
  resourceCol: 'Resource',
  milestoneCol: 'Milestone',
  colorCol: 'Color',
  notesCol: 'Notes',
};

/**
 * Get column letter from index (0 → A, 1 → B, etc).
 */
function colToLetter(col: number): string {
  let result = '';
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function ColumnMappingDialog({ sheet, onConfirm, onCancel }: ColumnMappingDialogProps) {
  const detected = detectColumnMapping(sheet);
  const [mapping, setMapping] = useState<ColumnMapping | null>(detected);
  const [headerRow, setHeaderRow] = useState<number>(detected?.headerRow ?? 0);

  if (!mapping) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">No Headers Detected</h2>
          <p className="text-sm text-gray-600 mb-4">
            Could not auto-detect column headers in this sheet. Please ensure your sheet has a header row
            with column names like "Task", "Start Date", "End Date", etc.
          </p>
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  function updateField(field: keyof ColumnMapping, value: number | null) {
    setMapping((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }

  function handleConfirm() {
    if (!mapping) return;
    onConfirm({ ...mapping, headerRow });
  }

  // Get header values for display
  const headers: string[] = [];
  for (let col = 0; col < Math.min(sheet.columnCount, 15); col++) {
    const cell = sheet.cells[`${headerRow}:${col}`];
    headers.push(cell?.rawValue?.toString() ?? `(Col ${colToLetter(col)})`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Confirm Column Mapping</h2>
          <p className="text-sm text-gray-500 mt-1">
            We auto-detected the following columns. Please confirm or adjust.
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Header row selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 w-32">Header Row:</label>
            <input
              type="number"
              value={headerRow}
              onChange={(e) => setHeaderRow(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
              min={0}
              max={10}
            />
            <span className="text-xs text-gray-500">(0-based row index)</span>
          </div>

          <hr className="border-gray-200" />

          {/* Column mapping fields */}
          {Object.entries(FIELD_LABELS).map(([field, label]) => {
            const currentValue = mapping[field as keyof ColumnMapping];
            const isRequired = field === 'taskCol' || field === 'startDateCol' || field === 'endDateCol';
            return (
              <div key={field} className="flex items-center gap-3">
                <label className={`text-sm w-32 ${isRequired ? 'font-medium text-gray-700' : 'text-gray-600'}`}>
                  {label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={currentValue ?? -1}
                  onChange={(e) => updateField(field as keyof ColumnMapping, parseInt(e.target.value) || null)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value={-1}>-- Not Mapped --</option>
                  {headers.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {colToLetter(idx)}: {header}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleConfirm}
            disabled={mapping.taskCol === -1 || (mapping.startDateCol === -1 && mapping.endDateCol === -1)}
          >
            Convert to Project
          </button>
        </div>
      </div>
    </div>
  );
}
