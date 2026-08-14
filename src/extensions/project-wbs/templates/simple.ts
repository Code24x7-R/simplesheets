// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Simple WBS Template
 *
 * A minimal customizable WBS with a few example tasks.
 */

import type { Project, WBSTask, Resource } from '../../types';
import { createDefaultCalendar } from '../calendar';
import { createRisk } from '../risks';

function makeTask(id: string, name: string, start: string, duration: number, progress = 0, parentId: string | null = null, level = 0): WBSTask {
  return {
    id, name, description: '', level, parentId, children: [],
    startDate: start,
    endDate: new Date(new Date(start + 'T00:00:00').getTime() + duration * 86400000 - 86400000).toISOString().slice(0, 10),
    duration, progress, effort: duration * 8, effortUnit: 'hours',
    cost: duration * 500, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: false, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createSimpleWBS(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'res-1', name: 'Project Manager', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'res-2', name: 'Developer', role: 'Dev', costRate: 120, costCurrency: 'USD', availability: 100, color: '#10B981' },
  ];

  const risks = [
    createRisk({
      id: 'risk-1', projectId: 'simple-wbs', title: 'Scope creep', category: 'scope',
      probability: 3, impact: 4, identifiedDate: '2026-01-05', reviewDate: '2026-02-01',
    }),
    createRisk({
      id: 'risk-2', projectId: 'simple-wbs', title: 'Resource unavailability', category: 'resource',
      probability: 2, impact: 3, identifiedDate: '2026-01-05', reviewDate: '2026-02-01',
    }),
  ];

  const wbs: WBSTask[] = [
    {
      ...makeTask('t1', 'Planning', '2026-01-05', 5, 100, null, 0),
      isSummary: true,
      children: [
        makeTask('t1-1', 'Requirements gathering', '2026-01-05', 3, 100, 't1', 1),
        makeTask('t1-2', 'Project plan', '2026-01-08', 2, 100, 't1', 1),
      ],
    },
    {
      ...makeTask('t2', 'Execution', '2026-01-12', 10, 50, null, 0),
      isSummary: true,
      children: [
        makeTask('t2-1', 'Design', '2026-01-12', 4, 75, 't2', 1),
        makeTask('t2-2', 'Implementation', '2026-01-17', 6, 25, 't2', 1),
      ],
    },
    {
      ...makeTask('t3', 'Closure', '2026-01-23', 3, 0, null, 0),
      isSummary: true,
      children: [
        makeTask('t3-1', 'Testing', '2026-01-23', 2, 0, 't3', 1),
        makeTask('t3-2', 'Deployment', '2026-01-27', 1, 0, 't3', 1),
      ],
    },
    {
      ...makeTask('t4', 'Project Complete', '2026-01-28', 0, 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'simple-wbs',
    name: 'Simple WBS',
    description: 'A simple customizable WBS template with planning, execution, and closure phases.',
    startDate: '2026-01-05',
    endDate: '2026-01-28',
    calendar,
    resources,
    risks,
    wbs,
  };
}
