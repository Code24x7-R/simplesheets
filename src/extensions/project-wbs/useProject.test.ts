// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { renderHook, act } from '@testing-library/react';
import { useProject } from './useProject';
import type { Project, WBSTask, Risk } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTask(overrides: Partial<WBSTask> = {}): WBSTask {
  return {
    id: 'task-1',
    name: 'Task',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    duration: 5,
    progress: 0,
    effort: 10,
    effortUnit: 'hours',
    cost: 1000,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82EF',
    riskIds: [],
    customFields: {},
    ...overrides,
  };
}

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: '',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    calendar: { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set(), hoursPerDay: 8 },
    resources: [],
    risks: [],
    wbs: [],
    ...overrides,
  };
}

function createRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: 'risk-1',
    projectId: 'proj-1',
    taskId: null,
    title: 'Risk',
    description: '',
    category: 'technical',
    probability: 3,
    impact: 4,
    riskScore: 12,
    status: 'identified',
    mitigationPlan: '',
    contingencyPlan: '',
    mitigationCost: 0,
    ownerId: null,
    identifiedDate: '2026-01-01',
    reviewDate: '2026-02-01',
    triggerCondition: '',
    residualProbability: 2,
    residualImpact: 3,
    residualRiskScore: 6,
    customFields: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useProject', () => {
  it('initializes with the given project', () => {
    const project = createProject();
    const { result } = renderHook(() => useProject(project));
    expect(result.current.project).toEqual(project);
    expect(result.current.viewMode).toBe('gantt');
    expect(result.current.zoom).toBe('week');
    expect(result.current.selectedTaskId).toBeNull();
  });

  describe('task operations', () => {
    it('adds a root task', () => {
      const { result } = renderHook(() => useProject(createProject()));
      act(() => {
        result.current.addTask(null, createTask({ id: 't1' }));
      });
      expect(result.current.project.wbs).toHaveLength(1);
      expect(result.current.project.wbs[0].id).toBe('t1');
    });

    it('adds a child task', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ wbs: [createTask({ id: 'parent', isSummary: true })] })),
      );
      act(() => {
        result.current.addTask('parent', createTask({ id: 'child' }));
      });
      expect(result.current.project.wbs[0].children).toHaveLength(1);
    });

    it('updates a task', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ wbs: [createTask({ id: 't1', name: 'Old' })] })),
      );
      act(() => {
        result.current.updateTask('t1', { name: 'New' });
      });
      expect(result.current.project.wbs[0].name).toBe('New');
    });

    it('removes a task', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ wbs: [createTask({ id: 't1' })] })),
      );
      act(() => {
        result.current.removeTask('t1');
      });
      expect(result.current.project.wbs).toHaveLength(0);
    });

    it('toggles collapsed state', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ wbs: [createTask({ id: 't1' })] })),
      );
      expect(result.current.project.wbs[0].collapsed).toBe(false);
      act(() => {
        result.current.toggleCollapsed('t1');
      });
      expect(result.current.project.wbs[0].collapsed).toBe(true);
    });

    it('selects a task', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ wbs: [createTask({ id: 't1' })] })),
      );
      act(() => {
        result.current.selectTask('t1');
      });
      expect(result.current.selectedTaskId).toBe('t1');
    });

    it('finds a task by ID', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ wbs: [createTask({ id: 't1' })] })),
      );
      const task = result.current.getTask('t1');
      expect(task).not.toBeNull();
      expect(task!.id).toBe('t1');
    });

    it('returns null for non-existent task', () => {
      const { result } = renderHook(() => useProject(createProject()));
      expect(result.current.getTask('xyz')).toBeNull();
    });
  });

  describe('risk operations', () => {
    it('adds a risk', () => {
      const { result } = renderHook(() => useProject(createProject()));
      act(() => {
        result.current.addRisk(createRisk());
      });
      expect(result.current.project.risks).toHaveLength(1);
    });

    it('updates a risk', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ risks: [createRisk()] })),
      );
      act(() => {
        result.current.updateRisk('risk-1', { title: 'Updated' });
      });
      expect(result.current.project.risks[0].title).toBe('Updated');
    });

    it('closes a risk', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ risks: [createRisk()] })),
      );
      act(() => {
        result.current.closeRisk('risk-1');
      });
      expect(result.current.project.risks[0].status).toBe('closed');
    });

    it('removes a risk', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ risks: [createRisk()] })),
      );
      act(() => {
        result.current.removeRisk('risk-1');
      });
      expect(result.current.project.risks).toHaveLength(0);
    });

    it('links risk to task', () => {
      const { result } = renderHook(() =>
        useProject(createProject({
          wbs: [createTask({ id: 't1' })],
          risks: [createRisk()],
        })),
      );
      act(() => {
        result.current.linkRiskToTask('risk-1', 't1');
      });
      expect(result.current.project.risks[0].taskId).toBe('t1');
      expect(result.current.project.wbs[0].riskIds).toContain('risk-1');
    });

    it('unlinks risk from task', () => {
      const { result } = renderHook(() =>
        useProject(createProject({
          wbs: [createTask({ id: 't1', riskIds: ['risk-1'] })],
          risks: [createRisk({ taskId: 't1' })],
        })),
      );
      act(() => {
        result.current.unlinkRiskFromTask('risk-1');
      });
      expect(result.current.project.risks[0].taskId).toBeNull();
      expect(result.current.project.wbs[0].riskIds).not.toContain('risk-1');
    });
  });

  describe('view operations', () => {
    it('sets view mode', () => {
      const { result } = renderHook(() => useProject(createProject()));
      act(() => {
        result.current.setViewMode('risk-matrix');
      });
      expect(result.current.viewMode).toBe('risk-matrix');
    });

    it('sets zoom', () => {
      const { result } = renderHook(() => useProject(createProject()));
      act(() => {
        result.current.setZoom('month');
      });
      expect(result.current.zoom).toBe('month');
    });
  });

  describe('derived values', () => {
    it('computes flat tasks', () => {
      const { result } = renderHook(() =>
        useProject(createProject({
          wbs: [
            createTask({ id: 'parent', isSummary: true, children: [createTask({ id: 'child' })] }),
          ],
        })),
      );
      expect(result.current.flatTasks.map((t) => t.id)).toEqual(['parent', 'child']);
    });

    it('computes critical path', () => {
      const { result } = renderHook(() =>
        useProject(createProject({
          wbs: [
            createTask({ id: 'a', duration: 5 }),
            createTask({ id: 'b', duration: 3, dependencies: [{ predecessorId: 'a', type: 'FS', lag: 0 }] }),
          ],
        })),
      );
      expect(result.current.criticalPath).toContain('a');
      expect(result.current.criticalPath).toContain('b');
    });

    it('computes risk matrix', () => {
      const { result } = renderHook(() =>
        useProject(createProject({ risks: [createRisk({ probability: 3, impact: 4 })] })),
      );
      expect(result.current.riskMatrix.cells).toHaveLength(5);
    });
  });

  describe('recomputeAll', () => {
    it('recomputes rollups for all summary tasks', () => {
      const { result } = renderHook(() =>
        useProject(createProject({
          wbs: [
            createTask({
              id: 'parent',
              isSummary: true,
              cost: 0,
              effort: 0,
              children: [
                createTask({ id: 'a', cost: 100, effort: 10 }),
                createTask({ id: 'b', cost: 200, effort: 20 }),
              ],
            }),
          ],
        })),
      );
      act(() => {
        result.current.recomputeAll();
      });
      expect(result.current.project.wbs[0].cost).toBe(300);
      expect(result.current.project.wbs[0].effort).toBe(30);
    });
  });
});
