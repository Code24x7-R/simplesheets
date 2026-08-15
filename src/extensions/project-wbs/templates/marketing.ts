// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Marketing Campaign Template
 *
 * End-to-end marketing campaign from research to analysis.
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
    cost: duration * 350, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createMarketingCampaignProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Marketing Manager', role: 'PM', costRate: 140, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'creative', name: 'Creative Director', role: 'Creative', costRate: 150, costCurrency: 'USD', availability: 75, color: '#8B5CF6' },
    { id: 'content', name: 'Content Writer', role: 'Content', costRate: 90, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'analyst', name: 'Data Analyst', role: 'Analytics', costRate: 120, costCurrency: 'USD', availability: 50, color: '#F59E0B' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'marketing', title: 'Low engagement rates', category: 'other', probability: 3, impact: 4, identifiedDate: '2026-07-01', reviewDate: '2026-08-01' }),
    createRisk({ id: 'r2', projectId: 'marketing', title: 'Budget overrun on ads', category: 'cost', probability: 3, impact: 3, identifiedDate: '2026-07-01', reviewDate: '2026-08-01' }),
    createRisk({ id: 'r3', projectId: 'marketing', title: 'Competitor campaign launch', category: 'external', probability: 2, impact: 4, identifiedDate: '2026-07-01', reviewDate: '2026-08-01' }),
    createRisk({ id: 'r4', projectId: 'marketing', title: 'Content approval delays', category: 'schedule', probability: 4, impact: 3, identifiedDate: '2026-07-01', reviewDate: '2026-08-01' }),
  ];

  const wbs = [
    task('research', 'Research & Strategy', '2026-07-01', 7, null, 0, [
      task('res-1', 'Market research', '2026-07-01', 3, 'research', 1),
      task('res-2', 'Competitor analysis', '2026-07-04', 2, 'research', 1),
      task('res-3', 'Target audience definition', '2026-07-06', 2, 'research', 1),
      task('res-4', 'Campaign brief approved', '2026-07-08', 0, 'research', 1),
    ]),
    task('content', 'Content Creation', '2026-07-09', 10, null, 0, [
      task('cont-1', 'Campaign messaging', '2026-07-09', 3, 'content', 1),
      task('cont-2', 'Visual assets creation', '2026-07-12', 4, 'content', 1),
      task('cont-3', 'Copywriting', '2026-07-16', 3, 'content', 1),
      task('cont-4', 'Content approval', '2026-07-19', 1, 'content', 1),
    ]),
    task('distribution', 'Distribution Setup', '2026-07-16', 7, null, 0, [
      task('dist-1', 'Channel selection', '2026-07-16', 1, 'distribution', 1),
      task('dist-2', 'Ad platform setup', '2026-07-17', 2, 'distribution', 1),
      task('dist-3', 'Email sequence setup', '2026-07-19', 3, 'distribution', 1),
      task('dist-4', 'Scheduling & automation', '2026-07-22', 2, 'distribution', 1),
    ]),
    task('launch', 'Campaign Launch', '2026-07-23', 3, null, 0, [
      task('launch-1', 'Soft launch testing', '2026-07-23', 1, 'launch', 1),
      task('launch-2', 'Full launch', '2026-07-24', 1, 'launch', 1),
      task('launch-3', 'Monitoring & adjustments', '2026-07-25', 1, 'launch', 1),
    ]),
    task('analysis', 'Analysis & Reporting', '2026-07-26', 5, null, 0, [
      task('anal-1', 'Data collection', '2026-07-26', 2, 'analysis', 1),
      task('anal-2', 'Performance analysis', '2026-07-28', 2, 'analysis', 1),
      task('anal-3', 'Final report', '2026-07-30', 1, 'analysis', 1),
    ]),
    {
      ...task('milestone-campaign', 'Campaign Complete', '2026-07-30', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'marketing',
    name: 'Marketing Campaign',
    description: 'End-to-end marketing campaign from research and strategy through content creation, distribution, launch, and analysis.',
    startDate: '2026-07-01',
    endDate: '2026-07-30',
    calendar,
    resources,
    risks,
    wbs,
  };
}
