// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Repository
import { describe, it, expect } from '@jest/globals';
import type { WBSTask } from '../types';
import {
  isTaskBlocked,
  isTaskReady,
  updateTaskStatuses,
  generateStatusNotifications,
  getBlockedTasksWithReasons,
  getNextActionableTasks,
} from './dependencyWorkflows';

function createTask(overrides: Partial<WBSTask> = {}): WBSTask {
  return {
    id: 'task-1',
    name: 'Test Task',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-05',
    endDate: '2026-01-10',
    duration: 5,
    progress: 0,
    effort: 40,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    status: 'not_started',
    float: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82F6',
    riskIds: [],
    customFields: {},
    ...overrides,
  };
}

describe('isTaskBlocked', () => {
  it('returns false for task with no dependencies', () => {
    const task = createTask();
    expect(isTaskBlocked(task, [task])).toBe(false);
  });

  it('returns true when predecessor is not done', () => {
    const pred = createTask({ id: 'pred-1', status: 'in_progress' });
    const task = createTask({
      dependencies: [{ predecessorId: 'pred-1', type: 'FS', lag: 0 }],
    });
    expect(isTaskBlocked(task, [pred, task])).toBe(true);
  });

  it('returns false when predecessor is done', () => {
    const pred = createTask({ id: 'pred-1', status: 'done' });
    const task = createTask({
      dependencies: [{ predecessorId: 'pred-1', type: 'FS', lag: 0 }],
    });
    expect(isTaskBlocked(task, [pred, task])).toBe(false);
  });
});

describe('isTaskReady', () => {
  it('returns true for task with no dependencies', () => {
    const task = createTask();
    expect(isTaskReady(task, [task])).toBe(true);
  });

  it('returns false when predecessor is not done', () => {
    const pred = createTask({ id: 'pred-1', status: 'in_progress' });
    const task = createTask({
      dependencies: [{ predecessorId: 'pred-1', type: 'FS', lag: 0 }],
    });
    expect(isTaskReady(task, [pred, task])).toBe(false);
  });

  it('returns true when all predecessors are done', () => {
    const pred1 = createTask({ id: 'pred-1', status: 'done' });
    const pred2 = createTask({ id: 'pred-2', status: 'done' });
    const task = createTask({
      dependencies: [
        { predecessorId: 'pred-1', type: 'FS', lag: 0 },
        { predecessorId: 'pred-2', type: 'FS', lag: 0 },
      ],
    });
    expect(isTaskReady(task, [pred1, pred2, task])).toBe(true);
  });
});

describe('updateTaskStatuses', () => {
  it('transitions tasks from not_started to waiting when blocked', () => {
    const pred = createTask({ id: 'pred-1', status: 'in_progress' });
    const task = createTask({
      id: 'task-1',
      dependencies: [{ predecessorId: 'pred-1', type: 'FS', lag: 0 }],
      status: 'not_started',
    });

    const result = updateTaskStatuses([pred, task]);
    const updatedTask = result.find((t) => t.id === 'task-1');
    expect(updatedTask?.status).toBe('waiting');
  });

  it('transitions tasks from waiting to ready when unblocked', () => {
    const pred = createTask({ id: 'pred-1', status: 'done' });
    const task = createTask({
      id: 'task-1',
      dependencies: [{ predecessorId: 'pred-1', type: 'FS', lag: 0 }],
      status: 'waiting',
    });

    const result = updateTaskStatuses([pred, task]);
    const updatedTask = result.find((t) => t.id === 'task-1');
    expect(updatedTask?.status).toBe('ready');
  });

  it('does not change completed tasks', () => {
    const task = createTask({ status: 'done' });
    const result = updateTaskStatuses([task]);
    expect(result[0].status).toBe('done');
  });
});

describe('generateStatusNotifications', () => {
  it('generates unblocked notification when task transitions to ready', () => {
    const resources = [{ id: 'res-1', name: 'John', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' }];
    const prevTask = createTask({ id: 'task-1', status: 'waiting', responsibleResourceId: 'res-1' });
    const currTask = createTask({ id: 'task-1', status: 'ready', responsibleResourceId: 'res-1' });

    const notifications = generateStatusNotifications([prevTask], [currTask], resources);
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe('unblocked');
    expect(notifications[0].assigneeName).toBe('John');
  });

  it('generates blocked notification when task becomes blocked', () => {
    const prevTask = createTask({ id: 'task-1', status: 'ready' });
    const currTask = createTask({ id: 'task-1', status: 'waiting' });

    const notifications = generateStatusNotifications([prevTask], [currTask], []);
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe('blocked');
  });
});

describe('getBlockedTasksWithReasons', () => {
  it('returns blocked tasks with their blocking predecessors', () => {
    const pred = createTask({ id: 'pred-1', status: 'in_progress' });
    const task = createTask({
      id: 'task-1',
      dependencies: [{ predecessorId: 'pred-1', type: 'FS', lag: 0 }],
      status: 'waiting',
    });

    const result = getBlockedTasksWithReasons([pred, task]);
    expect(result.length).toBe(1);
    expect(result[0].task.id).toBe('task-1');
    expect(result[0].blockers.length).toBe(1);
    expect(result[0].blockers[0].id).toBe('pred-1');
  });
});

describe('getNextActionableTasks', () => {
  it('returns tasks that are ready to start', () => {
    const task1 = createTask({ id: 'task-1', status: 'ready' });
    const task2 = createTask({ id: 'task-2', status: 'waiting' });
    const task3 = createTask({ id: 'task-3', status: 'not_started' });

    const result = getNextActionableTasks([task1, task2, task3]);
    expect(result.length).toBe(2);
    expect(result.map((t) => t.id)).toContain('task-1');
    expect(result.map((t) => t.id)).toContain('task-3');
  });
});
