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

import type { Sheet, ColumnMapping, ProjectModel, TaskRow, Cell } from '../../types';
import type { Project, WBSTask } from '../types';

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

// ─── Sheet to Project Conversion ────────────────────────────────────────────

/**
 * Convert sheet data to a Project model using the provided column mapping.
 */
export function sheetToProject(sheet: Sheet, mapping: ColumnMapping, projectName?: string): ProjectModel {
  const headerRow = mapping.headerRow ?? 0;
  const tasks: TaskRow[] = [];

  // Build a map from row index to task for parent/dependency resolution
  const rowIndexToTaskId = new Map<number, string>();

  for (let row = headerRow + 1; row < sheet.rowCount; row++) {
    const task = parseTaskRow(sheet, row, mapping);
    if (task) {
      tasks.push(task);
      rowIndexToTaskId.set(row, task.id);
    }
  }

  // Resolve parent references (by row reference or by name match)
  resolveParentRefs(tasks, sheet, mapping, rowIndexToTaskId);

  // Resolve dependency references
  resolveDependencyRefs(tasks, sheet, mapping, rowIndexToTaskId);

  // Compute project date range
  const dates = tasks.flatMap((t) => [t.startDate, t.endDate]).filter(Boolean);
  const projectStart = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);
  const projectEnd = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString().slice(0, 10);

  return {
    id: `proj-${Date.now()}`,
    name: projectName ?? sheet.name ?? 'Project Plan',
    description: `Imported from sheet "${sheet.name}"`,
    startDate: projectStart,
    endDate: projectEnd,
    tasks,
    risks: [], // Risks come from separate sheet or manual entry
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
  const duration = mapping.durationCol !== null
    ? parseInt(getCellStringValue(sheet, row, mapping.durationCol)) || 1
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
      costCurrency: 'USD',
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
    resources: [],
    risks,
    wbs: roots,
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
 * Creates a new Sheet pre-populated with project column headers and sample data.
 * The returned sheet can be added to a workbook.
 *
 * @param sheetName - Name for the new sheet tab
 * @param includeSamples - Whether to include sample data rows (default: true)
 * @returns A new Sheet ready to be added to a workbook
 */
export function createProjectSheet(sheetName = 'Project Plan', includeSamples = true): Sheet {
  const colCount = PROJECT_SHEET_HEADERS.length;
  const rowCount = includeSamples ? 1 + SAMPLE_ROWS.length + 5 : 2; // header + samples + blank rows
  const cells: Record<string, Cell> = {};

  // Header row
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

  // Sample data rows
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
