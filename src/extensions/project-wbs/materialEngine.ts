// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Material Management Engine
 *
 * Handles:
 * - CapEx depreciation (straight-line, declining-balance)
 * - OpEx rental/lease cost calculations
 * - Consumable consumption tracking with wastage
 * - Carrying/holding cost calculations
 * - Total Cost of Ownership (TCO)
 * - Capitalization threshold classification
 */

import type {
  Material,
  MaterialAllocation,
  MaterialConsumption,
  MaterialCostSummary,
  TaskMaterialCost,
  CapitalizationConfig,
  Project,
  WBSTask,
} from '../types';
import { getAllTasks } from './treeOps';

// ─── Default Configuration ───────────────────────────────────────────────────

export const DEFAULT_CAPITALIZATION_CONFIG: CapitalizationConfig = {
  threshold: 1000,
  currency: 'USD',
  defaultUsefulLifeMonths: 36,
  defaultDepreciationMethod: 'straight-line',
  defaultSalvagePercent: 10,
};

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * Classify a material based on cost and capitalization threshold.
 * Items above threshold → CapEx, below → OpEx (if rented) or Consumable.
 */
export function classifyMaterial(
  unitCost: number,
  quantity: number,
  isRented: boolean,
  config: CapitalizationConfig = DEFAULT_CAPITALIZATION_CONFIG,
): 'capex' | 'opex' | 'consumable' {
  const totalCost = unitCost * quantity;
  if (totalCost >= config.threshold) return 'capex';
  if (isRented) return 'opex';
  return 'consumable';
}

/**
 * Check if a material should be capitalized based on threshold.
 */
export function shouldCapitalize(
  unitCost: number,
  quantity: number,
  config: CapitalizationConfig = DEFAULT_CAPITALIZATION_CONFIG,
): boolean {
  return unitCost * quantity >= config.threshold;
}

// ─── CapEx Depreciation ──────────────────────────────────────────────────────

/**
 * Calculate straight-line depreciation for a period.
 * Monthly depreciation = (Cost - Salvage Value) / Useful Life in Months
 */
export function straightLineDepreciation(
  acquisitionCost: number,
  salvageValue: number,
  usefulLifeMonths: number,
): number {
  if (usefulLifeMonths <= 0) return 0;
  return (acquisitionCost - salvageValue) / usefulLifeMonths;
}

/**
 * Calculate declining-balance depreciation for a period.
 * Rate = 2 / UsefulLifeMonths (double-declining)
 */
export function decliningBalanceDepreciation(
  _bookValue: number,
  acquisitionCost: number,
  salvageValue: number,
  usefulLifeMonths: number,
  monthsElapsed: number,
): number {
  if (usefulLifeMonths <= 0 || monthsElapsed <= 0) return 0;
  const rate = 2 / usefulLifeMonths;
  let value = acquisitionCost;
  for (let i = 0; i < monthsElapsed; i++) {
    const depreciation = value * rate;
    value = Math.max(salvageValue, value - depreciation);
  }
  return acquisitionCost - value; // Total accumulated depreciation
}

/**
 * Calculate accumulated depreciation for a CapEx asset.
 */
export function calculateAccumulatedDepreciation(
  material: Material,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): number {
  if (!material.acquisitionDate) return 0;
  const acquisition = new Date(material.acquisitionDate + 'T00:00:00');
  const asOf = new Date(asOfDate + 'T00:00:00');
  const monthsElapsed = Math.max(0, (asOf.getFullYear() - acquisition.getFullYear()) * 12 + (asOf.getMonth() - acquisition.getMonth()));

  if (monthsElapsed <= 0) return 0;

  const acquisitionCost = material.unitCost * material.quantity;
  const salvageValue = material.salvageValue;

  switch (material.depreciationMethod) {
    case 'declining-balance':
      return decliningBalanceDepreciation(acquisitionCost, acquisitionCost, salvageValue, material.usefulLifeMonths, monthsElapsed);
    case 'straight-line':
    default:
      return straightLineDepreciation(acquisitionCost, salvageValue, material.usefulLifeMonths) * monthsElapsed;
  }
}

/**
 * Calculate current book value of a CapEx asset.
 */
export function calculateBookValue(
  material: Material,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): number {
  const acquisitionCost = material.unitCost * material.quantity;
  const accumulatedDepreciation = calculateAccumulatedDepreciation(material, asOfDate);
  return Math.max(material.salvageValue, acquisitionCost - accumulatedDepreciation);
}

/**
 * Calculate Total Cost of Ownership (TCO) for a CapEx asset.
 * TCO = Acquisition Cost + Maintenance + Carrying Costs - Salvage Value
 */
