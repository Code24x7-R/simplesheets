// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project Converter Utilities
 *
 * Shared utilities for converting between runtime Project and serializable ProjectModel.
 * Used by both ProjectView (for syncing to sheet) and sheetToProject (for templates).
 */

import type { Project, WBSTask, Risk, Resource, Material } from '../types';
import type { ProjectModel, TaskRow, RiskRow, ResourceRow, MaterialRow, ActualRow } from '../../types';
import { getAllTasks } from './treeOps';

/**
 * Convert a runtime Project to a serializable ProjectModel.
 * This is the single source of truth for Project → ProjectModel conversion.
 */
export function projectToModel(projectState: Project): ProjectModel {
  const allTasks = getAllTasks(projectState.wbs);
  return {
    id: projectState.id,
    name: projectState.name,
    description: projectState.description,
    startDate: projectState.startDate,
    endDate: projectState.endDate,
    tasks: allTasks.map((t) => taskToRow(t)),
    risks: projectState.risks.map((r) => riskToRow(r)),
    resources: projectState.resources.map((r) => resourceToRow(r)),
    materials: (projectState.materials ?? []).map((m) => materialToRow(m)),
    actuals: (projectState.accounting?.spendEntries ?? []).map((a) => actualToRow(a)),
  };
}

/**
 * Convert a WBSTask to a serializable TaskRow.
 */
export function taskToRow(task: WBSTask): TaskRow {
  return {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    duration: task.duration,
    parentId: task.parentId,
    dependencies: task.dependencies.map((d) => d.predecessorId),
    progress: task.progress,
    resourceId: task.responsibleResourceId,
    isMilestone: task.isMilestone,
    color: task.color,
    notes: task.description,
  };
}

/**
 * Convert a Risk to a serializable RiskRow.
 */
export function riskToRow(risk: Risk): RiskRow {
  return {
    id: risk.id,
    title: risk.title,
    category: risk.category,
    probability: risk.probability,
    impact: risk.impact,
    status: risk.status,
    ownerId: risk.ownerId,
    mitigationPlan: risk.mitigationPlan,
    notes: risk.description,
  };
}

/**
 * Convert a Resource to a serializable ResourceRow.
 */
export function resourceToRow(resource: Resource): ResourceRow {
  return {
    id: resource.id,
    name: resource.name,
    role: resource.role,
    costRate: resource.costRate,
    costCurrency: resource.costCurrency,
    availability: resource.availability,
    color: resource.color,
  };
}

/**
 * Convert a Material to a serializable MaterialRow.
 */
export function materialToRow(material: Material): MaterialRow {
  return {
    id: material.id,
    name: material.name,
    classification: material.classification,
    unit: material.unit,
    unitCost: material.unitCost,
    quantity: material.quantity,
    vendor: material.vendor,
    depreciationMethod: material.depreciationMethod,
    usefulLifeMonths: material.usefulLifeMonths,
    salvageValue: material.salvageValue,
    billingPeriod: material.billingPeriod,
    rentalRate: material.rentalRate,
    leaseStartDate: material.leaseStartDate,
    leaseEndDate: material.leaseEndDate,
    wastageRate: material.wastageRate,
    reorderPoint: material.reorderPoint,
    carryingCostPerUnit: material.carryingCostPerUnit,
    currency: material.currency,
    status: material.status,
  };
}

/**
 * Convert an ActualSpendEntry to a serializable ActualRow.
 */
export function actualToRow(actual: {
  id: string;
  taskId: string;
  date: string;
  amount: number;
  currency: string;
  source: string;
  notes: string;
}): ActualRow {
  return {
    id: actual.id,
    taskId: actual.taskId,
    date: actual.date,
    amount: actual.amount,
    currency: actual.currency,
    source: actual.source,
    notes: actual.notes,
  };
}
