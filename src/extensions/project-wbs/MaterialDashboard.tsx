// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Material Management Dashboard
 *
 * Displays materials with CapEx/OpEx/Consumable classification:
 * - Material registry with classification badges
 * - Allocation tracking (material → task)
 * - Consumption tracking with wastage
 * - Depreciation status for CapEx
 * - Carrying costs summary
 */

import { useState, useMemo } from 'react';
import type { Project, Material, MaterialClassification } from '../types';
import { calculateMaterialCostSummary } from './materialEngine';
import { formatCurrency } from '../../utils/currency';

interface MaterialDashboardProps {
  project: Project;
  onAddMaterial?: () => void;
  onEditMaterial?: (materialId: string) => void;
  onDeleteMaterial?: (materialId: string) => void;
  onAllocateMaterial?: (materialId: string) => void;
  onConfig?: () => void;
}

type MaterialFilter = 'all' | MaterialClassification;

export function MaterialDashboard({ project, onAddMaterial, onEditMaterial, onDeleteMaterial, onAllocateMaterial, onConfig }: MaterialDashboardProps) {
  const [filter, setFilter] = useState<MaterialFilter>('all');

  const materials = project.materials ?? [];
  const summary = useMemo(() => calculateMaterialCostSummary(project), [project]);

  const filteredMaterials = filter === 'all'
    ? materials
    : materials.filter((m) => m.classification === filter);

  const currency = project.accounting?.currency ?? 'USD';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Materials & Assets</h3>
          <div className="flex items-center gap-2">
            {onConfig && (
              <button
                className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                onClick={onConfig}
                title="Configure capitalization threshold"
              >
                ⚙️ Settings
              </button>
            )}
            {onAddMaterial && (
              <button
                className="px-3 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                onClick={onAddMaterial}
              >
                + Add Material
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-gray-100">
        <KpiCard
          label="CapEx"
          value={formatCurrency(summary.totalCapEx, currency)}
          sublabel={`Book: ${formatCurrency(summary.bookValue, currency)}`}
          color="purple"
        />
        <KpiCard
          label="OpEx"
          value={formatCurrency(summary.totalOpEx, currency)}
          sublabel={`Monthly: ${formatCurrency(summary.monthlyOpExBurn, currency)}`}
          color="blue"
        />
        <KpiCard
          label="Consumables"
          value={formatCurrency(summary.totalConsumables, currency)}
          sublabel={`Wastage: ${summary.wastagePercent.toFixed(1)}%`}
          color="green"
        />
        <KpiCard
          label="Carrying"
          value={formatCurrency(summary.totalCarryingCosts, currency)}
          sublabel={`TCO: ${formatCurrency(summary.totalCapExTCO, currency)}`}
          color="orange"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 px-4">
        {(['all', 'capex', 'opex', 'consumable'] as MaterialFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium capitalize ${
              filter === f
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <span className="ml-auto px-3 py-2 text-xs text-gray-400">
          {filteredMaterials.length} items
        </span>
      </div>

      {/* Materials Table */}
      <div className="overflow-x-auto">
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No materials registered.</p>
            <p className="text-xs mt-1">Add materials to track CapEx, OpEx, and consumables.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-center font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit Cost</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Used</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  currency={currency}
                  onEdit={onEditMaterial}
                  onDelete={onDeleteMaterial}
                  onAllocate={onAllocateMaterial}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: 'purple' | 'blue' | 'green' | 'orange';
}) {
  const colors = {
    purple: 'border-purple-200 bg-purple-50',
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50',
  };

  return (
    <div className={`rounded-lg border p-2 ${colors[color]}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-400">{sublabel}</div>
    </div>
  );
}

// ─── Material Row ────────────────────────────────────────────────────────────

function MaterialRow({
  material,
  currency,
  onEdit,
  onDelete,
  onAllocate,
}: {
  material: Material;
  currency: string;
  onEdit?: (materialId: string) => void;
  onDelete?: (materialId: string) => void;
  onAllocate?: (materialId: string) => void;
}) {
  const classificationBadge = {
    capex: 'bg-purple-100 text-purple-700',
    opex: 'bg-blue-100 text-blue-700',
    consumable: 'bg-green-100 text-green-700',
  };

  const totalCost = material.unitCost * material.quantity;
  const usedPercent = material.quantity > 0
    ? ((material.consumedQuantity + material.allocatedQuantity) / material.quantity) * 100
    : 0;

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-gray-800">{material.name}</div>
        {material.vendor && (
          <div className="text-xs text-gray-400">{material.vendor}</div>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${classificationBadge[material.classification]}`}>
          {material.classification.toUpperCase()}
        </span>
      </td>
      <td className="px-3 py-2 text-right">{material.quantity} {material.unit}</td>
      <td className="px-3 py-2 text-right font-mono">{formatCurrency(material.unitCost, currency)}</td>
      <td className="px-3 py-2 text-right font-mono">{formatCurrency(totalCost, currency)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(100, usedPercent)}%` }}
            />
          </div>
          <span className="text-gray-500">{usedPercent.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`text-xs ${
          material.status === 'in-use' ? 'text-blue-600' :
          material.status === 'delivered' ? 'text-green-600' :
          material.status === 'returned' ? 'text-gray-500' :
          'text-gray-400'
        }`}>
          {material.status}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-2">
          {onAllocate && (
            <button
              onClick={() => onAllocate(material.id)}
              className="text-green-600 hover:text-green-800 text-xs"
              title="Allocate to a task"
            >
              Allocate
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(material.id)}
              className="text-blue-600 hover:text-blue-800 text-xs"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(material.id)}
              className="text-red-600 hover:text-red-800 text-xs"
              title="Delete material"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}


