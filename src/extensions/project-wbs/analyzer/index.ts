// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project State Analyzer
 *
 * Exports for the project analyzer module.
 */

export { analyzeProject } from './projectAnalyzer';
export { ProjectAnalyzerPanel } from './ProjectAnalyzerPanel';
export type {
  ProjectAnalysis,
  ProjectHealth,
  CategorySummary,
  Finding,
  FindingSeverity,
  AnalysisCategory,
  ProjectStats,
  NextStep,
  AnalyzerOptions,
  AnalyzerThresholds,
  Grade,
} from './types';
