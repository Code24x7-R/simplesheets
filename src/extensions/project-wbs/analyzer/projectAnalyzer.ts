// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project State Analyzer Engine
 *
 * Core analysis logic that evaluates project health across multiple
 * dimensions: completeness, dependencies, resources, status,
 * financials, timeline, and risks.
 */

import type { Project, WBSTask } from '../../types';
import {
  type ProjectAnalysis,
  type ProjectHealth,
  type CategorySummary,
  type Finding,
  type AnalysisCategory,
  type ProjectStats,
  type NextStep,
  type AnalyzerOptions,
  DEFAULT_THRESHOLDS,
} from './types';

/** Flatten nested task tree into a list */
function flattenTasks(tasks: WBSTask[]): WBSTask[] {
  const result: WBSTask[] = [];
  for (const task of tasks) {
    result.push(task);
    if (task.children && task.children.length > 0) {
      result.push(...flattenTasks(task.children));
    }
  }
  return result;
}

/** Get only leaf tasks (no children) */
function getLeafTasks(tasks: WBSTask[]): WBSTask[] {
  const all = flattenTasks(tasks);
  return all.filter((t) => !t.children || t.children.length === 0);
}

/** Calculate days between two dates */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/** Derive task status from progress if status not set */
function deriveStatus(task: WBSTask): 'not_started' | 'in_progress' | 'done' {
  if (task.status) {
    if (task.status === 'done') return 'done';
    if (task.status === 'in_progress' || task.status === 'ready' || task.status === 'waiting') return 'in_progress';
    return 'not_started';
  }
  if (task.progress === 0) return 'not_started';
  if (task.progress === 100) return 'done';
  return 'in_progress';
}

/** Calculate project stats */
function calculateStats(project: Project, refDate: Date): ProjectStats {
  const leafTasks = getLeafTasks(project.wbs);

  const completedTasks = leafTasks.filter(
    (t) => deriveStatus(t) === 'done',
  ).length;
  const inProgressTasks = leafTasks.filter(
    (t) => deriveStatus(t) === 'in_progress',
  ).length;
  const notStartedTasks = leafTasks.filter(
    (t) => deriveStatus(t) === 'not_started',
  ).length;

  const openRisks = project.risks.filter(
    (r) => r.status === 'identified' || r.status === 'assessing' || r.status === 'mitigating' || r.status === 'monitoring',
  ).length;
  const mitigatedRisks = project.risks.filter(
    (r) => r.status === 'closed',
  ).length;

  const totalBudget =
    project.accounting?.allocatedTotal ??
    leafTasks.reduce((sum, t) => sum + (t.cost || 0), 0);

  const actualSpend =
    project.accounting?.actualSpendTotal ??
    project.accounting?.spendEntries?.reduce((sum, a) => sum + a.amount, 0) ??
    0;

  const projectedCost =
    project.accounting?.currentEstimateTotal ??
    actualSpend +
      leafTasks
        .filter((t) => deriveStatus(t) !== 'done')
        .reduce((sum, t) => sum + (t.cost || 0), 0);

  const totalDays = Math.max(1, daysBetween(project.startDate, project.endDate));
  const daysElapsed = Math.max(0, Math.min(totalDays, daysBetween(project.startDate, refDate.toISOString())));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);

  const percentTimeElapsed = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const percentWorkComplete =
    leafTasks.length > 0 ? (completedTasks / leafTasks.length) * 100 : 0;
  const percentBudgetSpent = totalBudget > 0 ? (actualSpend / totalBudget) * 100 : 0;

  return {
    totalTasks: leafTasks.length,
    completedTasks,
    inProgressTasks,
    notStartedTasks,
    totalRisks: project.risks.length,
    openRisks,
    mitigatedRisks,
    totalResources: project.resources.length,
    allocatedResources: new Set(
      leafTasks.map((t) => t.responsibleResourceId).filter((id): id is string => id !== null && id !== ''),
    ).size,
    totalBudget,
    actualSpend,
    projectedCost,
    daysElapsed,
    daysRemaining,
    percentTimeElapsed,
    percentWorkComplete,
    percentBudgetSpent,
  };
}

