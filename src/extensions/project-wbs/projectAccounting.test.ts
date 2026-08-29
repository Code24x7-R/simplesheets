// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import type { WBSTask, ActualSpendEntry } from '../types';
import {
  earnedValue,
  plannedValue,
  costPerformanceIndex,
  schedulePerformanceIndex,
  estimateAtCompletion,
  estimateToComplete,
  eacFromCPI,
  toCompletePerformanceIndex,
  costVariance,
  scheduleVariance,
  scheduleVarianceDays,
  computeTaskAccounting,
  computeProjectAccounting,
  calculateScheduleShiftCost,
  calculateDependencyImpact,
  createChangeLogEntry,
  formatVariance,
  formatPerformanceIndex,
  getCostRollupSummary,
} from './projectAccounting';
import type { Project } from '../types';

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
    progress: 50,
    effort: 40,
    effortUnit: 'hours',
    cost: 1000,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    status: 'in_progress',
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

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: '',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    calendar: { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set(), hoursPerDay: 8 },
    resources: [],
    risks: [],
    wbs: [],
    ...overrides,
  };
}

describe('earnedValue', () => {
  it('returns full cost at 100% progress', () => {
    expect(earnedValue(1000, 100)).toBe(1000);
  });

  it('returns half cost at 50% progress', () => {
    expect(earnedValue(1000, 50)).toBe(500);
  });

  it('returns zero at 0% progress', () => {
    expect(earnedValue(1000, 0)).toBe(0);
  });
});

describe('plannedValue', () => {
  it('returns 0 before start date', () => {
    expect(plannedValue(1000, '2026-01-10', '2026-01-20', '2026-01-05')).toBe(0);
  });

  it('returns full cost after end date', () => {
    expect(plannedValue(1000, '2026-01-05', '2026-01-10', '2026-01-15')).toBe(1000);
  });

  it('returns proportional value mid-task', () => {
    // 5-day task (Jan 5-10), checking at Jan 7 (2 calendar days elapsed)
    const pv = plannedValue(1000, '2026-01-05', '2026-01-10', '2026-01-07');
    // 2/5 of elapsed time → 400
    expect(pv).toBeCloseTo(400, 0);
  });
});

describe('costPerformanceIndex', () => {
  it('returns 1 when actual cost is 0', () => {
    expect(costPerformanceIndex(500, 0)).toBe(1);
  });

  it('returns >1 when under budget', () => {
    // EV = 500, AC = 400 → CPI = 1.25
    expect(costPerformanceIndex(500, 400)).toBe(1.25);
  });

  it('returns <1 when over budget', () => {
    // EV = 500, AC = 600 → CPI = 0.833
    expect(costPerformanceIndex(500, 600)).toBeCloseTo(0.833, 2);
  });
});

describe('schedulePerformanceIndex', () => {
  it('returns 1 when planned value is 0', () => {
    expect(schedulePerformanceIndex(500, 0)).toBe(1);
  });

  it('returns >1 when ahead of schedule', () => {
    // EV = 600, PV = 500 → SPI = 1.2
    expect(schedulePerformanceIndex(600, 500)).toBe(1.2);
  });

  it('returns <1 when behind schedule', () => {
    // EV = 400, PV = 500 → SPI = 0.8
    expect(schedulePerformanceIndex(400, 500)).toBe(0.8);
  });
});

describe('estimateAtCompletion', () => {
  it('sums ETC and actual spend', () => {
    expect(estimateAtCompletion(600, 400)).toBe(1000);
  });
});

describe('estimateToComplete', () => {
  it('returns remaining budget after earned value', () => {
    expect(estimateToComplete(1000, 500)).toBe(500);
  });

  it('returns 0 when earned value exceeds baseline', () => {
    expect(estimateToComplete(1000, 1200)).toBe(0);
  });
});

