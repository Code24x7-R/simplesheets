// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Event Planning Template
 *
 * Complete event planning from venue selection to day-of execution.
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
    cost: duration * 300, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createEventPlanningProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Event Manager', role: 'PM', costRate: 130, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'coordinator', name: 'Event Coordinator', role: 'Coordination', costRate: 90, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'caterer', name: 'Catering Manager', role: 'Catering', costRate: 100, costCurrency: 'USD', availability: 75, color: '#F59E0B' },
    { id: 'av', name: 'AV Technician', role: 'Technical', costRate: 85, costCurrency: 'USD', availability: 50, color: '#8B5CF6' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'event', title: 'Venue cancellation', category: 'external', probability: 2, impact: 5, identifiedDate: '2026-06-01', reviewDate: '2026-07-01' }),
    createRisk({ id: 'r2', projectId: 'event', title: 'Low attendance', category: 'other', probability: 3, impact: 3, identifiedDate: '2026-06-01', reviewDate: '2026-07-01' }),
    createRisk({ id: 'r3', projectId: 'event', title: 'Weather disruption', category: 'external', probability: 2, impact: 4, identifiedDate: '2026-06-01', reviewDate: '2026-07-01' }),
    createRisk({ id: 'r4', projectId: 'event', title: 'Vendor no-shows', category: 'resource', probability: 2, impact: 4, identifiedDate: '2026-06-01', reviewDate: '2026-07-01' }),
  ];

  const wbs = [
    task('setup', 'Initial Setup', '2026-06-01', 7, null, 0, [
      task('setup-1', 'Define event objectives', '2026-06-01', 2, 'setup', 1),
      task('setup-2', 'Budget planning', '2026-06-03', 2, 'setup', 1),
      task('setup-3', 'Venue research & booking', '2026-06-05', 3, 'setup', 1),
      task('setup-4', 'Venue confirmed', '2026-06-08', 0, 'setup', 1),
    ]),
    task('catering', 'Catering & Menu', '2026-06-09', 7, null, 0, [
      task('cat-1', 'Menu planning', '2026-06-09', 3, 'catering', 1),
      task('cat-2', 'Tasting session', '2026-06-12', 1, 'catering', 1),
      task('cat-3', 'Final vendor selection', '2026-06-13', 2, 'catering', 1),
      task('cat-4', 'Catering booked', '2026-06-15', 0, 'catering', 1),
    ]),
    task('marketing', 'Marketing & Registration', '2026-06-09', 10, null, 0, [
      task('mkt-1', 'Invitation design', '2026-06-09', 3, 'marketing', 1),
      task('mkt-2', 'Registration system setup', '2026-06-12', 2, 'marketing', 1),
      task('mkt-3', 'Promotional campaign', '2026-06-14', 5, 'marketing', 1),
    ]),
    task('logistics', 'Logistics & Technical', '2026-06-16', 7, null, 0, [
      task('log-1', 'AV equipment booking', '2026-06-16', 2, 'logistics', 1),
      task('log-2', 'Seating arrangement', '2026-06-18', 2, 'logistics', 1),
      task('log-3', 'Signage & decorations', '2026-06-20', 3, 'logistics', 1),
    ]),
    task('rehearsal', 'Final Preparation', '2026-06-23', 4, null, 0, [
      task('reh-1', 'Vendor confirmations', '2026-06-23', 1, 'rehearsal', 1),
      task('reh-2', 'Run-through rehearsal', '2026-06-24', 1, 'rehearsal', 1),
      task('reh-3', 'Final venue setup', '2026-06-25', 2, 'rehearsal', 1),
    ]),
    task('dayof', 'Event Day', '2026-06-27', 1, null, 0, [
      task('day-1', 'Event execution', '2026-06-27', 1, 'dayof', 1),
      task('day-2', 'Post-event teardown', '2026-06-27', 1, 'dayof', 1),
    ]),
    {
      ...task('milestone-event', 'Event Completed', '2026-06-27', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'event',
    name: 'Event Planning',
    description: 'Complete event planning from venue selection through catering, marketing, logistics, and day-of execution.',
    startDate: '2026-06-01',
    endDate: '2026-06-27',
    calendar,
    resources,
    risks,
    wbs,
  };
}
