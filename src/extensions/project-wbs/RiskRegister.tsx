// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Register View
 *
 * Table view of all project risks with sorting and filtering.
 */

import { useState, useMemo } from 'react';
import type { Risk, RiskStatus, RiskCategory } from '../types';
import { getRiskLevel } from './risks';

interface RiskRegisterProps {
  risks: Risk[];
  onRiskSelect?: (riskId: string) => void;
  onRiskClose?: (riskId: string) => void;
  onRiskEdit?: (riskId: string) => void;
  onRiskAdd?: () => void;
  selectedRiskId?: string | null;
}

type SortField = 'title' | 'category' | 'probability' | 'impact' | 'riskScore' | 'status';

const STATUS_LABELS: Record<RiskStatus, string> = {
  identified: 'Identified',
  assessing: 'Assessing',
  mitigating: 'Mitigating',
  monitoring: 'Monitoring',
  occurred: 'Occurred',
  closed: 'Closed',
};

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  technical: 'Technical',
  schedule: 'Schedule',
  cost: 'Cost',
  resource: 'Resource',
  external: 'External',
  quality: 'Quality',
  scope: 'Scope',
  other: 'Other',
};

const LEVEL_COLORS = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export function RiskRegister({ risks, onRiskSelect, onRiskClose, onRiskEdit, onRiskAdd, selectedRiskId }: RiskRegisterProps) {
  const [sortField, setSortField] = useState<SortField>('riskScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<RiskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<RiskCategory | 'all'>('all');

  const filteredRisks = useMemo(() => {
    let result = risks;
    if (filterStatus !== 'all') result = result.filter((r) => r.status === filterStatus);
    if (filterCategory !== 'all') result = result.filter((r) => r.category === filterCategory);
    return result;
  }, [risks, filterStatus, filterCategory]);

  const sortedRisks = useMemo(() => {
    const sorted = [...filteredRisks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'probability': cmp = a.probability - b.probability; break;
        case 'impact': cmp = a.impact - b.impact; break;
        case 'riskScore': cmp = a.riskScore - b.riskScore; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRisks, sortField, sortAsc]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded bg-white" data-testid="risk-register">
      {/* Filters */}
      <div className="flex gap-4 p-3 border-b border-gray-200 bg-gray-50">
        <label className="flex items-center gap-2 text-sm">
          Status:
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as RiskStatus | 'all')}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Category:
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as RiskCategory | 'all')}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {sortedRisks.length} risk(s)
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('title')}>
                Title {sortField === 'title' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('category')}>
                Category {sortField === 'category' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('probability')}>
                Prob {sortField === 'probability' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('impact')}>
                Impact {sortField === 'impact' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('riskScore')}>
                Score {sortField === 'riskScore' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                Status {sortField === 'status' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-center font-medium">
                Actions
                {onRiskAdd && (
                  <button
                    className="ml-2 text-xs text-green-600 hover:underline"
                    onClick={onRiskAdd}
                  >
                    + Add
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRisks.map((risk) => {
              const level = getRiskLevel(risk.riskScore);
              const isSelected = risk.id === selectedRiskId;
              return (
                <tr
                  key={risk.id}
                  className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
                  onClick={() => onRiskSelect?.(risk.id)}
                >
                  <td className="px-3 py-2 font-medium">{risk.title}</td>
                  <td className="px-3 py-2">{CATEGORY_LABELS[risk.category]}</td>
                  <td className="px-3 py-2 text-center">{risk.probability}</td>
                  <td className="px-3 py-2 text-center">{risk.impact}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[level]}`}>
                      {risk.riskScore}
                    </span>
                  </td>
                  <td className="px-3 py-2">{STATUS_LABELS[risk.status]}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {onRiskEdit && (
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); onRiskEdit(risk.id); }}
                        >
                          Edit
                        </button>
                      )}
                      {risk.status !== 'closed' && onRiskClose && (
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); onRiskClose(risk.id); }}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedRisks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  No risks match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
