// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Sheet-to-Project Converter
 *
 * Converts spreadsheet data into a Project model.
 * Handles:
 * - Column auto-detection from header row
 * - Parent-child hierarchy construction
 * - Dependency resolution
 * - Progress and date parsing
 */

import type { Sheet, Workbook, ColumnMapping, ProjectModel, TaskRow, RiskRow, ResourceRow, Cell } from '../../types';
import { colToLetter } from '../../types';
import type { Project, WBSTask, Resource } from '../types';
import { getTemplateById } from './templates/index';
import { getAllTasks } from './treeOps';
import { getDefaultCurrency, getCurrencyFormatPattern } from '../../utils/currency';

// ─── Sheet Name Constants ──────────────────────────────────────────────────

export const TASKS_SHEET_NAME = 'Project Plan';
export const RISKS_SHEET_NAME = 'Risks';
export const RESOURCES_SHEET_NAME = 'Resources';

// ─── Risk & Resource Column Layouts ───────────────────────────────────────

const RISK_HEADERS = ['Risk', 'Category', 'Probability', 'Impact', 'Status', 'Owner', 'Mitigation Plan', 'Notes'];
const RESOURCE_HEADERS = ['Resource', 'Role', 'Cost Rate', 'Currency', 'Availability %', 'Color'];

// ─── Column Auto-Detection ──────────────────────────────────────────────────

const COLUMN_KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  taskCol: ['task', 'name', 'title', 'activity', 'work package', 'wbs', 'description'],
  startDateCol: ['start', 'begin', 'commence', 'from'],
  endDateCol: ['end', 'finish', 'due', 'complete', 'to', 'deadline'],
  durationCol: ['duration', 'days', 'effort', 'work'],
  parentCol: ['parent', 'wbs parent', 'parent id', 'parent task', 'summary'],
  dependencyCol: ['dependency', 'depends', 'predecessor', 'pred', 'link'],
  progressCol: ['progress', '%', 'complete', 'done', 'percent', 'status'],
  resourceCol: ['resource', 'assigned', 'owner', 'who', 'team', 'person'],
  milestoneCol: ['milestone', 'mstone', 'marker'],
  colorCol: ['color', 'colour'],
  notesCol: ['notes', 'comment', 'description', 'note', 'remarks'],
  headerRow: [],
};

/**
 * Auto-detect column mapping from a sheet's header row.
 * Scans the first few rows for column headers that match known keywords.
 */
export function detectColumnMapping(sheet: Sheet): ColumnMapping | null {
  // Find the header row by scanning first 5 rows
  const headerRow = findHeaderRow(sheet);
  if (headerRow === null) return null;

  const headers: string[] = [];
  for (let col = 0; col < sheet.columnCount; col++) {
    const cell = sheet.cells[`${headerRow}:${col}`];
    headers.push((cell?.rawValue ?? '').toString().trim().toLowerCase());
  }

  const mapping: ColumnMapping = {
    taskCol: -1,
    startDateCol: -1,
    endDateCol: -1,
    durationCol: null,
    parentCol: null,
    dependencyCol: null,
    progressCol: null,
    resourceCol: null,
    milestoneCol: null,
    colorCol: null,
    notesCol: null,
    headerRow,
  };

  // Match each column to the best keyword match
  for (let col = 0; col < headers.length; col++) {
    const header = headers[col];
    if (!header) continue;

    for (const [field, keywords] of Object.entries(COLUMN_KEYWORDS)) {
      if (field === 'headerRow') continue;
      for (const keyword of keywords) {
        if (header === keyword || header.includes(keyword)) {
          const key = field as keyof ColumnMapping;
          // Assign if field is a column and not yet mapped (-1 for required, null for optional)
          if (key.includes('Col')) {
            const currentValue = (mapping as unknown as Record<string, number | null>)[key];
            if (currentValue === -1 || currentValue === null) {
              (mapping as unknown as Record<string, number | null>)[key] = col;
            }
          }
          break;
        }
      }
    }
  }

  // Require at least task + one date column
  if (mapping.taskCol === -1) return null;
  if (mapping.startDateCol === -1 && mapping.endDateCol === -1) return null;

  return mapping;
}

/**
 * Find the header row by scanning the first few rows for column labels.
 */
function findHeaderRow(sheet: Sheet): number | null {
  for (let row = 0; row < Math.min(5, sheet.rowCount); row++) {
    let matchCount = 0;
    for (let col = 0; col < Math.min(sheet.columnCount, 15); col++) {
      const cell = sheet.cells[`${row}:${col}`];
      if (!cell?.rawValue) continue;
      const value = cell.rawValue.toString().trim().toLowerCase();
      for (const keywords of Object.values(COLUMN_KEYWORDS)) {
        for (const keyword of keywords) {
          if (value === keyword || value.includes(keyword)) {
            matchCount++;
            break;
          }
        }
      }
    }
    if (matchCount >= 2) return row;
  }
  return null;
}

// ─── Workbook to Project Conversion ────────────────────────────────────────

/**
 * Convert a workbook (with separate sheets for tasks, risks, resources) to a Project model.
 * Falls back to single-sheet format for backward compatibility.
 */
