// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Template Handler
 *
 * Loads, parses, validates, and converts JSON project templates.
 * Makes templates maintainable as data files rather than code.
 */

import type { Project, WBSTask, Resource, WorkingCalendar, Risk, Material } from '../../types';
import type { ProjectTemplateJSON, TaskJSON, RiskJSON, ResourceJSON, MaterialJSON } from './types';
import { createRisk } from '../risks';
import { createDefaultCalendar } from '../calendar';
import { getEffectiveCurrency } from '../../../utils/currency';

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

  // Auto-assign resources to tasks if none are assigned
  // This ensures Gantt chart shows resource colors for all templates
  if (resources.length > 0) {
    const tasksNeedingResources = allTasks.filter((t) => !t.responsibleResourceId && !t.isSummary && !t.isMilestone);
    if (tasksNeedingResources.length > 0) {
      // Assign resources round-robin to leaf tasks
      let resourceIndex = 0;
      for (const task of tasksNeedingResources) {
        task.responsibleResourceId = resources[resourceIndex % resources.length].id;
        resourceIndex++;
      }
    }
  }

  // Convert risks
  const risks: Risk[] = (template.risks ?? []).map((r) => jsonRiskToRisk(r, template.id, template.startDate));

  // Convert materials
  const materials: Material[] = (template.materials ?? []).map((m) => jsonMaterialToMaterial(m));

  // Convert accounting data
  const accounting = template.accounting
    ? {
        baselineTotal: template.accounting.baselineTotal,
        allocatedTotal: template.accounting.allocatedTotal,
        currentEstimateTotal: template.accounting.currentEstimateTotal,
        actualSpendTotal: template.accounting.actualSpendTotal,
        etcTotal: template.accounting.etcTotal,
        materialCostTotal: template.accounting.materialCostTotal,
        currency: template.accounting.currency,
        taskAccounting: (template.accounting.taskAccounting ?? []).map((ta) => ({
          taskId: ta.taskId,
          taskName: ta.taskName,
          progress: ta.progress,
          baselineCost: ta.baselineCost,
          allocatedBudget: ta.allocatedBudget,
          materialCost: ta.materialCost,
          currentEstimate: ta.currentEstimate,
          actualSpend: ta.actualSpend,
          etc: ta.etc,
          costVariance: ta.currentEstimate - ta.baselineCost,
          baselineDuration: ta.baselineDuration,
          currentDuration: ta.currentDuration,
          actualDuration: ta.actualDuration,
          remainingDuration: ta.remainingDuration,
          durationVariance: ta.currentDuration - ta.baselineDuration,
          cpi: ta.actualSpend > 0 ? (ta.baselineCost * ta.progress / 100) / ta.actualSpend : 1,
          spi: ta.baselineDuration > 0 ? (ta.baselineDuration * ta.progress / 100) / ta.actualDuration : 1,
          responsibleResourceId: ta.responsibleResourceId ?? null,
          resourceCostRate: ta.resourceCostRate ?? 0,
          scheduleVarianceDays: ta.baselineDuration - ta.actualDuration,
        })),
        spendEntries: (template.accounting.spendEntries ?? []).map((se) => ({
          id: se.id,
          taskId: se.taskId,
          date: se.date,
          amount: se.amount,
          currency: se.currency,
          source: se.source,
          notes: se.notes,
        })),
        changeLog: (template.changeLog ?? []).map((cl) => ({
          id: cl.id,
          date: cl.date,
          taskId: cl.taskId ?? null,
          changeType: cl.changeType,
          description: cl.description,
          costImpact: cl.costImpact,
          scheduleImpactDays: cl.scheduleImpactDays,
          approvedBy: cl.approvedBy ?? null,
        })),
      }
    : undefined;

  // Convert material allocations
  const materialAllocations = (template.allocations ?? []).map((a) => ({
    id: a.id,
    materialId: a.materialId,
    taskId: a.taskId,
    allocatedQuantity: a.allocatedQuantity,
    consumedQuantity: a.consumedQuantity,
    allocationDate: a.allocationDate,
    expectedReturnDate: a.expectedReturnDate ?? null,
    actualCost: a.actualCost,
    notes: a.notes,
  }));

  // Convert material consumptions
  const materialConsumptions = (template.consumptions ?? []).map((c) => ({
    id: c.id,
    materialId: c.materialId,
    taskId: c.taskId,
    date: c.date,
    quantity: c.quantity,
    wastageQuantity: c.wastageQuantity,
    unitCostAtConsumption: c.unitCostAtConsumption,
    notes: c.notes,
  }));

  // Update material allocated/consumed quantities from allocations
  const materialQuantityMap = new Map<string, { allocated: number; consumed: number }>();
  for (const alloc of materialAllocations) {
    const existing = materialQuantityMap.get(alloc.materialId) ?? { allocated: 0, consumed: 0 };
    existing.allocated += alloc.allocatedQuantity;
    existing.consumed += alloc.consumedQuantity;
    materialQuantityMap.set(alloc.materialId, existing);
  }
  for (const mat of materials) {
    const quantities = materialQuantityMap.get(mat.id);
    if (quantities) {
      mat.allocatedQuantity = quantities.allocated;
      mat.consumedQuantity = quantities.consumed;
    }
  }

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
    materials: materials.length > 0 ? materials : undefined,
    accounting,
    materialAllocations: materialAllocations.length > 0 ? materialAllocations : undefined,
    materialConsumptions: materialConsumptions.length > 0 ? materialConsumptions : undefined,
    capitalizationConfig: template.capitalizationConfig ?? undefined,
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
    effort: json.effort ?? calculateWorkingDays(json.startDate, json.endDate) * 8,
    effortUnit: json.effortUnit ?? 'hours',
    cost: json.cost ?? 0,
    costCurrency: getEffectiveCurrency(),
    responsibleResourceId: json.resourceId ?? null,
    dependencies: json.dependencies?.map((depId) => ({ predecessorId: depId, type: 'FS' as const, lag: 0 })) ?? [],
    status: json.status,
    approvalGates: (json.approvalGates ?? []).map((ag) => ({
      taskId: json.id,
      gateType: ag.gateType,
      approved: ag.approved,
      approvedBy: ag.approvedBy,
      approvedDate: ag.approvedDate,
      notes: ag.notes,
    })),
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
    costCurrency: json.costCurrency ?? getEffectiveCurrency(),
    availability: json.availability ?? 100,
    color: json.color ?? '#3B82F6',
  };
}

