// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  rollUpStartDate,
  rollUpEndDate,
  rollUpDates,
  rollUpProgress,
  rollUpCost,
  rollUpCostByCurrency,
  rollUpEffort,
  rollUpEffortByUnit,
  rollUpRiskScore,
  rollUpRiskExposure,
  recomputeRollups,
  getProjectSummary,
} from './rollups';
import type { WBSTask, Risk } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function task(overrides: Partial<WBSTask> = {}): WBSTask {
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

function risk(overrides: Partial<Risk> = {}): Risk {
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

describe('rollups', () => {
  describe('rollUpStartDate', () => {
    it('returns earliest child start date', () => {
      const children = [
        task({ id: 'a', startDate: '2026-01-05' }),
        task({ id: 'b', startDate: '2026-01-01' }),
        task({ id: 'c', startDate: '2026-01-03' }),
      ];
      expect(rollUpStartDate(children)).toBe('2026-01-01');
    });

    it('returns null for empty array', () => {
      expect(rollUpStartDate([])).toBeNull();
    });
  });

  describe('rollUpEndDate', () => {
    it('returns latest child end date', () => {
      const children = [
        task({ id: 'a', endDate: '2026-01-10' }),
        task({ id: 'b', endDate: '2026-01-15' }),
        task({ id: 'c', endDate: '2026-01-08' }),
      ];
      expect(rollUpEndDate(children)).toBe('2026-01-15');
    });

    it('returns null for empty array', () => {
      expect(rollUpEndDate([])).toBeNull();
    });
  });

  describe('rollUpDates', () => {
    it('rolls up dates for summary task', () => {
      const summary = task({
        id: 'parent',
        isSummary: true,
        children: [
          task({ id: 'a', startDate: '2026-01-01', endDate: '2026-01-10' }),
          task({ id: 'b', startDate: '2026-01-05', endDate: '2026-01-20' }),
        ],
      });
      const result = rollUpDates(summary);
      expect(result.startDate).toBe('2026-01-01');
      expect(result.endDate).toBe('2026-01-20');
    });

    it('returns unchanged for leaf task', () => {
      const leaf = task({ children: [] });
      const result = rollUpDates(leaf);
      expect(result.startDate).toBe(leaf.startDate);
      expect(result.endDate).toBe(leaf.endDate);
    });
  });

  describe('rollUpProgress', () => {
    it('calculates simple average for equal durations', () => {
      const children = [
        task({ id: 'a', progress: 50, duration: 5 }),
        task({ id: 'b', progress: 100, duration: 5 }),
      ];
      expect(rollUpProgress(children)).toBe(75);
    });

    it('weights by duration', () => {
      const children = [
        task({ id: 'a', progress: 0, duration: 10 }),
        task({ id: 'b', progress: 100, duration: 1 }),
      ];
      // Weighted: (0*10 + 100*1) / 11 ≈ 9
      expect(rollUpProgress(children)).toBe(9);
    });

    it('returns 0 for empty array', () => {
      expect(rollUpProgress([])).toBe(0);
    });

    it('rolls up progress from nested summaries', () => {
      const children = [
        task({
          id: 'parent1',
          isSummary: true,
          progress: 0,
          duration: 10,
          children: [
            task({ id: 'a', progress: 50, duration: 5 }),
            task({ id: 'b', progress: 50, duration: 5 }),
          ],
        }),
        task({ id: 'c', progress: 100, duration: 5 }),
      ];
      // parent1 rolls up to 50, then (50*10 + 100*5) / 15 = 67
      expect(rollUpProgress(children)).toBe(67);
    });
  });

  describe('rollUpCost', () => {
    it('sums all descendant costs', () => {
      const taskTree = task({
        id: 'root',
        cost: 500,
        children: [
          task({ id: 'a', cost: 200, children: [task({ id: 'aa', cost: 100 })] }),
          task({ id: 'b', cost: 300 }),
        ],
      });
      expect(rollUpCost(taskTree)).toBe(1100);
    });

    it('returns own cost for leaf task', () => {
      expect(rollUpCost(task({ cost: 500 }))).toBe(500);
    });
  });

  describe('rollUpCostByCurrency', () => {
    it('breaks down cost by currency', () => {
      const taskTree = task({
        id: 'root',
        cost: 100,
        costCurrency: 'USD',
        children: [
          task({ id: 'a', cost: 200, costCurrency: 'EUR' }),
          task({ id: 'b', cost: 50, costCurrency: 'USD' }),
        ],
      });
      const breakdown = rollUpCostByCurrency(taskTree);
      expect(breakdown.get('USD')).toBe(150);
      expect(breakdown.get('EUR')).toBe(200);
    });
  });

  describe('rollUpEffort', () => {
    it('sums all descendant effort', () => {
      const taskTree = task({
        id: 'root',
        effort: 10,
        children: [
          task({ id: 'a', effort: 20, children: [task({ id: 'aa', effort: 5 })] }),
          task({ id: 'b', effort: 15 }),
        ],
      });
      expect(rollUpEffort(taskTree)).toBe(50);
    });
  });

  describe('rollUpEffortByUnit', () => {
    it('breaks down effort by unit', () => {
      const taskTree = task({
        id: 'root',
        effort: 10,
        effortUnit: 'hours',
        children: [
          task({ id: 'a', effort: 5, effortUnit: 'storyPoints' }),
          task({ id: 'b', effort: 20, effortUnit: 'hours' }),
        ],
      });
      const breakdown = rollUpEffortByUnit(taskTree);
      expect(breakdown.get('hours')).toBe(30);
      expect(breakdown.get('storyPoints')).toBe(5);
    });
  });

  describe('rollUpRiskScore', () => {
    const risks = [
      risk({ id: 'r1', riskScore: 12 }),
      risk({ id: 'r2', riskScore: 20 }),
      risk({ id: 'r3', riskScore: 8 }),
    ];

    it('returns max risk score from linked risks', () => {
      expect(rollUpRiskScore(['r1', 'r3'], risks)).toBe(12);
    });

    it('returns 0 for no linked risks', () => {
      expect(rollUpRiskScore([], risks)).toBe(0);
    });

    it('returns 0 for non-existent risk IDs', () => {
      expect(rollUpRiskScore(['xyz'], risks)).toBe(0);
    });
  });

  describe('rollUpRiskExposure', () => {
    const risks = [
      risk({ id: 'r1', riskScore: 12 }),
      risk({ id: 'r2', riskScore: 20 }),
    ];

    it('returns max risk in subtree', () => {
      const taskTree = task({
        id: 'root',
        riskIds: ['r1'],
        children: [task({ id: 'a', riskIds: ['r2'] })],
      });
      expect(rollUpRiskExposure(taskTree, risks)).toBe(20);
    });
  });

  describe('recomputeRollups', () => {
    const risks: Risk[] = [];

    it('recomputes all summary tasks bottom-up', () => {
      const tree = [
        task({
          id: 'root',
          isSummary: true,
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          progress: 0,
          cost: 0,
          effort: 0,
          children: [
            task({ id: 'a', startDate: '2026-01-01', endDate: '2026-01-10', progress: 50, cost: 100, effort: 20, duration: 5 }),
            task({ id: 'b', startDate: '2026-01-05', endDate: '2026-01-20', progress: 100, cost: 200, effort: 30, duration: 5 }),
          ],
        }),
      ];
      const result = recomputeRollups(tree, risks);
      const root = result[0];
      expect(root.startDate).toBe('2026-01-01');
      expect(root.endDate).toBe('2026-01-20');
      expect(root.cost).toBe(300);
      expect(root.effort).toBe(50);
    });

    it('does not mutate original tree', () => {
      const tree = [
        task({
          id: 'root',
          isSummary: true,
          children: [task({ id: 'a', progress: 100 })],
        }),
      ];
      recomputeRollups(tree, risks);
      expect(tree[0].progress).toBe(0);
    });
  });

  describe('getProjectSummary', () => {
    const risks: Risk[] = [risk({ id: 'r1', riskScore: 15 })];

    it('returns project-wide summary', () => {
      const tree = [
        task({
          id: 'root',
          isSummary: true,
          progress: 50,
          duration: 10,
          cost: 1000,
          effort: 40,
          riskIds: ['r1'],
          children: [
            task({ id: 'a', progress: 50, duration: 5, cost: 500, effort: 20, isMilestone: false }),
            task({ id: 'b', progress: 50, duration: 5, cost: 500, effort: 20, isMilestone: true }),
          ],
        }),
      ];
      const summary = getProjectSummary(tree, risks);
      expect(summary.totalTasks).toBe(3);
      expect(summary.summaryTaskCount).toBe(1);
      expect(summary.milestoneCount).toBe(1);
      expect(summary.maxRiskScore).toBe(15);
    });
  });
});
