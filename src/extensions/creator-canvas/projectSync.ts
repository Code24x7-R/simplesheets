// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type { ProjectModel, TaskRow } from '../../types';
import type { CreatorCanvasModel, CreatorTaskRow } from './types';

export interface CanvasProjectSyncIssue {
  code: 'unlinked-task' | 'missing-wbs-task' | 'missing-node' | 'cycle' | 'unsupported-relationship';
  message: string;
  canvasId?: string;
  wbsTaskId?: string;
}

export interface CanvasProjectSyncResult {
  model: ProjectModel;
  canvas: CreatorCanvasModel;
  issues: CanvasProjectSyncIssue[];
  changed: boolean;
}

/**
 * Returns the WBS task ID explicitly linked to a canvas task or task node.
 * Sync is deliberately opt-in: ordinary creative notes and unlinked tasks
 * never create project work packages.
 */
export function getLinkedWbsTaskId(
  canvas: CreatorCanvasModel,
  task: CreatorTaskRow
): string | undefined {
  if (task.linkedWbsTaskId) return task.linkedWbsTaskId;
  const node = canvas.nodes.find((item) => item.id === task.linkedNodeId);
  if (node?.payload?.type === 'task') {
    return node.linkedWbsTaskId;
  }
  return undefined;
}

function flattenTaskRows(tasks: TaskRow[]): TaskRow[] {
  return tasks.map((task) => ({ ...task, dependencies: [...task.dependencies] }));
}

function hasDependencyCycle(tasks: TaskRow[]): boolean {
  const graph = new Map(tasks.map((task) => [task.id, task.dependencies]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const predecessor of graph.get(id) ?? []) {
      if (graph.has(predecessor) && visit(predecessor)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return tasks.some((task) => visit(task.id));
}

function canvasStatusToProgress(status: CreatorTaskRow['status']): number | null {
  switch (status) {
    case 'done': return 100;
    case 'review': return 75;
    case 'in-progress': return 50;
    case 'todo': return 0;
    default: return null;
  }
}

/**
 * Applies only explicit Canvas → WBS links. WBS schedule, cost, resources and
 * reporting remain authoritative; Canvas supplies creative title/description
 * and (when present) a conservative progress signal.
 */
export function syncCanvasToProjectModel(
  canvas: CreatorCanvasModel,
  project: ProjectModel
): CanvasProjectSyncResult {
  const issues: CanvasProjectSyncIssue[] = [];
  const tasks = flattenTaskRows(project.tasks);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const canvasTaskByWbsId = new Map<string, CreatorTaskRow>();

  for (const task of canvas.tasks) {
    const wbsId = getLinkedWbsTaskId(canvas, task);
    if (!wbsId) {
      if (task.linkedNodeId) issues.push({ code: 'unlinked-task', canvasId: task.id, message: `Canvas task "${task.title}" is not linked to a WBS task.` });
      continue;
    }
    if (!taskMap.has(wbsId)) {
      issues.push({ code: 'missing-wbs-task', canvasId: task.id, wbsTaskId: wbsId, message: `WBS task "${wbsId}" no longer exists.` });
      continue;
    }
    canvasTaskByWbsId.set(wbsId, task);
  }

  for (const row of tasks) {
    const canvasTask = canvasTaskByWbsId.get(row.id);
    if (!canvasTask) continue;
    const progress = canvasStatusToProgress(canvasTask.status);
    row.name = canvasTask.title;
    row.notes = canvasTask.description ?? row.notes;
    if (canvasTask.startDate) row.startDate = canvasTask.startDate;
    if (canvasTask.dueDate) row.endDate = canvasTask.dueDate;
    if (progress !== null) row.progress = progress;
  }

  // Only explicit dependency connectors between linked task nodes become WBS dependencies.
  const nodeToWbs = new Map<string, string>();
  for (const task of canvas.tasks) {
    const wbsId = getLinkedWbsTaskId(canvas, task);
    if (wbsId && task.linkedNodeId && taskMap.has(wbsId)) nodeToWbs.set(task.linkedNodeId, wbsId);
  }
  for (const connection of canvas.connections) {
    if (connection.relationship !== 'dependency') continue;
    const predecessorId = nodeToWbs.get(connection.fromNodeId);
    const successorId = nodeToWbs.get(connection.toNodeId);
    if (!predecessorId || !successorId) {
      issues.push({ code: 'missing-node', canvasId: connection.id, message: 'Dependency connector endpoints are not both linked WBS tasks.' });
      continue;
    }
    if (predecessorId === successorId) continue;
    const successor = taskMap.get(successorId)!;
    if (!successor.dependencies.includes(predecessorId)) successor.dependencies.push(predecessorId);
  }

  if (hasDependencyCycle(tasks)) {
    issues.push({ code: 'cycle', message: 'Sync rejected dependency changes because they would create a circular WBS dependency.' });
    // Restore dependency lists from the authoritative ProjectModel on cycle rejection.
    const original = new Map(project.tasks.map((task) => [task.id, task.dependencies]));
    for (const task of tasks) task.dependencies = [...(original.get(task.id) ?? [])];
  }

  return {
    model: { ...project, tasks },
    canvas,
    issues,
    changed: JSON.stringify(tasks) !== JSON.stringify(project.tasks),
  };
}

/** Updates linked Canvas task display fields from the PM/WBS model. */
export function syncProjectModelToCanvas(
  project: ProjectModel,
  canvas: CreatorCanvasModel
): CreatorCanvasModel {
  const taskMap = new Map(project.tasks.map((task) => [task.id, task]));
  const tasks = canvas.tasks.map((task) => {
    const wbsId = getLinkedWbsTaskId(canvas, task);
    const row = wbsId ? taskMap.get(wbsId) : undefined;
    if (!row) return task;
    const status: CreatorTaskRow['status'] = row.progress >= 100 ? 'done' : row.progress > 0 ? 'in-progress' : 'todo';
    return { ...task, title: row.name, description: row.notes, startDate: row.startDate, dueDate: row.endDate, status };
  });
  return { ...canvas, tasks };
}
