// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Capitalization Configuration Modal
 *
 * Configure material capitalization thresholds:
 * - Threshold amount (items above this are CapEx)
 * - Default useful life (months)
 * - Default depreciation method
 * - Default salvage percentage
 */

import { useState, useEffect } from 'react';
import type { CapitalizationConfig, DepreciationMethod } from '../types';
import { NumericInput } from '../../components/NumericInput';

interface CapitalizationConfigModalProps {
  config: CapitalizationConfig;
  onClose: () => void;
  onSave: (config: CapitalizationConfig) => void;
}

const DEPRECIATION_METHODS: { value: DepreciationMethod; label: string; desc: string }[] = [
  { value: 'straight-line', label: 'Straight-Line', desc: 'Equal depreciation each month' },
  { value: 'declining-balance', label: 'Declining Balance', desc: 'Higher depreciation in early months' },
  { value: 'none', label: 'None', desc: 'No depreciation (expense immediately)' },
];

export function CapitalizationConfigModal({
  config,
  onClose,
  onSave,
}: CapitalizationConfigModalProps) {
  const [form, setForm] = useState<CapitalizationConfig>(config);

  // Sync form when config prop changes
  useEffect(() => {
    setForm(config);
  }, [config]);

  function updateField<K extends keyof CapitalizationConfig>(key: K, value: CapitalizationConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="capitalization-config-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Capitalization Settings
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
          {/* Threshold */}
          <div>
            <label htmlFor="cap-threshold" className="block text-sm font-medium text-gray-700 mb-1">
              Capitalization Threshold
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">{form.currency}</span>
              <NumericInput
                id="cap-threshold"
                value={form.threshold}
                onChange={(v) => updateField('threshold', Math.max(0, v))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                min={0}
                step={100}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Items with total cost ≥ this amount are classified as CapEx
            </p>
          </div>

          {/* Default Useful Life */}
          <div>
            <label htmlFor="cap-life" className="block text-sm font-medium text-gray-700 mb-1">
              Default Useful Life (months)
            </label>
            <NumericInput
              id="cap-life"
              value={form.defaultUsefulLifeMonths}
              onChange={(v) => updateField('defaultUsefulLifeMonths', Math.max(1, Math.round(v)))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              min={1}
            />
            <p className="text-xs text-gray-400 mt-1">
              Used for new CapEx assets
            </p>
          </div>

          {/* Default Depreciation Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Depreciation Method
            </label>
            <div className="space-y-2">
              {DEPRECIATION_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => updateField('defaultDepreciationMethod', method.value)}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    form.defaultDepreciationMethod === method.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800">{method.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{method.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Default Salvage Percentage */}
          <div>
            <label htmlFor="cap-salvage" className="block text-sm font-medium text-gray-700 mb-1">
              Default Salvage Value (%)
            </label>
            <NumericInput
              id="cap-salvage"
              value={form.defaultSalvagePercent}
              onChange={(v) => updateField('defaultSalvagePercent', Math.min(100, Math.max(0, v)))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              min={0}
              max={100}
              step={5}
            />
            <p className="text-xs text-gray-400 mt-1">
              Percentage of cost retained as salvage value
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
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
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