describe('eacFromCPI', () => {
  it('returns baseline when CPI is 1', () => {
    expect(eacFromCPI(1000, 1)).toBe(1000);
  });

  it('returns higher EAC when CPI < 1 (over budget)', () => {
    expect(eacFromCPI(1000, 0.8)).toBe(1250);
  });

  it('returns lower EAC when CPI > 1 (under budget)', () => {
    expect(eacFromCPI(1000, 1.25)).toBe(800);
  });
});

describe('toCompletePerformanceIndex', () => {
  it('returns 1 when at budget', () => {
    expect(toCompletePerformanceIndex(1000, 500, 500)).toBe(1);
  });

  it('returns >1 when over budget (need to work more efficiently)', () => {
    // BAC=1000, EV=400, AC=500 → remaining=600, remainingBudget=500 → TCPI=1.2
    expect(toCompletePerformanceIndex(1000, 400, 500)).toBe(1.2);
  });
});

describe('costVariance', () => {
  it('returns positive when under budget', () => {
    expect(costVariance(500, 400)).toBe(100);
  });

  it('returns negative when over budget', () => {
    expect(costVariance(500, 600)).toBe(-100);
  });
});

describe('scheduleVariance', () => {
  it('returns positive when ahead of schedule', () => {
    expect(scheduleVariance(600, 500)).toBe(100);
  });

  it('returns negative when behind schedule', () => {
    expect(scheduleVariance(400, 500)).toBe(-100);
  });
});

describe('scheduleVarianceDays', () => {
  it('returns 0 when SPI is 1 (on schedule)', () => {
    expect(scheduleVarianceDays(10, 1)).toBe(0);
  });

  it('returns positive days when behind schedule', () => {
    // 10 days remaining, SPI = 0.8 → 10/0.8 - 10 = 2.5 days behind
    expect(scheduleVarianceDays(10, 0.8)).toBeCloseTo(2.5, 1);
  });
});

describe('computeTaskAccounting', () => {
  it('computes all fields for a task with no actuals', () => {
    const task = createTask({ cost: 1000, progress: 50 });
    const result = computeTaskAccounting(task, [], 100);

    expect(result.baselineCost).toBe(1000);
    expect(result.actualSpend).toBe(0);
    expect(result.allocatedBudget).toBe(1000);
    expect(result.taskId).toBe('task-1');
    expect(result.taskName).toBe('Test Task');
  });

  it('computes actual spend from entries', () => {
    const task = createTask({ cost: 1000, progress: 50 });
    const entries: ActualSpendEntry[] = [
      { id: 'e1', taskId: 'task-1', date: '2026-01-05', amount: 300, currency: 'USD', source: 'Vendor A', notes: '' },
      { id: 'e2', taskId: 'task-1', date: '2026-01-07', amount: 200, currency: 'USD', source: 'Vendor B', notes: '' },
    ];
    const result = computeTaskAccounting(task, entries, 100);

    expect(result.actualSpend).toBe(500);
    expect(result.currentEstimate).toBe(1000); // ETC(500) + AC(500)
  });

  it('computes CPI correctly', () => {
    const task = createTask({ cost: 1000, progress: 50 });
    const entries: ActualSpendEntry[] = [
      { id: 'e1', taskId: 'task-1', date: '2026-01-05', amount: 400, currency: 'USD', source: 'Vendor', notes: '' },
    ];
    const result = computeTaskAccounting(task, entries, 100);

    // EV = 500, AC = 400 → CPI = 1.25
    expect(result.cpi).toBe(1.25);
  });

  it('computes duration fields for a task', () => {
    const task = createTask({ duration: 10, progress: 50 });
    const result = computeTaskAccounting(task, [], 100);

    expect(result.baselineDuration).toBe(10);
    expect(result.currentDuration).toBe(10);
    expect(result.actualDuration).toBe(5); // 50% of 10 days
    expect(result.remainingDuration).toBe(5); // 10 - 5
    expect(result.durationVariance).toBe(0); // no change from baseline
  });

  it('computes actual duration as 0 for not-started task', () => {
    const task = createTask({ duration: 8, progress: 0 });
    const result = computeTaskAccounting(task, [], 100);

    expect(result.actualDuration).toBe(0);
    expect(result.remainingDuration).toBe(8);
  });

  it('computes remaining duration for completed task', () => {
    const task = createTask({ duration: 6, progress: 100 });
    const result = computeTaskAccounting(task, [], 100);

    expect(result.actualDuration).toBe(6);
    expect(result.remainingDuration).toBe(0);
  });

  it('uses baselineCost when set instead of live cost', () => {
    const task = createTask({ cost: 2000, baselineCost: 1000, progress: 50 });
    const result = computeTaskAccounting(task, [], 100);

    expect(result.baselineCost).toBe(1000);
    expect(result.allocatedBudget).toBe(1000);
    // EV = baselineCost * progress% = 1000 * 0.5 = 500
    // ETC = baselineCost - EV = 500
    // EAC = ETC + actualSpend(0) = 500
    expect(result.currentEstimate).toBe(500);
    expect(result.costVariance).toBe(-500); // 500 - 1000
  });

  it('uses baselineDuration when set instead of live duration', () => {
    const task = createTask({ duration: 20, baselineDuration: 10, progress: 50 });
    const result = computeTaskAccounting(task, [], 100);

    expect(result.baselineDuration).toBe(10);
    expect(result.currentDuration).toBe(20);
    expect(result.actualDuration).toBe(5); // 50% of baselineDuration(10)
    expect(result.remainingDuration).toBe(15); // currentDuration(20) - actualDuration(5)
    expect(result.durationVariance).toBe(10); // currentDuration(20) - baselineDuration(10)
  });

  it('falls back to cost/duration when baseline fields are undefined', () => {
    const task = createTask({ cost: 1000, duration: 5 });
    // Ensure baseline fields are undefined
    delete (task as Partial<WBSTask>).baselineCost;
    delete (task as Partial<WBSTask>).baselineDuration;
    const result = computeTaskAccounting(task, [], 100);

    expect(result.baselineCost).toBe(1000);
    expect(result.baselineDuration).toBe(5);
  });
});

