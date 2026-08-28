// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project Analyzer Tests
 */

import { analyzeProject } from './projectAnalyzer';
import type { Project } from '../../types';

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function createMinimalProject(): Project {
  return {
    id: 'test-minimal',
    name: 'Minimal Test Project',
    description: 'A minimal project for testing',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    calendar: {
      workingDays: new Set([1, 2, 3, 4, 5]),
      holidays: new Set(),
      hoursPerDay: 8,
    },
    wbs: [
      {
        id: 'task-1',
        name: 'Task 1',
        startDate: '2026-01-01',
        endDate: '2026-01-10',
        description: 'First task',
        progress: 100,
        status: 'done',
        responsibleResourceId: 'res-1',
        cost: 5000,
        effort: 40,
        effortUnit: 'hours',
        dependencies: [],
        level: 0,
        parentId: null,
        children: [],
        duration: 10,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#3B82F6',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task-2',
        name: 'Task 2',
        startDate: '2026-01-11',
        endDate: '2026-01-20',
        description: 'Second task',
        progress: 50,
        status: 'in_progress',
        responsibleResourceId: 'res-1',
        cost: 3000,
        effort: 24,
        effortUnit: 'hours',
        dependencies: [{ predecessorId: 'task-1', type: 'FS', lag: 0 }],
        level: 0,
        parentId: null,
        children: [],
        duration: 10,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#10B981',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task-3',
        name: 'Task 3',
        startDate: '2026-01-21',
        endDate: '2026-01-31',
        description: 'Third task',
        progress: 0,
        status: 'not_started',
        responsibleResourceId: 'res-2',
        cost: 2000,
        effort: 16,
        effortUnit: 'hours',
        dependencies: [{ predecessorId: 'task-2', type: 'FS', lag: 0 }],
        level: 0,
        parentId: null,
        children: [],
        duration: 11,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#F59E0B',
        riskIds: [],
        customFields: {},
      },
    ],
    risks: [
      {
        id: 'risk-1',
        projectId: 'test-minimal',
        taskId: 'task-1',
        title: 'Test Risk',
        description: 'A test risk',
        category: 'technical',
        probability: 0.3,
        impact: 0.5,
        riskScore: 0.15,
        status: 'identified',
        mitigationPlan: 'Mitigation plan',
        contingencyPlan: '',
        mitigationCost: 0,
        ownerId: 'res-1',
        identifiedDate: '2026-01-01',
        reviewDate: '2026-01-15',
        triggerCondition: '',
        residualProbability: 0.1,
        residualImpact: 0.2,
        residualRiskScore: 0.02,
        customFields: {},
      },
    ],
    resources: [
      {
        id: 'res-1',
        name: 'Alice',
        role: 'Developer',
        costRate: 100,
        costCurrency: 'USD',
        availability: 100,
        color: '#3B82F6',
      },
      {
        id: 'res-2',
        name: 'Bob',
        role: 'Designer',
        costRate: 80,
        costCurrency: 'USD',
        availability: 100,
        color: '#10B981',
      },
    ],
    materials: [],
    accounting: {
      baselineTotal: 10000,
      allocatedTotal: 10000,
      currentEstimateTotal: 9800,
      actualSpendTotal: 4800,
      etcTotal: 5000,
      materialCostTotal: 0,
      currency: 'USD',
      taskAccounting: [],
      spendEntries: [
        {
          id: 'spend-1',
          taskId: 'task-1',
          date: '2026-01-10',
          amount: 4800,
          currency: 'USD',
          source: 'Invoice',
          notes: 'Task 1 actuals',
        },
      ],
      changeLog: [],
    },
  };
}

