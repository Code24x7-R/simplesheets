// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Accounting Dashboard
 *
 * Four-table cost tracking view:
 * 1. Baseline — Original approved plan
 * 2. Approved Allocation — Budget approved per task
 * 3. Current Estimate — Rolling forecast (EAC)
 * 4. Actual Spend — Real costs incurred
 *
 * Shows variance columns and earned value metrics (CPI/SPI).
 */

import { useState, useMemo } from 'react';
import type { Project } from '../types';
import {
  computeProjectAccounting,
  formatVariance,
  formatPerformanceIndex,
} from './projectAccounting';


interface AccountingDashboardProps {
  project: Project;
  onEditSpend?: (entryId: string) => void;
  onDeleteSpend?: (entryId: string) => void;
  onEditAllocation?: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onAddChange?: () => void;
  onEditChange?: (entryId: string) => void;
  onDeleteChange?: (entryId: string) => void;
}

type AccountingTab = 'baseline' | 'allocation' | 'estimate' | 'actual' | 'changelog';

export function AccountingDashboard({ project, onEditSpend, onDeleteSpend, onEditAllocation, onTaskClick, onAddChange, onEditChange, onDeleteChange }: AccountingDashboardProps) {
  const [activeTab, setActiveTab] = useState<AccountingTab>('estimate');

  const accounting = useMemo(() => computeProjectAccounting(project), [project]);
  const currency = accounting.currency;

  // Build task ID → name lookup for the actuals table
  const taskNamesById = useMemo(() => {
    const map = new Map<string, string>();
    const collect = (tasks: { id: string; name: string; children: unknown[] }[]) => {
      for (const t of tasks) {
        map.set(t.id, t.name);
        if (t.children.length > 0) collect(t.children as { id: string; name: string; children: unknown[] }[]);
      }
    };
    collect(project.wbs);
    return map;
  }, [project.wbs]);

  // Project-level metrics
  // Earned Value = Σ(baselineCost × progress%) from per-task accounting
  const totalEarnedValue = accounting.taskAccounting.reduce(
    (sum, t) => sum + t.baselineCost * (t.progress / 100),
    0,
  );
  const projectCPI = accounting.actualSpendTotal > 0
    ? totalEarnedValue / accounting.actualSpendTotal
    : 1;
  const projectSPI = 1; // Simplified — would need planned value by date
  const materialCostTotal = accounting.materialCostTotal;

  const tabs: { key: AccountingTab; label: string; icon: string }[] = [
    { key: 'baseline', label: 'Baseline', icon: '📋' },
    { key: 'allocation', label: 'Allocated', icon: '💰' },
    { key: 'estimate', label: 'Estimate', icon: '📊' },
    { key: 'actual', label: 'Actuals', icon: '🧾' },
    { key: 'changelog', label: 'Change Log', icon: '📝' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header with KPIs */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Project Accounting</h3>
          <div className="flex gap-4 text-xs">
            <KpiBadge
              label="CPI"
              value={projectCPI.toFixed(2)}
              status={formatPerformanceIndex(projectCPI).status}
            />
            <KpiBadge
              label="SPI"
              value={projectSPI.toFixed(2)}
              status={formatPerformanceIndex(projectSPI).status}
            />
            <span className="text-gray-500">
              Baseline: <strong>{currency} {accounting.baselineTotal.toLocaleString()}</strong>
            </span>
            {materialCostTotal > 0 && (
              <span className="text-gray-500">
                Materials: <strong className="text-purple-600">{currency} {materialCostTotal.toLocaleString()}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation — grouped into Planning and Execution */}
      <div className="border-b border-gray-200">
        {/* Planning section */}
        <div className="flex items-center">
          <span className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-r border-gray-200">
            Planning
          </span>
          {tabs.filter((t) => ['baseline', 'allocation', 'estimate'].includes(t.key)).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        {/* Execution section */}
        <div className="flex items-center border-t border-gray-100">
          <span className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-r border-gray-200">
            Execution
          </span>
          {tabs.filter((t) => ['actual', 'changelog'].includes(t.key)).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto">
        {activeTab === 'baseline' && <BaselineTable accounting={accounting} currency={currency} onTaskClick={onTaskClick} />}
        {activeTab === 'allocation' && (
          <AllocationTable accounting={accounting} currency={currency} onEdit={onEditAllocation} onTaskClick={onTaskClick} />
        )}
        {activeTab === 'estimate' && <EstimateTable accounting={accounting} currency={currency} onTaskClick={onTaskClick} />}
        {activeTab === 'actual' && <ActualsTable accounting={accounting} currency={currency} onEdit={onEditSpend} onDelete={onDeleteSpend} taskNamesById={taskNamesById} />}
        {activeTab === 'changelog' && (
          <ChangeLogTable
            accounting={accounting}
            currency={currency}
            onAddChange={onAddChange}
            onEditChange={onEditChange}
            onDeleteChange={onDeleteChange}
          />
        )}
      </div>

      {/* Footer totals */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between text-xs">
        <span className="text-gray-500">{accounting.taskAccounting.length} tasks</span>
        <div className="flex gap-4">
          <span className="text-gray-600">
            Variance: <strong className={accounting.currentEstimateTotal - accounting.baselineTotal >= 0 ? 'text-red-600' : 'text-green-600'}>
              {formatVariance(accounting.currentEstimateTotal - accounting.baselineTotal, currency)}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Badge ───────────────────────────────────────────────────────────────

function KpiBadge({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'critical' }) {
  const colors = {
    good: 'text-green-700 bg-green-50 border-green-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    critical: 'text-red-700 bg-red-50 border-red-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded border font-medium ${colors[status]}`}>
      {label}: {value}
    </span>
  );
}

// ─── Baseline Table ──────────────────────────────────────────────────────────

function BaselineTable({ accounting, currency, onTaskClick }: { accounting: ReturnType<typeof computeProjectAccounting>; currency: string; onTaskClick?: (taskId: string) => void }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 text-gray-600">
          <th className="px-3 py-2 text-left font-medium">Task</th>
          <th className="px-3 py-2 text-right font-medium">Cost</th>
          <th className="px-3 py-2 text-right font-medium">Duration</th>
          <th className="px-3 py-2 text-right font-medium">Resource</th>
          <th className="px-3 py-2 text-left font-medium">Start</th>
          <th className="px-3 py-2 text-left font-medium">End</th>
        </tr>
      </thead>
      <tbody>
        {accounting.taskAccounting.map((row) => (
          <tr key={row.taskId} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2">
              {onTaskClick ? (
                <button
                  onClick={() => onTaskClick(row.taskId)}
                  className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                  title="View task in Gantt chart"
                >
                  {row.taskName}
                </button>
              ) : (
                <span className="text-gray-800">{row.taskName}</span>
              )}
            </td>
            <td className="px-3 py-2 text-right font-mono">{currency} {row.baselineCost.toLocaleString()}</td>
            <td className="px-3 py-2 text-right">{row.baselineDuration}d</td>
            <td className="px-3 py-2 text-right text-gray-500">
              {row.resourceCostRate > 0 ? `${currency}${row.resourceCostRate}/day` : '—'}
            </td>
            <td className="px-3 py-2 text-gray-500">—</td>
            <td className="px-3 py-2 text-gray-500">—</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
          <td className="px-3 py-2">Total</td>
          <td className="px-3 py-2 text-right font-mono">{currency} {accounting.baselineTotal.toLocaleString()}</td>
          <td className="px-3 py-2 text-right">{accounting.taskAccounting.reduce((s, r) => s + r.baselineDuration, 0)}d</td>
          <td colSpan={3} className="px-3 py-2" />
        </tr>
      </tfoot>
    </table>
  );
}

// ─── Allocation Table ────────────────────────────────────────────────────────

function AllocationTable({
  accounting,
  currency,
  onEdit,
  onTaskClick,
}: {
  accounting: ReturnType<typeof computeProjectAccounting>;
  currency: string;
  onEdit?: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 text-gray-600">
          <th className="px-3 py-2 text-left font-medium">Task</th>
          <th className="px-3 py-2 text-right font-medium">Allocated</th>
          <th className="px-3 py-2 text-right font-medium">vs Baseline</th>
          <th className="px-3 py-2 text-right font-medium">Approved By</th>
          <th className="px-3 py-2 text-left font-medium">Date</th>
          <th className="px-3 py-2 text-center font-medium">Action</th>
        </tr>
      </thead>
      <tbody>
        {accounting.taskAccounting.map((row) => {
          const variance = row.allocatedBudget - row.baselineCost;
          return (
            <tr key={row.taskId} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2">
                {onTaskClick ? (
                  <button
                    onClick={() => onTaskClick(row.taskId)}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                    title="View task in Gantt chart"
                  >
                    {row.taskName}
                  </button>
                ) : (
                  <span className="text-gray-800">{row.taskName}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono">{currency} {row.allocatedBudget.toLocaleString()}</td>
              <td className={`px-3 py-2 text-right font-mono ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {formatVariance(variance, currency)}
              </td>
              <td className="px-3 py-2 text-right text-gray-400">—</td>
              <td className="px-3 py-2 text-gray-400">—</td>
              <td className="px-3 py-2 text-center">
                {onEdit && (
                  <button
                    onClick={() => onEdit(row.taskId)}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
          <td className="px-3 py-2">Total</td>
          <td className="px-3 py-2 text-right font-mono">{currency} {accounting.allocatedTotal.toLocaleString()}</td>
          <td className="px-3 py-2 text-right font-mono text-gray-400">—</td>
          <td colSpan={3} className="px-3 py-2" />
        </tr>
      </tfoot>
    </table>
  );
}

// ─── Estimate Table (EAC) ────────────────────────────────────────────────────

function EstimateTable({ accounting, currency, onTaskClick }: { accounting: ReturnType<typeof computeProjectAccounting>; currency: string; onTaskClick?: (taskId: string) => void }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 text-gray-600">
          <th className="px-3 py-2 text-left font-medium">Task</th>
          <th className="px-3 py-2 text-right font-medium">Baseline</th>
          <th className="px-3 py-2 text-right font-medium">EAC</th>
          <th className="px-3 py-2 text-right font-medium">ETC</th>
          <th className="px-3 py-2 text-right font-medium">Cost Var</th>
          <th className="px-3 py-2 text-right font-medium">Duration</th>
          <th className="px-3 py-2 text-right font-medium">Rem</th>
          <th className="px-3 py-2 text-center font-medium">CPI</th>
          <th className="px-3 py-2 text-center font-medium">SPI</th>
        </tr>
      </thead>
      <tbody>
        {accounting.taskAccounting.map((row) => {
          const cpiStatus = formatPerformanceIndex(row.cpi);
          const spiStatus = formatPerformanceIndex(row.spi);
          return (
            <tr key={row.taskId} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2">
                {onTaskClick ? (
                  <button
                    onClick={() => onTaskClick(row.taskId)}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                    title="View task in Gantt chart"
                  >
                    {row.taskName}
                  </button>
                ) : (
                  <span className="text-gray-800">{row.taskName}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{currency} {row.baselineCost.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-mono font-medium">{currency} {row.currentEstimate.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-mono">{currency} {row.etc.toLocaleString()}</td>
              <td className={`px-3 py-2 text-right font-mono ${row.costVariance < 0 ? 'text-green-600' : row.costVariance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {formatVariance(row.costVariance, currency)}
              </td>
              <td className="px-3 py-2 text-right">{row.baselineDuration}d</td>
              <td className="px-3 py-2 text-right">{row.remainingDuration}d</td>
              <td className="px-3 py-2 text-center">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  cpiStatus.status === 'good' ? 'bg-green-50 text-green-700' :
                  cpiStatus.status === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  {row.cpi.toFixed(2)}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  spiStatus.status === 'good' ? 'bg-green-50 text-green-700' :
                  spiStatus.status === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  {row.spi.toFixed(2)}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
          <td className="px-3 py-2">Total</td>
          <td className="px-3 py-2 text-right font-mono">{currency} {accounting.baselineTotal.toLocaleString()}</td>
          <td className="px-3 py-2 text-right font-mono">{currency} {accounting.currentEstimateTotal.toLocaleString()}</td>
          <td className="px-3 py-2 text-right font-mono">{currency} {accounting.etcTotal.toLocaleString()}</td>
          <td className={`px-3 py-2 text-right font-mono ${accounting.currentEstimateTotal - accounting.baselineTotal < 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatVariance(accounting.currentEstimateTotal - accounting.baselineTotal, currency)}
          </td>
          <td className="px-3 py-2 text-right">{accounting.taskAccounting.reduce((s, r) => s + r.baselineDuration, 0)}d</td>
          <td className="px-3 py-2 text-right">{accounting.taskAccounting.reduce((s, r) => s + r.remainingDuration, 0)}d</td>
          <td colSpan={2} className="px-3 py-2" />
        </tr>
      </tfoot>
    </table>
  );
}

// ─── Actuals Table ───────────────────────────────────────────────────────────

function ActualsTable({
  accounting,
  currency,
  onEdit,
  onDelete,
  taskNamesById,
}: {
  accounting: ReturnType<typeof computeProjectAccounting>;
  currency: string;
  onEdit?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  taskNamesById: Map<string, string>;
}) {
  const hasSpendEntries = accounting.spendEntries.length > 0;

  if (!hasSpendEntries) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">No actual spend entries yet.</p>
        <p className="text-xs mt-1">Add spend entries to track real costs against budget.</p>
        {onEdit && (
          <button
            onClick={() => onEdit('')}
            className="mt-3 px-3 py-1.5 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
          >
            + Add Spend Entry
          </button>
        )}
      </div>
    );
  }

  const totalActual = accounting.spendEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 text-gray-600">
          <th className="px-3 py-2 text-left font-medium">Task</th>
          <th className="px-3 py-2 text-right font-medium">Amount</th>
          <th className="px-3 py-2 text-left font-medium">Source</th>
          <th className="px-3 py-2 text-left font-medium">Date</th>
          <th className="px-3 py-2 text-center font-medium">Action</th>
        </tr>
      </thead>
      <tbody>
        {accounting.spendEntries.map((entry) => (
          <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 text-gray-800">
              {taskNamesById.get(entry.taskId) ?? entry.taskId}
            </td>
            <td className="px-3 py-2 text-right font-mono">
              {currency} {entry.amount.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-gray-600">{entry.source}</td>
            <td className="px-3 py-2 text-gray-500">{entry.date}</td>
            <td className="px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(entry.id)}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                    title="Delete spend entry"
                  >
                    Delete
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
          <td className="px-3 py-2">Total</td>
          <td className="px-3 py-2 text-right font-mono">{currency} {totalActual.toLocaleString()}</td>
          <td colSpan={3} className="px-3 py-2" />
        </tr>
      </tfoot>
    </table>
  );
}

// ─── Change Log Table ────────────────────────────────────────────────────────

/**
 * Map of change type to display icon.
 */
const CHANGE_TYPE_ICONS: Record<string, string> = {
  dependency: '🔗',
  scope: '📐',
  resource: '👤',
  schedule: '📅',
  risk: '⚠️',
  other: '📝',
};

function ChangeLogTable({
  accounting,
  currency,
  onAddChange,
  onEditChange,
  onDeleteChange,
}: {
  accounting: ReturnType<typeof computeProjectAccounting>;
  currency: string;
  onAddChange?: () => void;
  onEditChange?: (entryId: string) => void;
  onDeleteChange?: (entryId: string) => void;
}) {
  const entries = accounting.changeLog;

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <span className="text-sm text-gray-500">{entries.length} change(s)</span>
        {onAddChange && (
          <button
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            onClick={onAddChange}
          >
            + Add Change
          </button>
        )}
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No change log entries yet.</p>
          <p className="text-xs mt-1">Changes from dependency shifts and scope adjustments will appear here.</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Cost Impact</th>
              <th className="px-3 py-2 text-right font-medium">Schedule</th>
              <th className="px-3 py-2 text-left font-medium">Approved By</th>
              <th className="px-3 py-2 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{entry.date}</td>
                <td className="px-3 py-2">
                  <span className="mr-1">{CHANGE_TYPE_ICONS[entry.changeType] ?? '📝'}</span>
                  <span className="capitalize">{entry.changeType}</span>
                </td>
                <td className="px-3 py-2 text-gray-800">{entry.description}</td>
                <td className={`px-3 py-2 text-right font-mono ${entry.costImpact < 0 ? 'text-green-600' : entry.costImpact > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {formatVariance(entry.costImpact, currency)}
                </td>
                <td className={`px-3 py-2 text-right ${entry.scheduleImpactDays < 0 ? 'text-green-600' : entry.scheduleImpactDays > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {entry.scheduleImpactDays === 0 ? '—' : `${entry.scheduleImpactDays > 0 ? '+' : ''}${entry.scheduleImpactDays}d`}
                </td>
                <td className="px-3 py-2 text-gray-500">{entry.approvedBy ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  {onEditChange && (
                    <button
                      className="text-blue-600 hover:text-blue-800 text-xs mr-1"
                      onClick={() => onEditChange(entry.id)}
                    >
                      Edit
                    </button>
                  )}
                  {onDeleteChange && (
                    <button
                      className="text-red-500 hover:text-red-700 text-xs"
                      onClick={() => onDeleteChange(entry.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
