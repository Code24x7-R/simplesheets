// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * EVM Report UI Component
 *
 * Displays Earned Value Management reports with:
 * - Tab navigation between registered reports
 * - Metric cards with status indicators
 * - Color-coded variance display
 * - Extensible: new reports appear automatically when registered
 */

import { useState, useMemo } from 'react';
import type { Project } from '../types';
import { formatCurrency } from '../../utils/currency';
import {
  getRegisteredReports,
  calculateEvmMetrics,
  type EvmMetricRow,
} from './evmEngine';

interface EvmReportProps {
  project: Project;
  asOfDate?: string;
  defaultReportId?: string;
}

export function EvmReport({ project, asOfDate, defaultReportId }: EvmReportProps) {
  const reports = useMemo(() => getRegisteredReports(), []);
  const date = asOfDate ?? new Date().toISOString().slice(0, 10);

  const [activeReportId, setActiveReportId] = useState(
    defaultReportId ?? reports[0]?.id ?? '',
  );

  const activeReport = reports.find((r) => r.id === activeReportId) ?? reports[0];

  const section = useMemo(
    () => (activeReport ? activeReport.calculate(project, date) : null),
    [activeReport, project, date],
  );

  const metrics = useMemo(() => calculateEvmMetrics(project, date), [project, date]);

  if (!activeReport || !section) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-400">
        No EVM reports available.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Earned Value Management</h3>
          <span className="text-xs text-gray-500">As of {date}</span>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReportId(report.id)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeReportId === report.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            title={report.description}
          >
            {report.name}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="p-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard
            label="CV"
            value={formatCurrency(metrics.vac, metrics.currency)}
            status={metrics.cv >= 0 ? 'good' : 'critical'}
            subtitle="Cost Variance"
          />
          <MetricCard
            label="CPI"
            value={metrics.cpi.toFixed(2)}
            status={metrics.cpi >= 1 ? 'good' : metrics.cpi >= 0.85 ? 'warning' : 'critical'}
            subtitle="Cost Performance"
          />
          <MetricCard
            label="SPI"
            value={metrics.spi.toFixed(2)}
            status={metrics.spi >= 1 ? 'good' : metrics.spi >= 0.85 ? 'warning' : 'critical'}
            subtitle="Schedule Performance"
          />
          <MetricCard
            label="VAC"
            value={formatCurrency(metrics.vac, metrics.currency)}
            status={metrics.vac >= 0 ? 'good' : 'critical'}
            subtitle="Variance at Completion"
          />
        </div>

        {/* Detailed Metrics */}
        <div className="space-y-2">
          {section.metrics.map((metric, index) => (
            <MetricRow key={index} metric={metric} />
          ))}
        </div>

        {/* Chart Data Visualization (simple bar) */}
        {section.chartData && section.chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-600 mb-2">Visual Comparison</div>
            <div className="flex items-end gap-2 h-24">
              {section.chartData.map((point, index) => {
                const maxValue = Math.max(...section.chartData!.map((p) => Math.abs(p.value)));
                const height = maxValue > 0 ? (Math.abs(point.value) / maxValue) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${height}%`,
                        backgroundColor: point.color ?? '#3B82F6',
                        minHeight: '4px',
                      }}
                    />
                    <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metric Card (compact KPI) ───────────────────────────────────────────────

function MetricCard({
  value,
  status,
  subtitle,
}: {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
  subtitle: string;
}) {
  const statusColors = {
    good: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    critical: 'border-red-200 bg-red-50',
    neutral: 'border-gray-200 bg-gray-50',
  };

  const textColors = {
    good: 'text-green-700',
    warning: 'text-yellow-700',
    critical: 'text-red-700',
    neutral: 'text-gray-700',
  };

  return (
    <div className={`rounded-lg border p-3 ${statusColors[status]}`}>
      <div className="text-xs text-gray-500">{subtitle}</div>
      <div className={`text-lg font-bold ${textColors[status]}`}>{value}</div>
    </div>
  );
}

// ─── Metric Row (detailed) ───────────────────────────────────────────────────

function MetricRow({ metric }: { metric: EvmMetricRow }) {
  const statusIcon = {
    good: '\u2705',
    warning: '\u26A0\uFE0F',
    critical: '\u274C',
    neutral: '\u2139\uFE0F',
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="text-sm">{statusIcon[metric.status]}</span>
        <div>
          <div className="text-sm font-medium text-gray-800">{metric.label}</div>
          <div className="text-xs text-gray-400">{metric.description}</div>
        </div>
      </div>
      <div className="text-sm font-mono font-medium text-gray-700">{metric.value}</div>
    </div>
  );
}


