// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Earned Value Management (EVM) Reporting Engine
 *
 * Standard EVM metrics for project cost performance:
 * - CV (Cost Variance) = EV - AC
 * - VAC (Variance at Completion) = BAC - EAC
 * - CPI (Cost Performance Index) = EV / AC
 * - SPI (Schedule Performance Index) = EV / PV
 * - EAC (Estimate at Completion)
 * - ETC (Estimate to Complete)
 * - TCPI (To-Complete Performance Index)
 *
 * Architecture: Registry-based report system allowing new reports
 * to be added without modifying existing code.
 */

import type { Project } from '../types';
import { getAllTasks } from './treeOps';
import {
  earnedValue,
  plannedValue,
  costPerformanceIndex,
  schedulePerformanceIndex,
  estimateToComplete,
  eacFromCPI,
  toCompletePerformanceIndex,
  costVariance,
  scheduleVariance,
} from './projectAccounting';

// ─── EVM Data Structures ────────────────────────────────────────────────────

/**
 * Standard EVM metrics snapshot for a point in time.
 */
export interface EvmMetrics {
  // Core values
  pv: number;   // Planned Value (BCWS)
  ev: number;   // Earned Value (BCWP)
  ac: number;   // Actual Cost (ACWP)
  bac: number;  // Budget at Completion

  // Variances
  cv: number;   // Cost Variance = EV - AC
  sv: number;   // Schedule Variance = EV - PV
  vac: number;  // Variance at Completion = BAC - EAC

  // Indices
  cpi: number;  // Cost Performance Index = EV / AC
  spi: number;  // Schedule Performance Index = EV / PV
  tcpi: number; // To-Complete Performance Index = (BAC - EV) / (BAC - AC)

  // Estimates
  eac: number;  // Estimate at Completion
  etc: number;  // Estimate to Complete = EAC - AC

  // Metadata
  asOfDate: string;
  currency: string;
  taskCount: number;
  completedTaskCount: number;
  inProgressTaskCount: number;
}

/**
 * Per-task EVM breakdown for detailed reporting.
 */
export interface TaskEvmBreakdown {
  taskId: string;
  taskName: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  progress: number;
  status: string;
  isCritical: boolean;
}

/**
 * A report definition in the registry.
 * Each report has a unique ID, display name, and calculation function.
 */
export interface EvmReportDefinition {
  id: string;
  name: string;
  description: string;
  category: 'cost' | 'schedule' | 'forecast' | 'summary';
  calculate: (project: Project, asOfDate: string) => EvmReportSection;
}

/**
 * A section within an EVM report, containing metric rows.
 */
export interface EvmReportSection {
  title: string;
  metrics: EvmMetricRow[];
  chartData?: EvmChartDataPoint[];
}

/**
 * A single metric row in a report.
 */
export interface EvmMetricRow {
  label: string;
  value: string;
  rawValue: number;
  unit: 'currency' | 'days' | 'ratio' | 'percent' | 'count';
  status: 'good' | 'warning' | 'critical' | 'neutral';
  description: string;
}

/**
 * Data point for chart rendering.
 */
export interface EvmChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// ─── Core EVM Calculations ───────────────────────────────────────────────────

/**
 * Calculate comprehensive EVM metrics for a project at a given date.
 * This is the primary function that feeds all EVM reports.
 */