/**
 * Convert JSON risk to Risk
 */
function jsonRiskToRisk(json: RiskJSON, projectId: string, defaultDate: string): Risk {
  const risk = createRisk({
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
  // Set additional fields
  risk.taskId = json.taskId ?? null;
  risk.contingencyPlan = json.contingencyPlan ?? '';
  risk.mitigationCost = json.mitigationCost ?? 0;
  risk.triggerCondition = json.triggerCondition ?? '';
  risk.residualProbability = json.residualProbability ?? json.probability;
  risk.residualImpact = json.residualImpact ?? json.impact;
  risk.residualRiskScore = (json.residualProbability ?? json.probability) * (json.residualImpact ?? json.impact);
  return risk;
}

/**
 * Convert JSON material to Material
 */
function jsonMaterialToMaterial(json: MaterialJSON): Material {
  const currency = json.currency ?? getEffectiveCurrency();
  return {
    id: json.id,
    name: json.name,
    description: '',
    classification: json.classification as Material['classification'],
    unit: json.unit ?? 'each',
    unitCost: json.unitCost ?? 0,
    quantity: json.quantity ?? 1,
    currency,
    vendor: json.vendor ?? null,
    depreciationMethod: (json.depreciationMethod ?? 'straight-line') as Material['depreciationMethod'],
    usefulLifeMonths: json.usefulLifeMonths ?? 36,
    salvageValue: json.salvageValue ?? 0,
    acquisitionDate: null,
    billingPeriod: (json.billingPeriod ?? 'daily') as Material['billingPeriod'],
    rentalRate: json.rentalRate ?? 0,
    leaseStartDate: json.leaseStartDate ?? null,
    leaseEndDate: json.leaseEndDate ?? null,
    wastageRate: json.wastageRate ?? 0,
    reorderPoint: json.reorderPoint ?? 0,
    carryingCostPerUnit: json.carryingCostPerUnit ?? 0,
    allocatedQuantity: 0,
    consumedQuantity: 0,
    status: (json.status ?? 'delivered') as Material['status'],
  };
}

/**
 * Load a template from a JSON string and convert to Project
 */
export function loadTemplateFromJSON(json: string): Project {
  const template = parseTemplate(json);
  return templateToProject(template);
}
