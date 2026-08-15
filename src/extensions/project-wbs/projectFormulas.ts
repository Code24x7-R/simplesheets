// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project Formula Engine
 *
 * Integrates spreadsheet formulas with project data.
 * Allows task fields to use formulas referencing resources, risks, and other tasks.
 *
 * Features:
 * - VLOOKUP for resource rates
 * - SUM/AVERAGE for rollup calculations
 * - TODAY/DATEDIF for date calculations
 * - IF for conditional logic
 */

import type { Project, WBSTask } from '../types';
import { evaluateFormulaPreview } from '../../utils/formulaEngine';
import type { Sheet, Cell, Workbook } from '../../types';

/**
 * Create a virtual sheet from project data for formula evaluation.
 * Maps project resources, tasks, and risks to cell references.
 */
export function createProjectFormulaSheet(project: Project): Sheet {
  const cells: Record<string, Cell> = {};
  const rowCount = Math.max(100, project.resources.length + project.wbs.length + 20);
  const colCount = 26;

  // Row 0: Headers
  // Column A: Resource IDs
  cells['0:0'] = { rawValue: 'Resource ID', computedValue: 'Resource ID' };
  cells['1:0'] = { rawValue: 'Name', computedValue: 'Name' };
  cells['2:0'] = { rawValue: 'Rate', computedValue: 'Rate' };
  cells['3:0'] = { rawValue: 'Role', computedValue: 'Role' };

  // Rows 1..N: Resource data
  project.resources.forEach((resource, idx) => {
    const row = idx + 1;
    cells[`0:${row}`] = { rawValue: resource.id, computedValue: resource.id };
    cells[`1:${row}`] = { rawValue: resource.name, computedValue: resource.name };
    cells[`2:${row}`] = { rawValue: String(resource.costRate), computedValue: resource.costRate };
    cells[`3:${row}`] = { rawValue: resource.role, computedValue: resource.role };
  });

  // Section: Tasks (starts after resources)
  const taskStartRow = project.resources.length + 3;
  cells[`0:${taskStartRow}`] = { rawValue: 'Task ID', computedValue: 'Task ID' };
  cells[`1:${taskStartRow}`] = { rawValue: 'Task Name', computedValue: 'Task Name' };
  cells[`2:${taskStartRow}`] = { rawValue: 'Duration', computedValue: 'Duration' };
  cells[`3:${taskStartRow}`] = { rawValue: 'Progress', computedValue: 'Progress' };
  cells[`4:${taskStartRow}`] = { rawValue: 'Resource', computedValue: 'Resource' };

  // Flatten tasks and add to sheet
  const allTasks: WBSTask[] = [];
  function collectTasks(tasks: WBSTask[]) {
    for (const task of tasks) {
      allTasks.push(task);
      collectTasks(task.children);
    }
  }
  collectTasks(project.wbs);

  allTasks.forEach((task, idx) => {
    const row = taskStartRow + 1 + idx;
    cells[`0:${row}`] = { rawValue: task.id, computedValue: task.id };
    cells[`1:${row}`] = { rawValue: task.name, computedValue: task.name };
    cells[`2:${row}`] = { rawValue: String(task.duration), computedValue: task.duration };
    cells[`3:${row}`] = { rawValue: String(task.progress), computedValue: task.progress };
    cells[`4:${row}`] = { rawValue: task.responsibleResourceId ?? '', computedValue: task.responsibleResourceId ?? '' };
  });

  // Section: Risks
  const riskStartRow = taskStartRow + allTasks.length + 3;
  cells[`0:${riskStartRow}`] = { rawValue: 'Risk ID', computedValue: 'Risk ID' };
  cells[`1:${riskStartRow}`] = { rawValue: 'Risk Title', computedValue: 'Risk Title' };
  cells[`2:${riskStartRow}`] = { rawValue: 'Probability', computedValue: 'Probability' };
  cells[`3:${riskStartRow}`] = { rawValue: 'Impact', computedValue: 'Impact' };
  cells[`4:${riskStartRow}`] = { rawValue: 'Score', computedValue: 'Score' };

  project.risks.forEach((risk, idx) => {
    const row = riskStartRow + 1 + idx;
    cells[`0:${row}`] = { rawValue: risk.id, computedValue: risk.id };
    cells[`1:${row}`] = { rawValue: risk.title, computedValue: risk.title };
    cells[`2:${row}`] = { rawValue: String(risk.probability), computedValue: risk.probability };
    cells[`3:${row}`] = { rawValue: String(risk.impact), computedValue: risk.impact };
    cells[`4:${row}`] = { rawValue: String(risk.probability * risk.impact), computedValue: risk.probability * risk.impact };
  });

  return {
    id: 'project-formulas',
    name: 'Project Data',
    cells,
    rowCount,
    columnCount: colCount,
    defaultColWidth: 80,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    frozenColumns: 0,
    frozenRows: 0,
  };
}

