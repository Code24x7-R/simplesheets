// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Management Utilities
 *
 * Provides functions for:
 * - Risk scoring (probability × impact)
 * - Risk level classification
 * - Risk matrix generation
 - Risk CRUD operations (immutable)
 * - Risk queries and summaries
 */

import type { Risk, RiskLevel, RiskStatus, RiskCategory, RiskMatrix, RiskMatrixCell, RiskSummary, Project, WBSTask } from '../types';

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * Calculate risk score from probability and impact.
 * @param probability - 1-5 scale.
 * @param impact - 1-5 scale.
 * @returns Score (1-25).
 */
export function calculateRiskScore(probability: number, impact: number): number {
  return Math.max(1, Math.min(5, probability)) * Math.max(1, Math.min(5, impact));
}

/**
 * Get risk level from score.
 * @param score - Risk score (1-25).
 * @returns Risk level classification.
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

/**
 * Calculate residual risk score after mitigation.
 * @param risk - The risk to calculate residual for.
 * @returns Residual score.
 */
export function calculateResidualScore(risk: Risk): number {
  return calculateRiskScore(risk.residualProbability, risk.residualImpact);
}

/**
 * Create a new risk with computed scores.
 * @param params - Risk parameters (without computed scores).
 * @returns Complete Risk object.
 */
export function createRisk(params: {
  id: string;
  projectId: string;
  taskId?: string | null;
  title: string;
  description?: string;
  category: RiskCategory;
  probability: number;
  impact: number;
  status?: RiskStatus;
  mitigationPlan?: string;
  contingencyPlan?: string;
  mitigationCost?: number;
  ownerId?: string | null;
  identifiedDate: string;
  reviewDate: string;
  triggerCondition?: string;
  residualProbability?: number;
  residualImpact?: number;
}): Risk {
  const riskScore = calculateRiskScore(params.probability, params.impact);
  const residualProbability = params.residualProbability ?? params.probability;
  const residualImpact = params.residualImpact ?? params.impact;
  const residualRiskScore = calculateRiskScore(residualProbability, residualImpact);

  return {
    id: params.id,
    projectId: params.projectId,
    taskId: params.taskId ?? null,
    title: params.title,
    description: params.description ?? '',
    category: params.category,
    probability: Math.max(1, Math.min(5, params.probability)),
    impact: Math.max(1, Math.min(5, params.impact)),
    riskScore,
    status: params.status ?? 'identified',
    mitigationPlan: params.mitigationPlan ?? '',
    contingencyPlan: params.contingencyPlan ?? '',
    mitigationCost: params.mitigationCost ?? 0,
    ownerId: params.ownerId ?? null,
    identifiedDate: params.identifiedDate,
    reviewDate: params.reviewDate,
    triggerCondition: params.triggerCondition ?? '',
    residualProbability: Math.max(1, Math.min(5, residualProbability)),
    residualImpact: Math.max(1, Math.min(5, residualImpact)),
    residualRiskScore,
    customFields: {},
  };
}

// ─── Risk Matrix ────────────────────────────────────────────────────────────

/**
 * Generate a 5×5 risk matrix from an array of risks.
 * @param risks - Array of risks to plot.
 * @returns RiskMatrix with cells populated.
 */