// ─── Category Analyzers ────────────────────────────────────────────────────

/** Analyze data completeness */
function analyzeCompleteness(
  project: Project,
  _stats: ProjectStats,
): CategorySummary {
  const findings: Finding[] = [];
  const leafTasks = getLeafTasks(project.wbs);

  // Check for tasks missing key fields
  const missingCost = leafTasks.filter((t) => !t.cost || t.cost === 0);
  const missingEffort = leafTasks.filter((t) => !t.effort || t.effort === 0);
  const missingResource = leafTasks.filter((t) => !t.responsibleResourceId);
  const missingDependencies = leafTasks.filter(
    (t) => (!t.dependencies || t.dependencies.length === 0) && leafTasks.length > 1,
  );

  if (missingCost.length > 0) {
    findings.push({
      category: 'completeness',
      severity: 'warning',
      title: `${missingCost.length} tasks missing cost estimates`,
      description: `${missingCost.length} of ${leafTasks.length} tasks have no cost estimate, making budget forecasting unreliable.`,
      affectedIds: missingCost.map((t) => t.id),
      recommendation:
        'Add cost estimates to all tasks. Use historical data or analogous estimating for similar tasks.',
    });
  }

  if (missingEffort.length > 0) {
    findings.push({
      category: 'completeness',
      severity: 'warning',
      title: `${missingEffort.length} tasks missing effort estimates`,
      description: `${missingEffort.length} tasks have no effort (hours) estimate, making resource planning difficult.`,
      affectedIds: missingEffort.map((t) => t.id),
      recommendation:
        'Add effort estimates in hours. Consider using bottom-up estimating for critical path tasks.',
    });
  }

  if (missingResource.length > 0) {
    findings.push({
      category: 'completeness',
      severity: 'warning',
      title: `${missingResource.length} tasks without assigned resources`,
      description: `${missingResource.length} tasks have no resource assignment, creating accountability gaps.`,
      affectedIds: missingResource.map((t) => t.id),
      recommendation:
        'Assign at least one responsible resource to each task. Use RACI matrix for complex assignments.',
    });
  }

  if (missingDependencies.length > leafTasks.length * 0.5 && leafTasks.length > 3) {
    findings.push({
      category: 'completeness',
      severity: 'info',
      title: `${missingDependencies.length} tasks without dependencies`,
      description: 'Most tasks have no dependencies defined. This may hide critical path relationships.',
      affectedIds: missingDependencies.map((t) => t.id),
      recommendation:
        'Define task dependencies to enable critical path analysis and identify scheduling conflicts.',
    });
  }

  // Check for missing project-level data
  if (!project.accounting || !project.accounting.baselineTotal) {
    findings.push({
      category: 'completeness',
      severity: 'warning',
      title: 'No project budget defined',
      description: 'The project has no baseline budget, making financial tracking impossible.',
      recommendation:
        'Define a baseline budget in the Accounting section. Include all cost categories.',
    });
  }

  if (project.risks.length === 0) {
    findings.push({
      category: 'completeness',
      severity: 'warning',
      title: 'No risks identified',
      description: 'No project risks have been identified. All projects face risks that should be tracked.',
      recommendation:
        'Conduct a risk identification workshop. Document at least top 5 risks with mitigation plans.',
    });
  }

  if ((!project.materials || project.materials.length === 0) && leafTasks.length > 5) {
    findings.push({
      category: 'completeness',
      severity: 'info',
      title: 'No materials/equipment tracked',
      description: 'No materials or equipment are being tracked for this project.',
      recommendation:
        'Consider tracking materials, equipment, and other non-labor resources if applicable.',
    });
  }

  // Success: all key fields populated
  if (
    missingCost.length === 0 &&
    missingEffort.length === 0 &&
    missingResource.length === 0 &&
    project.accounting?.baselineTotal
  ) {
    findings.push({
      category: 'completeness',
      severity: 'success',
      title: 'All tasks have complete data',
      description: 'All tasks have cost, effort, and resource assignments.',
      recommendation: 'Continue maintaining data quality as the project progresses.',
    });
  }

  return buildSummary('completeness', findings);
}

