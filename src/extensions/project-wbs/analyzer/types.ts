// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project State Analyzer Types
 *
 * Defines types for analyzing project health, identifying gaps,
 * and providing actionable recommendations to the PM.
 */

/** Severity levels for analysis findings */
export type FindingSeverity = 'critical' | 'warning' | 'info' | 'success';

/** Categories of analysis */
export type AnalysisCategory =
  | 'completeness'
  | 'dependencies'
  | 'resources'
  | 'status'
  | 'financials'
  | 'timeline'
  | 'risks';

/** Individual finding from analysis */
export interface Finding {
  /** Category this finding belongs to */
  category: AnalysisCategory;
  /** Severity level */
  severity: FindingSeverity;
  /** Short title of the finding */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected task/resource IDs */
  affectedIds?: string[];
  /** Actionable recommendation */
  recommendation: string;
}

/** Category summary */
export interface CategorySummary {
  category: AnalysisCategory;
  /** Number of findings by severity */
  critical: number;
  warning: number;
  info: number;
  success: number;
  /** Findings in this category */
  findings: Finding[];
}

/** Overall project health score (0-100) */
export interface ProjectHealth {
  /** Overall score (0-100) */
  score: number;
  /** Grade (A-F) */
  grade: Grade;
  /** Human-readable assessment */
  assessment: string;
  /** Top priorities to address */
  topPriorities: string[];
}

/** Letter grade */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Complete project analysis result */
export interface ProjectAnalysis {
  /** Project name analyzed */
  projectName: string;
  /** When analysis was performed */
  analysisDate: string;
  /** Overall health */
  health: ProjectHealth;
  /** Summaries by category */
  categories: CategorySummary[];
  /** All findings (flattened) */
  allFindings: Finding[];
  /** Quick stats */
  stats: ProjectStats;
  /** Next steps for the PM */
  nextSteps: NextStep[];
}

/** Quick project statistics */
export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  totalRisks: number;
  openRisks: number;
  mitigatedRisks: number;
  totalResources: number;
  allocatedResources: number;
  totalBudget: number;
  actualSpend: number;
  projectedCost: number;
  daysElapsed: number;
  daysRemaining: number;
  percentTimeElapsed: number;
  percentWorkComplete: number;
  percentBudgetSpent: number;
}

/** Recommended next step */
export interface NextStep {
  /** Priority order (1 = highest) */
  priority: number;
  /** Category */
  category: AnalysisCategory;
  /** Action title */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected impact */
  impact: string;
  /** Estimated effort to address */
  effort: 'low' | 'medium' | 'high';
}

/** Analyzer configuration options */
export interface AnalyzerOptions {
  /** Enable/disable specific categories */
  enabledCategories?: AnalysisCategory[];
  /** Custom thresholds */
  thresholds?: AnalyzerThresholds;
  /** Reference date for timeline analysis (defaults to today) */
  referenceDate?: string;
}

/** Configurable thresholds for analysis */
export interface AnalyzerThresholds {
  /** Budget variance threshold (0.1 = 10% over budget triggers warning) */
  budgetVarianceWarning: number;
  /** Budget variance threshold for critical alert */
  budgetVarianceCritical: number;
  /** Schedule variance threshold (0.1 = 10% behind schedule) */
  scheduleVarianceWarning: number;
  /** Schedule variance threshold for critical alert */
  scheduleVarianceCritical: number;
  /** Resource utilization threshold (0.8 = 80% allocated triggers warning) */
  resourceUtilizationWarning: number;
  /** Resource utilization threshold for critical alert */
  resourceUtilizationCritical: number;
  /** Task completion threshold (0.2 = less than 20% complete with 50% time elapsed) */
  progressLaggingThreshold: number;
  /** Days before deadline to flag as approaching */
  deadlineWarningDays: number;
  /** Days past due to flag as overdue */
  overdueThresholdDays: number;
}

/** Default thresholds */
export const DEFAULT_THRESHOLDS: AnalyzerThresholds = {
  budgetVarianceWarning: 0.1,
  budgetVarianceCritical: 0.2,
  scheduleVarianceWarning: 0.1,
  scheduleVarianceCritical: 0.2,
  resourceUtilizationWarning: 0.8,
  resourceUtilizationCritical: 0.95,
  progressLaggingThreshold: 0.2,
  deadlineWarningDays: 14,
  overdueThresholdDays: 1,
};
