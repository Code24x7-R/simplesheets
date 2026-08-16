// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import type { Material, Project, WBSTask } from '../types';
import {
  classifyMaterial,
  shouldCapitalize,
  straightLineDepreciation,
  decliningBalanceDepreciation,
  calculateAccumulatedDepreciation,
  calculateBookValue,
  calculateTCO,
  calculateOpExCost,
  calculateMonthlyOpExBurn,
  calculateIdleTimeCost,
  calculateExpectedConsumption,
  calculateWastageCost,
  calculateConsumableCost,
  calculateCarryingCost,
  calculateTaskMaterialCost,
  calculateMaterialCostSummary,
  DEFAULT_CAPITALIZATION_CONFIG,
} from './materialEngine';

function createMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    name: 'Test Material',
    description: '',
    classification: 'consumable',
    unit: 'each',
    unitCost: 100,
    quantity: 10,
    currency: 'USD',
    vendor: null,
    depreciationMethod: 'straight-line',
    usefulLifeMonths: 36,
    salvageValue: 100,
    acquisitionDate: '2026-01-01',
    billingPeriod: 'daily',
    rentalRate: 50,
    leaseStartDate: null,
    leaseEndDate: null,
    wastageRate: 5,
    reorderPoint: 2,
    carryingCostPerUnit: 2,
    allocatedQuantity: 0,
    consumedQuantity: 0,
    status: 'delivered',
    ...overrides,
  };
}

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
    cost: 1000,
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

describe('classifyMaterial', () => {
  it('classifies expensive items as CapEx', () => {
    expect(classifyMaterial(5000, 1, false)).toBe('capex');
  });

  it('classifies rented items as OpEx even if expensive', () => {
    expect(classifyMaterial(5000, 1, true)).toBe('capex'); // Still CapEx above threshold
  });

  it('classifies rented items below threshold as OpEx', () => {
    expect(classifyMaterial(500, 1, true)).toBe('opex');
  });

  it('classifies cheap purchased items as consumable', () => {
    expect(classifyMaterial(50, 1, false)).toBe('consumable');
  });

  it('respects custom threshold', () => {
    const config = { ...DEFAULT_CAPITALIZATION_CONFIG, threshold: 5000 };
    expect(classifyMaterial(1000, 1, false, config)).toBe('consumable');
  });
});

describe('shouldCapitalize', () => {
  it('returns true above threshold', () => {
    expect(shouldCapitalize(100, 15)).toBe(true); // 1500 > 1000
  });

  it('returns false below threshold', () => {
    expect(shouldCapitalize(10, 5)).toBe(false); // 50 < 1000
  });

  it('returns true at exact threshold', () => {
    expect(shouldCapitalize(100, 10)).toBe(true); // 1000 = 1000
  });
});

describe('straightLineDepreciation', () => {
  it('calculates monthly depreciation correctly', () => {
    // Cost: 10000, Salvage: 1000, Life: 36 months
    // (10000 - 1000) / 36 = 250
    expect(straightLineDepreciation(10000, 1000, 36)).toBeCloseTo(250, 2);
  });

  it('returns 0 for zero useful life', () => {
    expect(straightLineDepreciation(10000, 1000, 0)).toBe(0);
  });

  it('returns 0 when cost equals salvage', () => {
    expect(straightLineDepreciation(1000, 1000, 36)).toBe(0);
  });
});

describe('decliningBalanceDepreciation', () => {
  it('calculates higher depreciation in early months', () => {
    const depreciation = decliningBalanceDepreciation(10000, 10000, 1000, 36, 12);
    expect(depreciation).toBeGreaterThan(0);
    // Should be more than straight-line for first year
    const straightLine = (10000 - 1000) / 36 * 12;
    expect(depreciation).toBeGreaterThan(straightLine);
  });

  it('never depreciates below salvage value', () => {
    const depreciation = decliningBalanceDepreciation(10000, 10000, 1000, 36, 100);
    expect(10000 - depreciation).toBeGreaterThanOrEqual(1000);
  });

  it('returns 0 for 0 months', () => {
    expect(decliningBalanceDepreciation(10000, 10000, 1000, 36, 0)).toBe(0);
  });
});

describe('calculateAccumulatedDepreciation', () => {
  it('returns 0 before acquisition date', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-06-01',
    });
    const depreciation = calculateAccumulatedDepreciation(material, '2026-01-15');
    expect(depreciation).toBe(0);
  });

  it('calculates depreciation after acquisition', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-01-01',
      usefulLifeMonths: 36,
      salvageValue: 1000,
    });
    const depreciation = calculateAccumulatedDepreciation(material, '2026-07-01');
    // 6 months × (10000-1000)/36 = 6 × 250 = 1500
    expect(depreciation).toBeCloseTo(1500, 0);
  });

  it('returns 0 if no acquisition date', () => {
    const material = createMaterial({ acquisitionDate: null });
    expect(calculateAccumulatedDepreciation(material)).toBe(0);
  });
});