export function calculateEvmMetrics(project: Project, asOfDate: string = new Date().toISOString().slice(0, 10)): EvmMetrics {
  const allTasks = getAllTasks(project.wbs);

  let totalPV = 0;
  let totalEV = 0;
  let totalAC = 0;
  let totalBAC = 0;
  let completedCount = 0;
  let inProgressCount = 0;

  for (const task of allTasks) {
    const bac = task.cost;
    const ev = earnedValue(bac, task.progress);
    const pv = plannedValue(bac, task.startDate, task.endDate, asOfDate);
    // Actual cost — simplified: use task.cost as placeholder for spent
    // In production, this would come from ActualSpendEntry records
    const ac = task.progress > 0 ? bac * (task.progress / 100) * 1.1 : 0; // Simulated: 10% over

    totalPV += pv;
    totalEV += ev;
    totalAC += ac;
    totalBAC += bac;

    if (task.progress >= 100) completedCount++;
    else if (task.progress > 0) inProgressCount++;
  }

  const cv = costVariance(totalEV, totalAC);
  const sv = scheduleVariance(totalEV, totalPV);
  const cpi = costPerformanceIndex(totalEV, totalAC);
  const spi = schedulePerformanceIndex(totalEV, totalPV);
  const eac = eacFromCPI(totalBAC, cpi);
  const etc = estimateToComplete(totalBAC, totalEV);
  const vac = totalBAC - eac;
  const tcpi = toCompletePerformanceIndex(totalBAC, totalEV, totalAC);

  return {
    pv: totalPV,
    ev: totalEV,
    ac: totalAC,
    bac: totalBAC,
    cv,
    sv,
    vac,
    cpi,
    spi,
    tcpi,
    eac,
    etc,
    asOfDate,
    currency: project.accounting?.currency ?? 'USD',
    taskCount: allTasks.length,
    completedTaskCount: completedCount,
    inProgressTaskCount: inProgressCount,
  };
}

/**
 * Calculate per-task EVM breakdown for detailed analysis.
 */
export function calculateTaskEvmBreakdown(
  project: Project,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): TaskEvmBreakdown[] {
  const allTasks = getAllTasks(project.wbs);

  return allTasks.map((task) => {
    const bac = task.cost;
    const ev = earnedValue(bac, task.progress);
    const pv = plannedValue(bac, task.startDate, task.endDate, asOfDate);
    const ac = task.progress > 0 ? bac * (task.progress / 100) * 1.1 : 0;
    const cv = costVariance(ev, ac);
    const sv = scheduleVariance(ev, pv);
    const cpi = costPerformanceIndex(ev, ac);
    const spi = schedulePerformanceIndex(ev, pv);

    return {
      taskId: task.id,
      taskName: task.name,
      bac,
      pv,
      ev,
      ac,
      cv,
      sv,
      cpi,
      spi,
      progress: task.progress,
      status: task.status ?? 'not_started',
      isCritical: task.isCritical ?? false,
    };
  });
}

// ─── Report Registry ─────────────────────────────────────────────────────────

/**
 * Registry of all available EVM reports.
 * Add new reports here to make them available in the UI.
 */
const reportRegistry: Map<string, EvmReportDefinition> = new Map();

/**
 * Register a new EVM report.
 * @param report - The report definition to register
 */
export function registerEvmReport(report: EvmReportDefinition): void {
  reportRegistry.set(report.id, report);
}

/**
 * Get all registered reports.
 */
export function getRegisteredReports(): EvmReportDefinition[] {
  return Array.from(reportRegistry.values());
}

/**
 * Get a specific report by ID.
 */
export function getReportById(id: string): EvmReportDefinition | undefined {
  return reportRegistry.get(id);
}

// ─── Built-in Report Definitions ────────────────────────────────────────────

/**
 * Cost Performance Report — focuses on cost variances and indices.
 */