describe('computeProjectAccounting', () => {
  it('computes totals for a project with multiple tasks', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Task 1', cost: 1000 }),
        createTask({ id: 't2', name: 'Task 2', cost: 2000 }),
        createTask({ id: 't3', name: 'Task 3', cost: 3000 }),
      ],
    });

    const result = computeProjectAccounting(project);

    expect(result.baselineTotal).toBe(6000);
    expect(result.allocatedTotal).toBe(6000);
    expect(result.taskAccounting.length).toBe(3);
    expect(result.currency).toBe('USD');
  });

  it('detects primary currency from tasks', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', cost: 1000, costCurrency: 'EUR' }),
        createTask({ id: 't2', cost: 2000, costCurrency: 'EUR' }),
        createTask({ id: 't3', cost: 3000, costCurrency: 'USD' }),
      ],
    });

    const result = computeProjectAccounting(project);
    expect(result.currency).toBe('EUR');
  });
});

describe('calculateScheduleShiftCost', () => {
  it('returns 0 when shift is 0 or negative', () => {
    const task = createTask();
    const resource = { costRate: 500, costCurrency: 'USD' };
    expect(calculateScheduleShiftCost(task, 0, resource)).toBe(0);
    expect(calculateScheduleShiftCost(task, -5, resource)).toBe(0);
  });

  it('returns 0 when no resource assigned', () => {
    const task = createTask();
    expect(calculateScheduleShiftCost(task, 5, null)).toBe(0);
  });

  it('calculates cost for daily rate resource', () => {
    const task = createTask();
    const resource = { costRate: 500, costCurrency: 'USD' };
    // Daily rate >= 100, so used directly: 500 × 3 = 1500
    expect(calculateScheduleShiftCost(task, 3, resource)).toBe(1500);
  });

  it('calculates cost for hourly rate resource', () => {
    const task = createTask();
    const resource = { costRate: 50, costCurrency: 'USD' };
    // Hourly rate < 100, so × 8: 50 × 8 × 3 = 1200
    expect(calculateScheduleShiftCost(task, 3, resource)).toBe(1200);
  });
});

