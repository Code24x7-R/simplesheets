// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Home Renovation Template
 *
 * Complete home renovation from planning to finishing.
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
    cost: duration * 400, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createRenovationProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Project Manager', role: 'PM', costRate: 120, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'contractor', name: 'General Contractor', role: 'Construction', costRate: 150, costCurrency: 'USD', availability: 100, color: '#F59E0B' },
    { id: 'electrician', name: 'Electrician', role: 'Trade', costRate: 100, costCurrency: 'USD', availability: 50, color: '#EF4444' },
    { id: 'plumber', name: 'Plumber', role: 'Trade', costRate: 100, costCurrency: 'USD', availability: 50, color: '#06B6D4' },
    { id: 'painter', name: 'Painter', role: 'Trade', costRate: 75, costCurrency: 'USD', availability: 100, color: '#8B5CF6' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'renovation', title: 'Permit delays', category: 'external', probability: 4, impact: 4, identifiedDate: '2026-04-01', reviewDate: '2026-05-01' }),
    createRisk({ id: 'r2', projectId: 'renovation', title: 'Hidden structural damage', category: 'technical', probability: 3, impact: 5, identifiedDate: '2026-04-01', reviewDate: '2026-05-01' }),
    createRisk({ id: 'r3', projectId: 'renovation', title: 'Material cost increases', category: 'cost', probability: 3, impact: 3, identifiedDate: '2026-04-01', reviewDate: '2026-05-01' }),
    createRisk({ id: 'r4', projectId: 'renovation', title: 'Contractor availability', category: 'resource', probability: 3, impact: 4, identifiedDate: '2026-04-01', reviewDate: '2026-05-01' }),
  ];

  const wbs = [
    task('planning', 'Planning & Permits', '2026-04-01', 10, null, 0, [
      task('plan-1', 'Design & architectural plans', '2026-04-01', 5, 'planning', 1),
      task('plan-2', 'Permit applications', '2026-04-06', 3, 'planning', 1),
      task('plan-3', 'Material selection', '2026-04-09', 3, 'planning', 1),
      task('plan-4', 'Permits approved', '2026-04-11', 0, 'planning', 1),
    ]),
    task('demo', 'Demolition', '2026-04-12', 5, null, 0, [
      task('demo-1', 'Site protection', '2026-04-12', 1, 'demo', 1),
      task('demo-2', 'Interior demolition', '2026-04-13', 3, 'demo', 1),
      task('demo-3', 'Debris removal', '2026-04-16', 1, 'demo', 1),
    ]),
    task('structural', 'Structural Work', '2026-04-17', 8, null, 0, [
      task('struct-1', 'Foundation repairs', '2026-04-17', 3, 'structural', 1),
      task('struct-2', 'Wall modifications', '2026-04-20', 3, 'structural', 1),
      task('struct-3', 'Structural inspection', '2026-04-23', 1, 'structural', 1),
      task('struct-4', 'Inspection passed', '2026-04-24', 0, 'structural', 1),
    ]),
    task('mechanical', 'MEP Rough-in', '2026-04-25', 10, null, 0, [
      task('mep-1', 'Electrical rough-in', '2026-04-25', 4, 'mechanical', 1),
      task('mep-2', 'Plumbing rough-in', '2026-04-29', 3, 'mechanical', 1),
      task('mep-3', 'HVAC installation', '2026-05-02', 3, 'mechanical', 1),
      task('mep-4', 'MEP inspection', '2026-05-05', 1, 'mechanical', 1),
    ]),
    task('finishing', 'Finishing', '2026-05-06', 12, null, 0, [
      task('fin-1', 'Drywall & insulation', '2026-05-06', 4, 'finishing', 1),
      task('fin-2', 'Flooring installation', '2026-05-10', 3, 'finishing', 1),
      task('fin-3', 'Painting', '2026-05-13', 3, 'finishing', 1),
      task('fin-4', 'Fixture installation', '2026-05-16', 2, 'finishing', 1),
      task('fin-5', 'Final cleanup', '2026-05-18', 1, 'finishing', 1),
    ]),
    task('handover', 'Handover', '2026-05-19', 3, null, 0, [
      task('hand-1', 'Final walkthrough', '2026-05-19', 1, 'handover', 1),
      task('hand-2', 'Punch list completion', '2026-05-20', 1, 'handover', 1),
      task('hand-3', 'Project sign-off', '2026-05-21', 0, 'handover', 1),
    ]),
    {
      ...task('milestone-complete', 'Renovation Complete', '2026-05-21', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'renovation',
    name: 'Home Renovation',
    description: 'Complete home renovation from planning and permits through demolition, structural work, MEP, and finishing.',
    startDate: '2026-04-01',
    endDate: '2026-05-21',
    calendar,
    resources,
    risks,
    wbs,
  };
}