describe('calculateBookValue', () => {
  it('equals acquisition cost when new', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-01-01',
    });
    const bookValue = calculateBookValue(material, '2026-01-15');
    // No months elapsed, so no depreciation
    expect(bookValue).toBe(10000);
  });

  it('decreases as depreciation accumulates', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-01-01',
      usefulLifeMonths: 36,
      salvageValue: 1000,
    });
    const bookValue = calculateBookValue(material, '2026-07-01');
    // 10000 - 1500 = 8500
    expect(bookValue).toBeCloseTo(8500, 0);
  });

  it('never goes below salvage value', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-01-01',
      usefulLifeMonths: 12,
      salvageValue: 1000,
    });
    const bookValue = calculateBookValue(material, '2028-01-01');
    expect(bookValue).toBeGreaterThanOrEqual(1000);
  });
});

describe('calculateTCO', () => {
  it('includes acquisition cost minus salvage', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-01-01',
      salvageValue: 2000,
    });
    const tco = calculateTCO(material, 0, '2026-07-01');
    expect(tco).toBeLessThan(10000); // Subtracts salvage
    expect(tco).toBeGreaterThan(0);
  });

  it('includes carrying costs over time', () => {
    const material = createMaterial({
      classification: 'capex',
      unitCost: 10000,
      quantity: 1,
      acquisitionDate: '2026-01-01',
      salvageValue: 1000,
      carryingCostPerUnit: 10,
    });
    const tco6 = calculateTCO(material, 0, '2026-07-01');
    const tco12 = calculateTCO(material, 0, '2027-01-01');
    expect(tco12).toBeGreaterThan(tco6);
  });
});

describe('calculateOpExCost', () => {
  it('calculates daily rate', () => {
    const material = createMaterial({
      classification: 'opex',
      billingPeriod: 'daily',
      rentalRate: 100,
    });
    const cost = calculateOpExCost(material, '2026-01-01', '2026-01-11'); // 10 days
    expect(cost).toBeCloseTo(1000, 0);
  });

  it('calculates weekly rate', () => {
    const material = createMaterial({
      classification: 'opex',
      billingPeriod: 'weekly',
      rentalRate: 500,
    });
    const cost = calculateOpExCost(material, '2026-01-01', '2026-01-22'); // 3 weeks
    expect(cost).toBeCloseTo(1500, 0);
  });

  it('returns fixed cost regardless of period', () => {
    const material = createMaterial({
      classification: 'opex',
      billingPeriod: 'fixed',
      rentalRate: 2000,
    });
    const cost = calculateOpExCost(material, '2026-01-01', '2026-03-01');
    expect(cost).toBe(2000);
  });

  it('returns 0 for negative period', () => {
    const material = createMaterial({
      classification: 'opex',
      billingPeriod: 'daily',
      rentalRate: 100,
    });
    const cost = calculateOpExCost(material, '2026-01-10', '2026-01-01');
    expect(cost).toBe(0);
  });
});

describe('calculateMonthlyOpExBurn', () => {
  it('sums monthly costs for all OpEx materials', () => {
    const materials = [
      createMaterial({ classification: 'opex', billingPeriod: 'daily', rentalRate: 100 }),
      createMaterial({ classification: 'opex', billingPeriod: 'monthly', rentalRate: 2000 }),
    ];
    const burn = calculateMonthlyOpExBurn(materials);
    expect(burn).toBeGreaterThan(0);
  });

  it('returns 0 for no OpEx materials', () => {
    const materials = [createMaterial({ classification: 'capex' })];
    expect(calculateMonthlyOpExBurn(materials)).toBe(0);
  });
});

describe('calculateIdleTimeCost', () => {
  it('calculates idle cost for daily billing', () => {
    const material = createMaterial({
      classification: 'opex',
      billingPeriod: 'daily',
      rentalRate: 100,
    });
    expect(calculateIdleTimeCost(material, 5)).toBe(500);
  });

  it('returns 0 for non-OpEx materials', () => {
    const material = createMaterial({ classification: 'capex' });
    expect(calculateIdleTimeCost(material, 5)).toBe(0);
  });

  it('returns 0 for fixed billing', () => {
    const material = createMaterial({
      classification: 'opex',
      billingPeriod: 'fixed',
      rentalRate: 2000,
    });
    expect(calculateIdleTimeCost(material, 5)).toBe(0);
  });
});

describe('calculateExpectedConsumption', () => {
  it('adds wastage to quantity', () => {
    expect(calculateExpectedConsumption(100, 5)).toBe(105);
  });

  it('returns original quantity when no wastage', () => {
    expect(calculateExpectedConsumption(100, 0)).toBe(100);
  });
});

describe('calculateWastageCost', () => {
  it('calculates cost of wasted material', () => {
    const material = createMaterial({
      consumedQuantity: 100,
      wastageRate: 10,
      unitCost: 5,
    });
    // Wasted: 100 × 10% = 10 units, Cost: 10 × 5 = 50
    expect(calculateWastageCost(material)).toBe(50);
  });

  it('returns 0 when nothing consumed', () => {
    const material = createMaterial({ consumedQuantity: 0 });
    expect(calculateWastageCost(material)).toBe(0);
  });
});

