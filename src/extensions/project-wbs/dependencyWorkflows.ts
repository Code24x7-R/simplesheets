// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Dependency Automation Workflows
 *
 * Implements workflow-driven dependency management:
 * 1. Dynamic Auto-Scheduling: Cascade date changes to successors
 * 2. Status-Driven Triggers: Lock tasks until predecessors complete
 * 3. Assignee Notifications: Alert when tasks become unblocked
 * 4. Approval/Gate Automation: External approvals unblock phases
 */

import type { Project, WBSTask, TaskDependency } from '../types';
import { topologicalSort } from './dependencies';
import { addWorkingDays } from './calendar';

// ─── Task Status ───────────────────────────────────────────────────────────

export type TaskStatus = 'not_started' | 'waiting' | 'ready' | 'in_progress' | 'done' | 'on_hold';

/**
 * Check if a task is blocked by incomplete predecessors.
 */
export function isTaskBlocked(task: WBSTask, allTasks: WBSTask[]): boolean {
  if (task.dependencies.length === 0) return false;

  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  for (const dep of task.dependencies) {
    const predecessor = taskMap.get(dep.predecessorId);
    if (!predecessor) continue;

    // Task is blocked if predecessor is not done
    if (predecessor.status !== 'done') {
      return true;
    }
  }

  return false;
}

/**
 * Check if a task is ready to start (all predecessors complete).
 */
export function isTaskReady(task: WBSTask, allTasks: WBSTask[]): boolean {
  if (task.dependencies.length === 0) return true;

  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  for (const dep of task.dependencies) {
    const predecessor = taskMap.get(dep.predecessorId);
    if (!predecessor) continue;

    // Task is not ready if predecessor is not done
    if (predecessor.status !== 'done') {
      return false;
    }
  }

  return true;
}

// ─── Workflow 1: Dynamic Auto-Scheduling ───────────────────────────────────

/**
 * Propagate date changes from a modified task to all successors.
 * Uses topological order to ensure correct cascade.
 */
export function autoScheduleSuccessors(
  tasks: WBSTask[],
  modifiedTaskId: string,
  calendar: Project['calendar'],
): WBSTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));
  const sorted = topologicalSort(tasks);
  if (!sorted) return tasks; // Cycle detected

  // Process in topological order starting from modified task
  let foundModified = false;
  for (const task of sorted) {
    if (task.id === modifiedTaskId) {
      foundModified = true;
      continue;
    }
    if (!foundModified) continue;

    // Check if this task depends on the modified task (directly or transitively)
    const updatedTask = taskMap.get(task.id)!;
    let needsUpdate = false;
    let newStartDate = updatedTask.startDate;

    for (const dep of updatedTask.dependencies) {
      const predecessor = taskMap.get(dep.predecessorId);
      if (!predecessor) continue;

      // Calculate expected start based on dependency
      let expectedStart: string;
      switch (dep.type) {
        case 'FS':
          expectedStart = addWorkingDays(predecessor.endDate, dep.lag + 1, calendar);
          break;
        case 'SS':
          expectedStart = addWorkingDays(predecessor.startDate, dep.lag, calendar);
          break;
        case 'FF':
          // For FF, adjust start to maintain finish relationship
          expectedStart = addWorkingDays(predecessor.endDate, dep.lag - updatedTask.duration + 1, calendar);
          break;
        case 'SF':
          expectedStart = addWorkingDays(predecessor.startDate, dep.lag - updatedTask.duration + 1, calendar);
          break;
        default:
          expectedStart = newStartDate;
      }

      // Update if this predecessor requires a later start
      if (expectedStart > newStartDate) {
        newStartDate = expectedStart;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const duration = updatedTask.duration;
      updatedTask.startDate = newStartDate;
      updatedTask.endDate = addWorkingDays(newStartDate, duration - 1, calendar);
      taskMap.set(task.id, updatedTask);
    }
  }

  return Array.from(taskMap.values());
}

// ─── Workflow 2: Status-Driven Triggers ────────────────────────────────────

/**
 * Update task statuses based on dependency completion.
 * Transitions tasks from 'waiting' to 'ready' when predecessors complete.
 */
export function updateTaskStatuses(tasks: WBSTask[]): WBSTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));

  for (const task of Array.from(taskMap.values())) {
    // Skip tasks that are already done, in progress, or on hold
    if (task.status === 'done' || task.status === 'in_progress' || task.status === 'on_hold') {
      continue;
    }

    const allTasks = Array.from(taskMap.values());

    if (isTaskBlocked(task, allTasks)) {
      // Task has incomplete predecessors → waiting
      if (task.status !== 'waiting') {
        task.status = 'waiting';
        taskMap.set(task.id, task);
      }
    } else if (isTaskReady(task, allTasks)) {
      // All predecessors complete → ready
      if (task.status === 'not_started' || task.status === 'waiting') {
        task.status = 'ready';
        taskMap.set(task.id, task);
      }
    }
  }

  return Array.from(taskMap.values());
}

// ─── Workflow 3: Assignee Notifications ─────────────────────────────────────

