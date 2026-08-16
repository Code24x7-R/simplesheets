// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Dependency Drawer
 *
 * Slide-out panel for managing task dependencies with real-time impact preview.
 *
 * Features:
 * - Lists existing dependencies as editable cards
 * - Add new dependencies via task picker
 * - Inline edit of relationship type (FS/SS/FF/SF) and lag
 * - Impact preview showing schedule and cost deltas before committing
 * - Visual indicators for blocked/ready status
 */

import { useState, useMemo } from 'react';
import type { WBSTask, Resource, DependencyType, TaskDependency } from '../types';
import { calculateDependencyImpact, calculateScheduleShiftCost } from './projectAccounting';
import { isTaskBlocked, isTaskReady } from './dependencyWorkflows';
import { NumericInput } from '../../components/NumericInput';

interface DependencyDrawerProps {
  task: WBSTask;
  allTasks: WBSTask[];
  resources: Resource[];
  isOpen: boolean;
  onClose: () => void;
  onSaveDependencies: (taskId: string, dependencies: TaskDependency[]) => void;
}

/**
 * Get human-readable description for a dependency type.
 */
function getDependencyTypeDescription(type: DependencyType): string {
  switch (type) {
    case 'FS':
      return 'Predecessor must finish before this task can start';
    case 'SS':
      return 'Predecessor must start before this task can start';
    case 'FF':
      return 'Predecessor must finish before this task can finish';
    case 'SF':
      return 'Predecessor must start before this task can finish';
    default:
      return '';
  }
}

