// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project Accounting Engine
 *
 * Calculates cost tracking metrics across four dimensions:
 * - Baseline: Original approved plan
 * - Allocated: Approved budget per task
 * - Current Estimate: Rolling forecast (EAC)
 * - Actual Spend: Real costs incurred
 *
 * Key formulas:
 * - EAC (Estimate at Completion) = ETC + Actual Spend
 * - ETC (Estimate to Complete) = EAC - Actual Spend
 * - Cost Variance = Current Estimate - Baseline
 * - CPI (Cost Performance Index) = Earned Value / Actual Cost
 * - SPI (Schedule Performance Index) = Earned Value / Planned Value
 */

import type {
  Project,
  WBSTask,
  TaskAccounting,
  ActualSpendEntry,
  ProjectAccounting,
} from '../types';
import { getAllTasks } from './treeOps';
import { rollUpCost } from './rollups';

// ─── Earned Value Calculations ──────────────────────────────────────────────

/**
 * Calculate Earned Value (EV) for a task.
 * EV = Budgeted Cost × Percent Complete
 * @param baselineCost - Original budget for the task
 * @param progress - Progress percentage (0-100)
 * @returns Earned value in currency units
 */
export function earnedValue(baselineCost: number, progress: number): number {
  return baselineCost * (progress / 100);
}

/**
 * Calculate Planned Value (PV) for a task up to a given date.
 * PV = Budgeted Cost × Planned Percent Complete
 * For simplicity, assumes linear progress over task duration.
 * @param baselineCost - Original budget
 * @param startDate - Task start date
 * @param endDate - Task end date
 * @param asOfDate - Date to calculate PV for (defaults to today)
 * @returns Planned value in currency units
 */
export function plannedValue(
  baselineCost: number,
  startDate: string,
  endDate: string,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): number {
  if (asOfDate <= startDate) return 0;
  if (asOfDate >= endDate) return baselineCost;

  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T00:00:00').getTime();
  const asOf = new Date(asOfDate + 'T00:00:00').getTime();

  const elapsed = (asOf - start) / (end - start);
  return baselineCost * elapsed;
}

/**
 * Calculate Cost Performance Index (CPI).
 * CPI = EV / AC
 * CPI > 1 = under budget, CPI < 1 = over budget
 * @param earnedValue - Earned value
 * @param actualCost - Actual cost
 * @returns CPI ratio (or 1 if AC is 0)
 */
export function costPerformanceIndex(earnedValue: number, actualCost: number): number {
  if (actualCost === 0) return 1;
  return earnedValue / actualCost;
}

/**
 * Calculate Schedule Performance Index (SPI).
 * SPI = EV / PV
 * SPI > 1 = ahead of schedule, SPI < 1 = behind
 * @param earnedValue - Earned value
 * @param plannedValue - Planned value
 * @returns SPI ratio (or 1 if PV is 0)
 */
export function schedulePerformanceIndex(earnedValue: number, plannedValue: number): number {
  if (plannedValue === 0) return 1;
  return earnedValue / plannedValue;
}

// ─── Estimate Calculations ───────────────────────────────────────────────────

/**
 * Calculate Estimate at Completion (EAC).
 * EAC = ETC + Actual Spend
 * @param etc - Estimate to Complete
 * @param actualSpend - Actual cost to date
 * @returns EAC
 */
export function estimateAtCompletion(etc: number, actualSpend: number): number {
  return etc + actualSpend;
}

/**
 * Calculate Estimate to Complete (ETC) assuming remaining work at budgeted rate.
 * ETC = BAC - EV (where BAC = Budget at Completion = baseline)
 * @param baselineCost - Budget at completion
 * @param earnedValue - Earned value
 * @returns ETC
 */
export function estimateToComplete(baselineCost: number, earnedValue: number): number {
  return Math.max(0, baselineCost - earnedValue);
}

/**
 * Calculate EAC using CPI-based forecasting (most common method).
 * EAC = BAC / CPI
 * Assumes current cost performance continues.
 * @param baselineCost - Budget at completion
 * @param cpi - Cost Performance Index
 * @returns Forecasted EAC
 */
