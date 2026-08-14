// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  calculateRiskScore,
  getRiskLevel,
  calculateResidualScore,
  createRisk,
  getRiskMatrix,
  addRisk,
  updateRisk,
  closeRisk,
  removeRisk,
  linkRiskToTask,
  unlinkRiskFromTask,
  getRisksForTask,
  getTopRisks,
  getRisksByStatus,
  getRisksByCategory,
  getRiskSummary,
} from './risks';
import type { Project } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestProject(): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: '',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    calendar: { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set(), hoursPerDay: 8 },
    resources: [],
    risks: [],
    wbs: [{
      id: 'task-1',
      name: 'Task 1',
      description: '',
      level: 0,
      parentId: null,
      children: [],
      startDate: '2026-01-01',
      endDate: '2026-01-10',
      duration: 5,
      progress: 0,
      effort: 0,
      effortUnit: 'hours',
      cost: 0,
      costCurrency: 'USD',
      responsibleResourceId: null,
      dependencies: [],
      isMilestone: false,
      isSummary: false,
      collapsed: false,
      color: '#3B82EF',
      riskIds: [],
      customFields: {},
    }],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('risks', () => {
  describe('calculateRiskScore', () => {
    it('multiplies probability × impact', () => {
      expect(calculateRiskScore(3, 4)).toBe(12);
      expect(calculateRiskScore(5, 5)).toBe(25);
      expect(calculateRiskScore(1, 1)).toBe(1);
    });

    it('clamps values to 1-5 range', () => {
      expect(calculateRiskScore(0, 4)).toBe(4);  // 0 clamped to 1
      expect(calculateRiskScore(6, 2)).toBe(10); // 6 clamped to 5
    });
  });

  describe('getRiskLevel', () => {
    it('classifies critical (20-25)', () => {
      expect(getRiskLevel(20)).toBe('critical');
      expect(getRiskLevel(25)).toBe('critical');
    });

    it('classifies high (12-19)', () => {
      expect(getRiskLevel(12)).toBe('high');
      expect(getRiskLevel(19)).toBe('high');
    });

    it('classifies medium (6-11)', () => {
      expect(getRiskLevel(6)).toBe('medium');
      expect(getRiskLevel(11)).toBe('medium');
    });

    it('classifies low (1-5)', () => {
      expect(getRiskLevel(1)).toBe('low');
      expect(getRiskLevel(5)).toBe('low');
    });
  });

  describe('calculateResidualScore', () => {
    it('uses residual probability and impact', () => {
      const risk = createRisk({
        id: 'r1',
        projectId: 'p1',
        title: 'Test',
        category: 'technical',
        probability: 4,
        impact: 5,
        residualProbability: 2,
        residualImpact: 3,
        identifiedDate: '2026-01-01',
        reviewDate: '2026-02-01',
      });
      expect(calculateResidualScore(risk)).toBe(6);
    });
  });

  describe('createRisk', () => {
    it('creates a risk with computed scores', () => {
      const risk = createRisk({
        id: 'r1',
        projectId: 'p1',
        title: 'Scope creep',
        category: 'scope',
        probability: 3,
        impact: 4,
        identifiedDate: '2026-01-01',
        reviewDate: '2026-02-01',
      });
      expect(risk.riskScore).toBe(12);
      expect(risk.status).toBe('identified');
      expect(risk.residualRiskScore).toBe(12); // Same as initial when no residual specified
    });

    it('clamps probability and impact', () => {
      const risk = createRisk({
        id: 'r1',
        projectId: 'p1',
        title: 'Test',
        category: 'technical',
        probability: 10,
        impact: 0,
        identifiedDate: '2026-01-01',
        reviewDate: '2026-02-01',
      });
      expect(risk.probability).toBe(5);
      expect(risk.impact).toBe(1);
    });
  });

  describe('getRiskMatrix', () => {
    it('creates a 5×5 matrix', () => {
      const risks = [
        createRisk({ id: 'r1', projectId: 'p1', title: 'A', category: 'technical', probability: 2, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' }),
        createRisk({ id: 'r2', projectId: 'p1', title: 'B', category: 'schedule', probability: 4, impact: 5, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' }),
      ];
      const matrix = getRiskMatrix(risks);
      expect(matrix.cells).toHaveLength(5);
      expect(matrix.cells[0]).toHaveLength(5);
      expect(matrix.cells[1][2].count).toBe(1); // p=2, i=3
      expect(matrix.cells[3][4].count).toBe(1); // p=4, i=5
    });

    it('excludes closed risks', () => {
      const risks = [
        createRisk({ id: 'r1', projectId: 'p1', title: 'A', category: 'technical', probability: 3, impact: 3, status: 'closed', identifiedDate: '2026-01-01', reviewDate: '2026-02-01' }),
      ];
      const matrix = getRiskMatrix(risks);
      let total = 0;
      for (const row of matrix.cells) {
        for (const cell of row) total += cell.count;
      }
      expect(total).toBe(0);
    });
  });

  describe('addRisk', () => {
    it('adds a risk immutably', () => {
      const project = createTestProject();
      const risk = createRisk({ id: 'r1', projectId: 'p1', title: 'Test', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const updated = addRisk(project, risk);
      expect(updated.risks).toHaveLength(1);
      expect(project.risks).toHaveLength(0); // Original unchanged
    });
  });

  describe('updateRisk', () => {
    it('updates risk fields', () => {
      let project = createTestProject();
      const risk = createRisk({ id: 'r1', projectId: 'p1', title: 'Test', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(project, risk);
      const updated = updateRisk(project, 'r1', { title: 'Updated', probability: 5 });
      expect(updated.risks[0].title).toBe('Updated');
      expect(updated.risks[0].probability).toBe(5);
      expect(updated.risks[0].riskScore).toBe(15); // 5 × 3
    });
  });

  describe('closeRisk', () => {
    it('sets status to closed', () => {
      let project = createTestProject();
      const risk = createRisk({ id: 'r1', projectId: 'p1', title: 'Test', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(project, risk);
      const updated = closeRisk(project, 'r1');
      expect(updated.risks[0].status).toBe('closed');
    });
  });

  describe('removeRisk', () => {
    it('removes a risk', () => {
      let project = createTestProject();
      const risk = createRisk({ id: 'r1', projectId: 'p1', title: 'Test', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(project, risk);
      const updated = removeRisk(project, 'r1');
      expect(updated.risks).toHaveLength(0);
    });
  });

  describe('linkRiskToTask / unlinkRiskFromTask', () => {
    it('links a risk to a task', () => {
      let project = createTestProject();
      const risk = createRisk({ id: 'r1', projectId: 'p1', title: 'Test', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(project, risk);
      const updated = linkRiskToTask(project, 'r1', 'task-1');
      expect(updated.risks[0].taskId).toBe('task-1');
      expect(updated.wbs[0].riskIds).toContain('r1');
    });

    it('unlinks a risk from a task', () => {
      let project = createTestProject();
      const risk = createRisk({ id: 'r1', projectId: 'p1', title: 'Test', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(project, risk);
      project = linkRiskToTask(project, 'r1', 'task-1');
      const updated = unlinkRiskFromTask(project, 'r1');
      expect(updated.risks[0].taskId).toBeNull();
      expect(updated.wbs[0].riskIds).not.toContain('r1');
    });
  });

  describe('getRisksForTask', () => {
    it('returns risks linked to a task', () => {
      let project = createTestProject();
      const r1 = createRisk({ id: 'r1', projectId: 'p1', title: 'A', category: 'technical', probability: 3, impact: 3, taskId: 'task-1', identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const r2 = createRisk({ id: 'r2', projectId: 'p1', title: 'B', category: 'schedule', probability: 2, impact: 2, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(addRisk(project, r1), r2);
      const taskRisks = getRisksForTask(project, 'task-1');
      expect(taskRisks).toHaveLength(1);
      expect(taskRisks[0].id).toBe('r1');
    });
  });

  describe('getTopRisks', () => {
    it('returns highest-scoring risks first', () => {
      let project = createTestProject();
      const r1 = createRisk({ id: 'r1', projectId: 'p1', title: 'Low', category: 'technical', probability: 1, impact: 1, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const r2 = createRisk({ id: 'r2', projectId: 'p1', title: 'High', category: 'schedule', probability: 5, impact: 5, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(addRisk(project, r1), r2);
      const top = getTopRisks(project, 1);
      expect(top).toHaveLength(1);
      expect(top[0].id).toBe('r2');
    });

    it('excludes closed risks', () => {
      let project = createTestProject();
      const r1 = createRisk({ id: 'r1', projectId: 'p1', title: 'Open', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const r2 = createRisk({ id: 'r2', projectId: 'p1', title: 'Closed', category: 'schedule', probability: 5, impact: 5, status: 'closed', identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(addRisk(project, r1), r2);
      const top = getTopRisks(project, 5);
      expect(top).toHaveLength(1);
      expect(top[0].id).toBe('r1');
    });
  });

  describe('getRisksByStatus', () => {
    it('filters by status', () => {
      let project = createTestProject();
      const r1 = createRisk({ id: 'r1', projectId: 'p1', title: 'A', category: 'technical', probability: 3, impact: 3, status: 'identified', identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const r2 = createRisk({ id: 'r2', projectId: 'p1', title: 'B', category: 'schedule', probability: 2, impact: 2, status: 'mitigating', identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(addRisk(project, r1), r2);
      const identified = getRisksByStatus(project, 'identified');
      expect(identified).toHaveLength(1);
      expect(identified[0].id).toBe('r1');
    });
  });

  describe('getRisksByCategory', () => {
    it('filters by category', () => {
      let project = createTestProject();
      const r1 = createRisk({ id: 'r1', projectId: 'p1', title: 'A', category: 'technical', probability: 3, impact: 3, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const r2 = createRisk({ id: 'r2', projectId: 'p1', title: 'B', category: 'schedule', probability: 2, impact: 2, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(addRisk(project, r1), r2);
      const technical = getRisksByCategory(project, 'technical');
      expect(technical).toHaveLength(1);
      expect(technical[0].id).toBe('r1');
    });
  });

  describe('getRiskSummary', () => {
    it('returns comprehensive summary', () => {
      let project = createTestProject();
      const r1 = createRisk({ id: 'r1', projectId: 'p1', title: 'Critical', category: 'technical', probability: 5, impact: 5, mitigationCost: 10000, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      const r2 = createRisk({ id: 'r2', projectId: 'p1', title: 'Low', category: 'schedule', probability: 1, impact: 1, status: 'closed', mitigationCost: 500, identifiedDate: '2026-01-01', reviewDate: '2026-02-01' });
      project = addRisk(addRisk(project, r1), r2);
      const summary = getRiskSummary(project);
      expect(summary.total).toBe(2);
      expect(summary.byStatus.identified).toBe(1);
      expect(summary.byStatus.closed).toBe(1);
      expect(summary.byCategory.technical).toBe(1);
      expect(summary.byLevel.critical).toBe(1);
      expect(summary.byLevel.low).toBe(1);
      expect(summary.totalMitigationCost).toBe(10500);
      expect(summary.openCount).toBe(1);
    });
  });
});
