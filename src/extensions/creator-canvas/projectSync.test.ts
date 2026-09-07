// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { createEmptyCreatorCanvasModel, createDefaultCreatorTask } from './schema';
import { syncCanvasToProjectModel, syncProjectModelToCanvas } from './projectSync';
import type { ProjectModel } from '../../types';

function project(): ProjectModel {
  return {
    id: 'p1', name: 'Plan', description: '', startDate: '2026-01-01', endDate: '2026-01-31',
    tasks: [
      { id: 'wbs-a', name: 'Design', startDate: '2026-01-01', endDate: '2026-01-03', duration: 3, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#111', notes: '' },
      { id: 'wbs-b', name: 'Build', startDate: '2026-01-04', endDate: '2026-01-08', duration: 5, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#222', notes: '' },
    ],
    risks: [], resources: [], materials: [], actuals: [], allocations: [], consumptions: [],
  };
}

describe('Creator Canvas / Project sync', () => {
  it('updates only explicitly linked WBS tasks and maps dependency connectors', () => {
    const canvas = createEmptyCreatorCanvasModel('c1');
    const a = createDefaultCreatorTask('ca', 'Design', { linkedWbsTaskId: 'wbs-a', status: 'in-progress', description: 'Canvas brief' });
    const b = createDefaultCreatorTask('cb', 'Build', { linkedWbsTaskId: 'wbs-b', status: 'todo' });
    a.linkedNodeId = 'node-a';
    b.linkedNodeId = 'node-b';
    canvas.tasks = [a, b];
    canvas.connections = [{ id: 'c', fromNodeId: 'node-a', toNodeId: 'node-b', relationship: 'dependency' }];

    const result = syncCanvasToProjectModel(canvas, project());
    expect(result.model.tasks[0].name).toBe('Design');
    expect(result.model.tasks[0].progress).toBe(50);
    expect(result.model.tasks[0].notes).toBe('Canvas brief');
    expect(result.model.tasks[1].dependencies).toEqual(['wbs-a']);
    expect(result.issues).toEqual([]);
  });

  it('rejects a dependency connector that creates a cycle', () => {
    const canvas = createEmptyCreatorCanvasModel('c1');
    const a = createDefaultCreatorTask('ca', 'A', { linkedWbsTaskId: 'wbs-a' });
    const b = createDefaultCreatorTask('cb', 'B', { linkedWbsTaskId: 'wbs-b' });
    a.linkedNodeId = 'node-a';
    b.linkedNodeId = 'node-b';
    canvas.tasks = [a, b];
    canvas.connections = [
      { id: 'forward', fromNodeId: 'node-a', toNodeId: 'node-b', relationship: 'dependency' },
      { id: 'back', fromNodeId: 'node-b', toNodeId: 'node-a', relationship: 'dependency' },
    ];
    const result = syncCanvasToProjectModel(canvas, project());
    expect(result.issues.some((issue) => issue.code === 'cycle')).toBe(true);
    expect(result.model.tasks.every((task) => task.dependencies.length === 0)).toBe(true);
  });

  it('projects WBS status and dates back to linked canvas tasks', () => {
    const canvas = createEmptyCreatorCanvasModel('c1');
    canvas.tasks = [createDefaultCreatorTask('ca', 'Old', { linkedWbsTaskId: 'wbs-a' })];
    const model = project();
    model.tasks[0].name = 'Approved Design';
    model.tasks[0].progress = 100;
    const updated = syncProjectModelToCanvas(model, canvas);
    expect(updated.tasks[0]).toMatchObject({ title: 'Approved Design', status: 'done', dueDate: '2026-01-03' });
  });
});
