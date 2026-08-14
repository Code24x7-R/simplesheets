// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Software Development Template
 *
 * Full SDLC: requirements, design, coding, QA, deploy.
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
    cost: duration * 700, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createSoftwareProject(): Project {
  const calendar = createDefaultCalendar();
  const resources: Resource[] = [
    { id: 'pm', name: 'Project Manager', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'arch', name: 'Tech Lead', role: 'Architecture', costRate: 170, costCurrency: 'USD', availability: 100, color: '#8B5CF6' },
    { id: 'dev1', name: 'Senior Dev', role: 'Dev', costRate: 150, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'dev2', name: 'Junior Dev', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#06B6D4' },
    { id: 'qa', name: 'QA Engineer', role: 'QA', costRate: 110, costCurrency: 'USD', availability: 100, color: '#F59E0B' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'software', title: 'Technical debt accumulation', category: 'technical', probability: 4, impact: 3, identifiedDate: '2026-03-01', reviewDate: '2026-04-01' }),
    createRisk({ id: 'r2', projectId: 'software', title: 'Key developer leaves', category: 'resource', probability: 2, impact: 5, identifiedDate: '2026-03-01', reviewDate: '2026-04-01' }),
    createRisk({ id: 'r3', projectId: 'software', title: 'Integration failures', category: 'technical', probability: 3, impact: 4, identifiedDate: '2026-03-01', reviewDate: '2026-04-01' }),
  ];

  const wbs = [
    task('req', 'Requirements', '2026-03-01', 5, null, 0, [
      task('req-1', 'Stakeholder analysis', '2026-03-01', 2, 'req', 1),
      task('req-2', 'User stories', '2026-03-03', 3, 'req', 1),
      task('req-3', 'Requirements sign-off', '2026-03-06', 0, 'req', 1),
    ]),
    task('design-sdlc', 'Design', '2026-03-07', 6, null, 0, [
      task('des-1', 'System architecture', '2026-03-07', 3, 'design-sdlc', 1),
      task('des-2', 'UI/UX design', '2026-03-07', 4, 'design-sdlc', 1),
      task('des-3', 'Database design', '2026-03-10', 2, 'design-sdlc', 1),
      task('des-4', 'Design review', '2026-03-12', 1, 'design-sdlc', 1),
    ]),
    task('coding', 'Development', '2026-03-13', 15, null, 0, [
      task('code-1', 'Sprint 1: Core features', '2026-03-13', 5, 'coding', 1),
      task('code-2', 'Sprint 2: API layer', '2026-03-20', 5, 'coding', 1),
      task('code-3', 'Sprint 3: UI polish', '2026-03-27', 5, 'coding', 1),
    ]),
    task('qa-sdlc', 'QA & Testing', '2026-04-03', 7, null, 0, [
      task('qa-1', 'Unit testing', '2026-04-03', 3, 'qa-sdlc', 1),
      task('qa-2', 'Integration testing', '2026-04-07', 2, 'qa-sdlc', 1),
      task('qa-3', 'UAT', '2026-04-09', 2, 'qa-sdlc', 1),
    ]),
    task('deploy', 'Deployment', '2026-04-11', 3, null, 0, [
      task('dep-1', 'Staging deployment', '2026-04-11', 1, 'deploy', 1),
      task('dep-2', 'Production cutover', '2026-04-12', 1, 'deploy', 1),
      task('dep-3', 'Post-launch monitoring', '2026-04-13', 1, 'deploy', 1),
    ]),
    task('milestone-release', 'v1.0 Release', '2026-04-13', 0, null, 0),
  ];

  return {
    id: 'software',
    name: 'Software Development',
    description: 'Full software development lifecycle from requirements to deployment.',
    startDate: '2026-03-01',
    endDate: '2026-04-13',
    calendar,
    resources,
    risks,
    wbs,
  };
}