/** Analyze task dependencies */
function analyzeDependencies(
  project: Project,
  _stats: ProjectStats,
): CategorySummary {
  const findings: Finding[] = [];
  const leafTasks = getLeafTasks(project.wbs);
  const taskIds = new Set(leafTasks.map((t) => t.id));

  // Check for broken dependency references
  const brokenDeps: string[] = [];
  for (const task of leafTasks) {
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        if (!taskIds.has(dep.predecessorId)) {
          brokenDeps.push(dep.predecessorId);
        }
      }
    }
  }

  if (brokenDeps.length > 0) {
    findings.push({
      category: 'dependencies',
      severity: 'critical',
      title: `${brokenDeps.length} broken dependency references`,
      description: `Some tasks reference dependencies that do not exist: ${[...new Set(brokenDeps)].slice(0, 3).join(', ')}${brokenDeps.length > 3 ? '...' : ''}`,
      recommendation:
        'Fix broken dependency references. These may cause scheduling errors in critical path analysis.',
    });
  }

  // Check for circular dependencies
  const cycles = detectCycles(leafTasks);
  if (cycles.length > 0) {
    findings.push({
      category: 'dependencies',
      severity: 'critical',
      title: `${cycles.length} circular dependency chain(s) detected`,
      description: `Circular dependencies found involving: ${cycles[0].slice(0, 3).join(' → ')}...`,
      affectedIds: cycles[0],
      recommendation:
        'Break circular dependencies by redefining task relationships. Use finish-to-start dependencies.',
    });
  }

  // Check for orphaned tasks (no deps, not a milestone, not first task)
  const firstTaskIds = new Set(
    project.wbs.filter((t) => !t.children || t.children.length === 0).map((t) => t.id),
  );
  const orphanedTasks = leafTasks.filter(
    (t) =>
      !t.isMilestone &&
      !firstTaskIds.has(t.id) &&
      (!t.dependencies || t.dependencies.length === 0),
  );

  if (orphanedTasks.length > 0 && leafTasks.length > 3) {
    findings.push({
      category: 'dependencies',
      severity: 'info',
      title: `${orphanedTasks.length} tasks with no predecessor`,
      description: 'These tasks have no dependencies, which may indicate missing relationships.',
      affectedIds: orphanedTasks.map((t) => t.id),
      recommendation:
        'Review orphaned tasks and add appropriate dependencies to ensure accurate scheduling.',
    });
  }

  // Success
  if (brokenDeps.length === 0 && cycles.length === 0) {
    findings.push({
      category: 'dependencies',
      severity: 'success',
      title: 'No dependency issues',
      description: 'All dependencies are valid and no circular references detected.',
      recommendation: 'Continue reviewing dependencies as new tasks are added.',
    });
  }

  return buildSummary('dependencies', findings);
}

/** Detect circular dependencies using DFS */
function detectCycles(tasks: WBSTask[]): string[][] {
  const cycles: string[][] = [];
  const taskMap = new Map<string, string[]>();

  for (const task of tasks) {
    taskMap.set(task.id, task.dependencies?.map((d) => d.predecessorId) || []);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const deps = taskMap.get(nodeId) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep)) return true;
      } else if (recStack.has(dep)) {
        const cycleStart = path.indexOf(dep);
        cycles.push([...path.slice(cycleStart), dep]);
        return true;
      }
    }

    path.pop();
    recStack.delete(nodeId);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id);
    }
  }

  return cycles;
}