export interface TaskNotification {
  taskId: string;
  taskName: string;
  assigneeResourceId: string | null;
  assigneeName: string | null;
  type: 'unblocked' | 'blocked' | 'overdue';
  message: string;
  timestamp: Date;
}

/**
 * Generate notifications for tasks that changed status.
 */
export function generateStatusNotifications(
  previousTasks: WBSTask[],
  currentTasks: WBSTask[],
  resources: Project['resources'],
): TaskNotification[] {
  const notifications: TaskNotification[] = [];
  const prevMap = new Map(previousTasks.map((t) => [t.id, t]));
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  for (const current of currentTasks) {
    const previous = prevMap.get(current.id);
    if (!previous) continue;

    // Task transitioned to ready (unblocked)
    if (previous.status === 'waiting' && current.status === 'ready') {
      const assignee = current.responsibleResourceId
        ? resourceMap.get(current.responsibleResourceId)
        : null;

      notifications.push({
        taskId: current.id,
        taskName: current.name,
        assigneeResourceId: current.responsibleResourceId,
        assigneeName: assignee?.name ?? null,
        type: 'unblocked',
        message: `"${current.name}" is now ready to start (all predecessors complete)`,
        timestamp: new Date(),
      });
    }

    // Task transitioned to waiting (blocked)
    if (previous.status === 'ready' && current.status === 'waiting') {
      const assignee = current.responsibleResourceId
        ? resourceMap.get(current.responsibleResourceId)
        : null;

      notifications.push({
        taskId: current.id,
        taskName: current.name,
        assigneeResourceId: current.responsibleResourceId,
        assigneeName: assignee?.name ?? null,
        type: 'blocked',
        message: `"${current.name}" is now blocked (predecessor incomplete)`,
        timestamp: new Date(),
      });
    }
  }

  return notifications;
}

// ─── Workflow 4: Approval/Gate Automation ───────────────────────────────────

export interface ApprovalGate {
  taskId: string;
  gateType: 'approval' | 'review' | 'sign_off' | 'external';
  approved: boolean;
  approvedBy: string | null;
  approvedDate: string | null;
  notes: string;
}

/**
 * Check if a task has pending approval gates.
 */
export function hasPendingGates(task: WBSTask): boolean {
  return task.approvalGates?.some((gate) => !gate.approved) ?? false;
}

/**
 * Approve a gate and unblock dependent tasks.
 */
export function approveGate(
  tasks: WBSTask[],
  taskId: string,
  gateIndex: number,
  approvedBy: string,
  notes: string,
): WBSTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t, approvalGates: t.approvalGates ? [...t.approvalGates] : [] }]));

  const task = taskMap.get(taskId);
  if (!task || !task.approvalGates || !task.approvalGates[gateIndex]) return tasks;

  task.approvalGates[gateIndex] = {
    ...task.approvalGates[gateIndex],
    approved: true,
    approvedBy,
    approvedDate: new Date().toISOString().slice(0, 10),
    notes,
  };

  taskMap.set(taskId, task);
  return Array.from(taskMap.values());
}

// ─── Workflow 5: Template Cascading ────────────────────────────────────────

/**
 * Instantiate a project from a template with pre-configured dependencies.
 */
export function instantiateTemplateDependencies(
  tasks: WBSTask[],
  templateDependencies: Array<{
    predecessorName: string;
    successorName: string;
    type: TaskDependency['type'];
    lag: number;
  }>,
): WBSTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t, dependencies: [...t.dependencies] }]));
  const nameToId = new Map(tasks.map((t) => [t.name.toLowerCase(), t.id]));

  for (const templateDep of templateDependencies) {
    const predId = nameToId.get(templateDep.predecessorName.toLowerCase());
    const succId = nameToId.get(templateDep.successorName.toLowerCase());

    if (!predId || !succId) continue;

    const successor = taskMap.get(succId)!;

    // Check if dependency already exists
    const existingDep = successor.dependencies.find((d) => d.predecessorId === predId);
    if (!existingDep) {
      successor.dependencies.push({
        predecessorId: predId,
        type: templateDep.type,
        lag: templateDep.lag,
      });
      taskMap.set(succId, successor);
    }
  }

  return Array.from(taskMap.values());
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Get all blocked tasks with their blocking predecessors.
 */
export function getBlockedTasksWithReasons(
  tasks: WBSTask[],
): Array<{ task: WBSTask; blockers: WBSTask[] }> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const result: Array<{ task: WBSTask; blockers: WBSTask[] }> = [];

  for (const task of tasks) {
    if (task.status === 'done') continue;

    const blockers: WBSTask[] = [];
    for (const dep of task.dependencies) {
      const predecessor = taskMap.get(dep.predecessorId);
      if (predecessor && predecessor.status !== 'done') {
        blockers.push(predecessor);
      }
    }

    if (blockers.length > 0) {
      result.push({ task, blockers });
    }
  }

  return result;
}

/**
 * Calculate the next actionable tasks (ready to start).
 */
export function getNextActionableTasks(tasks: WBSTask[]): WBSTask[] {
  return tasks.filter((t) => {
    if (t.status !== 'not_started' && t.status !== 'ready') return false;
    return isTaskReady(t, tasks);
  });
}