function createProjectWithIssues(): Project {
  return {
    id: 'test-issues',
    name: 'Project With Issues',
    description: 'A project with various issues',
    startDate: '2026-01-01',
    endDate: '2026-02-28',
    calendar: {
      workingDays: new Set([1, 2, 3, 4, 5]),
      holidays: new Set(),
      hoursPerDay: 8,
    },
    wbs: [
      {
        id: 'task-a',
        name: 'Task A - Missing cost',
        startDate: '2026-01-01',
        endDate: '2026-01-15',
        description: 'Task without cost',
        progress: 0,
        status: 'not_started',
        responsibleResourceId: '',
        cost: 0,
        effort: 0,
        effortUnit: 'hours',
        dependencies: [],
        level: 0,
        parentId: null,
        children: [],
        duration: 15,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#3B82F6',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task-b',
        name: 'Task B - Past due',
        startDate: '2026-01-01',
        endDate: '2026-01-10',
        description: 'Task past end date',
        progress: 30,
        status: 'in_progress',
        responsibleResourceId: 'res-1',
        cost: 5000,
        effort: 40,
        effortUnit: 'hours',
        dependencies: [{ predecessorId: 'nonexistent-task', type: 'FS', lag: 0 }],
        level: 0,
        parentId: null,
        children: [],
        duration: 10,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#10B981',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task-c',
        name: 'Task C - Overlapping',
        startDate: '2026-01-05',
        endDate: '2026-01-20',
        description: 'Overlaps with Task B',
        progress: 0,
        status: 'not_started',
        responsibleResourceId: 'res-1',
        cost: 3000,
        effort: 24,
        effortUnit: 'hours',
        dependencies: [],
        level: 0,
        parentId: null,
        children: [],
        duration: 16,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#F59E0B',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task-d',
        name: 'Task D - Circular ref',
        startDate: '2026-01-20',
        endDate: '2026-01-25',
        description: 'Has circular dependency',
        progress: 0,
        status: 'not_started',
        responsibleResourceId: 'res-1',
        cost: 2000,
        effort: 16,
        effortUnit: 'hours',
        dependencies: [{ predecessorId: 'task-e', type: 'FS', lag: 0 }],
        level: 0,
        parentId: null,
        children: [],
        duration: 6,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#EF4444',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task-e',
        name: 'Task E - Circular ref',
        startDate: '2026-01-25',
        endDate: '2026-01-28',
        description: 'Has circular dependency',
        progress: 0,
        status: 'not_started',
        responsibleResourceId: 'res-1',
        cost: 2000,
        effort: 16,
        effortUnit: 'hours',
        dependencies: [{ predecessorId: 'task-d', type: 'FS', lag: 0 }],
        level: 0,
        parentId: null,
        children: [],
        duration: 4,
        costCurrency: 'USD',
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#8B5CF6',
        riskIds: [],
        customFields: {},
      },
    ],
    risks: [
      {
        id: 'risk-high',
        projectId: 'test-issues',
        taskId: 'task-a',
        title: 'High Exposure Risk',
        description: 'High probability and impact',
        category: 'technical',
        probability: 0.8,
        impact: 0.7,
        riskScore: 0.56,
        status: 'identified',
        mitigationPlan: '',
        contingencyPlan: '',
        mitigationCost: 0,
        ownerId: 'res-1',
        identifiedDate: '2026-01-01',
        reviewDate: '2026-01-01',
        triggerCondition: '',
        residualProbability: 0,
        residualImpact: 0,
        residualRiskScore: 0,
        customFields: {},
      },
    ],
    resources: [
      {
        id: 'res-1',
        name: 'Overallocated Resource',
        role: 'Developer',
        costRate: 100,
        costCurrency: 'USD',
        availability: 100,
        color: '#3B82F6',
      },
    ],
    materials: [],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('projectAnalyzer', () => {
  describe('analyzeProject', () => {
    it('returns a complete analysis result', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.projectName).toBe('Minimal Test Project');
      expect(analysis.analysisDate).toBe('2026-01-15T00:00:00.000Z');
      expect(analysis.health).toBeDefined();
      expect(analysis.health.score).toBeGreaterThanOrEqual(0);
      expect(analysis.health.score).toBeLessThanOrEqual(100);
      expect(analysis.health.grade).toMatch(/^[A-F]$/);
      expect(analysis.categories).toHaveLength(7);
      expect(analysis.stats).toBeDefined();
      expect(analysis.nextSteps).toBeDefined();
    });

    it('calculates correct stats', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.stats.totalTasks).toBe(3);
      expect(analysis.stats.completedTasks).toBe(1);
      expect(analysis.stats.inProgressTasks).toBe(1);
      expect(analysis.stats.notStartedTasks).toBe(1);
      expect(analysis.stats.totalBudget).toBe(10000);
      expect(analysis.stats.actualSpend).toBe(4800);
      expect(analysis.stats.totalResources).toBe(2);
    });
  });

  describe('completeness analysis', () => {
    it('flags tasks missing cost estimates', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const completeness = analysis.categories.find(
        (c) => c.category === 'completeness',
      );
      expect(completeness).toBeDefined();

      const costFinding = completeness!.findings.find((f) =>
        f.title.includes('missing cost'),
      );
      expect(costFinding).toBeDefined();
      expect(costFinding!.severity).toBe('warning');
    });

    it('flags tasks missing resource assignments', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const completeness = analysis.categories.find(
        (c) => c.category === 'completeness',
      );
      const resourceFinding = completeness!.findings.find((f) =>
        f.title.includes('without assigned resources'),
      );
      expect(resourceFinding).toBeDefined();
    });

    it('flags missing budget', () => {
      const project = createMinimalProject();
      project.accounting = undefined;
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const completeness = analysis.categories.find(
        (c) => c.category === 'completeness',
      );
      const budgetFinding = completeness!.findings.find((f) =>
        f.title.includes('No project budget'),
      );
      expect(budgetFinding).toBeDefined();
    });

    it('reports success when all data is complete', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const completeness = analysis.categories.find(
        (c) => c.category === 'completeness',
      );
      const successFinding = completeness!.findings.find(
        (f) => f.severity === 'success',
      );
      expect(successFinding).toBeDefined();
    });
  });

  describe('dependency analysis', () => {
    it('detects broken dependency references', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const deps = analysis.categories.find(
        (c) => c.category === 'dependencies',
      );
      const brokenFinding = deps!.findings.find((f) =>
        f.title.includes('broken dependency'),
      );
      expect(brokenFinding).toBeDefined();
      expect(brokenFinding!.severity).toBe('critical');
    });

    it('detects circular dependencies', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const deps = analysis.categories.find(
        (c) => c.category === 'dependencies',
      );
      const cycleFinding = deps!.findings.find((f) =>
        f.title.includes('circular'),
      );
      expect(cycleFinding).toBeDefined();
      expect(cycleFinding!.severity).toBe('critical');
    });

    it('reports success when no dependency issues', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const deps = analysis.categories.find(
        (c) => c.category === 'dependencies',
      );
      const successFinding = deps!.findings.find(
        (f) => f.severity === 'success',
      );
      expect(successFinding).toBeDefined();
    });
  });

  describe('resource analysis', () => {
    it('detects over-allocated resources', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const resources = analysis.categories.find(
        (c) => c.category === 'resources',
      );
      const overallocationFinding = resources!.findings.find((f) =>
        f.title.includes('over-allocated'),
      );
      expect(overallocationFinding).toBeDefined();
      expect(overallocationFinding!.severity).toBe('warning');
    });

    it('flags unassigned tasks', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const resources = analysis.categories.find(
        (c) => c.category === 'resources',
      );
      const unassignedFinding = resources!.findings.find((f) =>
        f.title.includes('without resource assignment'),
      );
      expect(unassignedFinding).toBeDefined();
    });
  });

  describe('status analysis', () => {
    it('detects tasks past start date but not started', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-02-15',
      });

      const status = analysis.categories.find((c) => c.category === 'status');
      const pastStartFinding = status!.findings.find((f) =>
        f.title.includes('past start date'),
      );
      expect(pastStartFinding).toBeDefined();
      expect(pastStartFinding!.severity).toBe('critical');
    });

    it('detects stalled tasks (started but 0% progress)', () => {
      const project = createMinimalProject();
      project.wbs[1].progress = 0;
      project.wbs[1].status = 'in_progress';
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const status = analysis.categories.find((c) => c.category === 'status');
      const stalledFinding = status!.findings.find((f) =>
        f.title.includes('0% progress'),
      );
      expect(stalledFinding).toBeDefined();
    });
  });

  describe('financial analysis', () => {
    it('flags budget overrun projections', () => {
      const project = createMinimalProject();
      project.accounting!.currentEstimateTotal = 15000; // 50% over budget
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const financials = analysis.categories.find(
        (c) => c.category === 'financials',
      );
      const overrunFinding = financials!.findings.find((f) =>
        f.title.includes('exceed budget'),
      );
      expect(overrunFinding).toBeDefined();
    });

    it('flags spending rate exceeding planned rate', () => {
      const project = createMinimalProject();
      project.accounting!.actualSpendTotal = 8000; // 80% spent at ~50% time
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const financials = analysis.categories.find(
        (c) => c.category === 'financials',
      );
      const spendRateFinding = financials!.findings.find((f) =>
        f.title.includes('Spending rate'),
      );
      expect(spendRateFinding).toBeDefined();
    });

    it('reports success when financials are on track', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const financials = analysis.categories.find(
        (c) => c.category === 'financials',
      );
      const successFinding = financials!.findings.find(
        (f) => f.severity === 'success',
      );
      expect(successFinding).toBeDefined();
    });
  });

  describe('timeline analysis', () => {
    it('detects tasks past end date', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-02-15',
      });

      const timeline = analysis.categories.find(
        (c) => c.category === 'timeline',
      );
      const pastDueFinding = timeline!.findings.find((f) =>
        f.title.includes('past their end date'),
      );
      expect(pastDueFinding).toBeDefined();
      expect(pastDueFinding!.severity).toBe('critical');
    });

    it('detects tasks with end date before start date', () => {
      const project = createMinimalProject();
      project.wbs[0].endDate = '2025-12-01'; // Before start date
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const timeline = analysis.categories.find(
        (c) => c.category === 'timeline',
      );
      const invalidDateFinding = timeline!.findings.find((f) =>
        f.title.includes('end date before start date'),
      );
      expect(invalidDateFinding).toBeDefined();
      expect(invalidDateFinding!.severity).toBe('critical');
    });

    it('flags project past end date with incomplete work', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-02-15', // Past project end date
      });

      const timeline = analysis.categories.find(
        (c) => c.category === 'timeline',
      );
      const pastProjectEndFinding = timeline!.findings.find((f) =>
        f.title.includes('Project past end date'),
      );
      expect(pastProjectEndFinding).toBeDefined();
    });
  });

  describe('risk analysis', () => {
    it('flags high-exposure open risks', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const risks = analysis.categories.find((c) => c.category === 'risks');
      const highExposureFinding = risks!.findings.find((f) =>
        f.title.includes('high-exposure'),
      );
      expect(highExposureFinding).toBeDefined();
      expect(highExposureFinding!.severity).toBe('warning');
    });

    it('flags risks without mitigation plans', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const risks = analysis.categories.find((c) => c.category === 'risks');
      const noMitigationFinding = risks!.findings.find((f) =>
        f.title.includes('without mitigation plans'),
      );
      expect(noMitigationFinding).toBeDefined();
    });

    it('flags when no risks are identified', () => {
      const project = createMinimalProject();
      project.risks = [];
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      const risks = analysis.categories.find((c) => c.category === 'risks');
      const noRisksFinding = risks!.findings.find((f) =>
        f.title.includes('No risks identified'),
      );
      expect(noRisksFinding).toBeDefined();
    });
  });

  describe('health score', () => {
    it('gives high score for healthy project', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      // Minimal project has some info-level findings (e.g., tasks without deps)
      // so score should be reasonable
      expect(analysis.health.score).toBeGreaterThanOrEqual(50);
      expect(['A', 'B', 'C', 'D']).toContain(analysis.health.grade);
    });

    it('gives low score for project with many issues', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-02-15',
      });

      expect(analysis.health.score).toBeLessThan(70);
    });

    it('provides meaningful assessment text', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.health.assessment).toBeTruthy();
      expect(analysis.health.assessment.length).toBeGreaterThan(20);
    });
  });

  describe('next steps', () => {
    it('generates prioritized next steps', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.nextSteps.length).toBeGreaterThan(0);
      expect(analysis.nextSteps[0].priority).toBe(1);
    });

    it('prioritizes critical findings first', () => {
      const project = createProjectWithIssues();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-02-15',
      });

      const criticalSteps = analysis.nextSteps.filter(
        (s) => s.impact.includes('High'),
      );
      if (criticalSteps.length > 0) {
        expect(criticalSteps[0].priority).toBe(1);
      }
    });
  });

  describe('analyzer options', () => {
    it('respects enabledCategories option', () => {
      const project = createMinimalProject();
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
        enabledCategories: ['completeness', 'timeline'],
      });

      expect(analysis.categories).toHaveLength(2);
      expect(analysis.categories[0].category).toBe('completeness');
      expect(analysis.categories[1].category).toBe('timeline');
    });

    it('uses custom thresholds', () => {
      const project = createMinimalProject();
      project.accounting!.currentEstimateTotal = 10500; // 5% over budget
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
        thresholds: {
          budgetVarianceWarning: 0.02, // 2% triggers warning
          budgetVarianceCritical: 0.1,
          scheduleVarianceWarning: 0.1,
          scheduleVarianceCritical: 0.2,
          resourceUtilizationWarning: 0.8,
          resourceUtilizationCritical: 0.95,
          progressLaggingThreshold: 0.2,
          deadlineWarningDays: 14,
          overdueThresholdDays: 1,
        },
      });

      const financials = analysis.categories.find(
        (c) => c.category === 'financials',
      );
      const overrunFinding = financials!.findings.find((f) =>
        f.title.includes('over budget'),
      );
      expect(overrunFinding).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty project', () => {
      const project: Project = {
        id: 'empty',
        name: 'Empty Project',
        description: '',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        calendar: { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set(), hoursPerDay: 8 },
        wbs: [],
        risks: [],
        resources: [],
        materials: [],
      };
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.health.score).toBeDefined();
      expect(analysis.stats.totalTasks).toBe(0);
    });

    it('handles single task project', () => {
      const project: Project = {
        id: 'single',
        name: 'Single Task',
        description: '',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        calendar: { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set(), hoursPerDay: 8 },
        wbs: [
          {
            id: 'only-task',
            name: 'Only Task',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            description: '',
            progress: 50,
            status: 'in_progress',
            responsibleResourceId: 'res-1',
            cost: 1000,
            effort: 40,
            effortUnit: 'hours',
            dependencies: [],
            level: 0,
            parentId: null,
            children: [],
            duration: 31,
            costCurrency: 'USD',
            isMilestone: false,
            isSummary: false,
            collapsed: false,
            color: '#3B82F6',
            riskIds: [],
            customFields: {},
          },
        ],
        risks: [],
        resources: [
          {
            id: 'res-1',
            name: 'Resource',
            role: 'Role',
            costRate: 50,
            costCurrency: 'USD',
            availability: 100,
            color: '#000000',
          },
        ],
        materials: [],
      };
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.stats.totalTasks).toBe(1);
      expect(analysis.health.score).toBeDefined();
    });

    it('handles nested task structures', () => {
      const project = createMinimalProject();
      project.wbs = [
        {
          id: 'phase-1',
          name: 'Phase 1',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          description: '',
          progress: 50,
          status: 'in_progress',
          responsibleResourceId: 'res-1',
          cost: 10000,
          effort: 80,
          effortUnit: 'hours',
          dependencies: [],
          level: 0,
          parentId: null,
          isMilestone: false,
          isSummary: false,
          collapsed: false,
          color: '#3B82F6',
          riskIds: [],
          customFields: {},
          duration: 31,
          costCurrency: 'USD',
          children: [
            {
              id: 'child-1',
              name: 'Child Task 1',
              startDate: '2026-01-01',
              endDate: '2026-01-15',
              description: '',
              progress: 100,
              status: 'done',
              responsibleResourceId: 'res-1',
              cost: 5000,
              effort: 40,
              effortUnit: 'hours',
              dependencies: [],
              level: 1,
              parentId: 'phase-1',
              children: [],
              duration: 15,
              costCurrency: 'USD',
              isMilestone: false,
              isSummary: false,
              collapsed: false,
              color: '#10B981',
              riskIds: [],
              customFields: {},
            },
            {
              id: 'child-2',
              name: 'Child Task 2',
              startDate: '2026-01-16',
              endDate: '2026-01-31',
              description: '',
              progress: 0,
              status: 'not_started',
              responsibleResourceId: 'res-2',
              cost: 5000,
              effort: 40,
              effortUnit: 'hours',
              dependencies: [{ predecessorId: 'child-1', type: 'FS', lag: 0 }],
              level: 1,
              parentId: 'phase-1',
              children: [],
              duration: 16,
              costCurrency: 'USD',
              isMilestone: false,
              isSummary: false,
              collapsed: false,
              color: '#F59E0B',
              riskIds: [],
              customFields: {},
            },
          ],
        },
      ];
      const analysis = analyzeProject(project, {
        referenceDate: '2026-01-15',
      });

      expect(analysis.stats.totalTasks).toBe(2); // Only leaf tasks
    });
  });
});