export function calculateTCO(
  material: Material,
  maintenanceCost: number = 0,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): number {
  const acquisitionCost = material.unitCost * material.quantity;
  const monthsOwned = material.acquisitionDate
    ? Math.max(0, Math.round((new Date(asOfDate + 'T00:00:00').getTime() - new Date(material.acquisitionDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 0;
  const carryingCosts = material.carryingCostPerUnit * material.quantity * monthsOwned;
  return acquisitionCost + maintenanceCost + carryingCosts - material.salvageValue;
}

// ─── OpEx Calculations ───────────────────────────────────────────────────────

/**
 * Calculate OpEx cost for a rental/lease over a period.
 */
export function calculateOpExCost(
  material: Material,
  startDate: string,
  endDate: string,
): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  switch (material.billingPeriod) {
    case 'hourly':
      return material.rentalRate * days * 8; // 8 hours per day
    case 'daily':
      return material.rentalRate * days;
    case 'weekly':
      return material.rentalRate * (days / 7);
    case 'monthly':
      return material.rentalRate * (days / 30);
    case 'fixed':
    default:
      return material.rentalRate;
  }
}

/**
 * Calculate monthly burn rate for OpEx materials.
 */
export function calculateMonthlyOpExBurn(materials: Material[]): number {
  return materials
    .filter((m) => m.classification === 'opex')
    .reduce((sum, m) => {
      switch (m.billingPeriod) {
        case 'hourly':
          return sum + m.rentalRate * 8 * 22; // 8h/day, 22 days/month
        case 'daily':
          return sum + m.rentalRate * 22;
        case 'weekly':
          return sum + m.rentalRate * 4.33;
        case 'monthly':
          return sum + m.rentalRate;
        case 'fixed':
        default:
          return sum + m.rentalRate;
      }
    }, 0);
}

/**
 * Calculate idle time cost for rented equipment.
 * Idle cost = rental rate × idle days
 */
export function calculateIdleTimeCost(
  material: Material,
  idleDays: number,
): number {
  if (material.classification !== 'opex') return 0;
  switch (material.billingPeriod) {
    case 'hourly':
      return material.rentalRate * idleDays * 8;
    case 'daily':
      return material.rentalRate * idleDays;
    case 'weekly':
      return material.rentalRate * (idleDays / 7);
    case 'monthly':
      return material.rentalRate * (idleDays / 30);
    case 'fixed':
    default:
      return 0; // Fixed cost doesn't change with idle time
  }
}

// ─── Consumable Calculations ─────────────────────────────────────────────────

/**
 * Calculate expected consumption including wastage.
 * Expected = Quantity × (1 + WastageRate / 100)
 */
export function calculateExpectedConsumption(
  quantity: number,
  wastageRate: number,
): number {
  return quantity * (1 + wastageRate / 100);
}

/**
 * Calculate wastage cost for a material.
 */
export function calculateWastageCost(
  material: Material,
): number {
  const wastedQuantity = material.consumedQuantity * (material.wastageRate / 100);
  return wastedQuantity * material.unitCost;
}

/**
 * Calculate total consumable cost including wastage.
 */
export function calculateConsumableCost(material: Material): number {
  const totalConsumed = material.consumedQuantity;
  const wasted = totalConsumed * (material.wastageRate / 100);
  return (totalConsumed + wasted) * material.unitCost;
}

// ─── Carrying / Holding Costs ────────────────────────────────────────────────

/**
 * Calculate carrying cost for a material over a period.
 * Carrying cost = per-unit cost × quantity × months
 */
export function calculateCarryingCost(
  material: Material,
  monthsOwned: number,
): number {
  return material.carryingCostPerUnit * material.quantity * monthsOwned;
}

// ─── Task-Level Material Costs ───────────────────────────────────────────────

/**
 * Calculate material costs allocated to a specific task.
 */
export function calculateTaskMaterialCost(
  task: WBSTask,
  materials: Material[],
  allocations: MaterialAllocation[],
  consumptions: MaterialConsumption[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): TaskMaterialCost {
  const taskAllocations = allocations.filter((a) => a.taskId === task.id);
  const taskConsumptions = consumptions.filter((c) => c.taskId === task.id);

  let capexCost = 0;
  let opexCost = 0;
  let consumableCost = 0;
  let carryingCost = 0;

  for (const allocation of taskAllocations) {
    const material = materials.find((m) => m.id === allocation.materialId);
    if (!material) continue;

    switch (material.classification) {
      case 'capex': {
        // Depreciation allocated proportionally to time used
        const totalDepreciation = calculateAccumulatedDepreciation(material, asOfDate);
        const allocationRatio = allocation.allocatedQuantity / material.quantity;
        capexCost += totalDepreciation * allocationRatio;
        // Carrying cost allocated
        const monthsOwned = material.acquisitionDate
          ? Math.max(0, Math.round((new Date(asOfDate + 'T00:00:00').getTime() - new Date(material.acquisitionDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24 * 30)))
          : 0;
        carryingCost += calculateCarryingCost(material, monthsOwned) * allocationRatio;
        break;
      }
      case 'opex': {
        // Rental cost for the allocation period
        if (allocation.allocationDate && allocation.expectedReturnDate) {
          opexCost += calculateOpExCost(material, allocation.allocationDate, allocation.expectedReturnDate);
        } else {
          opexCost += allocation.actualCost;
        }
        break;
      }
      case 'consumable': {
        consumableCost += allocation.actualCost;
        break;
      }
    }
  }

  // Add consumption costs for consumables
  for (const consumption of taskConsumptions) {
    const material = materials.find((m) => m.id === consumption.materialId);
    if (!material || material.classification !== 'consumable') continue;
    consumableCost += consumption.quantity * consumption.unitCostAtConsumption;
    // Add wastage
    consumableCost += consumption.wastageQuantity * consumption.unitCostAtConsumption;
  }

  return {
    taskId: task.id,
    taskName: task.name,
    capexCost,
    opexCost,
    consumableCost,
    carryingCost,
    totalMaterialCost: capexCost + opexCost + consumableCost + carryingCost,
  };
}

// ─── Project-Level Material Cost Summary ──────────────────────────────────────

/**
 * Calculate comprehensive material cost summary for the project.
 */
export function calculateMaterialCostSummary(
  project: Project,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): MaterialCostSummary {
  const materials = project.materials ?? [];
  const allocations = project.materialAllocations ?? [];
  const consumptions = project.materialConsumptions ?? [];
  const allTasks = getAllTasks(project.wbs);

  let totalCapEx = 0;
  let totalOpEx = 0;
  let totalConsumables = 0;
  let totalCarryingCosts = 0;
  let totalCapExTCO = 0;
  let accumulatedDepreciation = 0;
  let totalWastageCost = 0;
  let totalConsumedValue = 0;

  // Calculate per-material totals
  for (const material of materials) {
    switch (material.classification) {
      case 'capex': {
        const depreciation = calculateAccumulatedDepreciation(material, asOfDate);
        const tco = calculateTCO(material, 0, asOfDate);
        totalCapEx += depreciation;
        totalCapExTCO += tco;
        accumulatedDepreciation += depreciation;
        break;
      }
      case 'opex': {
        if (material.leaseStartDate && material.leaseEndDate) {
          totalOpEx += calculateOpExCost(material, material.leaseStartDate, material.leaseEndDate);
        } else if (material.billingPeriod === 'fixed') {
          totalOpEx += material.rentalRate;
        }
        break;
      }
      case 'consumable': {
        const cost = calculateConsumableCost(material);
        const wastage = calculateWastageCost(material);
        totalConsumables += cost;
        totalWastageCost += wastage;
        totalConsumedValue += material.consumedQuantity * material.unitCost;
        break;
      }
    }
  }

  // Calculate carrying costs
  for (const material of materials) {
    if (material.acquisitionDate) {
      const monthsOwned = Math.max(0, Math.round(
        (new Date(asOfDate + 'T00:00:00').getTime() - new Date(material.acquisitionDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24 * 30)
      ));
      totalCarryingCosts += calculateCarryingCost(material, monthsOwned);
    }
  }

  // Per-task breakdown
  const taskCosts = allTasks.map((task) =>
    calculateTaskMaterialCost(task, materials, allocations, consumptions, asOfDate),
  );

  const totalMaterialCost = totalCapEx + totalOpEx + totalConsumables + totalCarryingCosts;
  const bookValue = materials
    .filter((m) => m.classification === 'capex')
    .reduce((sum, m) => sum + calculateBookValue(m, asOfDate), 0);

  return {
    totalCapEx,
    totalOpEx,
    totalConsumables,
    totalCarryingCosts,
    totalMaterialCost,
    totalCapExTCO,
    accumulatedDepreciation,
    bookValue,
    monthlyOpExBurn: calculateMonthlyOpExBurn(materials),
    idleTimeCost: 0, // Would need idle time tracking data
    totalWastageCost,
    wastagePercent: totalConsumedValue > 0 ? (totalWastageCost / totalConsumedValue) * 100 : 0,
    taskCosts,
  };
}