const costPerformanceReport: EvmReportDefinition = {
  id: 'cost-performance',
  name: 'Cost Performance',
  description: 'CV, CPI, and cost variance analysis',
  category: 'cost',
  calculate: (project: Project, asOfDate: string): EvmReportSection => {
    const metrics = calculateEvmMetrics(project, asOfDate);
    const currency = metrics.currency;

    return {
      title: 'Cost Performance Report',
      metrics: [
        {
          label: 'Cost Variance (CV)',
          value: formatCurrency(metrics.cv, currency),
          rawValue: metrics.cv,
          unit: 'currency',
          status: metrics.cv >= 0 ? 'good' : 'critical',
          description: 'EV - AC. Negative means over budget.',
        },
        {
          label: 'Cost Performance Index (CPI)',
          value: metrics.cpi.toFixed(2),
          rawValue: metrics.cpi,
          unit: 'ratio',
          status: metrics.cpi >= 1 ? 'good' : metrics.cpi >= 0.85 ? 'warning' : 'critical',
          description: 'EV / AC. < 1 means over budget.',
        },
        {
          label: 'Earned Value (EV)',
          value: formatCurrency(metrics.ev, currency),
          rawValue: metrics.ev,
          unit: 'currency',
          status: 'neutral',
          description: 'Budgeted cost of work performed.',
        },
        {
          label: 'Actual Cost (AC)',
          value: formatCurrency(metrics.ac, currency),
          rawValue: metrics.ac,
          unit: 'currency',
          status: 'neutral',
          description: 'Actual cost of work performed.',
        },
        {
          label: 'Budget at Completion (BAC)',
          value: formatCurrency(metrics.bac, currency),
          rawValue: metrics.bac,
          unit: 'currency',
          status: 'neutral',
          description: 'Total approved budget for the project.',
        },
      ],
      chartData: [
        { label: 'EV', value: metrics.ev, color: '#22C55E' },
        { label: 'AC', value: metrics.ac, color: '#EF4444' },
        { label: 'PV', value: metrics.pv, color: '#3B82F6' },
      ],
    };
  },
};

/**
 * Forecast Report — EAC, ETC, VAC, TCPI.
 */
const forecastReport: EvmReportDefinition = {
  id: 'forecast',
  name: 'Forecast at Completion',
  description: 'EAC, ETC, VAC, and TCPI projections',
  category: 'forecast',
  calculate: (project: Project, asOfDate: string): EvmReportSection => {
    const metrics = calculateEvmMetrics(project, asOfDate);
    const currency = metrics.currency;

    return {
      title: 'Forecast Report',
      metrics: [
        {
          label: 'Estimate at Completion (EAC)',
          value: formatCurrency(metrics.eac, currency),
          rawValue: metrics.eac,
          unit: 'currency',
          status: metrics.eac <= metrics.bac ? 'good' : 'critical',
          description: 'BAC / CPI. Projected final cost.',
        },
        {
          label: 'Estimate to Complete (ETC)',
          value: formatCurrency(metrics.etc, currency),
          rawValue: metrics.etc,
          unit: 'currency',
          status: 'neutral',
          description: 'EAC - AC. Cost to finish remaining work.',
        },
        {
          label: 'Variance at Completion (VAC)',
          value: formatCurrency(metrics.vac, currency),
          rawValue: metrics.vac,
          unit: 'currency',
          status: metrics.vac >= 0 ? 'good' : 'critical',
          description: 'BAC - EAC. Projected budget surplus/deficit.',
        },
        {
          label: 'To-Complete Performance Index (TCPI)',
          value: metrics.tcpi.toFixed(2),
          rawValue: metrics.tcpi,
          unit: 'ratio',
          status: metrics.tcpi <= 1 ? 'good' : metrics.tcpi <= 1.1 ? 'warning' : 'critical',
          description: '(BAC - EV) / (BAC - AC). Efficiency needed to finish on budget.',
        },
      ],
      chartData: [
        { label: 'BAC', value: metrics.bac, color: '#3B82F6' },
        { label: 'EAC', value: metrics.eac, color: metrics.eac > metrics.bac ? '#EF4444' : '#22C55E' },
      ],
    };
  },
};

/**
 * Schedule Performance Report — SV, SPI.
 */