/** Analyze resource allocation */
function analyzeResources(
  project: Project,
  stats: ProjectStats,
  thresholds: typeof DEFAULT_THRESHOLDS,
): CategorySummary {
  const findings: Finding[] = [];
  const leafTasks = getLeafTasks(project.wbs);

  // Check for unassigned tasks
  const unassigned = leafTasks.filter((t) => !t.responsibleResourceId);
  if (unassigned.length > 0) {
    findings.push({
      category: 'resources',
      severity: 'warning',
      title: `${unassigned.length} tasks without resource assignment`,
      description: `${unassigned.length} of ${leafTasks.length} tasks have no assigned resource.`,
      affectedIds: unassigned.map((t) => t.id),
      recommendation:
        'Assign resources to all tasks. Consider workload balancing when making assignments.',
    });
  }

  // Check for resource over-allocation (same resource on overlapping tasks)
  const resourceTasks = new Map<string, WBSTask[]>();
  for (const task of leafTasks) {
    if (task.responsibleResourceId) {
      const existing = resourceTasks.get(task.responsibleResourceId) || [];
      existing.push(task);
      resourceTasks.set(task.responsibleResourceId, existing);
    }
  }

  const overAllocated: string[] = [];
  for (const [resourceId, tasks] of resourceTasks) {
    if (tasks.length <= 1) continue;

    // Check for overlapping date ranges
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const t1 = tasks[i];
        const t2 = tasks[j];
        if (datesOverlap(t1.startDate, t1.endDate, t2.startDate, t2.endDate)) {
          if (!overAllocated.includes(resourceId)) {
            overAllocated.push(resourceId);
          }
        }
      }
    }
  }

  if (overAllocated.length > 0) {
    const resourceNames = overAllocated.map((id) => {
      const r = project.resources.find((r) => r.id === id);
      return r?.name || id;
    });
    findings.push({
      category: 'resources',
      severity: 'warning',
      title: `${overAllocated.length} resource(s) over-allocated`,
      description: `Resources with overlapping task assignments: ${resourceNames.join(', ')}`,
      affectedIds: overAllocated,
      recommendation:
        'Resolve over-allocations by reassigning tasks, adjusting dates, or adding resources.',
    });
  }

  // Check resource utilization
  const utilizationRate =
    stats.totalResources > 0
      ? stats.allocatedResources / stats.totalResources
      : 0;

  if (utilizationRate < thresholds.resourceUtilizationWarning && stats.totalResources > 1) {
    findings.push({
      category: 'resources',
      severity: 'info',
      title: `Low resource utilization (${Math.round(utilizationRate * 100)}%)`,
      description: `Only ${stats.allocatedResources} of ${stats.totalResources} resources are assigned to tasks.`,
      recommendation:
        'Review resource assignments. Consider cross-training or reallocating underutilized resources.',
    });
  }

  // Success
  if (unassigned.length === 0 && overAllocated.length === 0) {
    findings.push({
      category: 'resources',
      severity: 'success',
      title: 'Resources properly allocated',
      description: 'All tasks assigned and no over-allocation detected.',
      recommendation: 'Monitor workload as project progresses and new tasks are added.',
    });
  }

  return buildSummary('resources', findings);
}

/** Check if two date ranges overlap */
function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return new Date(start1) <= new Date(end2) && new Date(end1) >= new Date(start2);
}