export function eacFromCPI(baselineCost: number, cpi: number): number {
  if (cpi <= 0) return baselineCost;
  return baselineCost / cpi;
}

/**
 * Calculate To-Complete Performance Index (TCPI).
 * TCPI = (BAC - EV) / (BAC - AC)
 * Efficiency needed to finish on budget.
 * @param baselineCost - Budget at completion
 * @param earnedValue - Earned value
 * @param actualCost - Actual cost
 * @returns TCPI ratio (or 1 if at budget)
 */
export function toCompletePerformanceIndex(
  baselineCost: number,
  earnedValue: number,
  actualCost: number,
): number {
  const remainingWork = baselineCost - earnedValue;
  const remainingBudget = baselineCost - actualCost;
  if (remainingBudget === 0) return 1;
  return remainingWork / remainingBudget;
}

// ─── Variance Calculations ───────────────────────────────────────────────────

/**
 * Calculate Cost Variance (CV).
 * CV = EV - AC
 * Negative = over budget
 * @param earnedValue - Earned value
 * @param actualCost - Actual cost
 * @returns Cost variance (negative = over budget)
 */
export function costVariance(earnedValue: number, actualCost: number): number {
  return earnedValue - actualCost;
}

/**
 * Calculate Schedule Variance (SV) in currency terms.
 * SV = EV - PV
 * Negative = behind schedule
 * @param earnedValue - Earned value
 * @param plannedValue - Planned value
 * @returns Schedule variance (negative = behind)
 */
export function scheduleVariance(earnedValue: number, plannedValue: number): number {
  return earnedValue - plannedValue;
}

/**
 * Estimate schedule variance in days using SPI.
 * Approximation: remaining duration / SPI - remaining duration
 * @param remainingDurationDays - Working days remaining
 * @param spi - Schedule Performance Index
 * @returns Schedule variance in days (negative = behind)
 */
export function scheduleVarianceDays(remainingDurationDays: number, spi: number): number {
  if (spi <= 0) return -remainingDurationDays;
  return remainingDurationDays / spi - remainingDurationDays;
}

// ─── Task-Level Accounting ───────────────────────────────────────────────────

/**
 * Compute accounting metrics for a single task.
 * @param task - The WBS task
 * @param actualSpendEntries - Spend entries for this task
 * @param resourceCostRate - Hourly/daily rate of assigned resource
 * @returns TaskAccounting with all calculated fields
 */
export function computeTaskAccounting(
  task: WBSTask,
  actualSpendEntries: ActualSpendEntry[],
  resourceCostRate: number = 0,
): TaskAccounting {
  const actualSpend = actualSpendEntries.reduce((sum, e) => sum + e.amount, 0);
  const ev = earnedValue(task.cost, task.progress);
  const pv = plannedValue(task.cost, task.startDate, task.endDate);
  const cpi = costPerformanceIndex(ev, actualSpend);
  const spi = schedulePerformanceIndex(ev, pv);
  const etc = estimateToComplete(task.cost, ev);
  const eac = estimateAtCompletion(etc, actualSpend);
  const remainingDays = Math.max(0, task.duration * (1 - task.progress / 100));

  // Duration calculations
  const baselineDuration = task.duration;
  // Current duration: if task is in progress, use original (could be updated by dependencies)
  const currentDuration = task.duration;
  // Actual duration: elapsed working days since start (simplified: proportional to progress)
  const actualDuration = task.progress > 0 ? Math.round(task.duration * (task.progress / 100)) : 0;
  // Remaining duration: working days left
  const remainingDuration = Math.max(0, currentDuration - actualDuration);
  // Duration variance: difference between current estimate and baseline
  const durationVariance = currentDuration - baselineDuration;

  return {
    taskId: task.id,
    taskName: task.name,
    // Cost
    baselineCost: task.cost,
    allocatedBudget: task.cost, // Default allocation = baseline
    currentEstimate: eac,
    actualSpend,
    etc,
    costVariance: eac - task.cost,
    // Duration
    baselineDuration,
    currentDuration,
    actualDuration,
    remainingDuration,
    durationVariance,
    // Performance
    cpi,
    spi,
    responsibleResourceId: task.responsibleResourceId,
    resourceCostRate,
    // Schedule
    scheduleVarianceDays: scheduleVarianceDays(remainingDays, spi),
  };
}