describe('calculateDependencyImpact', () => {
  it('returns zero impact when no shift needed', () => {
    const tasks = [
      createTask({ id: 'pred', startDate: '2026-01-05', endDate: '2026-01-10' }),
      createTask({ id: 'succ', startDate: '2026-01-15', endDate: '2026-01-20' }),
    ];

    const result = calculateDependencyImpact(tasks, 'pred', 'succ', 'FS', 0);
    expect(result.scheduleImpactDays).toBe(0);
    expect(result.costImpact).toBe(0);
  });

  it('calculates impact when successor needs to shift', () => {
    const tasks = [
      createTask({ id: 'pred', startDate: '2026-01-05', endDate: '2026-01-20' }),
      createTask({ id: 'succ', startDate: '2026-01-10', endDate: '2026-01-15' }),
    ];

    // FS dependency: successor should start after predecessor ends (Jan 20)
    // Current start is Jan 10, so shift needed
    const result = calculateDependencyImpact(tasks, 'pred', 'succ', 'FS', 0);
    expect(result.scheduleImpactDays).toBeGreaterThan(0);
    expect(result.affectedTaskIds).toContain('succ');
  });

  it('returns zero for missing tasks', () => {
    const tasks = [createTask({ id: 'pred' })];
    const result = calculateDependencyImpact(tasks, 'pred', 'nonexistent', 'FS', 0);
    expect(result.scheduleImpactDays).toBe(0);
  });
});

describe('formatVariance', () => {
  it('formats positive variance with + sign', () => {
    expect(formatVariance(150, 'USD')).toBe('+$150.00');
  });

  it('formats negative variance with - sign', () => {
    expect(formatVariance(-200, 'USD')).toBe('-$200.00');
  });

  it('uses correct currency symbol', () => {
    expect(formatVariance(100, 'EUR')).toBe('+\u20AC100.00');
    expect(formatVariance(100, 'GBP')).toBe('+\u00A3100.00');
  });
});

describe('formatPerformanceIndex', () => {
  it('returns good status for index >= 1', () => {
    expect(formatPerformanceIndex(1.1)).toEqual({ value: 1.1, status: 'good' });
    expect(formatPerformanceIndex(1.0)).toEqual({ value: 1.0, status: 'good' });
  });

  it('returns warning status for index 0.85-1.0', () => {
    expect(formatPerformanceIndex(0.9)).toEqual({ value: 0.9, status: 'warning' });
    expect(formatPerformanceIndex(0.85)).toEqual({ value: 0.85, status: 'warning' });
  });

  it('returns critical status for index < 0.85', () => {
    expect(formatPerformanceIndex(0.7)).toEqual({ value: 0.7, status: 'critical' });
  });
});

describe('getCostRollupSummary', () => {
  it('returns own cost for leaf tasks', () => {
    const tree = [createTask({ id: 't1', name: 'Task 1', cost: 500 })];
    const result = getCostRollupSummary(tree);
    expect(result[0].ownCost).toBe(500);
    expect(result[0].totalCost).toBe(500);
  });

  it('rolls up costs for summary tasks', () => {
    const tree = [
      createTask({
        id: 'summary',
        name: 'Phase 1',
        cost: 100,
        isSummary: true,
        children: [
          createTask({ id: 'child-1', name: 'Child 1', cost: 400 }),
          createTask({ id: 'child-2', name: 'Child 2', cost: 600 }),
        ],
      }),
    ];

    const result = getCostRollupSummary(tree);
    expect(result[0].ownCost).toBe(100);
    expect(result[0].totalCost).toBe(1100); // 100 + 400 + 600
  });
});

