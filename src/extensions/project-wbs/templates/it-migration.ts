// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * IT Migration Template
 *
 * IT infrastructure migration from audit through cutover.
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
    cost: duration * 550, costCurrency: 'USD',
    responsibleResourceId: null, dependencies: [],
    isMilestone: false, isSummary: children.length > 0, collapsed: false,
    color: '#3B82EF', riskIds: [], customFields: {},
  };
}

export function createITMigrationProject(): Project {
  const calendar = createDefaultCalendar();

  const resources: Resource[] = [
    { id: 'pm', name: 'Migration Manager', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82EF' },
    { id: 'arch', name: 'Solutions Architect', role: 'Architecture', costRate: 170, costCurrency: 'USD', availability: 75, color: '#8B5CF6' },
    { id: 'engineer', name: 'Systems Engineer', role: 'Engineering', costRate: 140, costCurrency: 'USD', availability: 100, color: '#10B981' },
    { id: 'security', name: 'Security Analyst', role: 'Security', costRate: 130, costCurrency: 'USD', availability: 50, color: '#EF4444' },
  ];

  const risks = [
    createRisk({ id: 'r1', projectId: 'it-migration', title: 'Data loss during migration', category: 'technical', probability: 2, impact: 5, identifiedDate: '2026-10-01', reviewDate: '2026-11-01' }),
    createRisk({ id: 'r2', projectId: 'it-migration', title: 'Extended downtime', category: 'schedule', probability: 3, impact: 5, identifiedDate: '2026-10-01', reviewDate: '2026-11-01' }),
    createRisk({ id: 'r3', projectId: 'it-migration', title: 'Compatibility issues', category: 'technical', probability: 4, impact: 3, identifiedDate: '2026-10-01', reviewDate: '2026-11-01' }),
    createRisk({ id: 'r4', projectId: 'it-migration', title: 'Compliance violations', category: 'external', probability: 2, impact: 5, identifiedDate: '2026-10-01', reviewDate: '2026-11-01' }),
  ];

  const wbs = [
    task('audit', 'Infrastructure Audit', '2026-10-01', 8, null, 0, [
      task('aud-1', 'Current state assessment', '2026-10-01', 3, 'audit', 1),
      task('aud-2', 'Application inventory', '2026-10-04', 3, 'audit', 1),
      task('aud-3', 'Dependency mapping', '2026-10-07', 2, 'audit', 1),
      task('aud-4', 'Audit report complete', '2026-10-09', 0, 'audit', 1),
    ]),
    task('planning', 'Migration Planning', '2026-10-10', 7, null, 0, [
      task('plan-1', 'Target architecture design', '2026-10-10', 3, 'planning', 1),
      task('plan-2', 'Migration strategy', '2026-10-13', 2, 'planning', 1),
      task('plan-3', 'Rollback planning', '2026-10-15', 2, 'planning', 1),
      task('plan-4', 'Plan sign-off', '2026-10-17', 0, 'planning', 1),
    ]),
    task('migration', 'Migration Execution', '2026-10-18', 12, null, 0, [
      task('mig-1', 'Non-production migration', '2026-10-18', 4, 'migration', 1),
      task('mig-2', 'User acceptance testing', '2026-10-22', 3, 'migration', 1),
      task('mig-3', 'Production migration', '2026-10-25', 3, 'migration', 1),
      task('mig-4', 'Data validation', '2026-10-28', 2, 'migration', 1),
    ]),
    task('validation', 'Validation', '2026-10-29', 5, null, 0, [
      task('val-1', 'Performance testing', '2026-10-29', 2, 'validation', 1),
      task('val-2', 'Security audit', '2026-10-31', 2, 'validation', 1),
      task('val-3', 'Compliance verification', '2026-11-02', 1, 'validation', 1),
    ]),
    task('cutover', 'Cutover & Decommission', '2026-11-03', 4, null, 0, [
      task('cut-1', 'DNS cutover', '2026-11-03', 1, 'cutover', 1),
      task('cut-2', 'Legacy decommission', '2026-11-04', 2, 'cutover', 1),
      task('cut-3', 'Project closure', '2026-11-06', 1, 'cutover', 1),
    ]),
    {
      ...task('milestone-migration', 'Migration Complete', '2026-11-06', 0, null, 0),
      isMilestone: true,
    },
  ];

  return {
    id: 'it-migration',
    name: 'IT Migration',
    description: 'IT infrastructure migration from audit through planning, execution, validation, and cutover.',
    startDate: '2026-10-01',
    endDate: '2026-11-06',
    calendar,
    resources,
    risks,
    wbs,
  };
}
