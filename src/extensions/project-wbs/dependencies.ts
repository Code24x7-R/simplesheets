// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Task Dependency Resolution
 *
 * Handles dependency graph operations:
 * - Build adjacency map from task dependencies
 * - Topological sort for execution order
 * - Cycle detection
 * - Critical path method (CPM): early/late start, total float
 */

import type { WBSTask, TaskDependency } from '../types';
import { createDefaultCalendar, workingDaysBetween, addWorkingDays } from './calendar';
import type { WorkingCalendar } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DependencyGraph {
  /** taskId → set of successor task IDs */
  successors: Map<string, Set<string>>;
  /** taskId → set of predecessor task IDs */
  predecessors: Map<string, Set<string>>;
}

export interface CPMCalculation {
  taskId: string;
  earlyStart: number;  // Working days from project start
  earlyEnd: number;
  lateStart: number;
  lateEnd: number;
  totalFloat: number;
  isCritical: boolean;
}

// ─── Graph Building ─────────────────────────────────────────────────────────

/**
 * Build a dependency graph from a flat list of tasks.
 * @param tasks - Flat array of all tasks.
 */
export function buildDependencyGraph(tasks: WBSTask[]): DependencyGraph {
  const successors = new Map<string, Set<string>>();
  const predecessors = new Map<string, Set<string>>();

  // Initialize with all task IDs
  for (const task of tasks) {
    if (!successors.has(task.id)) successors.set(task.id, new Set());
    if (!predecessors.has(task.id)) predecessors.set(task.id, new Set());
  }

  // Populate from dependencies
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (successors.has(dep.predecessorId)) {
        successors.get(dep.predecessorId)!.add(task.id);
      }
      if (predecessors.has(task.id)) {
        predecessors.get(task.id)!.add(dep.predecessorId);
      }
    }
  }

  return { successors, predecessors };
}

/**
 * Get all tasks as a flat list from a tree.
 * @param tree - Array of root-level tasks.
 */
export function flattenTasks(tree: WBSTask[]): WBSTask[] {
  const result: WBSTask[] = [];
  for (const task of tree) {
    result.push(task);
    result.push(...flattenTasks(task.children));
  }
  return result;
}

// ─── Topological Sort ───────────────────────────────────────────────────────

/**
 * Perform a topological sort on tasks based on dependencies.
 * Returns tasks in execution order.
 * @param tasks - Flat array of all tasks.
 * @returns Sorted array of tasks, or null if cycle detected.
 */
export function topologicalSort(tasks: WBSTask[]): WBSTask[] | null {
  const graph = buildDependencyGraph(tasks);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: WBSTask[] = [];

  function visit(id: string): boolean {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false; // Cycle

    visiting.add(id);

    const preds = graph.predecessors.get(id);
    if (preds) {
      for (const predId of preds) {
        if (!visit(predId)) return false;
      }
    }

    visiting.delete(id);
    visited.add(id);
    const task = taskMap.get(id);
    if (task) result.push(task);
    return true;
  }

  for (const task of tasks) {
    if (!visit(task.id)) return null;
  }

  return result;
}

/**
 * Detect cycles in the dependency graph.
 * @param tasks - Flat array of all tasks.
 * @returns Array of task IDs involved in cycles.
 */
export function detectDependencyCycles(tasks: WBSTask[]): string[] {
  const graph = buildDependencyGraph(tasks);
  const cycleIds = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string, path: string[]): boolean {
    if (inStack.has(id)) {
      // Found cycle — mark all nodes in the cycle
      const cycleStart = path.indexOf(id);
      for (let i = cycleStart; i < path.length; i++) {
        cycleIds.add(path[i]);
      }
      return true;
    }
    if (visited.has(id)) return false;

    visited.add(id);
    inStack.add(id);
    path.push(id);

    const succs = graph.successors.get(id);
    if (succs) {
      for (const succId of succs) {
        dfs(succId, path);
      }
    }

    path.pop();
    inStack.delete(id);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return Array.from(cycleIds);
}

// ─── Critical Path Method ───────────────────────────────────────────────────

/**
 * Calculate CPM values for all tasks.
 * @param tasks - Flat array of all tasks.
 * @param calendar - Working calendar.
 * @returns Map of taskId → CPM calculation.
 */
