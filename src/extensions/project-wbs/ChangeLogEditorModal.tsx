// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Change Log Editor Modal
 *
 * Create and edit change log entries:
 * - Change type (dependency, scope, resource, schedule, risk, other)
 * - Linked task (optional)
 * - Date
 * - Description
 * - Cost impact
 * - Schedule impact (days)
 * - Approved by
 */

import { useState, useEffect } from 'react';
import type { ChangeLogEntry, WBSTask } from '../types';

interface ChangeLogEditorModalProps {
  entry: ChangeLogEntry | null; // null = create mode
  tasks: WBSTask[];
  onClose: () => void;
  onSave: (entry: ChangeLogEntry) => void;
  onDelete?: (entryId: string) => void;
}

const CHANGE_TYPES: Array<{ value: ChangeLogEntry['changeType']; label: string }> = [
  { value: 'dependency', label: 'Dependency' },
  { value: 'scope', label: 'Scope' },
  { value: 'resource', label: 'Resource' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'risk', label: 'Risk' },
  { value: 'other', label: 'Other' },
];

export function ChangeLogEditorModal({
  entry,
  tasks,
  onClose,
  onSave,
  onDelete,
}: ChangeLogEditorModalProps) {
  const isNew = entry === null;

  const [form, setForm] = useState<ChangeLogEntry>(
    entry ?? {
      id: `cl-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      taskId: null,
      changeType: 'scope',
      description: '',
      costImpact: 0,
      scheduleImpactDays: 0,
      approvedBy: null,
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form when entry prop changes
  useEffect(() => {
    if (entry) {
      setForm(entry);
    }
  }, [entry]);

  function updateField<K extends keyof ChangeLogEntry>(key: K, value: ChangeLogEntry[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.date) newErrors.date = 'Date is required';
    if (!form.description.trim()) newErrors.description = 'Description is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    onSave({
      ...form,
      description: form.description.trim(),
      approvedBy: form.approvedBy?.trim() || null,
    });
  }

  function handleDelete() {
    if (entry && onDelete) {
      onDelete(entry.id);
    }
  }

  // Flatten tasks for dropdown
  const flatTasks: WBSTask[] = [];
  const collectTasks = (taskList: WBSTask[]) => {
    for (const t of taskList) {
      flatTasks.push(t);
      if (t.children.length > 0) collectTasks(t.children as WBSTask[]);
    }
  };
  collectTasks(tasks);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="change-log-editor-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Add Change Log Entry' : 'Edit Change Log Entry'}
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
          {/* Change Type */}
          <div>
            <label htmlFor="cl-type" className="block text-sm font-medium text-gray-700 mb-1">
              Change Type <span className="text-red-500">*</span>
            </label>
            <select
              id="cl-type"
              value={form.changeType}
              onChange={(e) => updateField('changeType', e.target.value as ChangeLogEntry['changeType'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CHANGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Linked Task */}
          <div>
            <label htmlFor="cl-task" className="block text-sm font-medium text-gray-700 mb-1">
              Linked Task
            </label>
            <select
              id="cl-task"
              value={form.taskId ?? ''}
              onChange={(e) => updateField('taskId', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Project-level change (no task)</option>
              {flatTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {'  '.repeat(task.level)}{task.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="cl-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id="cl-date"
              type="date"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="cl-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cl-description"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describe the change and its impact..."
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Cost Impact & Schedule Impact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cl-cost" className="block text-sm font-medium text-gray-700 mb-1">
                Cost Impact
              </label>
              <input
                id="cl-cost"
                type="number"
                value={form.costImpact}
                onChange={(e) => updateField('costImpact', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Positive = cost increase</p>
            </div>
            <div>
              <label htmlFor="cl-schedule" className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Impact (days)
              </label>
              <input
                id="cl-schedule"
                type="number"
                value={form.scheduleImpactDays}
                onChange={(e) => updateField('scheduleImpactDays', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Positive = delay</p>
            </div>
          </div>

          {/* Approved By */}
          <div>
            <label htmlFor="cl-approver" className="block text-sm font-medium text-gray-700 mb-1">
              Approved By
            </label>
            <input
              id="cl-approver"
              type="text"
              value={form.approvedBy ?? ''}
              onChange={(e) => updateField('approvedBy', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., PM name"
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
