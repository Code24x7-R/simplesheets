// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Actuals Editor Modal
 *
 * Create and edit actual spend entries (timesheets, invoices, expenses):
 * - Task assignment
 * - Date
 * - Amount
 * - Currency
 * - Source (vendor, employee, expense category)
 * - Notes
 */

import { useState, useEffect } from 'react';
import type { ActualSpendEntry, WBSTask } from '../types';
import { NumericInput } from '../../components/NumericInput';

interface ActualsEditorModalProps {
  entry: ActualSpendEntry | null; // null = create mode
  tasks: WBSTask[];
  defaultCurrency?: string;
  onClose: () => void;
  onSave: (entry: ActualSpendEntry) => void;
  onDelete?: (entryId: string) => void;
}

export function ActualsEditorModal({
  entry,
  tasks,
  defaultCurrency = 'USD',
  onClose,
  onSave,
  onDelete,
}: ActualsEditorModalProps) {
  const isNew = entry === null;

  const [form, setForm] = useState<ActualSpendEntry>(
    entry ?? {
      id: `act-${Date.now()}`,
      taskId: '',
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      currency: defaultCurrency,
      source: '',
      notes: '',
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form when entry prop changes
  useEffect(() => {
    if (entry) {
      setForm(entry);
    }
  }, [entry]);

  function updateField<K extends keyof ActualSpendEntry>(key: K, value: ActualSpendEntry[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.taskId) newErrors.taskId = 'Task is required';
    if (!form.date) newErrors.date = 'Date is required';
    if (form.amount <= 0) newErrors.amount = 'Amount must be positive';
    if (!form.source.trim()) newErrors.source = 'Source is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, source: form.source.trim(), notes: form.notes.trim() });
  }

  function handleDelete() {
    if (entry && onDelete) {
      onDelete(entry.id);
    }
  }

  // Get task name for display
  const selectedTask = tasks.find((t) => t.id === form.taskId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="actuals-editor-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Add Actual Spend' : 'Edit Actual Spend'}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            onClick={onClose}
            data-testid="close-modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Task */}
          <div>
            <label htmlFor="actuals-task" className="block text-sm font-medium text-gray-700 mb-1">
              Task <span className="text-red-500">*</span>
            </label>
            <select
              id="actuals-task"
              value={form.taskId}
              onChange={(e) => updateField('taskId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a task...</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {'  '.repeat(task.level)}{task.name}
                </option>
              ))}
            </select>
            {errors.taskId && <p className="text-xs text-red-500 mt-1">{errors.taskId}</p>}
            {selectedTask && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedTask.startDate} → {selectedTask.endDate}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="actuals-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id="actuals-date"
              type="date"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label htmlFor="actuals-amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <NumericInput
                id="actuals-amount"
                value={form.amount}
                onChange={(value) => updateField('amount', value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label htmlFor="actuals-currency" className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                id="actuals-currency"
                value={form.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
                <option value="CHF">CHF</option>
                <option value="CNY">CNY</option>
              </select>
            </div>
          </div>

          {/* Source */}
          <div>
            <label htmlFor="actuals-source" className="block text-sm font-medium text-gray-700 mb-1">
              Source <span className="text-red-500">*</span>
            </label>
            <input
              id="actuals-source"
              type="text"
              value={form.source}
              onChange={(e) => updateField('source', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Vendor name, employee, expense category"
            />
            {errors.source && <p className="text-xs text-red-500 mt-1">{errors.source}</p>}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="actuals-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              id="actuals-notes"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional notes about this spend entry..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {onDelete && !isNew && (
              <button
                className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                onClick={handleDelete}
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              onClick={handleSave}
            >
              {isNew ? 'Add Entry' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
