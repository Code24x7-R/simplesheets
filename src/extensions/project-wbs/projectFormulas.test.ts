// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  createProjectFormulaSheet,
  evaluateProjectFormula,
  lookupResourceRate,
  calculateTaskCost,
  calculateTotalCost,
  getResourceLookupTable,
} from './projectFormulas';
import type { Project, WBSTask } from '../types';
import { createDefaultCalendar } from './calendar';

function createMockProject(): Project {
  return {
    id: 'test',
    name: 'Test Project',
    description: 'Test',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    calendar: createDefaultCalendar(),
    resources: [
      { id: 'dev1', name: 'Developer 1', role: 'Dev', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
      { id: 'dev2', name: 'Developer 2', role: 'Dev', costRate: 120, costCurrency: 'USD', availability: 100, color: '#10B981' },
      { id: 'pm', name: 'Project Manager', role: 'PM', costRate: 200, costCurrency: 'USD', availability: 50, color: '#F59E0B' },
    ],
    risks: [
      { id: 'r1', projectId: 'test', taskId: null, title: 'Risk 1', description: '', category: 'technical', probability: 3, impact: 4, riskScore: 12, status: 'identified', mitigationPlan: '', contingencyPlan: '', mitigationCost: 0, ownerId: null, identifiedDate: '2026-05-01', reviewDate: '', triggerCondition: '', residualProbability: 2, residualImpact: 2, residualRiskScore: 4, customFields: {} },
    ],
    wbs: [
      {
        id: 'task1',
        name: 'Task 1',
        description: '',
        level: 0,
        parentId: null,
        children: [],
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        duration: 5,
        progress: 50,
        effort: 40,
        effortUnit: 'hours',
        cost: 0,
        costCurrency: 'USD',
        responsibleResourceId: 'dev1',
        dependencies: [],
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#3B82F6',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task2',
        name: 'Task 2',
        description: '',
        level: 0,
        parentId: null,
        children: [],
        startDate: '2026-05-06',
        endDate: '2026-05-10',
        duration: 5,
        progress: 0,
        effort: 40,
        effortUnit: 'hours',
        cost: 0,
        costCurrency: 'USD',
        responsibleResourceId: 'pm',
        dependencies: [],
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#F59E0B',
        riskIds: [],
        customFields: {},
      },
    ],
  };
}

describe('projectFormulas', () => {
  describe('createProjectFormulaSheet', () => {
    it('creates a sheet with resource data', () => {
      const project = createMockProject();
      const sheet = createProjectFormulaSheet(project);
      expect(sheet.id).toBe('project-formulas');
      expect(sheet.cells['0:0']?.rawValue).toBe('Resource ID');
      expect(sheet.cells['0:1']?.rawValue).toBe('dev1');
      expect(sheet.cells['2:1']?.rawValue).toBe('150');
    });

    it('creates a sheet with task data', () => {
      const project = createMockProject();
      const sheet = createProjectFormulaSheet(project);
      // Tasks start after resources (3 resources + 3 header rows)
      const taskStartRow = 3 + 3;
      expect(sheet.cells[`0:${taskStartRow}`]?.rawValue).toBe('Task ID');
    });

    it('creates a sheet with risk data', () => {
      const project = createMockProject();
      const sheet = createProjectFormulaSheet(project);
      // Risk section exists somewhere in the sheet
      const riskCells = Object.entries(sheet.cells).filter(([, cell]) => cell.rawValue === 'Risk ID');
      expect(riskCells.length).toBe(1);
    });
  });

  describe('evaluateProjectFormula', () => {
    it('returns non-formula strings as-is', () => {
      const project = createMockProject();
      const result = evaluateProjectFormula('not a formula', project);
      expect(result).toBe('not a formula');
    });

    it('evaluates simple arithmetic', () => {
      const project = createMockProject();
      const result = evaluateProjectFormula('=1+2', project);
      expect(result).toBe(3);
    });

    it('evaluates SUM function', () => {
      const project = createMockProject();
      const result = evaluateProjectFormula('=SUM(10,20,30)', project);
      expect(result).toBe(60);
    });

    it('evaluates AVERAGE function', () => {
      const project = createMockProject();
      const result = evaluateProjectFormula('=AVERAGE(10,20,30)', project);
      expect(result).toBe(20);
    });

    it('evaluates IF function', () => {
      const project = createMockProject();
      const result = evaluateProjectFormula('=IF(1>0, "yes", "no")', project);
      expect(result).toBe('yes');
    });

    it('returns null for invalid formulas', () => {
      const project = createMockProject();
      const result = evaluateProjectFormula('=INVALID_FUNC()', project);
      expect(result).toBeNull();
    });
  });

  describe('lookupResourceRate', () => {
    it('returns rate for existing resource', () => {
      const project = createMockProject();
      expect(lookupResourceRate('dev1', project)).toBe(150);
      expect(lookupResourceRate('pm', project)).toBe(200);
    });

    it('returns 0 for non-existent resource', () => {
      const project = createMockProject();
      expect(lookupResourceRate('nonexistent', project)).toBe(0);
    });
  });

  describe('calculateTaskCost', () => {
    it('calculates cost from resource rate and duration', () => {
      const project = createMockProject();
      const task = project.wbs[0]; // dev1, 5 days, rate 150
      expect(calculateTaskCost(task, project)).toBe(750); // 150 * 5
    });

    it('returns task cost when no resource assigned', () => {
      const project = createMockProject();
      const task: WBSTask = {
        ...project.wbs[0],
        responsibleResourceId: null,
        cost: 500,
      };
      expect(calculateTaskCost(task, project)).toBe(500);
    });
  });

  describe('calculateTotalCost', () => {
    it('calculates total cost including children', () => {
      const project = createMockProject();
      const parentTask: WBSTask = {
        id: 'parent',
        name: 'Parent',
        description: '',
        level: 0,
        parentId: null,
        children: [
          {
            id: 'child1',
            name: 'Child 1',
            description: '',
            level: 1,
            parentId: 'parent',
            children: [],
            startDate: '2026-05-01',
            endDate: '2026-05-03',
            duration: 3,
            progress: 0,
            effort: 24,
            effortUnit: 'hours',
            cost: 0,
            costCurrency: 'USD',
            responsibleResourceId: 'dev1', // rate 150
            dependencies: [],
            isMilestone: false,
            isSummary: false,
            collapsed: false,
            color: '#3B82F6',
            riskIds: [],
            customFields: {},
          },
          {
            id: 'child2',
            name: 'Child 2',
            description: '',
            level: 1,
            parentId: 'parent',
            children: [],
            startDate: '2026-05-04',
            endDate: '2026-05-06',
            duration: 3,
            progress: 0,
            effort: 24,
            effortUnit: 'hours',
            cost: 0,
            costCurrency: 'USD',
            responsibleResourceId: 'dev2', // rate 120
            dependencies: [],
            isMilestone: false,
            isSummary: false,
            collapsed: false,
            color: '#10B981',
            riskIds: [],
            customFields: {},
          },
        ],
        startDate: '2026-05-01',
        endDate: '2026-05-06',
        duration: 6,
        progress: 0,
        effort: 48,
        effortUnit: 'hours',
        cost: 0,
        costCurrency: 'USD',
        responsibleResourceId: 'pm', // rate 200
        dependencies: [],
        isMilestone: false,
        isSummary: true,
        collapsed: false,
        color: '#F59E0B',
        riskIds: [],
        customFields: {},
      };

      // Parent: 200 * 6 = 1200
      // Child1: 150 * 3 = 450
      // Child2: 120 * 3 = 360
      // Total: 1200 + 450 + 360 = 2010
      expect(calculateTotalCost(parentTask, project)).toBe(2010);
    });
  });

  describe('getResourceLookupTable', () => {
    it('returns a 2D array with headers', () => {
      const project = createMockProject();
      const table = getResourceLookupTable(project);
      expect(table[0]).toEqual(['ID', 'Name', 'Rate', 'Role']);
      expect(table[1]).toEqual(['dev1', 'Developer 1', 150, 'Dev']);
    });

    it('includes all resources', () => {
      const project = createMockProject();
      const table = getResourceLookupTable(project);
      expect(table.length).toBe(project.resources.length + 1); // +1 for header
    });
  });
});
