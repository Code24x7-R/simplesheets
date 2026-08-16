// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Repository
/**
 * Material Editor Modal
 *
 * Create and edit materials with:
 * - Classification (CapEx/OpEx/Consumable)
 * - Cost fields (unit cost, quantity, vendor)
 * - CapEx fields (depreciation, useful life, salvage value)
 * - OpEx fields (billing period, rental rate, lease dates)
 * - Consumable fields (wastage rate, carrying cost, reorder point)
 */

import { useState, useEffect } from 'react';
import type { Material, MaterialClassification, DepreciationMethod, BillingPeriod } from '../types';
import { DEFAULT_CAPITALIZATION_CONFIG } from './materialEngine';
import { NumericInput } from '../../components/NumericInput';

interface MaterialEditorModalProps {
  material: Material | null; // null = create mode
  config?: { threshold: number; currency: string; defaultUsefulLifeMonths?: number; defaultDepreciationMethod?: DepreciationMethod };
  onClose: () => void;
  onSave: (material: Material) => void;
  onDelete?: (materialId: string) => void;
}

const CLASSIFICATIONS: { value: MaterialClassification; label: string; desc: string }[] = [
  { value: 'capex', label: 'CapEx', desc: 'Capitalized & depreciated (e.g., machinery, vehicles)' },
  { value: 'opex', label: 'OpEx', desc: 'Expensed in period (e.g., rentals, subscriptions)' },
  { value: 'consumable', label: 'Consumable', desc: 'Expensed as used (e.g., lumber, fuel)' },
];

const DEPRECIATION_METHODS: { value: DepreciationMethod; label: string }[] = [
  { value: 'straight-line', label: 'Straight-Line' },
  { value: 'declining-balance', label: 'Declining Balance' },
  { value: 'none', label: 'None' },
];

const BILLING_PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'fixed', label: 'Fixed' },
];