describe('createChangeLogEntry', () => {
  it('creates a change log entry with required fields', () => {
    const entry = createChangeLogEntry({
      taskId: 'task-1',
      changeType: 'dependency',
      description: 'Predecessor delayed',
      costImpact: 1500,
      scheduleImpactDays: 3,
    });

    expect(entry.id).toBeTruthy();
    expect(entry.date).toBeTruthy();
    expect(entry.taskId).toBe('task-1');
    expect(entry.changeType).toBe('dependency');
    expect(entry.description).toBe('Predecessor delayed');
    expect(entry.costImpact).toBe(1500);
    expect(entry.scheduleImpactDays).toBe(3);
    expect(entry.approvedBy).toBeNull();
  });

  it('creates a project-level entry when taskId is null', () => {
    const entry = createChangeLogEntry({
      changeType: 'scope',
      description: 'Scope changed',
      costImpact: 5000,
      scheduleImpactDays: 0,
    });

    expect(entry.taskId).toBeNull();
    expect(entry.changeType).toBe('scope');
  });

  it('includes optional approvedBy field', () => {
    const entry = createChangeLogEntry({
      changeType: 'schedule',
      description: 'Schedule compressed',
      costImpact: -2000,
      scheduleImpactDays: -5,
      approvedBy: 'Project Manager',
    });

    expect(entry.approvedBy).toBe('Project Manager');
  });
});

describe('computeProjectAccounting material integration', () => {
  it('includes material cost total in accounting', () => {
    const project = createProject({
      wbs: [createTask({ cost: 1000 })],
      materials: [
        {
          id: 'mat-1',
          name: 'Equipment',
          description: '',
          classification: 'capex',
          unit: 'each',
          unitCost: 10000,
          quantity: 1,
          currency: 'USD',
          vendor: null,
          depreciationMethod: 'straight-line',
          usefulLifeMonths: 36,
          salvageValue: 1000,
          acquisitionDate: '2026-01-01',
          billingPeriod: 'daily',
          rentalRate: 0,
          leaseStartDate: null,
          leaseEndDate: null,
          wastageRate: 0,
          reorderPoint: 0,
          carryingCostPerUnit: 0,
          allocatedQuantity: 0,
          consumedQuantity: 0,
          status: 'delivered',
        },
      ],
    });

    const result = computeProjectAccounting(project);
    expect(result.materialCostTotal).toBeGreaterThan(0);
  });

  it('returns 0 material cost total when no materials', () => {
    const project = createProject({
      wbs: [createTask({ cost: 1000 })],
    });

    const result = computeProjectAccounting(project);
    expect(result.materialCostTotal).toBe(0);
  });

  it('includes material costs in task accounting baseline', () => {
    const project = createProject({
      wbs: [createTask({ id: 't1', name: 'Build', cost: 1000, progress: 50 })],
      materials: [
        {
          id: 'mat-1', name: 'Steel', description: '', classification: 'consumable',
          unit: 'kg', unitCost: 50, quantity: 10, currency: 'USD', vendor: null,
          depreciationMethod: 'none', usefulLifeMonths: 0, salvageValue: 0,
          acquisitionDate: null, billingPeriod: 'fixed', rentalRate: 0,
          leaseStartDate: null, leaseEndDate: null, wastageRate: 0,
          reorderPoint: 0, carryingCostPerUnit: 0, allocatedQuantity: 0,
          consumedQuantity: 10, status: 'delivered',
        },
      ],
      materialAllocations: [
        { id: 'ma-1', materialId: 'mat-1', taskId: 't1', allocatedQuantity: 10,
          consumedQuantity: 10, allocationDate: '2026-01-05', expectedReturnDate: null,
          actualCost: 500, notes: '' },
      ],
    });

    const result = computeProjectAccounting(project);
    const taskAcct = result.taskAccounting.find((t) => t.taskId === 't1');
    expect(taskAcct).toBeDefined();
    // Material cost should be included in baseline
    expect(taskAcct!.materialCost).toBeGreaterThan(0);
    expect(taskAcct!.baselineCost).toBeGreaterThan(1000); // original + material
  });
});