export function workbookToProject(
  workbook: Workbook,
  tasksSheetName: string = TASKS_SHEET_NAME,
  mapping?: ColumnMapping | null,
  projectName?: string,
): ProjectModel {
  // Find the tasks sheet
  const tasksSheetIndex = workbook.sheets.findIndex((s) => s.name === tasksSheetName);
  if (tasksSheetIndex === -1) {
    // Fallback: use first sheet
    return sheetToProjectLegacy(workbook.sheets[0], mapping ?? detectColumnMapping(workbook.sheets[0]) ?? getDefaultColumnMapping(), projectName);
  }

  const tasksSheet = workbook.sheets[tasksSheetIndex];
  const taskMapping = mapping ?? detectColumnMapping(tasksSheet) ?? getDefaultColumnMapping();

  // Parse tasks from the tasks sheet
  const tasks = parseTasksFromSheet(tasksSheet, taskMapping);

  // Resolve parent and dependency references
  const rowIndexToTaskId = new Map<number, string>();
  tasks.forEach((t, i) => rowIndexToTaskId.set(i + 1, t.id));
  resolveParentRefs(tasks, tasksSheet, taskMapping, rowIndexToTaskId);
  resolveDependencyRefs(tasks, tasksSheet, taskMapping, rowIndexToTaskId);

  // Compute project date range
  const dates = tasks.flatMap((t) => [t.startDate, t.endDate]).filter(Boolean);
  const projectStart = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);
  const projectEnd = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString().slice(0, 10);

  // Parse risks from the Risks sheet
  const risksSheet = workbook.sheets.find((s) => s.name === RISKS_SHEET_NAME);
  const risks = risksSheet ? parseAllRisks(risksSheet) : [];

  // Parse resources from the Resources sheet
  const resourcesSheet = workbook.sheets.find((s) => s.name === RESOURCES_SHEET_NAME);
  const resources = resourcesSheet ? parseAllResources(resourcesSheet) : [];

  return {
    id: `proj-${Date.now()}`,
    name: projectName ?? tasksSheetName ?? 'Project Plan',
    description: `Imported from workbook "${workbook.title ?? 'Project'}"`,
    startDate: projectStart,
    endDate: projectEnd,
    tasks,
    risks,
    resources,
  };
}

/**
 * Legacy single-sheet converter for backward compatibility.
 */
export function sheetToProject(sheet: Sheet, mapping: ColumnMapping, projectName?: string): ProjectModel {
  return sheetToProjectLegacy(sheet, mapping, projectName);
}

/**
 * Parse tasks from a dedicated tasks sheet.
 */
function parseTasksFromSheet(sheet: Sheet, mapping: ColumnMapping): TaskRow[] {
  const headerRow = mapping.headerRow ?? 0;
  const tasks: TaskRow[] = [];

  for (let row = headerRow + 1; row < sheet.rowCount; row++) {
    const task = parseTaskRow(sheet, row, mapping);
    if (task) {
      tasks.push(task);
    }
  }
  return tasks;
}

/**
 * Parse all risks from a dedicated risks sheet.
 */
function parseAllRisks(sheet: Sheet): RiskRow[] {
  const risks: RiskRow[] = [];
  // Find header row
  let headerRow = -1;
  for (let row = 0; row < Math.min(5, sheet.rowCount); row++) {
    const cell = sheet.cells[`${row}:0`];
    const value = (cell?.rawValue ?? '').toString().trim().toLowerCase();
    if (value === 'risk' || value === 'title') {
      headerRow = row;
      break;
    }
  }
  if (headerRow === -1) return risks;

  for (let row = headerRow + 1; row < sheet.rowCount; row++) {
    const risk = parseRiskRow(sheet, row);
    if (risk) {
      risks.push(risk);
    }
  }
  return risks;
}

/**
 * Parse all resources from a dedicated resources sheet.
 */
function parseAllResources(sheet: Sheet): ResourceRow[] {
  const resources: ResourceRow[] = [];
  // Find header row
  let headerRow = -1;
  for (let row = 0; row < Math.min(5, sheet.rowCount); row++) {
    const cell = sheet.cells[`${row}:0`];
    const value = (cell?.rawValue ?? '').toString().trim().toLowerCase();
    if (value === 'resource' || value === 'name') {
      headerRow = row;
      break;
    }
  }
  if (headerRow === -1) return resources;

  for (let row = headerRow + 1; row < sheet.rowCount; row++) {
    const resource = parseResourceRow(sheet, row);
    if (resource) {
      resources.push(resource);
    }
  }
  return resources;
}

/**
 * Legacy single-sheet parser for backward compatibility.
 */
function sheetToProjectLegacy(sheet: Sheet, mapping: ColumnMapping, projectName?: string): ProjectModel {
  const headerRow = mapping.headerRow ?? 0;
  const tasks: TaskRow[] = [];
  const rowIndexToTaskId = new Map<number, string>();

  // Find section boundaries by scanning for headers
  let riskHeaderRow: number | null = null;
  let resourceHeaderRow: number | null = null;
  for (let row = headerRow + 1; row < sheet.rowCount; row++) {
    const cell = sheet.cells[`${row}:0`];
    const value = (cell?.rawValue ?? '').toString().trim().toLowerCase();
    if (value === 'risk' || value === 'risks' || value === 'title') {
      riskHeaderRow = row;
    } else if (value === 'resource' || value === 'resources' || value === 'name') {
      resourceHeaderRow = row;
      break;
    }
  }

  // Parse tasks until risk section or end
  const taskEndRow = riskHeaderRow ?? sheet.rowCount;
  for (let row = headerRow + 1; row < taskEndRow; row++) {
    const task = parseTaskRow(sheet, row, mapping);
    if (task) {
      tasks.push(task);
      rowIndexToTaskId.set(row, task.id);
    }
  }

  resolveParentRefs(tasks, sheet, mapping, rowIndexToTaskId);
  resolveDependencyRefs(tasks, sheet, mapping, rowIndexToTaskId);

  const dates = tasks.flatMap((t) => [t.startDate, t.endDate]).filter(Boolean);
  const projectStart = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);
  const projectEnd = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString().slice(0, 10);

  const risks: RiskRow[] = [];
  const resources: ResourceRow[] = [];

  if (riskHeaderRow !== null) {
    for (let row = riskHeaderRow + 1; row < (resourceHeaderRow ?? sheet.rowCount); row++) {
      const risk = parseRiskRow(sheet, row);
      if (risk) risks.push(risk);
    }
  }

  if (resourceHeaderRow !== null) {
    for (let row = resourceHeaderRow + 1; row < sheet.rowCount; row++) {
      const resource = parseResourceRow(sheet, row);
      if (resource) resources.push(resource);
    }
  }

  return {
    id: `proj-${Date.now()}`,
    name: projectName ?? sheet.name ?? 'Project Plan',
    description: `Imported from sheet "${sheet.name}"`,
    startDate: projectStart,
    endDate: projectEnd,
    tasks,
    risks,
    resources,
  };
}