// ─── Project-Level Accounting ────────────────────────────────────────────────

/**
 * Compute full project accounting from a Project object.
 * Aggregates all tasks and calculates project-level totals.
 * @param project - The project with WBS tasks
 * @returns ProjectAccounting with all tables populated
 */
export function computeProjectAccounting(project: Project): ProjectAccounting {
  const allTasks = getAllTasks(project.wbs);
  const resourceMap = new Map(project.resources.map((r) => [r.id, r]));

  const taskAccounting: TaskAccounting[] = allTasks.map((task) => {
    const resource = task.responsibleResourceId ? resourceMap.get(task.responsibleResourceId) : null;
    const resourceCostRate = resource?.costRate ?? 0;
    // For now, spend entries come from accounting data if present
    const entries: ActualSpendEntry[] = [];
    return computeTaskAccounting(task, entries, resourceCostRate);
  });

  const baselineTotal = taskAccounting.reduce((sum, t) => sum + t.baselineCost, 0);
  const allocatedTotal = taskAccounting.reduce((sum, t) => sum + t.allocatedBudget, 0);
  const currentEstimateTotal = taskAccounting.reduce((sum, t) => sum + t.currentEstimate, 0);
  const actualSpendTotal = taskAccounting.reduce((sum, t) => sum + t.actualSpend, 0);
  const etcTotal = taskAccounting.reduce((sum, t) => sum + t.etc, 0);

  // Detect primary currency from task data
  const currencyByCount = new Map<string, number>();
  for (const task of allTasks) {
    const c = task.costCurrency || 'USD';
    currencyByCount.set(c, (currencyByCount.get(c) ?? 0) + 1);
  }
  let currency = 'USD';
  let maxCount = 0;
  for (const [c, count] of currencyByCount) {
    if (count > maxCount) {
      maxCount = count;
      currency = c;
    }
  }

  return {
    baselineTotal,
    allocatedTotal,
    currentEstimateTotal,
    actualSpendTotal,
    etcTotal,
    taskAccounting,
    spendEntries: [],
    changeLog: [],
    currency,
  };
}

// ─── Impact Calculations for Dependency Changes ──────────────────────────────

/**
 * Calculate the cost impact of a schedule shift caused by a dependency change.
 * @param task - The task being shifted
 * @param daysShifted - Number of days the task is delayed
 * @param resource - The assigned resource (for cost rate)
 * @returns Estimated additional cost from the shift
 */
export function calculateScheduleShiftCost(
  _task: WBSTask,
  daysShifted: number,
  resource: { costRate: number; costCurrency: string } | null,
): number {
  if (daysShifted <= 0 || !resource) return 0;
  // Cost = daily rate × days shifted
  // Assumes costRate is daily rate; if hourly, multiply by 8
  const dailyRate = resource.costRate >= 100 ? resource.costRate : resource.costRate * 8;
  return dailyRate * daysShifted;
}

/**
 * Calculate the impact of adding a dependency on successor tasks.
 * Returns a summary of schedule and cost impacts.
 * @param tasks - All project tasks
 * @param predecessorId - The predecessor task ID
 * @param successorId - The successor task ID
 * @param dependencyType - Type of dependency
 * @param lag - Lag in working days
 * @returns Impact summary with schedule and cost deltas
 */
