// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Template Handler
 *
 * Loads, parses, validates, and converts JSON project templates.
 * Makes templates maintainable as data files rather than code.
 */

import type { Project, WBSTask, Resource, WorkingCalendar, Risk } from '../../types';
import type { ProjectTemplateJSON, TaskJSON, RiskJSON, ResourceJSON } from './types';
import { createRisk } from '../risks';
import { createDefaultCalendar } from '../calendar';
import { getDefaultCurrency } from '../currency';

/**
 * Validation error for templates
 */
export class TemplateValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

/**
 * Validates a JSON template structure
 */
export function validateTemplate(template: unknown): ProjectTemplateJSON {
  if (!template || typeof template !== 'object') {
    throw new TemplateValidationError('Template must be an object', 'root');
  }

  const t = template as Record<string, unknown>;

  // Required fields
  if (!t.id || typeof t.id !== 'string') {
    throw new TemplateValidationError('Template must have a string "id"', 'id');
  }
  if (!t.name || typeof t.name !== 'string') {
    throw new TemplateValidationError('Template must have a string "name"', 'name');
  }
  if (!t.category || typeof t.category !== 'string') {
    throw new TemplateValidationError('Template must have a string "category"', 'category');
  }
  if (!t.startDate || typeof t.startDate !== 'string') {
    throw new TemplateValidationError('Template must have a string "startDate"', 'startDate');
  }
  if (!Array.isArray(t.tasks)) {
    throw new TemplateValidationError('Template must have a "tasks" array', 'tasks');
  }

  // Validate tasks
  for (let i = 0; i < t.tasks.length; i++) {
    validateTask(t.tasks[i], `tasks[${i}]`);
  }

  return template as ProjectTemplateJSON;
}

function validateTask(task: unknown, path: string): void {
  if (!task || typeof task !== 'object') {
    throw new TemplateValidationError(`${path} must be an object`, path);
  }
  const t = task as Record<string, unknown>;
  if (!t.id || typeof t.id !== 'string') {
    throw new TemplateValidationError(`${path} must have a string "id"`, `${path}.id`);
  }
  if (!t.name || typeof t.name !== 'string') {
    throw new TemplateValidationError(`${path} must have a string "name"`, `${path}.name`);
  }
  if (!t.startDate || typeof t.startDate !== 'string') {
    throw new TemplateValidationError(`${path} must have a string "startDate"`, `${path}.startDate`);
  }
  if (!t.endDate || typeof t.endDate !== 'string') {
    throw new TemplateValidationError(`${path} must have a string "endDate"`, `${path}.endDate`);
  }
  // Validate children recursively
  if (t.children) {
    if (!Array.isArray(t.children)) {
      throw new TemplateValidationError(`${path}.children must be an array`, `${path}.children`);
    }
    for (let i = 0; i < t.children.length; i++) {
      validateTask(t.children[i], `${path}.children[${i}]`);
    }
  }
}

/**
 * Parse a JSON template string into a validated template object
 */
export function parseTemplate(json: string): ProjectTemplateJSON {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new TemplateValidationError('Invalid JSON syntax', 'root');
  }
  return validateTemplate(parsed);
}

/**
 * Convert a JSON template to a runtime Project
 */
export function templateToProject(template: ProjectTemplateJSON): Project {
  const calendar: WorkingCalendar = template.calendar
    ? {
        workingDays: new Set(template.calendar.workingDays ?? [1, 2, 3, 4, 5]),
        holidays: new Set(template.calendar.holidays ?? []),
        hoursPerDay: template.calendar.hoursPerDay ?? 8,
      }
    : createDefaultCalendar();

  // Convert tasks (flatten tree while preserving hierarchy)
  const roots: WBSTask[] = [];
  const allTasks: WBSTask[] = [];

  for (const taskJSON of template.tasks) {
    const task = jsonTaskToWBSTask(taskJSON, 0);
    roots.push(task);
    collectAllTasks(task, allTasks);
  }

  // Set levels recursively
  function setLevels(tasks: WBSTask[], level: number): void {
    for (const task of tasks) {
      task.level = level;
      task.isSummary = task.children.length > 0;
      setLevels(task.children, level + 1);
    }
  }
  setLevels(roots, 0);

  // Convert resources
  const resources: Resource[] = (template.resources ?? []).map((r) => jsonResourceToResource(r));

  // Convert risks
  const risks: Risk[] = (template.risks ?? []).map((r) => jsonRiskToRisk(r, template.id, template.startDate));

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    startDate: template.startDate,
    endDate: template.endDate ?? template.startDate,
    calendar,
    resources,
    risks,
    wbs: roots,
  };
}

/**
 * Recursively collect all tasks into a flat array
 */
function collectAllTasks(task: WBSTask, result: WBSTask[]): void {
  result.push(task);
  for (const child of task.children) {
    collectAllTasks(child, result);
  }
}

/**
 * Convert JSON task to WBSTask
 */
function jsonTaskToWBSTask(json: TaskJSON, level: number): WBSTask {
  const children: WBSTask[] = (json.children ?? []).map((c) => jsonTaskToWBSTask(c, level + 1));

  return {
    id: json.id,
    name: json.name,
    description: json.description ?? '',
    level,
    parentId: null, // Set by parent during construction
    children,
    startDate: json.startDate,
    endDate: json.endDate,
    duration: calculateWorkingDays(json.startDate, json.endDate),
    progress: json.progress ?? 0,
    effort: calculateWorkingDays(json.startDate, json.endDate) * 8,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: getDefaultCurrency(),
    responsibleResourceId: json.resourceId ?? null,
    dependencies: json.dependencies?.map((depId) => ({ predecessorId: depId, type: 'FS' as const, lag: 0 })) ?? [],
    isMilestone: json.isMilestone ?? false,
    isSummary: children.length > 0,
    collapsed: false,
    color: json.color ?? '#3B82F6',
    riskIds: [],
    customFields: {},
  };
}

/**
 * Calculate working days between two dates (simple Mon-Fri)
 */
function calculateWorkingDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, count);
}

/**
 * Convert JSON resource to Resource
 */
function jsonResourceToResource(json: ResourceJSON): Resource {
  return {
    id: json.id,
    name: json.name,
    role: json.role ?? '',
    costRate: json.costRate ?? 0,
    costCurrency: json.costCurrency ?? getDefaultCurrency(),
    availability: json.availability ?? 100,
    color: json.color ?? '#3B82F6',
  };
}

/**
 * Convert JSON risk to Risk
 */
function jsonRiskToRisk(json: RiskJSON, projectId: string, defaultDate: string): Risk {
  return createRisk({
    id: json.id,
    projectId,
    title: json.title,
    category: json.category,
    probability: json.probability,
    impact: json.impact,
    status: json.status ?? 'identified',
    ownerId: json.ownerId ?? null,
    mitigationPlan: json.mitigationPlan ?? '',
    description: json.notes ?? '',
    identifiedDate: json.identifiedDate ?? defaultDate,
    reviewDate: json.reviewDate ?? '',
  });
}

/**
 * Load a template from a JSON string and convert to Project
 */
export function loadTemplateFromJSON(json: string): Project {
  const template = parseTemplate(json);
  return templateToProject(template);
}
