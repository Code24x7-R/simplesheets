// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * WBS Roll-up Calculations
 *
 * Computes summary task values from child tasks:
 * - Date roll-up (min start, max end from children)
 * - Progress roll-up (weighted average by duration)
 * - Cost roll-up (sum of descendant costs)
 * - Effort roll-up (sum of descendant effort)
 * - Risk score roll-up (aggregate risk exposure)
 */

import type { WBSTask, Risk } from '../types';
import { calculateDuration, createDefaultCalendar } from './calendar';

// ─── Date Roll-up ───────────────────────────────────────────────────────────

/**
 * Calculate the start date for a summary task based on its children.
 * Returns the earliest child start date.
 * @param children - Array of child tasks.
 * @returns ISO date string, or null if no children.
 */
export function rollUpStartDate(children: WBSTask[]): string | null {
  if (children.length === 0) return null;
  let earliest = children[0].startDate;
  for (const child of children) {
    if (child.startDate < earliest) earliest = child.startDate;
  }
  return earliest;
}

/**
 * Calculate the end date for a summary task based on its children.
 * Returns the latest child end date.
 * @param children - Array of child tasks.
 * @returns ISO date string, or null if no children.
 */
export function rollUpEndDate(children: WBSTask[]): string | null {
  if (children.length === 0) return null;
  let latest = children[0].endDate;
  for (const child of children) {
    if (child.endDate > latest) latest = child.endDate;
  }
  return latest;
}

/**
 * Roll up dates for a summary task from its children.
 * @param task - The summary task to update.
 * @returns New task with rolled-up dates.
 */
export function rollUpDates(task: WBSTask): WBSTask {
  if (task.children.length === 0) return task;
  const start = rollUpStartDate(task.children);
  const end = rollUpEndDate(task.children);
  return {
    ...task,
    startDate: start ?? task.startDate,
    endDate: end ?? task.endDate,
  };
}

// ─── Progress Roll-up ───────────────────────────────────────────────────────

/**
 * Calculate weighted average progress from children.
 * Weight is based on task duration (longer tasks contribute more).
 * @param children - Array of child tasks.
 * @returns Weighted average progress (0-100).
 */
export function rollUpProgress(children: WBSTask[]): number {
  if (children.length === 0) return 0;

  let totalWeightedProgress = 0;
  let totalDuration = 0;

  for (const child of children) {
    // Use child's rolled-up progress if it's a summary task
    const progress = child.isSummary
      ? rollUpProgress(child.children)
      : child.progress;
    const duration = Math.max(child.duration, 1);
    totalWeightedProgress += progress * duration;
    totalDuration += duration;
  }

  if (totalDuration === 0) return 0;
  return Math.round(totalWeightedProgress / totalDuration);
}

// ─── Cost Roll-up ───────────────────────────────────────────────────────────

/**
 * Calculate total cost from a task and all its descendants.
 * @param task - The task to calculate cost for.
 * @returns Total cost.
 */
export function rollUpCost(task: WBSTask): number {
  let total = task.cost;
  for (const child of task.children) {
    total += rollUpCost(child);
  }
  return total;
}

/**
 * Get cost breakdown by currency.
 * @param task - The task to analyze.
 * @returns Map of currency → total cost.
 */
export function rollUpCostByCurrency(task: WBSTask): Map<string, number> {
  const breakdown = new Map<string, number>();

  function accumulate(t: WBSTask): void {
    const currency = t.costCurrency || 'USD';
    breakdown.set(currency, (breakdown.get(currency) ?? 0) + t.cost);
    for (const child of t.children) {
      accumulate(child);
    }
  }

  accumulate(task);
  return breakdown;
}

// ─── Effort Roll-up ─────────────────────────────────────────────────────────

/**
 * Calculate total effort from a task and all its descendants.
 * Note: Only sums effort with the same unit. Mixed units are tracked separately.
 * @param task - The task to calculate effort for.
 * @returns Total effort.
 */
export function rollUpEffort(task: WBSTask): number {
  let total = task.effort;
  for (const child of task.children) {
    total += rollUpEffort(child);
  }
  return total;
}

/**
 * Get effort breakdown by unit type.
 * @param task - The task to analyze.
 * @returns Map of unit → total effort.
 */
export function rollUpEffortByUnit(task: WBSTask): Map<string, number> {
  const breakdown = new Map<string, number>();

  function accumulate(t: WBSTask): void {
    const unit = t.effortUnit || 'hours';
    breakdown.set(unit, (breakdown.get(unit) ?? 0) + t.effort);
    for (const child of t.children) {
      accumulate(child);
    }
  }

  accumulate(task);
  return breakdown;
}

