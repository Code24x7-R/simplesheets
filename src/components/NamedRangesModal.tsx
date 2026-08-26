// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Named Ranges Modal — full CRUD for named ranges.
 *
 * Users can create, edit, and delete named ranges that map a human-readable
 * name to an A1-style cell reference. Names can be scoped to the workbook
 * (visible everywhere) or to a specific sheet.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import type { NamedRange, Sheet } from '../types';
import {
  validateName,
  validateReference,
  isNameDuplicate,
  createNamedRange,
} from '../utils/namedRangeUtils';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

interface NamedRangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  namedRanges: NamedRange[];
  onNamedRangesChange: (ranges: NamedRange[]) => void;
  /** Available sheets for scope selection. */
  sheets: Sheet[];
  /** ID of the currently active sheet (default scope selection). */
  activeSheetId: string;
  /** Whether the grid is currently in point-selection mode for this modal's reference. */
  isRangePickerActive: boolean;
  /** Toggle grid point-selection mode for picking a range on the grid. */
  onToggleRangePicker: () => void;
}

type Draft = {
  id: string;
  name: string;
  reference: string;
  scope: 'workbook' | 'sheet';
  sheetId: string;
  comment: string;
};

// ════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════

export function NamedRangesModal({
  isOpen,
  onClose,
  namedRanges,
  onNamedRangesChange,
  sheets,
  activeSheetId,
  isRangePickerActive,
  onToggleRangePicker,
}: NamedRangesModalProps) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ name?: string; reference?: string }>({});

  // Sort names alphabetically for display.
  const sorted = useMemo(
    () => [...namedRanges].sort((a, b) => a.name.localeCompare(b.name)),
    [namedRanges],
  );

  // Track latest editing draft in a ref so the range-pick listener always
  // sees the current value without needing it as a useEffect dependency
  // (which would re-register the listener on every keystroke).
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Listen for range selection events from the grid (point mode).
  useEffect(() => {
    const handleRangeSelected = (e: Event) => {
      const customEvent = e as CustomEvent<{ range: string }>;
      if (editingRef.current) {
        setEditing((prev) =>
          prev ? { ...prev, reference: customEvent.detail.range } : prev,
        );
      }
    };
    window.addEventListener('simplesheets:namedRangeSelected', handleRangeSelected);
    return () => window.removeEventListener('simplesheets:namedRangeSelected', handleRangeSelected);
  }, []);

  if (!isOpen) return null;

  function startAdd() {
    setEditing({
      id: '',
      name: '',
      reference: '',
      scope: 'workbook',
      sheetId: activeSheetId,
      comment: '',
    });
    setErrors({});
  }

  function startEdit(nr: NamedRange) {
    setEditing({
      id: nr.id,
      name: nr.name,
      reference: nr.reference,
      scope: nr.scope,
      sheetId: nr.sheetId ?? activeSheetId,
      comment: nr.comment ?? '',
    });
    setErrors({});
  }

  function validateDraft(): boolean {
    if (!editing) return false;
    const newErrors: { name?: string; reference?: string } = {};

    const nameError = validateName(editing.name);
    if (nameError) newErrors.name = nameError;
    else if (isNameDuplicate(editing.name, namedRanges, editing.id || undefined)) {
      newErrors.name = 'This name is already in use.';
    }

    const refError = validateReference(editing.reference);
    if (refError) newErrors.reference = refError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!editing) return;
    if (!validateDraft()) return;

    const nr = createNamedRange(editing.name, editing.reference, editing.scope, {
      sheetId: editing.scope === 'sheet' ? editing.sheetId : undefined,
      comment: editing.comment.trim() || undefined,
    });

    if (editing.id) {
      // Edit existing — preserve the original ID.
      const updated = namedRanges.map((r) => (r.id === editing.id ? { ...nr, id: r.id } : r));
      onNamedRangesChange(updated);
    } else {
      // Add new.
      onNamedRangesChange([...namedRanges, nr]);
    }
    setEditing(null);
    setErrors({});
  }

  function handleDelete(id: string) {
    onNamedRangesChange(namedRanges.filter((r) => r.id !== id));
    if (editing?.id === id) {
      setEditing(null);
    }
  }

  function handleCancelEdit() {
    setEditing(null);
    setErrors({});
  }

  // When range picker is active, minimize to a banner so the user can
  // select a range on the grid without the modal blocking the view.
  if (isRangePickerActive) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[55] bg-white rounded-lg shadow-xl border border-blue-300 w-[480px]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium text-blue-700">📎 Select a range on the grid for the named range</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Press Enter to accept, Esc to cancel</span>
            <button
              onClick={onToggleRangePicker}
              className="text-gray-400 hover:text-gray-600 text-sm"
              aria-label="Cancel range selection"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Named Ranges"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Named Ranges</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
            data-testid="close-modal"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {editing ? (
            <EditForm
              draft={editing}
              onChange={setEditing}
              onSave={handleSave}
              onCancel={handleCancelEdit}
              onDelete={handleDelete}
              errors={errors}
              sheets={sheets}
              isRangePickerActive={isRangePickerActive}
              onToggleRangePicker={onToggleRangePicker}
            />
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={startAdd}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Add Named Range
                </button>
              </div>

              {sorted.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No named ranges defined. Click &quot;+ Add Named Range&quot; to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {sorted.map((nr) => (
                    <NamedRangeItem
                      key={nr.id}
                      namedRange={nr}
                      sheets={sheets}
                      onEdit={() => startEdit(nr)}
                      onDelete={() => handleDelete(nr.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Named Range Item (list row)
// ════════════════════════════════════════════════════════════════

function NamedRangeItem({
  namedRange,
  sheets,
  onEdit,
  onDelete,
}: {
  namedRange: NamedRange;
  sheets: Sheet[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scopeLabel =
    namedRange.scope === 'sheet'
      ? `Sheet: ${sheets.find((s) => s.id === namedRange.sheetId)?.name ?? 'Unknown'}`
      : 'Workbook';

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">{namedRange.name}</span>
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
            {scopeLabel}
          </span>
        </div>
        <div className="text-sm text-gray-500 font-mono">{namedRange.reference}</div>
        {namedRange.comment && (
          <div className="text-xs text-gray-400 mt-0.5">{namedRange.comment}</div>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2 shrink-0">
        <button
          onClick={onEdit}
          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
          aria-label={`Edit ${namedRange.name}`}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
          aria-label={`Delete ${namedRange.name}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Edit Form
// ════════════════════════════════════════════════════════════════

function EditForm({
  draft,
  onChange,
  onSave,
  onCancel,
  onDelete,
  errors,
  sheets,
  isRangePickerActive,
  onToggleRangePicker,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  errors: { name?: string; reference?: string };
  sheets: Sheet[];
  isRangePickerActive: boolean;
  onToggleRangePicker: () => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">
        {draft.id ? 'Edit Named Range' : 'New Named Range'}
      </h3>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="e.g. SalesData"
          className={`w-full px-3 py-1.5 text-sm border rounded ${
            errors.name ? 'border-red-400' : 'border-gray-300'
          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
          data-testid="named-range-name-input"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Reference */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft.reference}
            onChange={(e) => onChange({ ...draft, reference: e.target.value })}
            placeholder="e.g. Sheet1!$A$1:$D$10"
            className={`flex-1 px-3 py-1.5 text-sm border rounded font-mono ${
              errors.reference ? 'border-red-400' : 'border-gray-300'
            } focus:outline-none focus:ring-1 focus:ring-blue-500`}
            data-testid="named-range-reference-input"
          />
          <button
            type="button"
            className={`px-3 py-1.5 rounded border text-sm whitespace-nowrap ${
              isRangePickerActive
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
            onClick={onToggleRangePicker}
            title="Select range on grid"
            data-testid="named-range-pick-range"
          >
            {isRangePickerActive ? '✓ Selecting...' : '📎 Pick Range'}
          </button>
        </div>
        {errors.reference && <p className="text-xs text-red-500 mt-1">{errors.reference}</p>}
      </div>

      {/* Scope */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
        <select
          value={draft.scope}
          onChange={(e) => onChange({ ...draft, scope: e.target.value as 'workbook' | 'sheet' })}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="workbook">Workbook</option>
          <option value="sheet">Sheet</option>
        </select>
      </div>

      {/* Sheet selector (only for sheet scope) */}
      {draft.scope === 'sheet' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sheet</label>
          <select
            value={draft.sheetId}
            onChange={(e) => onChange({ ...draft, sheetId: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Comment */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Comment (optional)</label>
        <input
          type="text"
          value={draft.comment}
          onChange={(e) => onChange({ ...draft, comment: e.target.value })}
          placeholder="Description..."
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <div>
          {draft.id && (
            <button
              onClick={() => onDelete(draft.id)}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
              data-testid="named-range-delete"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="named-range-save"
          >
            {draft.id ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
