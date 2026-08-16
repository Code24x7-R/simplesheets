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
import { projectModelToProject } from './sheetToProject';
import { createDefaultCalendar } from './calendar';
import type { WorkingCalendar } from '../types';

/**
 * Flatten a task tree into a list of tasks with parentId set correctly.
 * Unlike getAllTasks, this ensures parentId is set for child tasks,
 * which is needed for proper export/import round-tripping.
 */
function flattenTreeWithParentId(tree: WBSTask[]): WBSTask[] {
  const result: WBSTask[] = [];
  function traverse(tasks: WBSTask[], parentId: string | null) {
    for (const task of tasks) {
      // Create a copy with parentId set correctly
      result.push({ ...task, parentId });
      if (task.children.length > 0) {
        traverse(task.children, task.id);
      }
    }
  }
  traverse(tree, null);
  return result;
}

/**
 * Convert a runtime Project to a serializable ProjectModel.
 * This is the single source of truth for Project → ProjectModel conversion.
 */
export function projectToModel(projectState: Project): ProjectModel {
  // Use flattenTreeWithParentId to ensure parentId is set correctly for export/import
  const allTasks = flattenTreeWithParentId(projectState.wbs);
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

// ─── Import/Export Project Data ────────────────────────────────────────

/**
 * Export a project to a JSON string for saving/sharing.
 * Includes all project data: tasks, risks, resources, materials, actuals.
 */
export function exportProjectToJSON(projectState: Project): string {
  const model = projectToModel(projectState);
  return JSON.stringify({
    format: 'simplesheets-project',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    project: model,
  }, null, 2);
}

/**
 * Import a project from a JSON string.
 * Validates the JSON structure and converts to a runtime Project.
 * @throws Error if JSON is invalid or has wrong format
 */
export function importProjectFromJSON(json: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON syntax');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Project data must be an object');
  }

  const data = parsed as Record<string, unknown>;

  // Validate format
  if (data.format !== 'simplesheets-project') {
    throw new Error('Invalid project file format. Expected "simplesheets-project"');
  }

  // Extract project model
  const model = data.project as ProjectModel;
  if (!model || !model.id || !model.name) {
    throw new Error('Invalid project data: missing id or name');
  }

  // Convert to runtime Project using existing utility
  return projectModelToProject(model);
}

/**
 * Validate a project JSON string without importing it.
 * Returns true if valid, throws Error if invalid.
 */
export function validateProjectJSON(json: string): boolean {
  importProjectFromJSON(json);
  return true;
}

// ─── Blank Project Creation ─────────────────────────────────────────────

/**
 * Create a blank project with default calendar and no tasks.
 * Used when the user wants to start from scratch.
 */
export function createBlankProject(name = 'New Project', startDate?: string, endDate?: string): Project {
  const today = startDate ?? new Date().toISOString().slice(0, 10);
  const end = endDate ?? today;
  return {
    id: `proj-${Date.now()}`,
    name,
    description: '',
    startDate: today,
    endDate: end,
    calendar: createDefaultCalendar(),
    resources: [],
    risks: [],
    wbs: [],
    materials: [],
    accounting: {
      baselineTotal: 0,
      allocatedTotal: 0,
      currentEstimateTotal: 0,
      actualSpendTotal: 0,
      etcTotal: 0,
      taskAccounting: [],
      spendEntries: [],
      changeLog: [],
      currency: 'USD',
    },
  };
}