export function MaterialEditorModal({
  material,
  config = DEFAULT_CAPITALIZATION_CONFIG,
  onClose,
  onSave,
  onDelete,
}: MaterialEditorModalProps) {
  const isNew = material === null;

  const [form, setForm] = useState<Material>(
    material ?? {
      id: `mat-${Date.now()}`,
      name: '',
      description: '',
      classification: 'consumable',
      unit: 'each',
      unitCost: 0,
      quantity: 1,
      currency: config.currency,
      vendor: null,
      depreciationMethod: config.defaultDepreciationMethod ?? 'straight-line',
      usefulLifeMonths: config.defaultUsefulLifeMonths ?? 36,
      salvageValue: 0,
      acquisitionDate: null,
      billingPeriod: 'daily',
      rentalRate: 0,
      leaseStartDate: null,
      leaseEndDate: null,
      wastageRate: 0,
      reorderPoint: 0,
      carryingCostPerUnit: 0,
      allocatedQuantity: 0,
      consumedQuantity: 0,
      status: 'ordered',
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form when material prop changes
  useEffect(() => {
    if (material) {
      setForm(material);
    }
  }, [material]);

  function updateField<K extends keyof Material>(key: K, value: Material[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Material name is required';
    if (form.unitCost < 0) newErrors.unitCost = 'Unit cost must be non-negative';
    if (form.quantity <= 0) newErrors.quantity = 'Quantity must be positive';

    if (form.classification === 'capex') {
      if (form.usefulLifeMonths <= 0) newErrors.usefulLifeMonths = 'Useful life must be positive';
      if (form.salvageValue < 0) newErrors.salvageValue = 'Salvage value must be non-negative';
      if (form.salvageValue > form.unitCost * form.quantity) {
        newErrors.salvageValue = 'Salvage value cannot exceed total cost';
      }
    }

    if (form.classification === 'opex') {
      if (form.rentalRate < 0) newErrors.rentalRate = 'Rental rate must be non-negative';
    }

    if (form.classification === 'consumable') {
      if (form.wastageRate < 0 || form.wastageRate > 100) {
        newErrors.wastageRate = 'Wastage rate must be 0-100%';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, name: form.name.trim() });
  }

  function handleDelete() {
    if (material && onDelete) {
      onDelete(material.id);
    }
  }

  // Auto-calculate salvage value based on percentage
  const totalCost = form.unitCost * form.quantity;
  const salvagePercent = totalCost > 0 ? (form.salvageValue / totalCost) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="material-editor-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Add Material' : 'Edit Material'}
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
          {/* Name & Description */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Excavator, Steel Beams, Fuel"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input
                type="text"
                value={form.vendor ?? ''}
                onChange={(e) => updateField('vendor', e.target.value || null)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Supplier name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={2}
              placeholder="Material description..."
            />
          </div>

          {/* Classification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {CLASSIFICATIONS.map((cls) => (
                <button
                  key={cls.value}
                  type="button"
                  onClick={() => updateField('classification', cls.value)}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    form.classification === cls.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800">{cls.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{cls.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Common Cost Fields */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={form.quantity}
                onChange={(v) => updateField('quantity', Math.max(1, Math.round(v)))}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.quantity ? 'border-red-500' : 'border-gray-300'
                }`}
                min={1}
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => updateField('unit', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="each, kg, hrs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Cost <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={form.unitCost}
                onChange={(v) => updateField('unitCost', Math.max(0, v))}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.unitCost ? 'border-red-500' : 'border-gray-300'
                }`}
                min={0}
                step={0.01}
              />
              {errors.unitCost && <p className="text-red-500 text-xs mt-1">{errors.unitCost}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Cost</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono">
                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* CapEx-specific fields */}
          {form.classification === 'capex' && (
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <div className="text-sm font-medium text-purple-800 mb-3">CapEx Settings</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
                  <select
                    value={form.depreciationMethod}
                    onChange={(e) => updateField('depreciationMethod', e.target.value as DepreciationMethod)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    {DEPRECIATION_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Useful Life (months) <span className="text-red-500">*</span>
                  </label>
                  <NumericInput
                    value={form.usefulLifeMonths}
                    onChange={(v) => updateField('usefulLifeMonths', Math.max(1, Math.round(v)))}
                    className={`w-full border rounded px-3 py-2 text-sm ${
                      errors.usefulLifeMonths ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min={1}
                  />
                  {errors.usefulLifeMonths && <p className="text-red-500 text-xs mt-1">{errors.usefulLifeMonths}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salvage Value ($)
                  </label>
                  <NumericInput
                    value={form.salvageValue}
                    onChange={(v) => updateField('salvageValue', Math.max(0, v))}
                    className={`w-full border rounded px-3 py-2 text-sm ${
                      errors.salvageValue ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min={0}
                    step={0.01}
                  />
                  {errors.salvageValue && <p className="text-red-500 text-xs mt-1">{errors.salvageValue}</p>}
                  <p className="text-xs text-gray-400 mt-1">{salvagePercent.toFixed(1)}% of total</p>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Date</label>
                <input
                  type="date"
                  value={form.acquisitionDate ?? ''}
                  onChange={(e) => updateField('acquisitionDate', e.target.value || null)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* OpEx-specific fields */}
          {form.classification === 'opex' && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="text-sm font-medium text-blue-800 mb-3">OpEx Settings</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Period</label>
                  <select
                    value={form.billingPeriod}
                    onChange={(e) => updateField('billingPeriod', e.target.value as BillingPeriod)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    {BILLING_PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rental Rate ($) <span className="text-red-500">*</span>
                  </label>
                  <NumericInput
                    value={form.rentalRate}
                    onChange={(v) => updateField('rentalRate', Math.max(0, v))}
                    className={`w-full border rounded px-3 py-2 text-sm ${
                      errors.rentalRate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min={0}
                    step={0.01}
                  />
                  {errors.rentalRate && <p className="text-red-500 text-xs mt-1">{errors.rentalRate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value as Material['status'])}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="ordered">Ordered</option>
                    <option value="delivered">Delivered</option>
                    <option value="in-use">In Use</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lease Start</label>
                  <input
                    type="date"
                    value={form.leaseStartDate ?? ''}
                    onChange={(e) => updateField('leaseStartDate', e.target.value || null)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lease End</label>
                  <input
                    type="date"
                    value={form.leaseEndDate ?? ''}
                    onChange={(e) => updateField('leaseEndDate', e.target.value || null)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Consumable-specific fields */}
          {form.classification === 'consumable' && (
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <div className="text-sm font-medium text-green-800 mb-3">Consumable Settings</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wastage Rate (%)
                  </label>
                  <NumericInput
                    value={form.wastageRate}
                    onChange={(v) => updateField('wastageRate', Math.min(100, Math.max(0, v)))}
                    className={`w-full border rounded px-3 py-2 text-sm ${
                      errors.wastageRate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min={0}
                    max={100}
                    step={0.1}
                  />
                  {errors.wastageRate && <p className="text-red-500 text-xs mt-1">{errors.wastageRate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carrying Cost ($/unit/mo)
                  </label>
                  <NumericInput
                    value={form.carryingCostPerUnit}
                    onChange={(v) => updateField('carryingCostPerUnit', Math.max(0, v))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    min={0}
                    step={0.01}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reorder Point
                  </label>
                  <NumericInput
                    value={form.reorderPoint}
                    onChange={(v) => updateField('reorderPoint', Math.max(0, Math.round(v)))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    min={0}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {!isNew && onDelete && (
              <button
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                onClick={handleDelete}
              >
                Delete Material
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
              {isNew ? 'Add Material' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