/**
 * Parse a single risk row.
 */
function parseRiskRow(sheet: Sheet, row: number): RiskRow | null {
  const title = getCellStringValue(sheet, row, 0);
  if (!title) return null;

  return {
    id: `risk-${row}-${Date.now()}`,
    title,
    category: getCellStringValue(sheet, row, 1) || 'other',
    probability: parseInt(getCellStringValue(sheet, row, 2)) || 1,
    impact: parseInt(getCellStringValue(sheet, row, 3)) || 1,
    status: getCellStringValue(sheet, row, 4) || 'identified',
    ownerId: getCellStringValue(sheet, row, 5) || null,
    mitigationPlan: getCellStringValue(sheet, row, 6),
    notes: getCellStringValue(sheet, row, 7),
  };
}

/**
 * Parse a single resource row.
 */
function parseResourceRow(sheet: Sheet, row: number): ResourceRow | null {
  const name = getCellStringValue(sheet, row, 0);
  if (!name) return null;

  return {
    id: `r-${row}-${Date.now()}`,
    name,
    role: getCellStringValue(sheet, row, 1),
    costRate: parseFloat(getCellStringValue(sheet, row, 2)) || 0,
    costCurrency: getCellStringValue(sheet, row, 3) || getDefaultCurrency(),
    // Availability stored as decimal (0-1) with percentage format, convert back to 0-100
    availability: Math.round((parseFloat(getCellStringValue(sheet, row, 4)) || 1) * 100),
    color: getCellStringValue(sheet, row, 5) || '#3B82F6',
  };
}

/**
 * Parse a single row into a TaskRow.
 */
function parseTaskRow(sheet: Sheet, row: number, mapping: ColumnMapping): TaskRow | null {
  const name = getCellStringValue(sheet, row, mapping.taskCol);
  if (!name) return null; // Skip empty rows

  const startDate = parseDate(getCellStringValue(sheet, row, mapping.startDateCol));
  const endDate = parseDate(getCellStringValue(sheet, row, mapping.endDateCol));
  // Duration may be a NETWORKDAYS formula - read computedValue for formulas
  const durationRaw = mapping.durationCol !== null
    ? getCellStringValue(sheet, row, mapping.durationCol)
    : '';
  const duration = mapping.durationCol !== null
    ? parseInt(durationRaw) || 1
    : 1;

  const progressRaw = mapping.progressCol !== null
    ? getCellStringValue(sheet, row, mapping.progressCol)
    : '';
  const progress = parseProgress(progressRaw);

  const isMilestone = mapping.milestoneCol !== null
    ? isTruthyValue(getCellStringValue(sheet, row, mapping.milestoneCol))
    : false;

  const color = mapping.colorCol !== null
    ? parseColor(getCellStringValue(sheet, row, mapping.colorCol))
    : '#3B82F6';

  const notes = mapping.notesCol !== null
    ? getCellStringValue(sheet, row, mapping.notesCol)
    : '';

  // If only start date provided, compute end from duration
  let computedEndDate = endDate;
  if (startDate && !endDate) {
    computedEndDate = addDays(startDate, duration - 1);
  } else if (!startDate && endDate) {
    // If only end date, set start to end
    computedEndDate = endDate;
  }

  return {
    id: `task-${row}-${Date.now()}`,
    name,
    startDate: startDate ?? new Date().toISOString().slice(0, 10),
    endDate: computedEndDate ?? startDate ?? new Date().toISOString().slice(0, 10),
    duration,
    parentId: null, // Resolved later
    dependencies: [], // Resolved later
    progress,
    resourceId: null,
    isMilestone: isMilestone || duration === 1,
    color,
    notes,
  };
}

/**
 * Resolve parent references for all tasks.
 * Parent can be specified as: row number, task ID, or task name.
 */
function resolveParentRefs(
  tasks: TaskRow[],
  sheet: Sheet,
  mapping: ColumnMapping,
  rowIndexToTaskId: Map<number, number | string>,
): void {
  if (mapping.parentCol === null) return;

  // Build name-to-first-task-index map for name-based matching
  const taskNameMap = new Map<string, string>();
  for (const task of tasks) {
    const key = task.name.toLowerCase().trim();
    if (!taskNameMap.has(key)) {
      taskNameMap.set(key, task.id);
    }
  }

  for (let i = 0; i < tasks.length; i++) {
    const parentValue = getCellStringValue(sheet, i + (mapping.headerRow ?? 0) + 1, mapping.parentCol);
    if (!parentValue) continue;

    const parentTrimmed = parentValue.trim();

    // Try to match by row number (e.g., "1", "2")
    const rowNum = parseInt(parentTrimmed, 10);
    if (!isNaN(rowNum) && rowIndexToTaskId.has(rowNum - 1)) {
      tasks[i].parentId = rowIndexToTaskId.get(rowNum - 1) as string;
      continue;
    }

    // Try to match by name (case-insensitive)
    const parentId = taskNameMap.get(parentTrimmed.toLowerCase());
    if (parentId && parentId !== tasks[i].id) {
      tasks[i].parentId = parentId;
    }
  }
}

/**
 * Resolve dependency references for all tasks.
 * Dependencies can be specified as comma-separated row numbers or task IDs.
 */
