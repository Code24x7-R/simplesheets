// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Website Project Template
 *
 * Standard website development project with design, development, testing, launch phases.
 */

import type { Project, Resource } from '../../types';
import { createDefaultCalendar } from '../calendar';
import { createRisk } from '../risks';

function makeTask(id: string, name: string, start: string, duration: number, progress = 0, parentId: string | null = null, level = 0, children: import('../../types').WBSTask[] = []): import('../../types').WBSTask {
  return {
    id, name, description: '', level, parentId, children,
    startDate: start,
    endDate: new Date(new Date(start + 'T00:00:00').getTime() + duration * 86400000 - 86400000).toISOString().slice(0, 10),
    duration, progress, effort: duration * 8, effortUnit: 'hours',
    cost: duration * 600, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createWebsiteProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Project Manager', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'designer', name: 'UI Designer', role: 'Design', costRate: 130, costCurrency: 'USD', availability: 100, color: '#8B5CF6' },
    { id: 'dev', name: 'Web Developer', role: 'Dev', costRate: 140, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'qa', name: 'QA Engineer', role: 'QA', costRate: 110, costCurrency: 'USD', availability: 100, color: '#F59E0B' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'website', title: 'Design approval delays', category: 'schedule', probability: 4, impact: 3, identifiedDate: '2026-02-01', reviewDate: '2026-03-01' }),
    createRisk({ id: 'r2', projectId: 'website', title: 'Scope creep (feature requests)', category: 'scope', probability: 3, impact: 4, identifiedDate: '2026-02-01', reviewDate: '2026-03-01' }),
    createRisk({ id: 'r3', projectId: 'website', title: 'Browser compatibility issues', category: 'technical', probability: 2, impact: 3, identifiedDate: '2026-02-01', reviewDate: '2026-03-01' }),
  ];

  const wbs = [
    makeTask('discovery', 'Discovery', '2026-02-01', 5, 0, null, 0, [
      makeTask('disc-1', 'Stakeholder interviews', '2026-02-01', 2, 0, 'discovery', 1),
      makeTask('disc-2', 'Content audit', '2026-02-03', 2, 0, 'discovery', 1),
      makeTask('disc-3', 'Sitemap & wireframes', '2026-02-05', 1, 0, 'discovery', 1),
    ]),
    makeTask('design', 'Design', '2026-02-06', 8, 0, null, 0, [
      makeTask('des-1', 'Visual design', '2026-02-06', 4, 0, 'design', 1),
      makeTask('des-2', 'Responsive mockups', '2026-02-10', 3, 0, 'design', 1),
      makeTask('des-3', 'Design review', '2026-02-13', 1, 0, 'design', 1),
    ]),
    makeTask('dev', 'Development', '2026-02-14', 12, 0, null, 0, [
      makeTask('dev-1', 'Frontend development', '2026-02-14', 6, 0, 'dev', 1),
      makeTask('dev-2', 'Backend integration', '2026-02-20', 5, 0, 'dev', 1),
      makeTask('dev-3', 'CMS setup', '2026-02-25', 2, 0, 'dev', 1),
    ]),
    makeTask('qa', 'Testing', '2026-02-27', 5, 0, null, 0, [
      makeTask('qa-1', 'Functional testing', '2026-02-27', 3, 0, 'qa', 1),
      makeTask('qa-2', 'Cross-browser testing', '2026-03-02', 2, 0, 'qa', 1),
      makeTask('qa-3', 'Performance testing', '2026-03-04', 1, 0, 'qa', 1),
    ]),
    makeTask('launch', 'Launch', '2026-03-05', 2, 0, null, 0, [
      makeTask('launch-1', 'Deployment', '2026-03-05', 1, 0, 'launch', 1),
      makeTask('launch-2', 'Go-live', '2026-03-06', 0, 0, 'launch', 1),
    ]),
    makeTask('milestone-launch', 'Website Live', '2026-03-06', 0, 0, null, 0),
  ];

  return {
    id: 'website',
    name: 'Website Project',
    description: 'Complete website design and development project.',
    startDate: '2026-02-01',
    endDate: '2026-03-06',
    calendar,
    resources,
    risks,
    wbs,
  };
}