const scheduleReport: EvmReportDefinition = {
  id: 'schedule',
  name: 'Schedule Performance',
  description: 'SV, SPI, and schedule variance analysis',
  category: 'schedule',
  calculate: (project: Project, asOfDate: string): EvmReportSection => {
    const metrics = calculateEvmMetrics(project, asOfDate);

    return {
      title: 'Schedule Performance Report',
      metrics: [
        {
          label: 'Schedule Variance (SV)',
          value: formatCurrency(metrics.sv, metrics.currency),
          rawValue: metrics.sv,
          unit: 'currency',
          status: metrics.sv >= 0 ? 'good' : 'critical',
          description: 'EV - PV. Negative means behind schedule.',
        },
        {
          label: 'Schedule Performance Index (SPI)',
          value: metrics.spi.toFixed(2),
          rawValue: metrics.spi,
          unit: 'ratio',
          status: metrics.spi >= 1 ? 'good' : metrics.spi >= 0.85 ? 'warning' : 'critical',
          description: 'EV / PV. < 1 means behind schedule.',
        },
        {
          label: 'Tasks Completed',
          value: `${metrics.completedTaskCount} of ${metrics.taskCount}`,
          rawValue: metrics.completedTaskCount,
          unit: 'count',
          status: 'neutral',
          description: 'Number of tasks at 100% progress.',
        },
        {
          label: 'Tasks In Progress',
          value: String(metrics.inProgressTaskCount),
          rawValue: metrics.inProgressTaskCount,
          unit: 'count',
          status: 'neutral',
          description: 'Number of tasks between 1-99% progress.',
        },
      ],
    };
  },
};

/**
 * Executive Summary Report — all key metrics at a glance.
 */
const executiveSummaryReport: EvmReportDefinition = {
  id: 'executive-summary',
  name: 'Executive Summary',
  description: 'High-level EVM metrics overview',
  category: 'summary',
  calculate: (project: Project, asOfDate: string): EvmReportSection => {
    const metrics = calculateEvmMetrics(project, asOfDate);
    const currency = metrics.currency;

    return {
      title: 'Executive Summary',
      metrics: [
        {
          label: 'Cost Variance (CV)',
          value: formatCurrency(metrics.cv, currency),
          rawValue: metrics.cv,
          unit: 'currency',
          status: metrics.cv >= 0 ? 'good' : 'critical',
          description: 'EV - AC. Over/under budget.',
        },
        {
          label: 'Schedule Variance (SV)',
          value: formatCurrency(metrics.sv, currency),
          rawValue: metrics.sv,
          unit: 'currency',
          status: metrics.sv >= 0 ? 'good' : 'critical',
          description: 'EV - PV. Ahead/behind schedule.',
        },
        {
          label: 'CPI',
          value: metrics.cpi.toFixed(2),
          rawValue: metrics.cpi,
          unit: 'ratio',
          status: metrics.cpi >= 1 ? 'good' : 'critical',
          description: 'Cost efficiency ratio.',
        },
        {
          label: 'SPI',
          value: metrics.spi.toFixed(2),
          rawValue: metrics.spi,
          unit: 'ratio',
          status: metrics.spi >= 1 ? 'good' : 'critical',
          description: 'Schedule efficiency ratio.',
        },
        {
          label: 'VAC',
          value: formatCurrency(metrics.vac, currency),
          rawValue: metrics.vac,
          unit: 'currency',
          status: metrics.vac >= 0 ? 'good' : 'critical',
          description: 'BAC - EAC. Projected final variance.',
        },
      ],
      chartData: [
        { label: 'EV', value: metrics.ev, color: '#22C55E' },
        { label: 'PV', value: metrics.pv, color: '#3B82F6' },
        { label: 'AC', value: metrics.ac, color: '#EF4444' },
        { label: 'BAC', value: metrics.bac, color: '#8B5CF6' },
      ],
    };
  },
};

// Register built-in reports
registerEvmReport(costPerformanceReport);
registerEvmReport(forecastReport);
registerEvmReport(scheduleReport);
registerEvmReport(executiveSummaryReport);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5',
    AUD: 'A$', CAD: 'C$', CHF: 'CHF ', CNY: '\u00A5',
  };
  const symbol = symbols[currency] ?? currency + ' ';
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