function resolveDependencyRefs(
  tasks: TaskRow[],
  sheet: Sheet,
  mapping: ColumnMapping,
  rowIndexToTaskId: Map<number, number | string>,
): void {
  if (mapping.dependencyCol === null) return;

  const taskIdSet = new Set(tasks.map((t) => t.id));
  const headerRow = mapping.headerRow ?? 0;

  for (let i = 0; i < tasks.length; i++) {
    const sheetRow = headerRow + 1 + i;
    const depValue = getCellStringValue(sheet, sheetRow, mapping.dependencyCol);
    if (!depValue) continue;

    const deps: string[] = [];
    for (const part of depValue.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Try row number (1-based, referring to data rows)
      const rowNum = parseInt(trimmed, 10);
      if (!isNaN(rowNum)) {
        // Convert to 0-based sheet row: data row N = headerRow + N
        const targetSheetRow = headerRow + rowNum;
        if (rowIndexToTaskId.has(targetSheetRow)) {
          const predId = rowIndexToTaskId.get(targetSheetRow) as string;
          if (taskIdSet.has(predId) && predId !== tasks[i].id) {
            deps.push(predId);
            continue;
          }
        }
      }

      // Try task ID directly
      if (taskIdSet.has(trimmed) && trimmed !== tasks[i].id) {
        deps.push(trimmed);
      }
    }
    tasks[i].dependencies = deps;
  }
}

// ─── Project Model to Runtime Project ────────────────────────────────────────

/**
 * Convert a serialized ProjectModel to a runtime Project (with WBSTask tree).
 */
export function projectModelToProject(model: ProjectModel): Project {
  // Build task map for quick lookup
  const taskMap = new Map<string, WBSTask>();
  for (const row of model.tasks) {
    taskMap.set(row.id, {
      id: row.id,
      name: row.name,
      description: row.notes,
      level: 0,
      parentId: row.parentId,
      children: [],
      startDate: row.startDate,
      endDate: row.endDate,
      duration: row.duration,
      progress: row.progress,
      effort: row.duration,
      effortUnit: 'days',
      cost: 0,
      costCurrency: getDefaultCurrency(),
      responsibleResourceId: row.resourceId,
      dependencies: row.dependencies.map((predId) => ({
        predecessorId: predId,
        type: 'FS',
        lag: 0,
      })),
      isMilestone: row.isMilestone,
      isSummary: false,
      collapsed: false,
      color: row.color,
      riskIds: [],
      customFields: {},
    });
  }

  // Build tree structure
  const roots: WBSTask[] = [];
  for (const task of taskMap.values()) {
    if (task.parentId && taskMap.has(task.parentId)) {
      const parent = taskMap.get(task.parentId)!;
      parent.children.push(task);
      parent.isSummary = true;
    } else {
      roots.push(task);
    }
  }

  // Set levels recursively
  function setLevels(tasks: WBSTask[], level: number): void {
    for (const task of tasks) {
      task.level = level;
      setLevels(task.children, level + 1);
    }
  }
  setLevels(roots, 0);

  // Parse risks
  const risks = model.risks.map((r) => ({
    id: r.id,
    projectId: model.id,
    taskId: null,
    title: r.title,
    description: r.notes,
    category: (['technical', 'schedule', 'cost', 'resource', 'external', 'quality', 'scope', 'other'].includes(r.category)
      ? r.category
      : 'other') as import('../types').RiskCategory,
    probability: r.probability,
    impact: r.impact,
    riskScore: r.probability * r.impact,
    status: (['identified', 'assessing', 'mitigating', 'monitoring', 'occurred', 'closed'].includes(r.status)
      ? r.status
      : 'identified') as import('../types').RiskStatus,
    mitigationPlan: r.mitigationPlan,
    contingencyPlan: '',
    mitigationCost: 0,
    ownerId: r.ownerId,
    identifiedDate: model.startDate,
    reviewDate: '',
    triggerCondition: '',
    residualProbability: Math.max(1, r.probability - 1),
    residualImpact: Math.max(1, r.impact - 1),
    residualRiskScore: Math.max(1, (r.probability - 1) * (r.impact - 1)),
    customFields: {},
  }));

  // Convert resource rows to runtime resources
  const resources: Resource[] = model.resources.map((r) => rowToResource(r));

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    startDate: model.startDate,
    endDate: model.endDate,
    calendar: {
      workingDays: new Set([1, 2, 3, 4, 5]),
      holidays: new Set(),
      hoursPerDay: 8,
    },
    resources,
    risks,
    wbs: roots,
  };
}

// ─── Project Model to Workbook ────────────────────────────────────────────

/**
 * Convert a ProjectModel to a workbook with separate sheets for tasks, risks, and resources.
 * This enables Project → Sheet sync with proper separation of concerns.
 */
