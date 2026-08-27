// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Resource Editor Modal
 *
 * Modal dialog for creating and editing project resources.
 * Supports name, role, cost rate, availability, and color.
 */

import { useState, useEffect } from 'react';
import type { Resource } from '../types';
import { getEffectiveCurrency, SUPPORTED_CURRENCIES } from '../../utils/currency';
import { NumericInput } from '../../components/NumericInput';

interface ResourceEditorModalProps {
  resource: Resource | null; // null = create mode
  onClose: () => void;
  onSave: (resource: Resource) => void;
  onDelete?: (resourceId: string) => void;
}

const COLOR_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

export function ResourceEditorModal({
  resource,
  onClose,
  onSave,
  onDelete,
}: ResourceEditorModalProps) {
  const [form, setForm] = useState<Resource>({
    id: '',
    name: '',
    role: '',
    costRate: 0,
    costCurrency: getEffectiveCurrency(),
    availability: 100,
    color: '#3B82F6',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when editing
  useEffect(() => {
    if (resource) {
      setForm(resource);
    }
  }, [resource]);

  function updateField<K extends keyof Resource>(key: K, value: Resource[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error on change
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Resource name is required';
    }
    if (form.costRate < 0) {
      newErrors.costRate = 'Cost rate cannot be negative';
    }
    if (form.availability < 0 || form.availability > 100) {
      newErrors.availability = 'Availability must be between 0 and 100';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(form);
  }

  function handleDelete() {
    if (resource && onDelete) {
      onDelete(resource.id);
    }
  }

  const isEditing = resource !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Resource' : 'Add Resource'}
          </h2>
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
          {/* Name */}
          <div>
            <label htmlFor="resource-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              id="resource-name"
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Alice Smith"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Role */}
          <div>
            <label htmlFor="resource-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              id="resource-role"
              type="text"
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Developer, Designer, QA"
            />
          </div>

          {/* Cost Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="resource-cost-rate" className="block text-sm font-medium text-gray-700 mb-1">
                Cost Rate
              </label>
              <NumericInput
                id="resource-cost-rate"
                value={form.costRate}
                onChange={(v) => updateField('costRate', v)}
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.costRate ? 'border-red-500' : 'border-gray-300'
                }`}
                min={0}
                step={1}
              />
              {errors.costRate && <p className="text-red-500 text-xs mt-1">{errors.costRate}</p>}
            </div>
            <div>
              <label htmlFor="resource-currency" className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                id="resource-currency"
                value={form.costCurrency}
                onChange={(e) => updateField('costCurrency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability */}
          <div>
            <label htmlFor="resource-availability" className="block text-sm font-medium text-gray-700 mb-1">
              Availability (%)
            </label>
            <NumericInput
              id="resource-availability"
              value={form.availability}
              onChange={(v) => updateField('availability', v)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.availability ? 'border-red-500' : 'border-gray-300'
              }`}
              min={0}
              max={100}
              step={5}
            />
            {errors.availability && <p className="text-red-500 text-xs mt-1">{errors.availability}</p>}
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => updateField('color', color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    form.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <div>
            {isEditing && onDelete && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              {isEditing ? 'Update' : 'Add Resource'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