/** Analyze task status and progress */
function analyzeStatus(
  project: Project,
  stats: ProjectStats,
  thresholds: typeof DEFAULT_THRESHOLDS,
): CategorySummary {
  const findings: Finding[] = [];
  const leafTasks = getLeafTasks(project.wbs);

  // Check for stalled tasks (started but no progress recorded)
  const stalledTasks = leafTasks.filter(
    (t) => {
      const startDate = new Date(t.startDate);
      const today = new Date();
      return startDate < today && (!t.progress || t.progress === 0);
    },
  );
  if (stalledTasks.length > 0) {
    findings.push({
      category: 'status',
      severity: 'warning',
      title: `${stalledTasks.length} task(s) started but 0% progress`,
      description: 'These tasks have passed their start date but show no progress, which may indicate blockers.',
      affectedIds: stalledTasks.map((t) => t.id),
      recommendation:
        'Update task progress or identify blockers preventing work from proceeding.',
    });
  }

  // Check for not-started tasks past their start date
  const pastStartNotStarted = leafTasks.filter((t) => {
    if (deriveStatus(t) !== 'not_started') return false;
    const startDate = new Date(t.startDate);
    const today = new Date();
    return startDate < today;
  });
  if (pastStartNotStarted.length > 0) {
    findings.push({
      category: 'status',
      severity: 'critical',
      title: `${pastStartNotStarted.length} task(s) past start date but not started`,
      description: 'These tasks have passed their planned start date but remain in not-started status.',
      affectedIds: pastStartNotStarted.map((t) => t.id),
      recommendation:
        'Either start these tasks, update their status, or revise the schedule to reflect current reality.',
    });
  }

  // Check progress vs time elapsed (SPI indicator)
  if (
    stats.percentTimeElapsed > 20 &&
    stats.percentWorkComplete < stats.percentTimeElapsed - thresholds.progressLaggingThreshold * 100
  ) {
    findings.push({
      category: 'status',
      severity: 'warning',
      title: 'Project progress lagging behind schedule',
      description: `${Math.round(stats.percentWorkComplete)}% complete with ${Math.round(stats.percentTimeElapsed)}% of time elapsed. SPI ≈ ${(stats.percentWorkComplete / Math.max(1, stats.percentTimeElapsed)).toFixed(2)}`,
      recommendation:
        'Accelerate work on critical path tasks or consider crashing/fast-tracking the schedule.',
    });
  }

  // Success
  if (
    stalledTasks.length === 0 &&
    pastStartNotStarted.length === 0 &&
    stats.percentWorkComplete >= stats.percentTimeElapsed * 0.8
  ) {
    findings.push({
      category: 'status',
      severity: 'success',
      title: 'Task status healthy',
      description: 'Tasks are progressing appropriately with no blockers detected.',
      recommendation: 'Continue regular status updates and progress tracking.',
    });
  }

  return buildSummary('status', findings);
}

/** Analyze financial health */
function analyzeFinancials(
  project: Project,
  stats: ProjectStats,
  thresholds: typeof DEFAULT_THRESHOLDS,
): CategorySummary {
  const findings: Finding[] = [];

  if (!project.accounting || stats.totalBudget === 0) {
    findings.push({
      category: 'financials',
      severity: 'warning',
      title: 'No financial data to analyze',
      description: 'Project has no accounting data or budget defined.',
      recommendation:
        'Set up accounting data with baseline budget and track actual spend.',
    });
    return buildSummary('financials', findings);
  }

  // Budget variance
  const budgetVariance = stats.projectedCost - stats.totalBudget;
  const budgetVariancePct = stats.totalBudget > 0 ? budgetVariance / stats.totalBudget : 0;

  if (budgetVariancePct > thresholds.budgetVarianceCritical) {
    findings.push({
      category: 'financials',
      severity: 'critical',
      title: `Project projected to exceed budget by ${Math.round(budgetVariancePct * 100)}%`,
      description: `Projected cost ($${Math.round(stats.projectedCost).toLocaleString()}) exceeds budget ($${Math.round(stats.totalBudget).toLocaleString()}) by $${Math.round(budgetVariance).toLocaleString()}.`,
      recommendation:
        'Implement cost control measures. Review scope for potential descoping or value engineering.',
    });
  } else if (budgetVariancePct > thresholds.budgetVarianceWarning) {
    findings.push({
      category: 'financials',
      severity: 'warning',
      title: `Project trending ${Math.round(budgetVariancePct * 100)}% over budget`,
      description: `Current projections indicate a ${Math.round(budgetVariancePct * 100)}% budget overrun if trends continue.`,
      recommendation:
        'Monitor spending closely. Identify cost drivers and implement corrective actions.',
    });
  }

  // Actual spend vs budget
  const spendRate = stats.totalBudget > 0 ? stats.actualSpend / stats.totalBudget : 0;
  if (
    stats.percentTimeElapsed > 30 &&
    spendRate > stats.percentTimeElapsed / 100 + 0.15
  ) {
    findings.push({
      category: 'financials',
      severity: 'warning',
      title: 'Spending rate exceeds planned rate',
      description: `${Math.round(spendRate * 100)}% of budget spent with ${Math.round(stats.percentTimeElapsed)}% of time elapsed.`,
      recommendation:
        'Review spending patterns. Defer non-critical expenditures or negotiate better rates.',
    });
  }

  // Check for unmapped actuals (spend without task)
  const unmappedActuals = project.accounting.spendEntries?.filter((a) => !a.taskId) || [];
  if (unmappedActuals.length > 0) {
    findings.push({
      category: 'financials',
      severity: 'info',
      title: `${unmappedActuals.length} spend entries not linked to tasks`,
      description: 'Some actual spend entries are not linked to any task, reducing traceability.',
      affectedIds: unmappedActuals.map((a) => a.id),
      recommendation:
        'Link all spend entries to specific tasks for accurate cost tracking and forecasting.',
    });
  }

  // Success
  if (findings.length === 0) {
    findings.push({
      category: 'financials',
      severity: 'success',
      title: 'Financials on track',
      description: `Project is within budget with ${Math.round(stats.percentBudgetSpent)}% spent.`,
      recommendation: 'Continue monitoring actual spend against budget.',
    });
  }

  return buildSummary('financials', findings);
}