/**
 * Create a minimal workbook from a single sheet.
 */
function createWorkbookFromSheet(sheet: Sheet): Workbook {
  return {
    id: 'project',
    title: 'Project',
    sheets: [sheet],
    activeSheetIndex: 0,
    extensions: {},
    lastModified: Date.now(),
  };
}

/**
 * Evaluate a formula string in the context of project data.
 * @param formula - Formula string (e.g., '=VLOOKUP("dev1", A1:D10, 3, FALSE)')
 * @param project - The project model
 * @returns Evaluated value
 */
export function evaluateProjectFormula(formula: string, project: Project): number | string | null {
  if (!formula.startsWith('=')) {
    return formula; // Not a formula, return as-is
  }

  try {
    const sheet = createProjectFormulaSheet(project);
    const workbook = createWorkbookFromSheet(sheet);
    const expr = formula.slice(1); // Remove '='

    const result = evaluateFormulaPreview(expr, workbook, 0);
    // Convert boolean to string for consistency
    if (typeof result === 'boolean') {
      return result ? 'TRUE' : 'FALSE';
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Look up a resource rate using VLOOKUP semantics.
 * @param resourceId - Resource ID to look up
 * @param project - The project model
 * @returns Resource cost rate or 0 if not found
 */
export function lookupResourceRate(resourceId: string, project: Project): number {
  const resource = project.resources.find((r) => r.id === resourceId);
  return resource?.costRate ?? 0;
}

/**
 * Calculate total project cost using resource rates and task durations.
 * @param task - The task to calculate cost for
 * @param project - The project model
 * @returns Calculated cost
 */
export function calculateTaskCost(task: WBSTask, project: Project): number {
  if (task.responsibleResourceId) {
    const rate = lookupResourceRate(task.responsibleResourceId, project);
    // Cost = rate * duration (assuming daily rate)
    return rate * task.duration;
  }
  return task.cost;
}

/**
 * Calculate total cost for a task including all descendants.
 * @param task - The root task
 * @param project - The project model
 * @returns Total cost including descendants
 */
export function calculateTotalCost(task: WBSTask, project: Project): number {
  let total = calculateTaskCost(task, project);
  for (const child of task.children) {
    total += calculateTotalCost(child, project);
  }
  return total;
}

/**
 * Get resource lookup table for VLOOKUP.
 * Returns a 2D array that can be used with VLOOKUP formulas.
 */
export function getResourceLookupTable(project: Project): (string | number)[][] {
  const table: (string | number)[][] = [];

  // Header row
  table.push(['ID', 'Name', 'Rate', 'Role']);

  // Data rows
  for (const resource of project.resources) {
    table.push([resource.id, resource.name, resource.costRate, resource.role]);
  }

  return table;
}

/**
 * Evaluate a task's formula fields and update computed values.
 * @param task - The task to evaluate
 * @param project - The project model
 * @returns Task with computed values
 */
export function evaluateTaskFormulas(task: WBSTask, project: Project): WBSTask {
  // If cost starts with '=', evaluate it as a formula
  if (typeof task.cost === 'string' && String(task.cost).startsWith('=')) {
    const result = evaluateProjectFormula(String(task.cost), project);
    if (result !== null && typeof result === 'number') {
      return { ...task, cost: result };
    }
  }
  return task;
}

/**
 * Get a summary of formula functions available for project use.
 */
export const PROJECT_FORMULA_FUNCTIONS = {
  VLOOKUP: 'VLOOKUP(lookup_value, table_array, col_index, [range_lookup])',
  HLOOKUP: 'HLOOKUP(lookup_value, table_array, row_index, [range_lookup])',
  SUM: 'SUM(number1, [number2], ...)',
  AVERAGE: 'AVERAGE(number1, [number2], ...)',
  IF: 'IF(logical_test, value_if_true, value_if_false)',
  TODAY: 'TODAY()',
  DATEDIF: 'DATEDIF(start_date, end_date, unit)',
  COUNTIF: 'COUNTIF(range, criteria)',
  SUMIF: 'SUMIF(range, criteria, [sum_range])',
  NETWORKDAYS: 'NETWORKDAYS(start_date, end_date, [holidays])',
  MIN: 'MIN(number1, [number2], ...)',
  MAX: 'MAX(number1, [number2], ...)',
  ROUND: 'ROUND(number, num_digits)',
};