export function calculateCPM(
  tasks: WBSTask[],
  _calendar: WorkingCalendar = createDefaultCalendar(),
): Map<string, CPMCalculation> {
  const graph = buildDependencyGraph(tasks);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const result = new Map<string, CPMCalculation>();

  // Forward pass: calculate early start/end
  const sorted = topologicalSort(tasks);
  if (!sorted) return result; // Cycle detected

  const earlyStart = new Map<string, number>();
  const earlyEnd = new Map<string, number>();

  for (const task of sorted) {
    let maxStart = 0;
    const preds = graph.predecessors.get(task.id);
    if (preds) {
      for (const predId of preds) {
        const predStart = earlyStart.get(predId) ?? 0;
        const predEnd = earlyEnd.get(predId) ?? 0;
        const dep = findDependency(task, predId);
        const lag = dep ? dep.lag : 0;

        // Calculate the earliest this task can start based on dependency type
        let earliestStart: number;
        switch (dep?.type) {
          case 'SS': // Start-to-Start: successor starts after predecessor starts + lag
            earliestStart = predStart + lag;
            break;
          case 'FF': // Finish-to-Finish: successor ends after predecessor ends + lag
            earliestStart = predEnd + lag - task.duration + 1;
            break;
          case 'SF': // Start-to-Finish: successor ends after predecessor starts + lag
            earliestStart = predStart + lag - task.duration + 1;
            break;
          case 'FS': // Finish-to-Start: successor starts after predecessor ends + lag
          default:
            earliestStart = predEnd + lag + 1;
            break;
        }
        maxStart = Math.max(maxStart, earliestStart);
      }
    }
    earlyStart.set(task.id, maxStart);
    earlyEnd.set(task.id, maxStart + task.duration - 1);
  }

  // Find project end
  let projectEnd = 0;
  for (const end of earlyEnd.values()) {
    projectEnd = Math.max(projectEnd, end);
  }

  // Backward pass: calculate late start/end
  const lateEnd = new Map<string, number>();
  const lateStart = new Map<string, number>();

  for (let i = sorted.length - 1; i >= 0; i--) {
    const task = sorted[i];
    let minConstraint = projectEnd;
    const succs = graph.successors.get(task.id);
    if (succs && succs.size > 0) {
      for (const succId of succs) {
        const succLateStart = lateStart.get(succId) ?? projectEnd;
        const succLateEnd = lateEnd.get(succId) ?? projectEnd;
        const dep = findDependency(taskMap.get(succId)!, task.id);
        const lag = dep ? dep.lag : 0;

        // Calculate the latest this task can end based on dependency type
        let latestAllowed: number;
        switch (dep?.type) {
          case 'SS': // Start-to-Start: predecessor starts before successor starts + lag
            latestAllowed = succLateStart - lag - task.duration + 1;
            break;
          case 'FF': // Finish-to-Finish: predecessor ends before successor ends + lag
            latestAllowed = succLateEnd - lag;
            break;
          case 'SF': // Start-to-Finish: predecessor starts before successor ends + lag
            latestAllowed = succLateEnd - lag - task.duration + 1;
            break;
          case 'FS': // Finish-to-Start: predecessor ends before successor starts + lag
          default:
            latestAllowed = succLateStart - lag - 1;
            break;
        }
        minConstraint = Math.min(minConstraint, latestAllowed);
      }
    } else {
      minConstraint = projectEnd;
    }
    lateEnd.set(task.id, minConstraint);
    lateStart.set(task.id, minConstraint - task.duration + 1);
  }

  // Calculate total float and critical status
  for (const task of tasks) {
    const es = earlyStart.get(task.id) ?? 0;
    const ee = earlyEnd.get(task.id) ?? 0;
    const ls = lateStart.get(task.id) ?? 0;
    const le = lateEnd.get(task.id) ?? 0;
    const totalFloat = ls - es;

    result.set(task.id, {
      taskId: task.id,
      earlyStart: es,
      earlyEnd: ee,
      lateStart: ls,
      lateEnd: le,
      totalFloat,
      isCritical: totalFloat === 0,
    });
  }

  return result;
}

/**
 * Get the critical path — the sequence of tasks with zero total float.
 * @param tasks - Flat array of all tasks.
 * @param calendar - Working calendar.
 * @returns Array of task IDs on the critical path.
 */
export function getCriticalPath(
  tasks: WBSTask[],
  calendar: WorkingCalendar = createDefaultCalendar(),
): string[] {
  const cpm = calculateCPM(tasks, calendar);
  return Array.from(cpm.values())
    .filter((c) => c.isCritical)
    .map((c) => c.taskId);
}

/**
 * Calculate total float (scheduling slack) for a specific task.
 * @param tasks - Flat array of all tasks.
 * @param taskId - Task to calculate float for.
 * @param calendar - Working calendar.
 * @returns Total float in working days, or null if cycle.
 */
export function calculateTotalFloat(
  tasks: WBSTask[],
  taskId: string,
  calendar: WorkingCalendar = createDefaultCalendar(),
): number | null {
  const cpm = calculateCPM(tasks, calendar);
  const calc = cpm.get(taskId);
  return calc ? calc.totalFloat : null;
}

// ─── Date Propagation ───────────────────────────────────────────────────────

/**
 * Calculate the end date of a predecessor considering dependency type and lag.
 * @param predecessor - The predecessor task.
 * @param dependency - The dependency relationship.
 * @param projectStart - ISO date string of project start.
 * @param calendar - Working calendar.
 * @returns ISO date string for the calculated date.
 */
export function calculateDependencyDate(
  predecessor: WBSTask,
  dependency: TaskDependency,
  projectStart: string,
  calendar: WorkingCalendar = createDefaultCalendar(),
): string {
  const predStartOffset = workingDaysBetween(projectStart, predecessor.startDate, calendar);
  const predEndOffset = predStartOffset + predecessor.duration - 1;

  switch (dependency.type) {
    case 'FS': // Finish-to-Start: successor starts after predecessor finishes + lag
      return addWorkingDays(projectStart, predEndOffset + dependency.lag + 1, calendar);
    case 'SS': // Start-to-Start: successor starts after predecessor starts + lag
      return addWorkingDays(projectStart, predStartOffset + dependency.lag, calendar);
    case 'FF': // Finish-to-Finish: successor ends after predecessor ends + lag
      return addWorkingDays(projectStart, predEndOffset + dependency.lag - predecessor.duration + 1, calendar);
    case 'SF': // Start-to-Finish: successor ends after predecessor starts + lag
      return addWorkingDays(projectStart, predStartOffset + dependency.lag - predecessor.duration + 1, calendar);
    default:
      return predecessor.endDate;
  }
}

// ─── Internal ───────────────────────────────────────────────────────────────

/**
 * Find the dependency relationship where `fromId` is the predecessor of `task`.
 */
function findDependency(task: WBSTask, fromId: string): TaskDependency | undefined {
  return task.dependencies.find((d) => d.predecessorId === fromId);
}
