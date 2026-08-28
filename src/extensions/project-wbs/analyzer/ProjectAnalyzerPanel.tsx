// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project Analyzer Panel
 *
 * UI component that displays project health analysis with findings,
 * recommendations, and next steps for the PM.
 */

import React, { useMemo } from 'react';
import type { Project } from '../../types';
import { analyzeProject } from './projectAnalyzer';
import type { ProjectAnalysis, FindingSeverity, AnalysisCategory } from './types';

interface ProjectAnalyzerPanelProps {
  project: Project;
  onClose?: () => void;
}

/** Severity color mapping */
const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 border-red-400 text-red-800',
  warning: 'bg-amber-100 border-amber-400 text-amber-800',
  info: 'bg-blue-100 border-blue-400 text-blue-800',
  success: 'bg-green-100 border-green-400 text-green-800',
};

const SEVERITY_ICONS: Record<FindingSeverity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
  success: '🟢',
};

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
  success: 'Good',
};

/** Category display names */
const CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  completeness: 'Data Completeness',
  dependencies: 'Dependencies',
  resources: 'Resources',
  status: 'Task Status',
  financials: 'Financials',
  timeline: 'Timeline',
  risks: 'Risks',
};

const CATEGORY_ICONS: Record<AnalysisCategory, string> = {
  completeness: '📋',
  dependencies: '🔗',
  resources: '👥',
  status: '📊',
  financials: '💰',
  timeline: '📅',
  risks: '⚠️',
};

/** Grade colors */
const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-green-400',
  C: 'bg-yellow-400',
  D: 'bg-orange-400',
  F: 'bg-red-500',
};

export const ProjectAnalyzerPanel: React.FC<ProjectAnalyzerPanelProps> = ({
  project,
  onClose,
}) => {
  const analysis = useMemo(() => analyzeProject(project), [project]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔍</span>
          <h2 className="text-lg font-semibold text-gray-800">
            Project State Analyzer
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
            aria-label="Close analyzer"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Health Score */}
        <HealthScoreCard health={analysis.health} />

        {/* Quick Stats */}
        <StatsGrid stats={analysis.stats} />

        {/* Next Steps */}
        <NextStepsCard steps={analysis.nextSteps} />

        {/* Category Findings */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Detailed Analysis
          </h3>
          {analysis.categories.map((category) => (
            <CategoryCard key={category.category} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────

const HealthScoreCard: React.FC<{ health: ProjectAnalysis['health'] }> = ({
  health,
}) => (
  <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg border p-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-600">Project Health</h3>
        <p className="text-sm text-gray-500 mt-1">{health.assessment}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-800">{health.score}</div>
          <div className="text-xs text-gray-500">out of 100</div>
        </div>
        <div
          className={`w-14 h-14 rounded-full ${GRADE_COLORS[health.grade]} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}
        >
          {health.grade}
        </div>
      </div>
    </div>
    {health.topPriorities.length > 0 && (
      <div className="mt-3 pt-3 border-t">
        <div className="text-xs font-medium text-gray-600 mb-2">
          Top Priorities:
        </div>
        <ul className="space-y-1">
          {health.topPriorities.slice(0, 3).map((priority, i) => (
            <li key={i} className="text-sm text-red-700 flex items-start gap-1">
              <span className="text-red-500">•</span>
              {priority}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const StatsGrid: React.FC<{ stats: ProjectAnalysis['stats'] }> = ({ stats }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <StatItem
      label="Tasks"
      value={`${stats.completedTasks}/${stats.totalTasks}`}
      sub="completed"
      color="green"
    />
    <StatItem
      label="Progress"
      value={`${Math.round(stats.percentWorkComplete)}%`}
      sub={`${Math.round(stats.percentTimeElapsed)}% time elapsed`}
      color="blue"
    />
    <StatItem
      label="Budget"
      value={`${Math.round(stats.percentBudgetSpent)}%`}
      sub={`$${Math.round(stats.actualSpend).toLocaleString()} spent`}
      color="amber"
    />
    <StatItem
      label="Timeline"
      value={`${stats.daysRemaining}d`}
      sub="remaining"
      color={stats.daysRemaining > 14 ? 'green' : 'red'}
    />
  </div>
);

const StatItem: React.FC<{
  label: string;
  value: string;
  sub: string;
  color: string;
}> = ({ label, value, sub, color }) => {
  const colorClasses: Record<string, string> = {
    green: 'text-green-700 bg-green-50',
    blue: 'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    red: 'text-red-700 bg-red-50',
  };

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs opacity-75">{sub}</div>
    </div>
  );
};

const NextStepsCard: React.FC<{ steps: ProjectAnalysis['nextSteps'] }> = ({
  steps,
}) => {
  if (steps.length === 0) return null;

  return (
    <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
      <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
        <span>📋</span> Recommended Next Steps
      </h3>
      <ol className="space-y-2">
        {steps.slice(0, 5).map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold">
              {step.priority}
            </span>
            <div>
              <div className="font-medium text-blue-900">{step.title}</div>
              <div className="text-blue-700 text-xs mt-0.5">
                {step.description}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

const CategoryCard: React.FC<{
  category: ProjectAnalysis['categories'][0];
}> = ({ category }) => {
  const [expanded, setExpanded] = React.useState(
    category.critical > 0 || category.warning > 0,
  );

  const hasFindings = category.findings.length > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{CATEGORY_ICONS[category.category]}</span>
          <span className="font-medium text-gray-800">
            {CATEGORY_LABELS[category.category]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {category.critical > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {category.critical} critical
            </span>
          )}
          {category.warning > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {category.warning} warning
            </span>
          )}
          {category.success > 0 && category.critical === 0 && category.warning === 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              ✓ OK
            </span>
          )}
          <span className="text-gray-400 text-sm">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>
      {expanded && hasFindings && (
        <div className="divide-y">
          {category.findings.map((finding, i) => (
            <FindingItem key={i} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
};

const FindingItem: React.FC<{
  finding: ProjectAnalysis['allFindings'][0];
}> = ({ finding }) => (
  <div className={`px-4 py-3 border-l-4 ${SEVERITY_COLORS[finding.severity]}`}>
    <div className="flex items-start gap-2">
      <span className="text-sm">{SEVERITY_ICONS[finding.severity]}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{finding.title}</span>
          <span className="text-xs opacity-75">
            {SEVERITY_LABELS[finding.severity]}
          </span>
        </div>
        <p className="text-xs mt-1 opacity-90">{finding.description}</p>
        <p className="text-xs mt-1 font-medium">
          💡 {finding.recommendation}
        </p>
      </div>
    </div>
  </div>
);

export default ProjectAnalyzerPanel;
