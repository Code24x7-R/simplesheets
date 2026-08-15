// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Agile/Sprint Planning Template
 *
 * Agile project with backlog, sprint planning, sprints, review, and retro.
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
    cost: duration * 450, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createAgileProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'po', name: 'Product Owner', role: 'PO', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'sm', name: 'Scrum Master', role: 'SM', costRate: 130, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'dev1', name: 'Senior Developer', role: 'Dev', costRate: 150, costCurrency: 'USD', availability: 100, color: '#8B5CF6' },
    { id: 'dev2', name: 'Developer', role: 'Dev', costRate: 120, costCurrency: 'USD', availability: 100, color: '#06B6D4' },
    { id: 'qa', name: 'QA Engineer', role: 'QA', costRate: 110, costCurrency: 'USD', availability: 75, color: '#F59E0B' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'agile', title: 'Scope creep within sprints', category: 'scope', probability: 4, impact: 3, identifiedDate: '2026-11-01', reviewDate: '2026-12-01' }),
    createRisk({ id: 'r2', projectId: 'agile', title: 'Team member unavailability', category: 'resource', probability: 3, impact: 3, identifiedDate: '2026-11-01', reviewDate: '2026-12-01' }),
    createRisk({ id: 'r3', projectId: 'agile', title: 'Technical debt accumulation', category: 'technical', probability: 4, impact: 3, identifiedDate: '2026-11-01', reviewDate: '2026-12-01' }),
    createRisk({ id: 'r4', projectId: 'agile', title: 'Stakeholder availability for reviews', category: 'resource', probability: 3, impact: 2, identifiedDate: '2026-11-01', reviewDate: '2026-12-01' }),
  ];

  const wbs = [
    task('backlog', 'Backlog Refinement', '2026-11-01', 5, null, 0, [
      task('back-1', 'User story creation', '2026-11-01', 2, 'backlog', 1),
      task('back-2', 'Story point estimation', '2026-11-03', 2, 'backlog', 1),
      task('back-3', 'Priority ranking', '2026-11-05', 1, 'backlog', 1),
      task('back-4', 'Backlog ready', '2026-11-06', 0, 'backlog', 1),
    ]),
    task('sprint1', 'Sprint 1', '2026-11-07', 10, null, 0, [
      task('s1-1', 'Sprint planning', '2026-11-07', 1, 'sprint1', 1),
      task('s1-2', 'Development', '2026-11-08', 5, 'sprint1', 1),
      task('s1-3', 'Testing & review', '2026-11-13', 3, 'sprint1', 1),
      task('s1-4', 'Sprint review & retro', '2026-11-16', 1, 'sprint1', 1),
    ]),
    task('sprint2', 'Sprint 2', '2026-11-17', 10, null, 0, [
      task('s2-1', 'Sprint planning', '2026-11-17', 1, 'sprint2', 1),
      task('s2-2', 'Development', '2026-11-18', 5, 'sprint2', 1),
      task('s2-3', 'Testing & review', '2026-11-23', 3, 'sprint2', 1),
      task('s2-4', 'Sprint review & retro', '2026-11-24', 1, 'sprint2', 1),
    ]),
    task('sprint3', 'Sprint 3', '2026-11-25', 10, null, 0, [
      task('s3-1', 'Sprint planning', '2026-11-25', 1, 'sprint3', 1),
      task('s3-2', 'Development', '2026-11-26', 5, 'sprint3', 1),
      task('s3-3', 'Testing & review', '2026-12-01', 3, 'sprint3', 1),
      task('s3-4', 'Sprint review & retro', '2026-12-02', 1, 'sprint3', 1),
    ]),
    task('release', 'Release', '2026-12-03', 3, null, 0, [
      task('rel-1', 'Final integration testing', '2026-12-03', 1, 'release', 1),
      task('rel-2', 'Deployment', '2026-12-04', 1, 'release', 1),
      task('rel-3', 'Project retrospective', '2026-12-05', 1, 'release', 1),
    ]),
    {
      ...task('milestone-agile', 'Project Complete', '2026-12-05', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'agile',
    name: 'Agile/Sprint Planning',
    description: 'Agile project with backlog refinement, three sprints, and release.',
    startDate: '2026-11-01',
    endDate: '2026-12-05',
    calendar,
    resources,
    risks,
    wbs,
  };
}
