// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Baseline Editor Modal
 *
 * Modal dialog for defining the project baseline (cost and duration)
 * for individual tasks.  The baseline is the original approved plan
 * against which cost and schedule variance are measured.
 */

import { useState, useEffect } from 'react';
import { NumericInput } from '../../components/NumericInput';
import type { TaskAccounting } from '../types';

interface BaselineEditorModalProps {
  task: TaskAccounting;
  currency: string;
  onClose: () => void;
  onSave: (taskId: string, baselineCost: number, baselineDuration: number) => void;
}

export function BaselineEditorModal({
  task,
  currency,
  onClose,
  onSave,
}: BaselineEditorModalProps) {
  const [baselineCost, setBaselineCost] = useState(task.baselineCost);
  const [baselineDuration, setBaselineDuration] = useState(task.baselineDuration);

  // Sync local state when the task prop changes
  useEffect(() => {
    setBaselineCost(task.baselineCost);
    setBaselineDuration(task.baselineDuration);
  }, [task]);

  function handleSave() {
    onSave(task.taskId, baselineCost, baselineDuration);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Baseline</h2>
            <p className="text-sm text-gray-500 mt-0.5">{task.taskName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Current values info */}
          <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>Current Estimate (EAC):</span>
              <span className="font-mono font-medium">{currency} {task.currentEstimate.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Actual Spend:</span>
              <span className="font-mono font-medium">{currency} {task.actualSpend.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Progress:</span>
              <span className="font-mono font-medium">{task.progress}%</span>
            </div>
          </div>

          {/* Baseline Cost */}
          <div>
            <label htmlFor="baseline-cost" className="block text-sm font-medium text-gray-700 mb-1">
              Baseline Cost *
            </label>
            <NumericInput
              id="baseline-cost"
              value={baselineCost}
              onChange={setBaselineCost}
              min={0}
              step={100}
              placeholder="0.00"
              aria-label="Baseline cost"
            />
            <p className="text-xs text-gray-400 mt-1">
              Original approved budget for this task (including materials).
            </p>
          </div>

          {/* Baseline Duration */}
          <div>
            <label htmlFor="baseline-duration" className="block text-sm font-medium text-gray-700 mb-1">
              Baseline Duration *
            </label>
            <NumericInput
              id="baseline-duration"
              value={baselineDuration}
              onChange={(v) => setBaselineDuration(Math.round(v))}
              min={1}
              step={1}
              placeholder="1"
              aria-label="Baseline duration in working days"
            />
            <p className="text-xs text-gray-400 mt-1">
              Original approved duration in working days.
            </p>
          </div>

          {/* Preview variance */}
          <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-800 space-y-1">
            <div className="font-medium text-blue-900">Variance Preview</div>
            <div className="flex justify-between">
              <span>Cost Variance:</span>
              <span className={`font-mono font-medium ${task.currentEstimate - baselineCost >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {currency} {(task.currentEstimate - baselineCost).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Duration Variance:</span>
              <span className={`font-mono font-medium ${task.currentDuration - baselineDuration >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {task.currentDuration - baselineDuration}d
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save Baseline
          </button>
        </div>
      </div>
    </div>
  );
}
