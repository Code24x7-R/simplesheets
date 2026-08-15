// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Mining Consulting Template
 *
 * Mining consulting project from scoping through presentation.
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

export function createMiningConsultingProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'partner', name: 'Managing Partner', role: 'Partner', costRate: 250, costCurrency: 'USD', availability: 50, color: '#3B82EF' },
    { id: 'consultant', name: 'Senior Consultant', role: 'Consulting', costRate: 180, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'analyst', name: 'Mining Analyst', role: 'Analysis', costRate: 140, costCurrency: 'USD', availability: 100, color: '#F59E0B' },
    { id: 'field', name: 'Field Engineer', role: 'Fieldwork', costRate: 150, costCurrency: 'USD', availability: 75, color: '#8B5CF6' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'mining', title: 'Site access restrictions', category: 'external', probability: 3, impact: 4, identifiedDate: '2027-04-01', reviewDate: '2027-06-01' }),
    createRisk({ id: 'r2', projectId: 'mining', title: 'Data quality issues', category: 'quality', probability: 3, impact: 3, identifiedDate: '2027-04-01', reviewDate: '2027-06-01' }),
    createRisk({ id: 'r3', projectId: 'mining', title: 'Regulatory compliance gaps', category: 'external', probability: 2, impact: 5, identifiedDate: '2027-04-01', reviewDate: '2027-06-01' }),
    createRisk({ id: 'r4', projectId: 'mining', title: 'Client scope changes', category: 'scope', probability: 4, impact: 3, identifiedDate: '2027-04-01', reviewDate: '2027-06-01' }),
  ];

  const wbs = [
    task('scoping', 'Scoping', '2027-04-01', 7, null, 0, [
      task('scope-1', 'Client kickoff meeting', '2027-04-01', 1, 'scoping', 1),
      task('scope-2', 'Requirements gathering', '2027-04-02', 3, 'scoping', 1),
      task('scope-3', 'Scope definition', '2027-04-05', 2, 'scoping', 1),
      task('scope-4', 'Proposal & agreement', '2027-04-07', 1, 'scoping', 1),
    ]),
    task('assessment', 'Site Assessment', '2027-04-08', 10, null, 0, [
      task('assess-1', 'Site visit preparation', '2027-04-08', 2, 'assessment', 1),
      task('assess-2', 'Field data collection', '2027-04-10', 4, 'assessment', 1),
      task('assess-3', 'Sample analysis', '2027-04-14', 3, 'assessment', 1),
      task('assess-4', 'Assessment report', '2027-04-17', 1, 'assessment', 1),
    ]),
    task('analysis', 'Data Analysis', '2027-04-18', 10, null, 0, [
      task('anal-1', 'Resource estimation', '2027-04-18', 4, 'analysis', 1),
      task('anal-2', 'Feasibility analysis', '2027-04-22', 3, 'analysis', 1),
      task('anal-3', 'Risk assessment', '2027-04-25', 3, 'analysis', 1),
    ]),
    task('report', 'Report Writing', '2027-04-28', 8, null, 0, [
      task('rep-1', 'Draft report', '2027-04-28', 4, 'report', 1),
      task('rep-2', 'Internal review', '2027-05-02', 2, 'report', 1),
      task('rep-3', 'Client review', '2027-05-04', 2, 'report', 1),
      task('rep-4', 'Final report', '2027-05-06', 1, 'report', 1),
    ]),
    task('presentation', 'Presentation', '2027-05-07', 3, null, 0, [
      task('pres-1', 'Presentation preparation', '2027-05-07', 1, 'presentation', 1),
      task('pres-2', 'Stakeholder presentation', '2027-05-08', 1, 'presentation', 1),
      task('pres-3', 'Follow-up & close', '2027-05-09', 1, 'presentation', 1),
    ]),
    {
      ...task('milestone-mining', 'Engagement Complete', '2027-05-09', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'mining',
    name: 'Mining Consulting',
    description: 'Mining consulting project from scoping through site assessment, data analysis, report writing, and presentation.',
    startDate: '2027-04-01',
    endDate: '2027-05-09',
    calendar,
    resources,
    risks,
    wbs,
  };
}
