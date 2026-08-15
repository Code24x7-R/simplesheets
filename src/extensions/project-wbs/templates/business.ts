// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Business Project Template
 *
 * Generic business project from feasibility to review.
 */

import type { Project, Resource, WBSTask } from '../../types';
import { createDefaultCalendar } from '../calendar';
import { createRisk } from '../risks';

function task(id: string, name: string, start: string, duration: number, parentId: string | null = null, level = 0, children: WBSTask[] = []): WBSTask {
  return {
    id, name, description: '', level, parentId, children,
    startDate: start,
    endDate: new Date(new Date(start + 'T00:00:00').getTime() + duration * 86400000 - 86400000).toISOString().slice(0, 10),
    duration, progress: 0, effort: duration * 8, effortUnit: 'hours',
    cost: duration * 500, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createBusinessProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Project Manager', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'analyst', name: 'Business Analyst', role: 'Analysis', costRate: 120, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'lead', name: 'Team Lead', role: 'Leadership', costRate: 160, costCurrency: 'USD', availability: 75, color: '#8B5CF6' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'business', title: 'Scope creep', category: 'scope', probability: 4, impact: 3, identifiedDate: '2026-08-01', reviewDate: '2026-09-01' }),
    createRisk({ id: 'r2', projectId: 'business', title: 'Stakeholder misalignment', category: 'resource', probability: 3, impact: 4, identifiedDate: '2026-08-01', reviewDate: '2026-09-01' }),
    createRisk({ id: 'r3', projectId: 'business', title: 'Budget constraints', category: 'cost', probability: 3, impact: 3, identifiedDate: '2026-08-01', reviewDate: '2026-09-01' }),
  ];

  const wbs = [
    task('feasibility', 'Feasibility Study', '2026-08-01', 7, null, 0, [
      task('feas-1', 'Problem definition', '2026-08-01', 2, 'feasibility', 1),
      task('feas-2', 'Market analysis', '2026-08-03', 3, 'feasibility', 1),
      task('feas-3', 'Feasibility report', '2026-08-06', 2, 'feasibility', 1),
      task('feas-4', 'Go/no-go decision', '2026-08-08', 0, 'feasibility', 1),
    ]),
    task('planning', 'Project Planning', '2026-08-09', 8, null, 0, [
      task('plan-1', 'Project charter', '2026-08-09', 2, 'planning', 1),
      task('plan-2', 'Resource planning', '2026-08-11', 3, 'planning', 1),
      task('plan-3', 'Risk management plan', '2026-08-14', 2, 'planning', 1),
      task('plan-4', 'Project plan approved', '2026-08-16', 0, 'planning', 1),
    ]),
    task('execution', 'Execution', '2026-08-17', 15, null, 0, [
      task('exec-1', 'Phase 1 delivery', '2026-08-17', 5, 'execution', 1),
      task('exec-2', 'Phase 2 delivery', '2026-08-22', 5, 'execution', 1),
      task('exec-3', 'Phase 3 delivery', '2026-08-27', 5, 'execution', 1),
    ]),
    task('review', 'Review & Handover', '2026-09-01', 5, null, 0, [
      task('rev-1', 'Quality review', '2026-09-01', 2, 'review', 1),
      task('rev-2', 'Documentation', '2026-09-03', 2, 'review', 1),
      task('rev-3', 'Final presentation', '2026-09-05', 1, 'review', 1),
    ]),
    {
      ...task('milestone-business', 'Project Complete', '2026-09-05', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'business',
    name: 'Business Project',
    description: 'Generic business project from feasibility study through planning, execution, and review.',
    startDate: '2026-08-01',
    endDate: '2026-09-05',
    calendar,
    resources,
    risks,
    wbs,
  };
}
