// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import type { Project, WBSTask } from '../types';
import {
  calculateEvmMetrics,
  calculateTaskEvmBreakdown,
  registerEvmReport,
  getRegisteredReports,
  getReportById,
  type EvmReportDefinition,
} from './evmEngine';

function createTask(overrides: Partial<WBSTask> = {}): WBSTask {
  return {
    id: 'task-1',
    name: 'Test Task',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-05',
    endDate: '2026-01-10',
    duration: 5,
    progress: 50,
    effort: 40,
    effortUnit: 'hours',
    cost: 1000,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    status: 'in_progress',
    float: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82F6',
    riskIds: [],
    customFields: {},
    ...overrides,
  };
}

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: '',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    calendar: { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set(), hoursPerDay: 8 },
    resources: [],
    risks: [],
    wbs: [],
    ...overrides,
  };
}

describe('calculateEvmMetrics', () => {
  it('returns zero metrics for project with no tasks', () => {
    const project = createProject({ wbs: [] });
    const metrics = calculateEvmMetrics(project, '2026-01-15');

    expect(metrics.pv).toBe(0);
    expect(metrics.ev).toBe(0);
    expect(metrics.ac).toBe(0);
    expect(metrics.bac).toBe(0);
    expect(metrics.taskCount).toBe(0);
  });

  it('calculates BAC as sum of task costs', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', cost: 1000 }),
        createTask({ id: 't2', cost: 2000 }),
        createTask({ id: 't3', cost: 3000 }),
      ],
    });

    const metrics = calculateEvmMetrics(project, '2026-01-15');
    expect(metrics.bac).toBe(6000);
  });

  it('calculates EV based on progress', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', cost: 1000, progress: 100 }),
        createTask({ id: 't2', cost: 2000, progress: 50 }),
      ],
    });

    const metrics = calculateEvmMetrics(project, '2026-01-15');
    // EV = 1000 * 1.0 + 2000 * 0.5 = 2000
    expect(metrics.ev).toBe(2000);
  });

  it('counts completed and in-progress tasks', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', progress: 100, status: 'done' }),
        createTask({ id: 't2', progress: 50, status: 'in_progress' }),
        createTask({ id: 't3', progress: 0, status: 'not_started' }),
      ],
    });

    const metrics = calculateEvmMetrics(project, '2026-01-15');
    expect(metrics.completedTaskCount).toBe(1);
    expect(metrics.inProgressTaskCount).toBe(1);
    expect(metrics.taskCount).toBe(3);
  });

  it('calculates CPI', () => {
    const project = createProject({
      wbs: [createTask({ cost: 1000, progress: 50 })],
    });

    const metrics = calculateEvmMetrics(project, '2026-01-15');
    // CPI = EV / AC, both should be calculated
    expect(metrics.cpi).toBeGreaterThan(0);
  });

  it('calculates VAC', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', cost: 1000, progress: 100 }),
      ],
    });

    const metrics = calculateEvmMetrics(project, '2026-01-15');
    // VAC = BAC - EAC
    expect(metrics.vac).toBeCloseTo(metrics.bac - metrics.eac, 2);
  });

  it('uses default asOfDate as today', () => {
    const project = createProject({
      wbs: [createTask({ cost: 1000, progress: 50 })],
    });

    const metrics = calculateEvmMetrics(project);
    expect(metrics.asOfDate).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('calculateTaskEvmBreakdown', () => {
  it('returns breakdown for each task', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Design', cost: 5000, progress: 100 }),
        createTask({ id: 't2', name: 'Build', cost: 8000, progress: 30 }),
      ],
    });

    const breakdown = calculateTaskEvmBreakdown(project, '2026-01-15');
    expect(breakdown.length).toBe(2);

    const design = breakdown.find((b) => b.taskId === 't1');
    expect(design?.bac).toBe(5000);
    expect(design?.progress).toBe(100);

    const build = breakdown.find((b) => b.taskId === 't2');
    expect(build?.bac).toBe(8000);
    expect(build?.progress).toBe(30);
  });

  it('calculates per-task CV and SV', () => {
    const project = createProject({
      wbs: [createTask({ id: 't1', cost: 1000, progress: 50 })],
    });

    const breakdown = calculateTaskEvmBreakdown(project, '2026-01-15');
    expect(breakdown[0].cv).toBeDefined();
    expect(breakdown[0].sv).toBeDefined();
  });

  it('marks critical tasks', () => {
    const project = createProject({
      wbs: [createTask({ id: 't1', isCritical: true })],
    });

    const breakdown = calculateTaskEvmBreakdown(project, '2026-01-15');
    expect(breakdown[0].isCritical).toBe(true);
  });
});

describe('report registry', () => {
  it('has 4 built-in reports registered', () => {
    const reports = getRegisteredReports();
    expect(reports.length).toBe(4);
  });

  it('includes cost-performance report', () => {
    const report = getReportById('cost-performance');
    expect(report).toBeDefined();
    expect(report?.name).toBe('Cost Performance');
    expect(report?.category).toBe('cost');
  });

  it('includes forecast report', () => {
    const report = getReportById('forecast');
    expect(report).toBeDefined();
    expect(report?.name).toBe('Forecast at Completion');
    expect(report?.category).toBe('forecast');
  });

  it('includes schedule report', () => {
    const report = getReportById('schedule');
    expect(report).toBeDefined();
    expect(report?.category).toBe('schedule');
  });

  it('includes executive-summary report', () => {
    const report = getReportById('executive-summary');
    expect(report).toBeDefined();
    expect(report?.category).toBe('summary');
  });

  it('allows registering custom reports', () => {
    const customReport: EvmReportDefinition = {
      id: 'custom-test',
      name: 'Custom Test',
      description: 'Test report',
      category: 'summary',
      calculate: () => ({
        title: 'Custom',
        metrics: [
          {
            label: 'Test Metric',
            value: '42',
            rawValue: 42,
            unit: 'count',
            status: 'good',
            description: 'A test metric',
          },
        ],
      }),
    };

    registerEvmReport(customReport);

    const retrieved = getReportById('custom-test');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Custom Test');

    // Verify it appears in the full list
    const reports = getRegisteredReports();
    expect(reports.find((r) => r.id === 'custom-test')).toBeDefined();
  });

  it('report calculate function returns valid section', () => {
    const project = createProject({
      wbs: [createTask({ cost: 1000, progress: 50 })],
    });

    const report = getReportById('cost-performance');
    expect(report).toBeDefined();

    const section = report!.calculate(project, '2026-01-15');
    expect(section.title).toBe('Cost Performance Report');
    expect(section.metrics.length).toBeGreaterThan(0);

    // Each metric should have required fields
    for (const metric of section.metrics) {
      expect(metric.label).toBeTruthy();
      expect(metric.value).toBeTruthy();
      expect(metric.status).toMatch(/good|warning|critical|neutral/);
      expect(metric.description).toBeTruthy();
    }
  });

  it('executive summary includes all key metrics', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', cost: 1000, progress: 100 }),
        createTask({ id: 't2', cost: 2000, progress: 50 }),
      ],
    });

    const report = getReportById('executive-summary');
    const section = report!.calculate(project, '2026-01-15');

    const labels = section.metrics.map((m) => m.label);
    expect(labels).toContain('Cost Variance (CV)');
    expect(labels).toContain('Schedule Variance (SV)');
    expect(labels).toContain('CPI');
    expect(labels).toContain('SPI');
    expect(labels).toContain('VAC');
  });
});