export function getRiskMatrix(risks: Risk[]): RiskMatrix {
  // Initialize 5×5 grid (probability × impact)
  const cells: RiskMatrixCell[][] = [];
  let maxScore = 0;
  let minScore = 25;

  for (let p = 1; p <= 5; p++) {
    cells[p - 1] = [];
    for (let i = 1; i <= 5; i++) {
      const score = p * i;
      cells[p - 1][i - 1] = {
        probability: p,
        impact: i,
        riskIds: [],
        count: 0,
        level: getRiskLevel(score),
      };
      if (score > maxScore) maxScore = score;
      if (score < minScore) minScore = score;
    }
  }

  // Populate with risks
  for (const risk of risks) {
    if (risk.status === 'closed') continue; // Don't plot closed risks
    const p = Math.max(1, Math.min(5, risk.probability));
    const i = Math.max(1, Math.min(5, risk.impact));
    const cell = cells[p - 1][i - 1];
    cell.riskIds.push(risk.id);
    cell.count++;
  }

  return { cells, maxScore, minScore };
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Add a risk to a project (immutable).
 * @param project - The project to add to.
 * @param risk - The risk to add.
 * @returns New project with the risk added.
 */
export function addRisk(project: Project, risk: Risk): Project {
  return {
    ...project,
    risks: [...project.risks, risk],
  };
}

/**
 * Update a risk in a project (immutable).
 * @param project - The project containing the risk.
 * @param riskId - ID of the risk to update.
 * @param changes - Partial risk changes to apply.
 * @returns New project with the risk updated.
 */
export function updateRisk(project: Project, riskId: string, changes: Partial<Risk>): Project {
  return {
    ...project,
    risks: project.risks.map((r) => {
      if (r.id !== riskId) return r;
      const updated = { ...r, ...changes };
      // Recalculate scores if probability or impact changed
      if (changes.probability !== undefined || changes.impact !== undefined) {
        updated.riskScore = calculateRiskScore(
          changes.probability ?? r.probability,
          changes.impact ?? r.impact,
        );
      }
      if (changes.residualProbability !== undefined || changes.residualImpact !== undefined) {
        updated.residualRiskScore = calculateRiskScore(
          changes.residualProbability ?? r.residualProbability,
          changes.residualImpact ?? r.residualImpact,
        );
      }
      return updated;
    }),
  };
}

/**
 * Close a risk (immutable).
 * @param project - The project containing the risk.
 * @param riskId - ID of the risk to close.
 * @returns New project with the risk closed.
 */
export function closeRisk(project: Project, riskId: string): Project {
  return updateRisk(project, riskId, { status: 'closed' });
}

/**
 * Remove a risk from a project (immutable).
 * @param project - The project containing the risk.
 * @param riskId - ID of the risk to remove.
 * @returns New project with the risk removed.
 */
export function removeRisk(project: Project, riskId: string): Project {
  return {
    ...project,
    risks: project.risks.filter((r) => r.id !== riskId),
  };
}

/**
 * Link a risk to a task (immutable).
 * @param project - The project.
 * @param riskId - Risk ID to link.
 * @param taskId - Task ID to link to.
 * @returns New project with the link created.
 */
export function linkRiskToTask(project: Project, riskId: string, taskId: string): Project {
  return {
    ...project,
    risks: project.risks.map((r) => {
      if (r.id !== riskId) return r;
      return { ...r, taskId };
    }),
    wbs: project.wbs.map((t) => addRiskIdToTask(t, taskId, riskId)),
  };
}

/**
 * Unlink a risk from its task (immutable).
 * @param project - The project.
 * @param riskId - Risk ID to unlink.
 * @returns New project with the link removed.
 */
export function unlinkRiskFromTask(project: Project, riskId: string): Project {
  const risk = project.risks.find((r) => r.id === riskId);
  if (!risk || !risk.taskId) return project;

  return {
    ...project,
    risks: project.risks.map((r) => {
      if (r.id !== riskId) return r;
      return { ...r, taskId: null };
    }),
    wbs: project.wbs.map((t) => removeRiskIdFromTask(t, risk.taskId!, riskId)),
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get all risks linked to a specific task.
 * @param project - The project.
 * @param taskId - Task ID to filter by.
 * @returns Array of risks linked to the task.
 */
export function getRisksForTask(project: Project, taskId: string): Risk[] {
  return project.risks.filter((r) => r.taskId === taskId);
}

/**
 * Get top N risks by score (highest first).
 * @param project - The project.
 * @param n - Number of risks to return.
 * @returns Array of top risks.
 */
export function getTopRisks(project: Project, n: number): Risk[] {
  return [...project.risks]
    .filter((r) => r.status !== 'closed')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, n);
}

/**
 * Get risks by status.
 * @param project - The project.
 * @param status - Status to filter by.
 * @returns Array of risks with the given status.
 */
export function getRisksByStatus(project: Project, status: RiskStatus): Risk[] {
  return project.risks.filter((r) => r.status === status);
}

/**
 * Get risks by category.
 * @param project - The project.
 * @param category - Category to filter by.
 * @returns Array of risks in the category.
 */
export function getRisksByCategory(project: Project, category: RiskCategory): Risk[] {
  return project.risks.filter((r) => r.category === category);
}

/**
 * Get risk summary statistics.
 * @param project - The project.
 * @returns Summary of risks by status, category, and level.
 */
export function getRiskSummary(project: Project): RiskSummary {
  const byStatus: Record<RiskStatus, number> = {
    identified: 0,
    assessing: 0,
    mitigating: 0,
    monitoring: 0,
    occurred: 0,
    closed: 0,
  };
  const byCategory: Record<RiskCategory, number> = {
    technical: 0,
    schedule: 0,
    cost: 0,
    resource: 0,
    external: 0,
    quality: 0,
    scope: 0,
    other: 0,
  };
  const byLevel: Record<RiskLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  let totalMitigationCost = 0;
  let openCount = 0;

  for (const risk of project.risks) {
    byStatus[risk.status]++;
    byCategory[risk.category]++;
    byLevel[getRiskLevel(risk.riskScore)]++;
    totalMitigationCost += risk.mitigationCost;
    if (risk.status !== 'closed' && risk.status !== 'occurred') {
      openCount++;
    }
  }

  return {
    total: project.risks.length,
    byStatus,
    byCategory,
    byLevel,
    totalMitigationCost,
    openCount,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function addRiskIdToTask(task: WBSTask, taskId: string, riskId: string): WBSTask {
  if (task.id === taskId) {
    return {
      ...task,
      riskIds: task.riskIds.includes(riskId) ? task.riskIds : [...task.riskIds, riskId],
    };
  }
  return {
    ...task,
    children: task.children.map((c) => addRiskIdToTask(c, taskId, riskId)),
  };
}

function removeRiskIdFromTask(task: WBSTask, taskId: string, riskId: string): WBSTask {
  if (task.id === taskId) {
    return {
      ...task,
      riskIds: task.riskIds.filter((id) => id !== riskId),
    };
  }
  return {
    ...task,
    children: task.children.map((c) => removeRiskIdFromTask(c, taskId, riskId)),
  };
}
