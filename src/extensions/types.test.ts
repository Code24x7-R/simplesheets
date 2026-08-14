// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type {
  Project,
  WBSTask,
  Risk,
  WorkingCalendar,
  Resource,
  RiskStatus,
  RiskCategory,
  RiskLevel,
  DependencyType,
  EffortUnit,
  GanttZoom,
  ViewMode,
  TaskDependency,
} from './types';

// ─── Helper factories ───────────────────────────────────────────────────────

function createCalendar(): WorkingCalendar {
  return {
    workingDays: new Set([1, 2, 3, 4, 5]), // Mon-Fri
    holidays: new Set(),
    hoursPerDay: 8,
  };
}

function createResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'res-1',
    name: 'Alice',
    role: 'Developer',
    costRate: 100,
    costCurrency: 'USD',
    availability: 100,
    color: '#3B82EF',
    ...overrides,
  };
}

function createTask(overrides: Partial<WBSTask> = {}): WBSTask {
  return {
    id: 'task-1',
    name: 'Design Phase',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-01',
    endDate: '2026-01-15',
    duration: 10,
    progress: 50,
    effort: 80,
    effortUnit: 'hours',
    cost: 8000,
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

function createRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: 'risk-1',
    projectId: 'proj-1',
    taskId: null,
    title: 'Scope creep',
    description: 'Requirements may expand',
    category: 'scope',
    probability: 3,
    impact: 4,
    riskScore: 12,
    status: 'identified',
    mitigationPlan: 'Strict change control',
    contingencyPlan: 'Buffer budget',
    mitigationCost: 5000,
    ownerId: null,
    identifiedDate: '2026-01-01',
    reviewDate: '2026-02-01',
    triggerCondition: 'New feature requests',
    residualProbability: 2,
    residualImpact: 3,
    residualRiskScore: 6,
    customFields: {},
    ...overrides,
  };
}

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    calendar: createCalendar(),
    resources: [createResource()],
    risks: [createRisk()],
    wbs: [createTask()],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Extension Types', () => {
  describe('WorkingCalendar', () => {
    it('creates a default Mon-Fri calendar', () => {
      const cal = createCalendar();
      expect(cal.workingDays.has(0)).toBe(false); // Sunday
      expect(cal.workingDays.has(1)).toBe(true);  // Monday
      expect(cal.workingDays.has(5)).toBe(true);  // Friday
      expect(cal.workingDays.has(6)).toBe(false); // Saturday
      expect(cal.hoursPerDay).toBe(8);
    });

    it('can have custom holidays', () => {
      const cal = createCalendar();
      cal.holidays.add('2026-12-25');
      expect(cal.holidays.has('2026-12-25')).toBe(true);
    });
  });

  describe('Resource', () => {
    it('creates a resource with defaults', () => {
      const res = createResource();
      expect(res.id).toBe('res-1');
      expect(res.name).toBe('Alice');
      expect(res.costRate).toBe(100);
      expect(res.availability).toBe(100);
    });

    it('allows overrides', () => {
      const res = createResource({ name: 'Bob', role: 'PM' });
      expect(res.name).toBe('Bob');
      expect(res.role).toBe('PM');
    });
  });

  describe('WBSTask', () => {
    it('creates a leaf task by default', () => {
      const task = createTask();
      expect(task.children).toEqual([]);
      expect(task.isSummary).toBe(false);
      expect(task.isMilestone).toBe(false);
      expect(task.level).toBe(0);
    });

    it('can represent a summary task', () => {
      const child = createTask({ id: 'child-1', parentId: 'parent', level: 1 });
      const parent = createTask({
        id: 'parent',
        isSummary: true,
        children: [child],
        level: 0,
      });
      expect(parent.isSummary).toBe(true);
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0].parentId).toBe('parent');
    });

    it('can represent a milestone', () => {
      const milestone = createTask({ isMilestone: true, duration: 0 });
      expect(milestone.isMilestone).toBe(true);
      expect(milestone.duration).toBe(0);
    });

    it('supports effort units', () => {
      const hours = createTask({ effortUnit: 'hours' as EffortUnit });
      const points = createTask({ effortUnit: 'storyPoints' as EffortUnit });
      const days = createTask({ effortUnit: 'days' as EffortUnit });
      expect(hours.effortUnit).toBe('hours');
      expect(points.effortUnit).toBe('storyPoints');
      expect(days.effortUnit).toBe('days');
    });

    it('can link risks', () => {
      const task = createTask({ riskIds: ['risk-1', 'risk-2'] });
      expect(task.riskIds).toHaveLength(2);
      expect(task.riskIds[0]).toBe('risk-1');
    });

    it('can have dependencies', () => {
      const dep: TaskDependency = { predecessorId: 'task-a', type: 'FS', lag: 0 };
      const task = createTask({ dependencies: [dep] });
      expect(task.dependencies).toHaveLength(1);
      expect(task.dependencies[0].type).toBe('FS');
    });
  });

  describe('Risk', () => {
    it('stores risk score from probability × impact', () => {
      const risk = createRisk({ probability: 4, impact: 5, riskScore: 20 });
      expect(risk.riskScore).toBe(20);
    });

    it('stores residual risk score', () => {
      const risk = createRisk({ residualProbability: 2, residualImpact: 3, residualRiskScore: 6 });
      expect(risk.residualRiskScore).toBe(6);
    });

    it('riskScore defaults to probability × impact when computed', () => {
      // When probability=3, impact=4, score should be 12
      const risk = createRisk({ probability: 3, impact: 4, riskScore: 3 * 4 });
      expect(risk.riskScore).toBe(12);
    });

    it('supports all statuses', () => {
      const statuses: RiskStatus[] = [
        'identified', 'assessing', 'mitigating', 'monitoring', 'occurred', 'closed',
      ];
      statuses.forEach((status) => {
        expect(createRisk({ status }).status).toBe(status);
      });
    });

    it('supports all categories', () => {
      const categories: RiskCategory[] = [
        'technical', 'schedule', 'cost', 'resource', 'external', 'quality', 'scope', 'other',
      ];
      categories.forEach((category) => {
        expect(createRisk({ category }).category).toBe(category);
      });
    });

    it('can be task-level or project-level', () => {
      const taskRisk = createRisk({ taskId: 'task-1' });
      const projectRisk = createRisk({ taskId: null });
      expect(taskRisk.taskId).toBe('task-1');
      expect(projectRisk.taskId).toBeNull();
    });
  });

  describe('Project', () => {
    it('creates a project with all components', () => {
      const proj = createProject();
      expect(proj.id).toBe('proj-1');
      expect(proj.wbs).toHaveLength(1);
      expect(proj.resources).toHaveLength(1);
      expect(proj.risks).toHaveLength(1);
      expect(proj.calendar).toBeDefined();
    });

    it('can have multiple root tasks', () => {
      const proj = createProject({
        wbs: [createTask({ id: 't1' }), createTask({ id: 't2' })],
      });
      expect(proj.wbs).toHaveLength(2);
    });
  });

  describe('Type unions', () => {
    it('DependencyType accepts all variants', () => {
      const types: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];
      expect(types).toHaveLength(4);
    });

    it('GanttZoom accepts all variants', () => {
      const zooms: GanttZoom[] = ['day', 'week', 'month'];
      expect(zooms).toHaveLength(3);
    });

    it('ViewMode accepts all variants', () => {
      const modes: ViewMode[] = ['gantt', 'wbs', 'risk-register', 'risk-matrix'];
      expect(modes).toHaveLength(4);
    });

    it('RiskLevel accepts all variants', () => {
      const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
      expect(levels).toHaveLength(4);
    });
  });
});