export function DependencyDrawer({
  task,
  allTasks,
  resources,
  isOpen,
  onClose,
  onSaveDependencies,
}: DependencyDrawerProps) {
  const [editedDeps, setEditedDeps] = useState<TaskDependency[]>(task.dependencies);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDepPredId, setNewDepPredId] = useState('');
  const [newDepType, setNewDepType] = useState<DependencyType>('FS');
  const [newDepLag, setNewDepLag] = useState(0);

  // Reset edited deps when task changes
  useMemo(() => {
    setEditedDeps(task.dependencies);
    setShowAddForm(false);
  }, [task.id, task.dependencies]);

  // Get task map for lookups
  const taskMap = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const resourceMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  // Filter out self and already-selected predecessors
  const availablePredecessors = allTasks.filter(
    (t) => t.id !== task.id && !editedDeps.some((d) => d.predecessorId === t.id),
  );

  // Calculate current blocked/ready status
  const currentlyBlocked = isTaskBlocked(task, allTasks);
  const currentlyReady = isTaskReady(task, allTasks);

  // Calculate impact of proposed changes
  const impactPreview = useMemo(() => {
    // Find dependencies that were added or modified
    let totalScheduleImpact = 0;
    let totalCostImpact = 0;
    const affectedTasks: string[] = [];

    for (const dep of editedDeps) {
      const pred = taskMap.get(dep.predecessorId);
      if (!pred) continue;

      const impact = calculateDependencyImpact(
        allTasks,
        dep.predecessorId,
        task.id,
        dep.type,
        dep.lag,
      );

      if (impact.scheduleImpactDays > 0) {
        totalScheduleImpact += impact.scheduleImpactDays;
        affectedTasks.push(...impact.affectedTaskIds);

        // Calculate cost impact
        const resource = task.responsibleResourceId ? resourceMap.get(task.responsibleResourceId) : null;
        if (resource) {
          totalCostImpact += calculateScheduleShiftCost(task, impact.scheduleImpactDays, resource);
        }
      }
    }

    return {
      scheduleImpactDays: totalScheduleImpact,
      costImpact: totalCostImpact,
      affectedTaskIds: affectedTasks,
    };
  }, [editedDeps, allTasks, task, taskMap, resourceMap]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (editedDeps.length !== task.dependencies.length) return true;
    for (let i = 0; i < editedDeps.length; i++) {
      const orig = task.dependencies[i];
      const edit = editedDeps[i];
      if (
        orig.predecessorId !== edit.predecessorId ||
        orig.type !== edit.type ||
        orig.lag !== edit.lag
      ) {
        return true;
      }
    }
    return false;
  }, [editedDeps, task.dependencies]);

  function handleAddDep() {
    if (!newDepPredId) return;
    const newDep: TaskDependency = {
      predecessorId: newDepPredId,
      type: newDepType,
      lag: newDepLag,
    };
    setEditedDeps([...editedDeps, newDep]);
    setNewDepPredId('');
    setNewDepType('FS');
    setNewDepLag(0);
    setShowAddForm(false);
  }

  function handleRemoveDep(index: number) {
    setEditedDeps(editedDeps.filter((_, i) => i !== index));
  }

  function handleUpdateDep(index: number, updates: Partial<TaskDependency>) {
    const next = [...editedDeps];
    next[index] = { ...next[index], ...updates };
    setEditedDeps(next);
  }

  function handleSave() {
    onSaveDependencies(task.id, editedDeps);
  }

  function handleReset() {
    setEditedDeps(task.dependencies);
    setShowAddForm(false);
  }

  if (!isOpen) return null;

  const resource = task.responsibleResourceId ? resourceMap.get(task.responsibleResourceId) : null;

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full shadow-lg" data-testid="dependency-drawer">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Dependencies</h3>
          <button
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 truncate">{task.name}</p>
      </div>

      {/* Task Status Banner */}
      <div className={`px-4 py-2 border-b border-gray-200 text-xs ${
        currentlyBlocked ? 'bg-yellow-50' : currentlyReady ? 'bg-green-50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            currentlyBlocked ? 'bg-yellow-500' : currentlyReady ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <span className="font-medium">
            {currentlyBlocked ? 'Blocked by predecessors' : currentlyReady ? 'Ready to start' : 'No dependencies'}
          </span>
        </div>
        <div className="mt-1 text-gray-500">
          {task.startDate} → {task.endDate}
          {resource && <span className="ml-2">| {resource.name}</span>}
        </div>
      </div>

      {/* Dependencies List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Predecessors ({editedDeps.length})
        </div>

        {editedDeps.length === 0 && (
          <p className="text-xs text-gray-400 italic">No dependencies defined</p>
        )}

        {editedDeps.map((dep, index) => {
          const pred = taskMap.get(dep.predecessorId);
          if (!pred) return null;

          const predResource = pred.responsibleResourceId ? resourceMap.get(pred.responsibleResourceId) : null;
          const predComplete = pred.status === 'done';

          return (
            <div
              key={`${dep.predecessorId}-${index}`}
              className="border border-gray-200 rounded-lg p-3 bg-white hover:border-blue-300 transition-colors"
            >
              {/* Predecessor Name + Status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${predComplete ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-800 truncate" title={pred.name}>
                    {pred.name}
                  </span>
                </div>
                <button
                  className="text-gray-400 hover:text-red-500 text-xs"
                  onClick={() => handleRemoveDep(index)}
                  title="Remove dependency"
                >
                  ×
                </button>
              </div>

              {/* Relationship Type + Lag */}
              <div className="flex gap-2 items-center">
                <select
                  value={dep.type}
                  onChange={(e) => handleUpdateDep(index, { type: e.target.value as DependencyType })}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="FS">FS - Finish-to-Start</option>
                  <option value="SS">SS - Start-to-Start</option>
                  <option value="FF">FF - Finish-to-Finish</option>
                  <option value="SF">SF - Start-to-Finish</option>
                </select>
                <div className="flex items-center gap-1">
                  <NumericInput
                    value={dep.lag}
                    onChange={(v) => handleUpdateDep(index, { lag: Math.round(v) })}
                    className="w-14 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                    title="Lag days (negative = lead)"
                  />
                  <span className="text-xs text-gray-400">days</span>
                </div>
              </div>

              {/* Type description */}
              <div className="mt-1 text-xs text-gray-400 italic">
                {getDependencyTypeDescription(dep.type)}
              </div>

              {/* Predecessor dates */}
              <div className="mt-0.5 text-xs text-gray-400">
                {pred.startDate} → {pred.endDate}
                {predResource && <span className="ml-1">({predResource.name})</span>}
              </div>
            </div>
          );
        })}

        {/* Add Dependency Form */}
        {showAddForm ? (
          <div className="border border-blue-300 rounded-lg p-3 bg-blue-50">
            <div className="text-xs font-medium text-blue-700 mb-2">Add New Dependency</div>

            {/* Predecessor Picker */}
            <select
              value={newDepPredId}
              onChange={(e) => setNewDepPredId(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs mb-2"
            >
              <option value="">Select predecessor...</option>
              {availablePredecessors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Type + Lag */}
            <div className="flex gap-2 mb-2">
              <select
                value={newDepType}
                onChange={(e) => setNewDepType(e.target.value as DependencyType)}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="FS">FS - Finish-to-Start</option>
                <option value="SS">SS - Start-to-Start</option>
                <option value="FF">FF - Finish-to-Finish</option>
                <option value="SF">SF - Start-to-Finish</option>
              </select>
              <NumericInput
                value={newDepLag}
                onChange={(v) => setNewDepLag(Math.round(v))}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                placeholder="Lag"
                title="Lag days (negative = lead)"
              />
            </div>

            {/* Type description */}
            <div className="text-xs text-gray-400 italic mb-2">
              {getDependencyTypeDescription(newDepType)}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button
                className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleAddDep}
                disabled={!newDepPredId}
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full py-2 text-xs text-blue-600 border border-dashed border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
            onClick={() => setShowAddForm(true)}
            disabled={availablePredecessors.length === 0}
          >
            + Add Dependency
          </button>
        )}
      </div>

      {/* Impact Preview */}
      {hasChanges && (
        <div className="px-4 py-3 border-t border-gray-200 bg-amber-50">
          <div className="text-xs font-medium text-amber-800 mb-1">Impact Preview</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Schedule:</span>
              <span className={impactPreview.scheduleImpactDays > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                {impactPreview.scheduleImpactDays > 0
                  ? `+${impactPreview.scheduleImpactDays} days`
                  : 'No shift'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cost:</span>
              <span className={impactPreview.costImpact > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                {impactPreview.costImpact > 0
                  ? `+$${impactPreview.costImpact.toLocaleString()}`
                  : 'No impact'}
              </span>
            </div>
            {impactPreview.affectedTaskIds.length > 1 && (
              <div className="text-gray-500 mt-1">
                Affects {impactPreview.affectedTaskIds.length} successor tasks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between">
        <button
          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
          onClick={handleReset}
          disabled={!hasChanges}
        >
          Reset
        </button>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
