// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Product Launch Template
 *
 * Full product launch from development through post-launch analysis.
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
    cost: duration * 600, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createProductLaunchProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Product Manager', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'dev', name: 'Lead Developer', role: 'Development', costRate: 160, costCurrency: 'USD', availability: 75, color: '#10B981' },
    { id: 'marketing', name: 'Marketing Lead', role: 'Marketing', costRate: 140, costCurrency: 'USD', availability: 100, color: '#F59E0B' },
    { id: 'support', name: 'Support Lead', role: 'Support', costRate: 100, costCurrency: 'USD', availability: 100, color: '#8B5CF6' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'product', title: 'Launch date slip', category: 'schedule', probability: 4, impact: 4, identifiedDate: '2026-09-01', reviewDate: '2026-10-01' }),
    createRisk({ id: 'r2', projectId: 'product', title: 'Critical bugs at launch', category: 'quality', probability: 3, impact: 5, identifiedDate: '2026-09-01', reviewDate: '2026-10-01' }),
    createRisk({ id: 'r3', projectId: 'product', title: 'Competitor pre-launch', category: 'external', probability: 2, impact: 4, identifiedDate: '2026-09-01', reviewDate: '2026-10-01' }),
    createRisk({ id: 'r4', projectId: 'product', title: 'Low market adoption', category: 'other', probability: 3, impact: 4, identifiedDate: '2026-09-01', reviewDate: '2026-10-01' }),
  ];

  const wbs = [
    task('dev', 'Development', '2026-09-01', 12, null, 0, [
      task('dev-1', 'Core feature development', '2026-09-01', 6, 'dev', 1),
      task('dev-2', 'Beta testing', '2026-09-07', 3, 'dev', 1),
      task('dev-3', 'Bug fixes & stabilization', '2026-09-10', 3, 'dev', 1),
      task('dev-4', 'Feature complete', '2026-09-13', 0, 'dev', 1),
    ]),
    task('mkt-prep', 'Marketing Preparation', '2026-09-07', 10, null, 0, [
      task('mkt-1', 'Launch campaign design', '2026-09-07', 4, 'mkt-prep', 1),
      task('mkt-2', 'Press kit & materials', '2026-09-11', 3, 'mkt-prep', 1),
      task('mkt-3', 'Influencer outreach', '2026-09-14', 3, 'mkt-prep', 1),
    ]),
    task('readiness', 'Launch Readiness', '2026-09-14', 5, null, 0, [
      task('read-1', 'Support team training', '2026-09-14', 2, 'readiness', 1),
      task('read-2', 'Infrastructure scaling', '2026-09-16', 2, 'readiness', 1),
      task('read-3', 'Go-live checklist', '2026-09-18', 1, 'readiness', 1),
    ]),
    task('launch', 'Launch', '2026-09-19', 3, null, 0, [
      task('launch-1', 'Soft launch (beta users)', '2026-09-19', 1, 'launch', 1),
      task('launch-2', 'Public launch', '2026-09-20', 1, 'launch', 1),
      task('launch-3', 'Launch day monitoring', '2026-09-21', 1, 'launch', 1),
    ]),
    task('post', 'Post-Launch', '2026-09-22', 8, null, 0, [
      task('post-1', 'User feedback collection', '2026-09-22', 3, 'post', 1),
      task('post-2', 'Hotfixes & patches', '2026-09-25', 2, 'post', 1),
      task('post-3', 'Performance analysis', '2026-09-27', 2, 'post', 1),
      task('post-4', 'Post-launch report', '2026-09-29', 1, 'post', 1),
    ]),
    {
      ...task('milestone-launch', 'Product Launched', '2026-09-20', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'product',
    name: 'Product Launch',
    description: 'Full product launch from development through marketing preparation, launch execution, and post-launch analysis.',
    startDate: '2026-09-01',
    endDate: '2026-09-29',
    calendar,
    resources,
    risks,
    wbs,
  };
}
