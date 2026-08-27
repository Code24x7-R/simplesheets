// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Task Editor Modal
 *
 * Full-featured modal dialog for creating and editing WBS tasks.
 * Supports all task fields including dates, progress, effort, cost,
 * dependencies, resources, and custom fields.
 */

import { useState, useEffect } from 'react';
import type { WBSTask, Resource, EffortUnit, ApprovalGate } from '../types';
import { NumericInput } from '../../components/NumericInput';

interface TaskEditorModalProps {
  task: WBSTask | null; // null = create mode
  resources: Resource[];
  allTasks: WBSTask[];
  isChild?: boolean;
  onClose: () => void;
  onSave: (task: WBSTask) => void;
  onDelete?: (taskId: string) => void;
}

const EFFORT_UNITS: { value: EffortUnit; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'storyPoints', label: 'Story Points' },
];

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export function TaskEditorModal({
  task,
  resources,
  allTasks,
  isChild = false,
  onClose,
  onSave,
  onDelete,
}: TaskEditorModalProps) {
  const isNew = task === null;
  const [form, setForm] = useState<WBSTask>(
    task ?? {
      id: `task-${Date.now()}`,
      name: '',
      description: '',
      level: 0,
      parentId: null,
      children: [],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      duration: 1,
      progress: 0,
      effort: 0,
      effortUnit: 'hours',
      cost: 0,
      costCurrency: 'USD',
      responsibleResourceId: null,
      dependencies: [],
      isMilestone: false,
      isSummary: false,
      collapsed: false,
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      riskIds: [],
      approvalGates: [],
      customFields: {},
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form when task prop changes
  useEffect(() => {
    if (task) {
      setForm(task);
    }
  }, [task]);

  function updateField<K extends keyof WBSTask>(key: K, value: WBSTask[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-update duration when dates change
      if (key === 'startDate' || key === 'endDate') {
        const start = new Date((key === 'startDate' ? value : prev.startDate) + 'T00:00:00');
        const end = new Date((key === 'endDate' ? value : prev.endDate) + 'T00:00:00');
        next.duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      }
      // Sync milestone with duration = 1
      if (key === 'isMilestone' && value === true) {
        next.duration = 1;
        next.endDate = next.startDate;
      }
      return next;
    });
    // Clear error for this field
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Task name is required';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.endDate) newErrors.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (form.progress < 0 || form.progress > 100) newErrors.progress = 'Progress must be 0-100';
    if (form.effort < 0) newErrors.effort = 'Effort must be non-negative';
    if (form.cost < 0) newErrors.cost = 'Cost must be non-negative';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, name: form.name.trim() });
  }

  function handleDelete() {
    if (task && onDelete) {
      onDelete(task.id);
    }
  }

  // Predecessor options (exclude self and descendants to avoid cycles)
  const predecessorOptions = allTasks.filter((t) => t.id !== form.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="task-editor-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? (isChild ? 'Add Child Task' : 'Add Task') : 'Edit Task'}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`w-full border rounded px-3 py-2 text-sm ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter task name..."
              autoFocus
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={2}
              placeholder="Task description..."
            />
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.startDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                disabled={form.isMilestone}
                onChange={(e) => updateField('endDate', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.endDate ? 'border-red-500' : 'border-gray-300'
                } ${form.isMilestone ? 'bg-gray-100' : ''}`}
              />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <NumericInput
                value={form.duration}
                onChange={(v) => updateField('duration', Math.max(1, Math.round(v)))}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  form.isMilestone ? 'bg-gray-100' : 'border-gray-300'
                }`}
                min={1}
                disabled={form.isMilestone}
              />
            </div>
          </div>

          {/* Progress, Effort, Cost Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Progress (%)
              </label>
              <NumericInput
                value={form.progress}
                onChange={(v) => updateField('progress', Math.min(100, Math.max(0, Math.round(v))))}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.progress ? 'border-red-500' : 'border-gray-300'
                }`}
                min={0}
                max={100}
              />
              {errors.progress && <p className="text-red-500 text-xs mt-1">{errors.progress}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effort</label>
              <div className="flex gap-2">
                <NumericInput
                  value={form.effort}
                  onChange={(v) => updateField('effort', Math.max(0, Math.round(v)))}
                  className={`flex-1 border rounded px-3 py-2 text-sm ${
                    errors.effort ? 'border-red-500' : 'border-gray-300'
                  }`}
                  min={0}
                />
                <select
                  value={form.effortUnit}
                  onChange={(e) => updateField('effortUnit', e.target.value as EffortUnit)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[80px]"
                >
                  {EFFORT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.effort && <p className="text-red-500 text-xs mt-1">{errors.effort}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
              <NumericInput
                value={form.cost}
                onChange={(v) => updateField('cost', Math.max(0, v))}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.cost ? 'border-red-500' : 'border-gray-300'
                }`}
                min={0}
              />
              {errors.cost && <p className="text-red-500 text-xs mt-1">{errors.cost}</p>}
            </div>
          </div>

          {/* Resource + Color Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Resource</label>
              <select
                value={form.responsibleResourceId ?? ''}
                onChange={(e) => updateField('responsibleResourceId', e.target.value || null)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-1 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded border-2 ${
                      form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => updateField('color', c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Flags Row */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isMilestone}
                onChange={(e) => updateField('isMilestone', e.target.checked)}
              />
              Milestone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isSummary}
                disabled
                title="Summary status is automatic based on children"
              />
              Summary (auto)
            </label>
          </div>

          {/* Dependencies */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dependencies</label>
            {form.dependencies.length === 0 && (
              <p className="text-xs text-gray-400 mb-2">No dependencies</p>
            )}
            {form.dependencies.map((dep, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select
                  value={dep.predecessorId}
                  onChange={(e) => {
                    const next = [...form.dependencies];
                    next[idx] = { ...next[idx], predecessorId: e.target.value };
                    updateField('dependencies', next);
                  }}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {predecessorOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={dep.type}
                  onChange={(e) => {
                    const next = [...form.dependencies];
                    next[idx] = { ...next[idx], type: e.target.value as 'FS' | 'SS' | 'FF' | 'SF' };
                    updateField('dependencies', next);
                  }}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="FS">FS</option>
                  <option value="SS">SS</option>
                  <option value="FF">FF</option>
                  <option value="SF">SF</option>
                </select>
                <NumericInput
                  value={dep.lag}
                  onChange={(v) => {
                    const next = [...form.dependencies];
                    next[idx] = { ...next[idx], lag: Math.round(v) };
                    updateField('dependencies', next);
                  }}
                  className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="Lag"
                />
                <button
                  className="text-red-500 hover:text-red-700 text-sm"
                  onClick={() => {
                    const next = form.dependencies.filter((_, i) => i !== idx);
                    updateField('dependencies', next);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                const next = [...form.dependencies, { predecessorId: predecessorOptions[0]?.id ?? '', type: 'FS' as const, lag: 0 }];
                updateField('dependencies', next);
              }}
            >
              + Add Dependency
            </button>
          </div>

          {/* Approval Gates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approval Gates</label>
            {(!form.approvalGates || form.approvalGates.length === 0) && (
              <p className="text-xs text-gray-400 mb-2">No approval gates</p>
            )}
            {form.approvalGates?.map((gate, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select
                  value={gate.gateType}
                  onChange={(e) => {
                    const next = [...(form.approvalGates ?? [])];
                    next[idx] = { ...next[idx], gateType: e.target.value as ApprovalGate['gateType'] };
                    updateField('approvalGates', next);
                  }}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="approval">Approval</option>
                  <option value="review">Review</option>
                  <option value="sign_off">Sign-off</option>
                  <option value="external">External</option>
                </select>
                <span className={`text-xs px-2 py-1 rounded ${gate.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {gate.approved ? 'Approved' : 'Pending'}
                </span>
                {!gate.approved && (
                  <button
                    className="text-xs text-green-600 hover:underline"
                    onClick={() => {
                      const next = [...(form.approvalGates ?? [])];
                      next[idx] = {
                        ...next[idx],
                        approved: true,
                        approvedBy: 'Current User',
                        approvedDate: new Date().toISOString().slice(0, 10),
                      };
                      updateField('approvalGates', next);
                    }}
                  >
                    Approve
                  </button>
                )}
                <button
                  className="text-red-500 hover:text-red-700 text-sm"
                  onClick={() => {
                    const next = (form.approvalGates ?? []).filter((_, i) => i !== idx);
                    updateField('approvalGates', next);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                const newGate: ApprovalGate = {
                  taskId: form.id,
                  gateType: 'approval',
                  approved: false,
                  approvedBy: null,
                  approvedDate: null,
                  notes: '',
                };
                const next = [...(form.approvalGates ?? []), newGate];
                updateField('approvalGates', next);
              }}
            >
              + Add Approval Gate
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {!isNew && onDelete && (
              <button
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                onClick={handleDelete}
              >
                Delete Task
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              onClick={handleSave}
            >
              {isNew ? 'Add Task' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