export function projectModelToWorkbook(
  model: ProjectModel,
  mapping?: ColumnMapping | null,
): Workbook {
  const taskMapping = mapping ?? getDefaultColumnMapping();
  const sheets: Sheet[] = [];

  // ─── Tasks Sheet ───────────────────────────────────────────────────
  sheets.push(createTasksSheet(model, taskMapping));

  // ─── Risks Sheet ───────────────────────────────────────────────────
  sheets.push(createRisksSheetFromModel(model));

  // ─── Resources Sheet ───────────────────────────────────────────────
  sheets.push(createResourcesSheetFromModel(model));

  return {
    id: `wb-${model.id}`,
    title: model.name,
    sheets,
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

/**
 * Create the tasks sheet from a ProjectModel.
 */
function createTasksSheet(model: ProjectModel, mapping: ColumnMapping): Sheet {
  const headerRow = mapping.headerRow ?? 0;
  const colCount = 11; // Task columns
  const rowCount = headerRow + 1 + model.tasks.length + 2;
  const cells: Record<string, Cell> = {};

  // Headers
  const headers = ['Task', 'Start Date', 'End Date', 'Duration', 'Parent', 'Dependency', 'Progress', 'Resource', 'Milestone', 'Color', 'Notes'];
  for (let col = 0; col < headers.length; col++) {
    cells[`${headerRow}:${col}`] = {
      rawValue: headers[col],
      computedValue: headers[col],
      style: { fontWeight: 'bold', backgroundColor: '#EFF6FF', color: '#1E40AF' },
    };
  }

  // Data rows
  for (let i = 0; i < model.tasks.length; i++) {
    const task = model.tasks[i];
    const row = headerRow + 1 + i;
    const rowNum = row + 1;

    if (mapping.taskCol >= 0) cells[`${row}:${mapping.taskCol}`] = { rawValue: task.name, computedValue: task.name };
    if (mapping.startDateCol >= 0) cells[`${row}:${mapping.startDateCol}`] = { rawValue: task.startDate, computedValue: task.startDate };
    if (mapping.endDateCol >= 0) cells[`${row}:${mapping.endDateCol}`] = { rawValue: task.endDate, computedValue: task.endDate };
    if (mapping.durationCol !== null && mapping.durationCol >= 0) {
      const startCol = colToLetter(mapping.startDateCol);
      const endCol = colToLetter(mapping.endDateCol);
      cells[`${row}:${mapping.durationCol}`] = {
        rawValue: `=NETWORKDAYS(${startCol}${rowNum},${endCol}${rowNum})`,
        computedValue: String(task.duration),
      };
    }
    if (mapping.parentCol !== null && mapping.parentCol >= 0) {
      const parentTask = model.tasks.find((t) => t.id === task.parentId);
      cells[`${row}:${mapping.parentCol}`] = { rawValue: parentTask?.name ?? '', computedValue: parentTask?.name ?? '' };
    }
    if (mapping.dependencyCol !== null && mapping.dependencyCol >= 0) {
      const depRows = task.dependencies.map((depId) => {
        const idx = model.tasks.findIndex((t) => t.id === depId);
        return idx >= 0 ? String(idx + 1) : '';
      }).filter(Boolean);
      cells[`${row}:${mapping.dependencyCol}`] = { rawValue: depRows.join(', '), computedValue: depRows.join(', ') };
    }
    if (mapping.progressCol !== null && mapping.progressCol >= 0) cells[`${row}:${mapping.progressCol}`] = { rawValue: String(task.progress), computedValue: String(task.progress) };
    if (mapping.resourceCol !== null && mapping.resourceCol >= 0) cells[`${row}:${mapping.resourceCol}`] = { rawValue: task.resourceId ?? '', computedValue: task.resourceId ?? '' };
    if (mapping.milestoneCol !== null && mapping.milestoneCol >= 0) cells[`${row}:${mapping.milestoneCol}`] = { rawValue: task.isMilestone ? 'yes' : 'no', computedValue: task.isMilestone ? 'yes' : 'no' };
    if (mapping.colorCol !== null && mapping.colorCol >= 0) cells[`${row}:${mapping.colorCol}`] = { rawValue: task.color, computedValue: task.color };
    if (mapping.notesCol !== null && mapping.notesCol >= 0) cells[`${row}:${mapping.notesCol}`] = { rawValue: task.notes, computedValue: task.notes };
  }

  return {
    id: `sheet-tasks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: TASKS_SHEET_NAME,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: { 0: 200, 10: 180 },
    rowHeights: {},
    columnCount: colCount,
    rowCount: rowCount,
    frozenColumns: 1,
    frozenRows: 1,
  };
}

/**
 * Create the risks sheet from a ProjectModel.
 */
function createRisksSheetFromModel(model: ProjectModel): Sheet {
  const colCount = RISK_HEADERS.length;
  const rowCount = 1 + model.risks.length + 2;
  const cells: Record<string, Cell> = {};

  // Headers
  for (let col = 0; col < RISK_HEADERS.length; col++) {
    cells[`0:${col}`] = {
      rawValue: RISK_HEADERS[col],
      computedValue: RISK_HEADERS[col],
      style: { fontWeight: 'bold', backgroundColor: '#FEF3C7', color: '#92400E' },
    };
  }

  // Data rows
  for (let i = 0; i < model.risks.length; i++) {
    const risk = model.risks[i];
    const row = 1 + i;
    cells[`${row}:0`] = { rawValue: risk.title, computedValue: risk.title };
    cells[`${row}:1`] = { rawValue: risk.category, computedValue: risk.category };
    cells[`${row}:2`] = { rawValue: String(risk.probability), computedValue: String(risk.probability) };
    cells[`${row}:3`] = { rawValue: String(risk.impact), computedValue: String(risk.impact) };
    cells[`${row}:4`] = { rawValue: risk.status, computedValue: risk.status };
    cells[`${row}:5`] = { rawValue: risk.ownerId ?? '', computedValue: risk.ownerId ?? '' };
    cells[`${row}:6`] = { rawValue: risk.mitigationPlan, computedValue: risk.mitigationPlan };
    cells[`${row}:7`] = { rawValue: risk.notes, computedValue: risk.notes };
  }

  return {
    id: `sheet-risks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: RISKS_SHEET_NAME,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: { 0: 180, 6: 200 },
    rowHeights: {},
    columnCount: colCount,
    rowCount: rowCount,
    frozenColumns: 0,
    frozenRows: 1,
  };
}

/**
 * Create the resources sheet from a ProjectModel.
 */
function createResourcesSheetFromModel(model: ProjectModel): Sheet {
  const colCount = RESOURCE_HEADERS.length;
  const rowCount = 1 + model.resources.length + 2;
  const cells: Record<string, Cell> = {};

  // Headers
  for (let col = 0; col < RESOURCE_HEADERS.length; col++) {
    cells[`0:${col}`] = {
      rawValue: RESOURCE_HEADERS[col],
      computedValue: RESOURCE_HEADERS[col],
      style: { fontWeight: 'bold', backgroundColor: '#ECFDF5', color: '#065F46' },
    };
  }

  // Data rows
  for (let i = 0; i < model.resources.length; i++) {
    const resource = model.resources[i];
    const row = 1 + i;
    cells[`${row}:0`] = { rawValue: resource.name, computedValue: resource.name };
    cells[`${row}:1`] = { rawValue: resource.role, computedValue: resource.role };
    cells[`${row}:2`] = {
      rawValue: String(resource.costRate),
      computedValue: resource.costRate,
      style: { numberFormat: getCurrencyFormatPattern(resource.costCurrency) },
    };
    cells[`${row}:3`] = { rawValue: resource.costCurrency, computedValue: resource.costCurrency };
    // Store availability as decimal (0-1) with percentage format for display
    cells[`${row}:4`] = {
      rawValue: String((resource.availability ?? 100) / 100),
      computedValue: (resource.availability ?? 100) / 100,
      style: { numberFormat: '0%' },
    };
    cells[`${row}:5`] = { rawValue: resource.color, computedValue: resource.color };
  }

  return {
    id: `sheet-resources-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: RESOURCES_SHEET_NAME,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: { 0: 150 },
    rowHeights: {},
    columnCount: colCount,
    rowCount: rowCount,
    frozenColumns: 0,
    frozenRows: 1,
  };
}

/**
 * Legacy: Convert a ProjectModel back to single-sheet cell data.
 * @deprecated Use projectModelToWorkbook instead.
 */
export function projectModelToSheetCells(
  model: ProjectModel,
  mapping: ColumnMapping,
): Record<string, string> {
  const workbook = projectModelToWorkbook(model, mapping);
  // Flatten all sheets into a single cell record (for backward compat)
  const cells: Record<string, string> = {};
  let rowOffset = 0;
  for (const sheet of workbook.sheets) {
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const [r, c] = key.split(':').map(Number);
      cells[`${r + rowOffset}:${c}`] = cell.rawValue;
    }
    rowOffset += sheet.rowCount + 1; // +1 for blank separator
  }
  return cells;
}

/**
 * Convert runtime Resource to serializable ResourceRow.
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
 * Convert ResourceRow to runtime Resource.
 */
export function rowToResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    costRate: row.costRate,
    costCurrency: row.costCurrency,
    availability: row.availability,
    color: row.color,
  };
}

/**
 * Convert RiskRow to runtime Risk.
 */
export function rowToRisk(row: RiskRow) {
  return {
    id: row.id,
    projectId: '',
    taskId: null,
    title: row.title,
    description: row.notes,
    category: row.category as import('../types').RiskCategory,
    probability: row.probability,
    impact: row.impact,
    riskScore: row.probability * row.impact,
    status: row.status as import('../types').RiskStatus,
    mitigationPlan: row.mitigationPlan,
    contingencyPlan: '',
    mitigationCost: 0,
    ownerId: row.ownerId,
    identifiedDate: '',
    reviewDate: '',
    triggerCondition: '',
    residualProbability: Math.max(1, row.probability - 1),
    residualImpact: Math.max(1, row.impact - 1),
    residualRiskScore: Math.max(1, (row.probability - 1) * (row.impact - 1)),
    customFields: {},
  };
}

/**
 * Convert runtime Risk to serializable RiskRow.
 */
export function riskToRow(risk: import('../types').Risk): RiskRow {
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

// ─── Utility Functions ──────────────────────────────────────────────────────

function getCellStringValue(sheet: Sheet, row: number, col: number): string {
  if (col < 0) return '';
  const cell = sheet.cells[`${row}:${col}`];
  if (!cell) return '';
  return (cell.computedValue ?? cell.rawValue ?? '').toString().trim();
}

function parseDate(value: string): string | null {
  if (!value) return null;
  // Try parsing as ISO date (YYYY-MM-DD)
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try parsing with Date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function parseProgress(value: string): number {
  if (!value) return 0;
  // Remove % sign
  const cleaned = value.replace('%', '').trim();
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return 0;
  return Math.min(100, Math.max(0, num));
}

function isTruthyValue(value: string): boolean {
  const v = value.toLowerCase().trim();
  return v === 'true' || v === 'yes' || v === 'y' || v === '1' || v === 'x';
}

function parseColor(value: string): string {
  if (!value) return '#3B82F6';
  // Check if it's a valid hex color
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  // Named colors
  const namedColors: Record<string, string> = {
    red: '#EF4444',
    blue: '#3B82F6',
    green: '#10B981',
    yellow: '#F59E0B',
    orange: '#F97316',
    purple: '#8B5CF6',
    pink: '#EC4899',
    cyan: '#06B6D4',
    gray: '#6B7280',
    grey: '#6B7280',
  };
  return namedColors[value.toLowerCase()] ?? '#3B82F6';
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Create New Project Sheet ───────────────────────────────────────────────

/**
 * Default column headers for a new project sheet.
 * These are the canonical headers that auto-detection recognizes.
 */
export const PROJECT_SHEET_HEADERS = [
  'Task',
  'Start Date',
  'End Date',
  'Duration',
  'Parent',
  'Dependency',
  'Progress',
  'Resource',
  'Milestone',
  'Color',
  'Notes',
] as const;

/**
 * Sample rows to help users understand the expected format.
 */
const SAMPLE_ROWS: string[][] = [
  ['Project Planning', '2025-01-06', '2025-01-17', '10', '', '', '0', '', 'no', '', 'Initial planning phase'],
  ['  Research', '2025-01-06', '2025-01-10', '5', 'Project Planning', '', '0', '', 'no', '', 'Market and technical research'],
  ['  Design', '2025-01-13', '2025-01-17', '5', 'Project Planning', '2', '0', '', 'no', '', 'System design based on research'],
  ['Development', '2025-01-20', '2025-02-14', '20', '', '3', '0', '', 'no', '', 'Main development phase'],
  ['  Implementation', '2025-01-20', '2025-02-07', '15', 'Development', '', '0', '', 'no', '', 'Core implementation work'],
  ['  Testing', '2025-02-03', '2025-02-14', '10', 'Development', '5', '0', '', 'no', '', 'QA and testing'],
  ['Deployment', '2025-02-17', '2025-02-21', '5', '', '4', '0', '', 'yes', '', 'Production deployment'],
];

/**
 * Sample risk rows for the project sheet.
 */
const SAMPLE_RISKS: string[][] = [
  ['Scope creep', 'scope', '3', '4', 'identified', '', 'Regular scope reviews', 'Monitor requirements'],
  ['Resource unavailability', 'resource', '2', '3', 'identified', '', 'Cross-train team members', 'Key person dependency'],
  ['Technical debt', 'technical', '3', '2', 'monitoring', '', 'Code reviews', 'May slow development'],
];

/**
 * Sample resource rows for the project sheet.
 */
const SAMPLE_RESOURCES: string[][] = [
  ['Alice Smith', 'Project Manager', '150', 'USD', '100', '#3B82F6'],
  ['Bob Jones', 'Developer', '120', 'USD', '100', '#10B981'],
  ['Carol White', 'Designer', '110', 'USD', '50', '#F59E0B'],
];

/**
 * Creates a new Sheet pre-populated with project column headers and sample data.
 * The returned sheet can be added to a workbook.
 *
 * @param sheetName - Name for the new sheet tab
 * @param includeSamples - Whether to include sample data rows (default: true)
 * @returns A new Sheet ready to be added to a workbook
 */
export function createProjectSheet(sheetName = 'Project Plan', includeSamples = true): Sheet {
  const colCount = PROJECT_SHEET_HEADERS.length;
  const taskRowCount = includeSamples ? SAMPLE_ROWS.length : 0;
  const riskRowCount = includeSamples ? SAMPLE_RISKS.length : 0;
  const resourceRowCount = includeSamples ? SAMPLE_RESOURCES.length : 0;
  // header + tasks + separator + risk header + risks + separator + resource header + resources + blank
  const rowCount = 1 + taskRowCount + 1 + 1 + riskRowCount + 1 + 1 + resourceRowCount + 5;
  const cells: Record<string, Cell> = {};

  // ─── Task Section ──────────────────────────────────────────────────

  // Task header row (row 0)
  for (let col = 0; col < colCount; col++) {
    cells[`0:${col}`] = {
      rawValue: PROJECT_SHEET_HEADERS[col],
      computedValue: PROJECT_SHEET_HEADERS[col],
      style: {
        fontWeight: 'bold',
        backgroundColor: '#EFF6FF',
        color: '#1E40AF',
      },
    };
  }

  // Task data rows
  if (includeSamples) {
    for (let i = 0; i < SAMPLE_ROWS.length; i++) {
      const row = i + 1;
      const rowData = SAMPLE_ROWS[i];
      for (let col = 0; col < rowData.length; col++) {
        const value = rowData[col] ?? '';
        if (value) {
          cells[`${row}:${col}`] = {
            rawValue: value,
            computedValue: value,
          };
        }
      }
    }
  }

  // ─── Risk Section ──────────────────────────────────────────────────

  const taskEndRow = 1 + taskRowCount;
  const riskHeaderRow = taskEndRow + 1; // +1 for separator

  // Risk headers
  const riskHeaders = ['Risk', 'Category', 'Probability', 'Impact', 'Status', 'Owner', 'Mitigation Plan', 'Notes'];
  for (let col = 0; col < riskHeaders.length; col++) {
    cells[`${riskHeaderRow}:${col}`] = {
      rawValue: riskHeaders[col],
      computedValue: riskHeaders[col],
      style: {
        fontWeight: 'bold',
        backgroundColor: '#FEF3C7',
        color: '#92400E',
      },
    };
  }

  // Risk data rows
  if (includeSamples) {
    for (let i = 0; i < SAMPLE_RISKS.length; i++) {
      const row = riskHeaderRow + 1 + i;
      const rowData = SAMPLE_RISKS[i];
      for (let col = 0; col < rowData.length; col++) {
        const value = rowData[col] ?? '';
        if (value) {
          cells[`${row}:${col}`] = {
            rawValue: value,
            computedValue: value,
          };
        }
      }
    }
  }

  // ─── Resource Section ───────────────────────────────────────────────

  const riskEndRow = riskHeaderRow + 1 + riskRowCount;
  const resourceHeaderRow = riskEndRow + 1; // +1 for separator

  // Resource headers
  const resourceHeaders = ['Resource', 'Role', 'Cost Rate', 'Currency', 'Availability %', 'Color'];
  for (let col = 0; col < resourceHeaders.length; col++) {
    cells[`${resourceHeaderRow}:${col}`] = {
      rawValue: resourceHeaders[col],
      computedValue: resourceHeaders[col],
      style: {
        fontWeight: 'bold',
        backgroundColor: '#ECFDF5',
        color: '#065F46',
      },
    };
  }

  // Resource data rows
  if (includeSamples) {
    for (let i = 0; i < SAMPLE_RESOURCES.length; i++) {
      const row = resourceHeaderRow + 1 + i;
      const rowData = SAMPLE_RESOURCES[i];
      for (let col = 0; col < rowData.length; col++) {
        const value = rowData[col] ?? '';
        if (value) {
          cells[`${row}:${col}`] = {
            rawValue: value,
            computedValue: value,
          };
        }
      }
    }
  }

  return {
    id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: sheetName,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: {
      0: 200, // Task column wider
      10: 180, // Notes column wider
    },
    rowHeights: {},
    columnCount: colCount,
    rowCount: rowCount,
    frozenColumns: 1, // Freeze task name column
    frozenRows: 1, // Freeze header row
  };
}

/**
 * Get the default column mapping for a sheet created by createProjectSheet.
 * Since we control the headers, we know exactly which columns map to which fields.
 */
export function getDefaultColumnMapping(): ColumnMapping {
  return {
    taskCol: 0,
    startDateCol: 1,
    endDateCol: 2,
    durationCol: 3,
    parentCol: 4,
    dependencyCol: 5,
    progressCol: 6,
    resourceCol: 7,
    milestoneCol: 8,
    colorCol: 9,
    notesCol: 10,
    headerRow: 0,
  };
}

// ─── Template to Sheet ─────────────────────────────────────────────────────

/**
 * Create a new Sheet pre-populated with data from a project template.
 * The sheet includes task, risk, and resource sections.
 *
 * @param templateId - ID of the template to use
 * @param projectName - Optional custom name for the project
 * @returns A new Sheet ready to be added to a workbook, or null if template not found
 */
export function createSheetFromTemplate(templateId: string, projectName?: string): Sheet | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  const project = template.create();
  const colCount = PROJECT_SHEET_HEADERS.length;
  const cells: Record<string, Cell> = {};

  // Convert project to model (serializable)
  const allTasks = getAllTasks(project.wbs);
  const model: ProjectModel = {
    id: project.id,
    name: projectName ?? project.name,
    description: project.description,
    startDate: project.startDate,
    endDate: project.endDate,
    tasks: allTasks.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      duration: t.duration,
      parentId: t.parentId,
      dependencies: t.dependencies.map((d) => d.predecessorId),
      progress: t.progress,
      resourceId: t.responsibleResourceId,
      isMilestone: t.isMilestone,
      color: t.color,
      notes: t.description,
    })),
    risks: project.risks.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      probability: r.probability,
      impact: r.impact,
      status: r.status,
      ownerId: r.ownerId,
      mitigationPlan: r.mitigationPlan,
      notes: r.description,
    })),
    resources: project.resources.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      costRate: r.costRate,
      costCurrency: r.costCurrency,
      availability: r.availability,
      color: r.color,
    })),
  };

  // Use projectModelToSheetCells to generate cells
  const mapping = getDefaultColumnMapping();
  const cellValues = projectModelToSheetCells(model, mapping);

  // Convert string values to Cell objects with headers styled
  for (const [key, value] of Object.entries(cellValues)) {
    const [row, col] = key.split(':').map(Number);
    const isHeader = row === 0 || row === model.tasks.length + 1 || row === model.tasks.length + 1 + 1 + model.risks.length + 1;
    cells[key] = {
      rawValue: value,
      computedValue: value,
      style: isHeader ? {
        fontWeight: 'bold',
        backgroundColor: col === 0 ? '#EFF6FF' : undefined,
        color: '#1E40AF',
      } : undefined,
    };
  }

  // Calculate row count
  const taskRowCount = model.tasks.length;
  const riskRowCount = model.risks.length;
  const resourceRowCount = model.resources.length;
  const rowCount = 1 + taskRowCount + 1 + 1 + riskRowCount + 1 + 1 + resourceRowCount + 5;

  return {
    id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: projectName ?? project.name,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: {
      0: 200,
      10: 180,
    },
    rowHeights: {},
    columnCount: colCount,
    rowCount: rowCount,
    frozenColumns: 1,
    frozenRows: 1,
  };
}

// ─── Template to Workbook ──────────────────────────────────────────────────

/**
 * Create a new Workbook with separate sheets for tasks, risks, and resources
 * from a project template.
 *
 * @param templateId - ID of the template to use
 * @param projectName - Optional custom name for the project
 * @returns A new Workbook ready to be loaded, or null if template not found
 */
export function createWorkbookFromTemplate(templateId: string, projectName?: string): Workbook | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  const project = template.create();

  // Convert project to model (serializable)
  const allTasks = getAllTasks(project.wbs);
  const model: ProjectModel = {
    id: project.id,
    name: projectName ?? project.name,
    description: project.description,
    startDate: project.startDate,
    endDate: project.endDate,
    tasks: allTasks.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      duration: t.duration,
      parentId: t.parentId,
      dependencies: t.dependencies.map((d) => d.predecessorId),
      progress: t.progress,
      resourceId: t.responsibleResourceId,
      isMilestone: t.isMilestone,
      color: t.color,
      notes: t.description,
    })),
    risks: project.risks.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      probability: r.probability,
      impact: r.impact,
      status: r.status,
      ownerId: r.ownerId,
      mitigationPlan: r.mitigationPlan,
      notes: r.description,
    })),
    resources: project.resources.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      costRate: r.costRate,
      costCurrency: r.costCurrency,
      availability: r.availability,
      color: r.color,
    })),
  };

  return projectModelToWorkbook(model);
}

// ─── Blank Sheet Creators ──────────────────────────────────────────────────

/**
 * Create a blank risks sheet with headers.
 */
export function createRisksSheet(): Sheet {
  const cells: Record<string, Cell> = {};
  for (let col = 0; col < RISK_HEADERS.length; col++) {
    cells[`0:${col}`] = {
      rawValue: RISK_HEADERS[col],
      computedValue: RISK_HEADERS[col],
      style: { fontWeight: 'bold', backgroundColor: '#FEF3C7', color: '#92400E' },
    };
  }
  return {
    id: `sheet-risks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: RISKS_SHEET_NAME,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: { 0: 180, 6: 200 },
    rowHeights: {},
    columnCount: RISK_HEADERS.length,
    rowCount: 10,
    frozenColumns: 0,
    frozenRows: 1,
  };
}

/**
 * Create a blank resources sheet with headers.
 */
export function createResourcesSheet(): Sheet {
  const cells: Record<string, Cell> = {};
  for (let col = 0; col < RESOURCE_HEADERS.length; col++) {
    cells[`0:${col}`] = {
      rawValue: RESOURCE_HEADERS[col],
      computedValue: RESOURCE_HEADERS[col],
      style: { fontWeight: 'bold', backgroundColor: '#ECFDF5', color: '#065F46' },
    };
  }
  return {
    id: `sheet-resources-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: RESOURCES_SHEET_NAME,
    cells,
    defaultColWidth: 120,
    defaultRowHeight: 24,
    columnWidths: { 0: 150 },
    rowHeights: {},
    columnCount: RESOURCE_HEADERS.length,
    rowCount: 10,
    frozenColumns: 0,
    frozenRows: 1,
  };
}