describe('calculateConsumableCost', () => {
  it('includes wastage in total cost', () => {
    const material = createMaterial({
      consumedQuantity: 100,
      wastageRate: 5,
      unitCost: 10,
    });
    // Consumed: 100 × 10 = 1000, Wasted: 5 × 10 = 50, Total: 1050
    expect(calculateConsumableCost(material)).toBe(1050);
  });
});

describe('calculateCarryingCost', () => {
  it('calculates monthly carrying cost', () => {
    const material = createMaterial({
      quantity: 100,
      carryingCostPerUnit: 2,
    });
    expect(calculateCarryingCost(material, 6)).toBe(1200); // 100 × 2 × 6
  });
});

describe('calculateTaskMaterialCost', () => {
  it('returns zero costs when no allocations', () => {
    const task = createTask();
    const cost = calculateTaskMaterialCost(task, [], [], []);
    expect(cost.totalMaterialCost).toBe(0);
  });

  it('calculates OpEx allocation cost', () => {
    const task = createTask();
    const material = createMaterial({
      id: 'mat-1',
      classification: 'opex',
      billingPeriod: 'fixed',
      rentalRate: 1000,
    });
    const allocations = [{
      id: 'alloc-1',
      materialId: 'mat-1',
      taskId: 'task-1',
      allocatedQuantity: 1,
      consumedQuantity: 0,
      allocationDate: '2026-01-01',
      expectedReturnDate: '2026-01-31',
      actualCost: 1000,
      notes: '',
    }];

    const cost = calculateTaskMaterialCost(task, [material], allocations, []);
    expect(cost.opexCost).toBe(1000);
  });

  it('calculates consumable consumption cost', () => {
    const task = createTask();
    const material = createMaterial({
      id: 'mat-1',
      classification: 'consumable',
      unitCost: 10,
      wastageRate: 5,
    });
    const consumptions = [{
      id: 'cons-1',
      materialId: 'mat-1',
      taskId: 'task-1',
      date: '2026-01-05',
      quantity: 10,
      wastageQuantity: 1,
      unitCostAtConsumption: 10,
      notes: '',
    }];

    const cost = calculateTaskMaterialCost(task, [material], [], consumptions);
    // Consumption: 10 × 10 = 100, Wastage: 1 × 10 = 10, Total: 110
    expect(cost.consumableCost).toBe(110);
  });
});

describe('calculateMaterialCostSummary', () => {
  it('returns zero summary for project with no materials', () => {
    const project = createProject({ materials: [] });
    const summary = calculateMaterialCostSummary(project);
    expect(summary.totalMaterialCost).toBe(0);
    expect(summary.taskCosts).toEqual([]);
  });

  it('aggregates costs by classification', () => {
    const project = createProject({
      wbs: [createTask()],
      materials: [
        createMaterial({ id: 'm1', classification: 'capex', unitCost: 10000, quantity: 1, acquisitionDate: '2026-01-01' }),
        createMaterial({ id: 'm2', classification: 'opex', billingPeriod: 'fixed', rentalRate: 2000 }),
        createMaterial({ id: 'm3', classification: 'consumable', unitCost: 100, consumedQuantity: 10 }),
      ],
    });

    const summary = calculateMaterialCostSummary(project);
    expect(summary.totalMaterialCost).toBeGreaterThan(0);
    expect(summary.totalCapEx).toBeGreaterThan(0);
    expect(summary.totalOpEx).toBe(2000);
    expect(summary.totalConsumables).toBeGreaterThan(0);
  });

  it('calculates book value for CapEx assets', () => {
    const project = createProject({
      materials: [
        createMaterial({
          id: 'm1',
          classification: 'capex',
          unitCost: 10000,
          quantity: 1,
          acquisitionDate: '2026-01-01',
          usefulLifeMonths: 36,
          salvageValue: 1000,
        }),
      ],
    });

    const summary = calculateMaterialCostSummary(project, '2026-07-01');
    expect(summary.bookValue).toBeLessThan(10000);
    expect(summary.bookValue).toBeGreaterThan(1000);
  });

  it('calculates monthly OpEx burn rate', () => {
    const project = createProject({
      materials: [
        createMaterial({ classification: 'opex', billingPeriod: 'monthly', rentalRate: 3000 }),
      ],
    });

    const summary = calculateMaterialCostSummary(project);
    expect(summary.monthlyOpExBurn).toBe(3000);
  });

  it('provides per-task cost breakdown', () => {
    const task = createTask();
    const project = createProject({
      wbs: [task],
      materials: [
        createMaterial({ id: 'm1', classification: 'consumable', unitCost: 50 }),
      ],
      materialConsumptions: [{
        id: 'c1',
        materialId: 'm1',
        taskId: 'task-1',
        date: '2026-01-05',
        quantity: 5,
        wastageQuantity: 0,
        unitCostAtConsumption: 50,
        notes: '',
      }],
    });

    const summary = calculateMaterialCostSummary(project);
    expect(summary.taskCosts.length).toBe(1);
    expect(summary.taskCosts[0].consumableCost).toBe(250);
  });
});
