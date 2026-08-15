// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Construction Project Template
 *
 * Full construction project from pre-construction through finishing.
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
    cost: duration * 800, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createConstructionProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Construction Manager', role: 'PM', costRate: 160, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'arch', name: 'Architect', role: 'Design', costRate: 150, costCurrency: 'USD', availability: 50, color: '#8B5CF6' },
    { id: 'engineer', name: 'Structural Engineer', role: 'Engineering', costRate: 160, costCurrency: 'USD', availability: 50, color: '#10B981' },
    { id: 'contractor', name: 'General Contractor', role: 'Construction', costRate: 180, costCurrency: 'USD', availability: 100, color: '#F59E0B' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'construction', title: 'Weather delays', category: 'external', probability: 4, impact: 4, identifiedDate: '2027-01-01', reviewDate: '2027-03-01' }),
    createRisk({ id: 'r2', projectId: 'construction', title: 'Material delivery delays', category: 'schedule', probability: 3, impact: 4, identifiedDate: '2027-01-01', reviewDate: '2027-03-01' }),
    createRisk({ id: 'r3', projectId: 'construction', title: 'Safety incidents', category: 'other', probability: 2, impact: 5, identifiedDate: '2027-01-01', reviewDate: '2027-03-01' }),
    createRisk({ id: 'r4', projectId: 'construction', title: 'Budget overrun', category: 'cost', probability: 3, impact: 4, identifiedDate: '2027-01-01', reviewDate: '2027-03-01' }),
    createRisk({ id: 'r5', projectId: 'construction', title: 'Regulatory changes', category: 'external', probability: 2, impact: 4, identifiedDate: '2027-01-01', reviewDate: '2027-03-01' }),
  ];

  const wbs = [
    task('precon', 'Pre-Construction', '2027-01-01', 15, null, 0, [
      task('pre-1', 'Site survey', '2027-01-01', 3, 'precon', 1),
      task('pre-2', 'Architectural design', '2027-01-04', 7, 'precon', 1),
      task('pre-3', 'Permits & approvals', '2027-01-11', 5, 'precon', 1),
      task('pre-4', 'Permits approved', '2027-01-16', 0, 'precon', 1),
    ]),
    task('foundation', 'Foundation', '2027-01-17', 12, null, 0, [
      task('found-1', 'Excavation', '2027-01-17', 4, 'foundation', 1),
      task('found-2', 'Foundation pouring', '2027-01-21', 3, 'foundation', 1),
      task('found-3', 'Curing & inspection', '2027-01-24', 5, 'foundation', 1),
      task('found-4', 'Foundation complete', '2027-01-29', 0, 'foundation', 1),
    ]),
    task('structure', 'Structure', '2027-01-30', 20, null, 0, [
      task('struct-1', 'Framing', '2027-01-30', 8, 'structure', 1),
      task('struct-2', 'Roofing', '2027-02-07', 6, 'structure', 1),
      task('struct-3', 'Exterior walls', '2027-02-13', 6, 'structure', 1),
      task('struct-4', 'Structure complete', '2027-02-19', 0, 'structure', 1),
    ]),
    task('mep', 'MEP Installation', '2027-02-20', 15, null, 0, [
      task('mep-1', 'Electrical rough-in', '2027-02-20', 5, 'mep', 1),
      task('mep-2', 'Plumbing rough-in', '2027-02-25', 5, 'mep', 1),
      task('mep-3', 'HVAC installation', '2027-03-02', 5, 'mep', 1),
      task('mep-4', 'MEP inspection', '2027-03-07', 1, 'mep', 1),
    ]),
    task('finishing', 'Finishing', '2027-03-08', 15, null, 0, [
      task('fin-1', 'Interior drywall', '2027-03-08', 5, 'finishing', 1),
      task('fin-2', 'Flooring', '2027-03-13', 4, 'finishing', 1),
      task('fin-3', 'Painting', '2027-03-17', 3, 'finishing', 1),
      task('fin-4', 'Fixture installation', '2027-03-20', 3, 'finishing', 1),
    ]),
    task('handover', 'Handover', '2027-03-24', 5, null, 0, [
      task('hand-1', 'Final inspection', '2027-03-24', 2, 'handover', 1),
      task('hand-2', 'Punch list', '2027-03-26', 2, 'handover', 1),
      task('hand-3', 'Certificate of occupancy', '2027-03-28', 1, 'handover', 1),
    ]),
    {
      ...task('milestone-construction', 'Construction Complete', '2027-03-28', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'construction',
    name: 'Construction Project',
    description: 'Full construction project from pre-construction through foundation, structure, MEP, finishing, and handover.',
    startDate: '2027-01-01',
    endDate: '2027-03-28',
    calendar,
    resources,
    risks,
    wbs,
  };
}
