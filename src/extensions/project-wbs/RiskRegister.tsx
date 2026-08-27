// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Register View
 *
 * Table view of all project risks with sorting and filtering.
 */

import React, { useState, useMemo } from 'react';
import type { Risk, RiskStatus, RiskCategory } from '../types';
import { getRiskLevel } from './risks';

interface RiskRegisterProps {
  risks: Risk[];
  onRiskSelect?: (riskId: string) => void;
  onRiskClose?: (riskId: string) => void;
  onRiskEdit?: (riskId: string) => void;
  onRiskAdd?: () => void;
  onBulkStatusChange?: (riskIds: string[], status: RiskStatus) => void;
  selectedRiskId?: string | null;
}

type SortField = 'title' | 'category' | 'probability' | 'impact' | 'riskScore' | 'status';
type GroupBy = 'none' | 'category' | 'status' | 'level';

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

export function RiskRegister({ risks, onRiskSelect, onRiskClose, onRiskEdit, onRiskAdd, onBulkStatusChange, selectedRiskId }: RiskRegisterProps) {
  const [sortField, setSortField] = useState<SortField>('riskScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<RiskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<RiskCategory | 'all'>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(new Set());

  const isAllSelected = selectedRiskIds.size === risks.length && risks.length > 0;

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedRiskIds(new Set());
    } else {
      setSelectedRiskIds(new Set(risks.map((r) => r.id)));
    }
  }

  function toggleSelectRisk(riskId: string) {
    setSelectedRiskIds((prev) => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  }

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

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  // Group risks when groupBy is set
  const groupedRisks = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, { label: string; risks: Risk[] }>();
    for (const risk of sortedRisks) {
      let key: string;
      let label: string;
      switch (groupBy) {
        case 'category':
          key = risk.category;
          label = CATEGORY_LABELS[risk.category];
          break;
        case 'status':
          key = risk.status;
          label = STATUS_LABELS[risk.status];
          break;
        case 'level': {
          const level = getRiskLevel(risk.riskScore);
          key = level;
          label = level.charAt(0).toUpperCase() + level.slice(1);
          break;
        }
        default:
          continue;
      }
      if (!groups.has(key)) {
        groups.set(key, { label, risks: [] });
      }
      groups.get(key)!.risks.push(risk);
    }
    return Array.from(groups.entries()).map(([key, { label, risks: groupRisks }]) => ({
      key,
      label,
      risks: groupRisks,
      count: groupRisks.length,
    }));
  }, [sortedRisks, groupBy]);

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
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500">Group by:</span>
          {(['none', 'category', 'status', 'level'] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-2 py-0.5 text-xs rounded ${
                groupBy === g
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {g === 'none' ? 'None' : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedRiskIds.size > 0 && (
        <div className="flex items-center gap-3 p-2 border-b border-gray-200 bg-blue-50">
          <span className="text-sm text-blue-700 font-medium">
            {selectedRiskIds.size} selected
          </span>
          <span className="text-sm text-gray-500">Bulk Actions:</span>
          {onBulkStatusChange && (
            <>
              <button
                className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-100"
                onClick={() => {
                  onBulkStatusChange(Array.from(selectedRiskIds), 'mitigating');
                  setSelectedRiskIds(new Set());
                }}
              >
                Mitigate
              </button>
              <button
                className="px-2 py-1 text-xs text-green-600 border border-green-300 rounded hover:bg-green-100"
                onClick={() => {
                  onBulkStatusChange(Array.from(selectedRiskIds), 'monitoring');
                  setSelectedRiskIds(new Set());
                }}
              >
                Monitor
              </button>
              <button
                className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                onClick={() => {
                  onBulkStatusChange(Array.from(selectedRiskIds), 'closed');
                  setSelectedRiskIds(new Set());
                }}
              >
                Close Selected
              </button>
            </>
          )}
          <button
            className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-100 ml-auto"
            onClick={() => setSelectedRiskIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-center font-medium">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300"
                  aria-label="Select all risks"
                />
              </th>
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
            {groupedRisks
              ? groupedRisks.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key);
                  return (
                    <React.Fragment key={group.key}>
                      {/* Group header */}
                      <tr
                        className="bg-gray-50 cursor-pointer"
                        onClick={() => toggleGroup(group.key)}
                      >
                        <td colSpan={8} className="px-3 py-1.5 text-xs font-medium text-gray-600">
                          <span className="mr-1">{isCollapsed ? '▶' : '▼'}</span>
                          {group.label}
                          <span className="ml-2 text-gray-400">({group.count} risk{group.count !== 1 ? 's' : ''})</span>
                        </td>
                      </tr>
                      {/* Group rows */}
                      {!isCollapsed &&
                        group.risks.map((risk) => {
                          const level = getRiskLevel(risk.riskScore);
                          const isSelected = risk.id === selectedRiskId;
                          const isChecked = selectedRiskIds.has(risk.id);
                          return (
                            <tr
                              key={risk.id}
                              className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
                              onClick={() => onRiskSelect?.(risk.id)}
                            >
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelectRisk(risk.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300"
                                  aria-label={`Select ${risk.title}`}
                                />
                              </td>
                              <td className="px-3 py-2 font-medium pl-6">{risk.title}</td>
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
                                {onRiskEdit && (
                                  <button
                                    className="text-blue-600 hover:text-blue-800 text-xs mr-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRiskEdit(risk.id);
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                                {onRiskClose && risk.status !== 'closed' && (
                                  <button
                                    className="text-gray-500 hover:text-gray-700 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRiskClose(risk.id);
                                    }}
                                  >
                                    Close
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              : sortedRisks.map((risk) => {
                  const level = getRiskLevel(risk.riskScore);
                  const isSelected = risk.id === selectedRiskId;
                  const isChecked = selectedRiskIds.has(risk.id);
                  return (
                    <tr
                      key={risk.id}
                      className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
                      onClick={() => onRiskSelect?.(risk.id)}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRisk(risk.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300"
                          aria-label={`Select ${risk.title}`}
                        />
                      </td>
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