/** Analyze timeline health */
function analyzeTimeline(
  project: Project,
  stats: ProjectStats,
  thresholds: typeof DEFAULT_THRESHOLDS,
): CategorySummary {
  const findings: Finding[] = [];
  const leafTasks = getLeafTasks(project.wbs);

  // Check for tasks past due date
  const today = new Date();
  const pastDue = leafTasks.filter((t) => {
    if (deriveStatus(t) === 'done') return false;
    const endDate = new Date(t.endDate);
    return endDate < today;
  });

  if (pastDue.length > 0) {
    findings.push({
      category: 'timeline',
      severity: 'critical',
      title: `${pastDue.length} task(s) past their end date`,
      description: 'These tasks have passed their planned end date but are not marked complete.',
      affectedIds: pastDue.map((t) => t.id),
      recommendation:
        'Update task status or revise end dates. Assess impact on dependent tasks and milestones.',
    });
  }

  // Check for tasks approaching deadline
  const approachingDeadline = leafTasks.filter((t) => {
    if (deriveStatus(t) === 'done') return false;
    const endDate = new Date(t.endDate);
    const daysToDeadline = Math.floor(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysToDeadline >= 0 && daysToDeadline <= thresholds.deadlineWarningDays;
  });

  if (approachingDeadline.length > 0) {
    findings.push({
      category: 'timeline',
      severity: 'info',
      title: `${approachingDeadline.length} task(s) approaching deadline`,
      description: `These tasks have deadlines within the next ${thresholds.deadlineWarningDays} days.`,
      affectedIds: approachingDeadline.map((t) => t.id),
      recommendation:
        'Review progress on approaching tasks. Allocate additional resources if needed.',
    });
  }

  // Check project end date
  if (stats.daysRemaining <= 0 && stats.percentWorkComplete < 100) {
    findings.push({
      category: 'timeline',
      severity: 'critical',
      title: 'Project past end date with incomplete work',
      description: `Project end date has passed but only ${Math.round(stats.percentWorkComplete)}% of work is complete.`,
      recommendation:
        'Develop a recovery plan. Consider scope reduction or schedule extension with stakeholders.',
    });
  }

  // Check for tasks with end date before start date
  const invalidDates = leafTasks.filter(
    (t) => new Date(t.endDate) < new Date(t.startDate),
  );
  if (invalidDates.length > 0) {
    findings.push({
      category: 'timeline',
      severity: 'critical',
      title: `${invalidDates.length} task(s) with end date before start date`,
      description: 'These tasks have invalid date ranges that will cause scheduling errors.',
      affectedIds: invalidDates.map((t) => t.id),
      recommendation: 'Correct the date ranges so end dates are after start dates.',
    });
  }

  // Success
  if (
    pastDue.length === 0 &&
    invalidDates.length === 0 &&
    stats.daysRemaining > 0
  ) {
    findings.push({
      category: 'timeline',
      severity: 'success',
      title: 'Timeline on track',
      description: `No overdue tasks. ${stats.daysRemaining} days remaining until project end.`,
      recommendation: 'Continue monitoring task deadlines and dependencies.',
    });
  }

  return buildSummary('timeline', findings);
}

/** Analyze risk management */
function analyzeRisks(project: Project): CategorySummary {
  const findings: Finding[] = [];

  if (project.risks.length === 0) {
    findings.push({
      category: 'risks',
      severity: 'warning',
      title: 'No risks identified',
      description: 'No project risks have been documented.',
      recommendation:
        'Conduct risk identification and document at least top risks with mitigation plans.',
    });
    return buildSummary('risks', findings);
  }

  // Check for unlinked risks
  const allTaskIds = new Set(getLeafTasks(project.wbs).map((t) => t.id));
  const unlinkedRisks = project.risks.filter(
    (r) => r.taskId && !allTaskIds.has(r.taskId),
  );
  if (unlinkedRisks.length > 0) {
    findings.push({
      category: 'risks',
      severity: 'info',
      title: `${unlinkedRisks.length} risk(s) linked to non-existent tasks`,
      description: 'Some risks reference task IDs that do not exist in the project.',
      affectedIds: unlinkedRisks.map((r) => r.id),
      recommendation:
        'Update risk-task links to reference valid tasks or mark as project-level risks.',
    });
  }

  // Check for high-priority open risks
  const highPriorityOpen = project.risks.filter((r) => {
    const isOpen = r.status === 'identified' || r.status === 'assessing' || r.status === 'mitigating' || r.status === 'monitoring';
    const exposure = (r.probability || 0) * (r.impact || 0);
    return isOpen && exposure >= 0.25; // High exposure threshold
  });
  if (highPriorityOpen.length > 0) {
    findings.push({
      category: 'risks',
      severity: 'warning',
      title: `${highPriorityOpen.length} high-exposure risk(s) still open`,
      description: 'These risks have high probability × impact scores and require attention.',
      affectedIds: highPriorityOpen.map((r) => r.id),
      recommendation:
        'Prioritize mitigation actions for high-exposure risks. Consider contingency plans.',
    });
  }

  // Check for risks without mitigation plans
  const noMitigation = project.risks.filter(
    (r) => (!r.mitigationPlan || r.mitigationPlan.trim() === '') && (r.status === 'identified' || r.status === 'assessing' || r.status === 'mitigating'),
  );
  if (noMitigation.length > 0) {
    findings.push({
      category: 'risks',
      severity: 'info',
      title: `${noMitigation.length} open risk(s) without mitigation plans`,
      description: 'Open risks should have documented mitigation strategies.',
      affectedIds: noMitigation.map((r) => r.id),
      recommendation:
        'Develop mitigation plans for all open risks. Include triggers and contingency actions.',
    });
  }

  // Success
  const openRisks = project.risks.filter(
    (r) => r.status === 'identified' || r.status === 'assessing' || r.status === 'mitigating' || r.status === 'monitoring',
  );
  if (highPriorityOpen.length === 0 && noMitigation.length === 0 && unlinkedRisks.length === 0) {
    findings.push({
      category: 'risks',
      severity: 'success',
      title: 'Risk management healthy',
      description: `${openRisks.length} open risks being tracked with mitigation plans.`,
      recommendation: 'Continue monitoring risks and updating mitigation status.',
    });
  }

  return buildSummary('risks', findings);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildSummary(
  category: AnalysisCategory,
  findings: Finding[],
): CategorySummary {
  return {
    category,
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    success: findings.filter((f) => f.severity === 'success').length,
    findings,
  };
}

/** Calculate overall health score and grade */
function calculateHealth(
  categories: CategorySummary[],
  _stats: ProjectStats,
): ProjectHealth {
  let score = 100;
  const priorities: string[] = [];

  // Deduct points for critical findings
  for (const cat of categories) {
    score -= cat.critical * 15;
    score -= cat.warning * 5;
    score -= cat.info * 1;

    // Add top priorities from critical findings
    for (const finding of cat.findings.filter((f) => f.severity === 'critical')) {
      priorities.push(finding.title);
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  // Generate assessment
  let assessment: string;
  if (score >= 90) {
    assessment = 'Project is in excellent health. Continue current practices.';
  } else if (score >= 80) {
    assessment = 'Project is in good health with minor areas for improvement.';
  } else if (score >= 70) {
    assessment = 'Project has some issues that need attention to prevent escalation.';
  } else if (score >= 60) {
    assessment = 'Project has significant issues requiring immediate corrective action.';
  } else {
    assessment = 'Project is in critical condition. Major intervention required.';
  }

  return {
    score,
    grade,
    assessment,
    topPriorities: priorities.slice(0, 5),
  };
}

/** Generate actionable next steps */
function generateNextSteps(
  categories: CategorySummary[],
  _stats: ProjectStats,
): NextStep[] {
  const steps: NextStep[] = [];
  let priority = 1;

  // Critical items first
  for (const cat of categories) {
    for (const finding of cat.findings.filter((f) => f.severity === 'critical')) {
      steps.push({
        priority: priority++,
        category: finding.category,
        title: finding.title,
        description: finding.recommendation,
        impact: 'High - prevents project issues',
        effort: 'medium',
      });
    }
  }

  // Then warnings
  for (const cat of categories) {
    for (const finding of cat.findings.filter((f) => f.severity === 'warning')) {
      steps.push({
        priority: priority++,
        category: finding.category,
        title: finding.title,
        description: finding.recommendation,
        impact: 'Medium - improves project health',
        effort: 'low',
      });
    }
  }

  // Then info items (limited)
  let infoCount = 0;
  for (const cat of categories) {
    for (const finding of cat.findings.filter((f) => f.severity === 'info')) {
      if (infoCount >= 3) break;
      steps.push({
        priority: priority++,
        category: finding.category,
        title: finding.title,
        description: finding.recommendation,
        impact: 'Low - enhances project quality',
        effort: 'low',
      });
      infoCount++;
    }
  }

  return steps;
}

// ─── Main Analyzer ─────────────────────────────────────────────────────────

/**
 * Analyze a project and generate a comprehensive health report.
 *
 * @param project - The project to analyze
 * @param options - Optional analyzer configuration
 * @returns Complete project analysis with findings and recommendations
 */
export function analyzeProject(
  project: Project,
  options?: AnalyzerOptions,
): ProjectAnalysis {
  const thresholds = options?.thresholds ?? DEFAULT_THRESHOLDS;
  const refDate = options?.referenceDate
    ? new Date(options.referenceDate)
    : new Date();
  const enabledCategories = options?.enabledCategories ?? [
    'completeness',
    'dependencies',
    'resources',
    'status',
    'financials',
    'timeline',
    'risks',
  ];

  // Calculate base stats
  const stats = calculateStats(project, refDate);

  // Run category analyzers
  const categories: CategorySummary[] = [];

  if (enabledCategories.includes('completeness')) {
    categories.push(analyzeCompleteness(project, stats));
  }
  if (enabledCategories.includes('dependencies')) {
    categories.push(analyzeDependencies(project, stats));
  }
  if (enabledCategories.includes('resources')) {
    categories.push(analyzeResources(project, stats, thresholds));
  }
  if (enabledCategories.includes('status')) {
    categories.push(analyzeStatus(project, stats, thresholds));
  }
  if (enabledCategories.includes('financials')) {
    categories.push(analyzeFinancials(project, stats, thresholds));
  }
  if (enabledCategories.includes('timeline')) {
    categories.push(analyzeTimeline(project, stats, thresholds));
  }
  if (enabledCategories.includes('risks')) {
    categories.push(analyzeRisks(project));
  }

  // Flatten all findings
  const allFindings = categories.flatMap((c) => c.findings);

  // Calculate overall health
  const health = calculateHealth(categories, stats);

  // Generate next steps
  const nextSteps = generateNextSteps(categories, stats);

  return {
    projectName: project.name,
    analysisDate: refDate.toISOString(),
    health,
    categories,
    allFindings,
    stats,
    nextSteps,
  };
}