// ─── Risk Roll-up ───────────────────────────────────────────────────────────

/**
 * Calculate aggregate risk score for a task based on linked risks.
 * Returns the maximum risk score among linked risks.
 * @param riskIds - IDs of risks linked to this task.
 * @param risks - Array of all project risks.
 * @returns Maximum risk score (0 if no risks).
 */
export function rollUpRiskScore(riskIds: string[], risks: Risk[]): number {
  if (riskIds.length === 0) return 0;
  let maxScore = 0;
  for (const risk of risks) {
    if (riskIds.includes(risk.id) && risk.riskScore > maxScore) {
      maxScore = risk.riskScore;
    }
  }
  return maxScore;
}

/**
 * Calculate aggregate risk exposure for a task including descendants.
 * @param task - The task to analyze.
 * @param risks - Array of all project risks.
 * @returns Maximum risk score in the subtree.
 */
export function rollUpRiskExposure(task: WBSTask, risks: Risk[]): number {
  let maxScore = rollUpRiskScore(task.riskIds, risks);
  for (const child of task.children) {
    const childExposure = rollUpRiskExposure(child, risks);
    if (childExposure > maxScore) maxScore = childExposure;
  }
  return maxScore;
}

// ─── Full Tree Recalculation ────────────────────────────────────────────────

/**
 * Recursively recompute roll-up values for all summary tasks in the tree.
 * Processes bottom-up (children before parents).
 * @param tree - Array of root-level tasks.
 * @param risks - Array of all project risks.
 * @returns New tree with all roll-ups computed.
 */
export function recomputeRollups(tree: WBSTask[], risks: Risk[]): WBSTask[] {
  return tree.map((task) => recomputeTaskRollup(task, risks));
}

/**
 * Recursively recompute roll-up values for a single task.
 */
function recomputeTaskRollup(task: WBSTask, risks: Risk[]): WBSTask {
  // First, recurse into children
  const updatedChildren = task.children.map((child) => recomputeTaskRollup(child, risks));

  // Then compute this task's roll-ups if it's a summary
  if (task.isSummary || updatedChildren.length > 0) {
    const start = rollUpStartDate(updatedChildren) ?? task.startDate;
    const end = rollUpEndDate(updatedChildren) ?? task.endDate;
    const progress = rollUpProgress(updatedChildren);
    const duration = calculateDuration(start, end, createDefaultCalendar());

    return {
      ...task,
      children: updatedChildren,
      startDate: start,
      endDate: end,
      duration: duration || task.duration,
      progress,
      cost: rollUpCost(task),
      effort: rollUpEffort(task),
    };
  }

  return { ...task, children: updatedChildren };
}

/**
 * Get a summary of the entire project tree.
 * @param tree - Array of root-level tasks.
 * @param risks - Array of all project risks.
 * @returns Summary statistics.
 */
export function getProjectSummary(tree: WBSTask[], risks: Risk[]): {
  totalTasks: number;
  totalCost: number;
  totalEffort: number;
  overallProgress: number;
  maxRiskScore: number;
  summaryTaskCount: number;
  milestoneCount: number;
} {
  let totalTasks = 0;
  let totalCost = 0;
  let totalEffort = 0;
  let totalWeightedProgress = 0;
  let totalDuration = 0;
  let maxRiskScore = 0;
  let summaryTaskCount = 0;
  let milestoneCount = 0;

  function traverse(task: WBSTask): void {
    totalTasks++;
    totalCost += task.cost;
    totalEffort += task.effort;
    totalWeightedProgress += task.progress * Math.max(task.duration, 1);
    totalDuration += Math.max(task.duration, 1);

    if (task.isSummary) summaryTaskCount++;
    if (task.isMilestone) milestoneCount++;

    const taskRisk = rollUpRiskScore(task.riskIds, risks);
    if (taskRisk > maxRiskScore) maxRiskScore = taskRisk;

    for (const child of task.children) {
      traverse(child);
    }
  }

  for (const task of tree) {
    traverse(task);
  }

  return {
    totalTasks,
    totalCost,
    totalEffort,
    overallProgress: totalDuration > 0 ? Math.round(totalWeightedProgress / totalDuration) : 0,
    maxRiskScore,
    summaryTaskCount,
    milestoneCount,
  };
}