export function calculateDependencyImpact(
  tasks: WBSTask[],
  predecessorId: string,
  successorId: string,
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF',
  lag: number,
): {
  scheduleImpactDays: number;
  costImpact: number;
  affectedTaskIds: string[];
} {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const predecessor = taskMap.get(predecessorId);
  const successor = taskMap.get(successorId);

  if (!predecessor || !successor) {
    return { scheduleImpactDays: 0, costImpact: 0, affectedTaskIds: [] };
  }

  // Calculate expected start based on dependency
  let expectedSuccessorStart: string;
  switch (dependencyType) {
    case 'FS':
      expectedSuccessorStart = predecessor.endDate;
      break;
    case 'SS':
      expectedSuccessorStart = predecessor.startDate;
      break;
    case 'FF':
      expectedSuccessorStart = predecessor.endDate;
      break;
    case 'SF':
      expectedSuccessorStart = predecessor.startDate;
      break;
    default:
      expectedSuccessorStart = successor.startDate;
  }

  // Calculate the shift
  const currentStart = successor.startDate;
  const shiftDays = dateDiffWorkingDays(currentStart, expectedSuccessorStart);

  // If no shift needed, no impact
  if (shiftDays <= 0 && lag <= 0) {
    return { scheduleImpactDays: 0, costImpact: 0, affectedTaskIds: [] };
  }

  // Calculate cost impact (simplified: resource cost × days)
  const totalShiftDays = Math.max(shiftDays, lag);
  let costImpact = 0;
  if (successor.responsibleResourceId) {
    // Would need resource lookup in real implementation
    costImpact = totalShiftDays * 100; // Placeholder rate
  }

  return {
    scheduleImpactDays: totalShiftDays,
    costImpact,
    affectedTaskIds: [successorId],
  };
}

/**
 * Calculate working days between two dates (simplified — no holiday support).
 */
function dateDiffWorkingDays(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T00:00:00');
  let days = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

/**
 * Format a variance value with color indicator info.
 * @param value - The variance amount
 * @param currency - Currency code
 * @returns Formatted string with sign indicator
 */
export function formatVariance(value: number, currency: string = 'USD'): string {
  const symbol = currencySymbol(currency);
  if (value >= 0) {
    return `+${symbol}${value.toFixed(2)}`;
  }
  return `-${symbol}${Math.abs(value).toFixed(2)}`;
}

/**
 * Format a performance index with status indicator.
 * @param index - CPI or SPI value
 * @returns Object with value and status label
 */
export function formatPerformanceIndex(index: number): { value: number; status: 'good' | 'warning' | 'critical' } {
  if (index >= 1.0) return { value: index, status: 'good' };
  if (index >= 0.85) return { value: index, status: 'warning' };
  return { value: index, status: 'critical' };
}

/**
 * Get currency symbol from currency code.
 */
function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3',
    JPY: '\u00A5',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF ',
    CNY: '\u00A5',
  };
  return symbols[currency] ?? currency + ' ';
}

// ─── Export Aggregations ─────────────────────────────────────────────────────

/**
 * Get accounting summary grouped by currency.
 * @param project - The project
 * @returns Map of currency → { baseline, allocated, estimate, actual }
 */
export function getAccountingByCurrency(
  project: Project,
): Map<string, { baseline: number; allocated: number; estimate: number; actual: number }> {
  const allTasks = getAllTasks(project.wbs);
  const result = new Map<string, { baseline: number; allocated: number; estimate: number; actual: number }>();

  for (const task of allTasks) {
    const currency = task.costCurrency || 'USD';
    const existing = result.get(currency) ?? { baseline: 0, allocated: 0, estimate: 0, actual: 0 };
    existing.baseline += task.cost;
    existing.allocated += task.cost;
    existing.estimate += task.cost;
    existing.actual += 0; // No actuals without spend entries
    result.set(currency, existing);
  }

  return result;
}

/**
 * Get cost roll-up summary for summary tasks.
 * Shows how costs aggregate up the WBS hierarchy.
 * @param tree - Root-level WBS tasks
 * @returns Array of { taskId, name, ownCost, totalCost, currency }
 */
export function getCostRollupSummary(
  tree: WBSTask[],
): Array<{ taskId: string; name: string; ownCost: number; totalCost: number; currency: string }> {
  return tree.map((task) => ({
    taskId: task.id,
    name: task.name,
    ownCost: task.cost,
    totalCost: rollUpCost(task),
    currency: task.costCurrency || 'USD',
  }));
}
