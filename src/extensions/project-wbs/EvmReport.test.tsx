// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvmReport } from './EvmReport';
import type { Project, WBSTask } from '../types';
import './evmEngine'; // Ensure reports are registered

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

describe('EvmReport', () => {
  it('renders without crashing', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);
    expect(screen.getByText('Earned Value Management')).toBeTruthy();
  });

  it('shows as-of date', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);
    expect(screen.getByText(/2026-01-15/)).toBeTruthy();
  });

  it('displays all report tabs', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);

    // Use getAllByText since some text appears in both tabs and content
    expect(screen.getAllByText('Cost Performance').length).toBeGreaterThan(0);
    expect(screen.getByText('Forecast at Completion')).toBeTruthy();
    expect(screen.getAllByText('Schedule Performance').length).toBeGreaterThan(0);
    expect(screen.getByText('Executive Summary')).toBeTruthy();
  });

  it('shows KPI cards', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);

    // KPI card subtitles
    expect(screen.getByText('Cost Variance')).toBeTruthy();
    expect(screen.getByText('Variance at Completion')).toBeTruthy();
    // CPI and SPI appear as both KPI card labels and detailed metrics
    expect(screen.getAllByText('Cost Performance').length).toBeGreaterThan(0);
  });

  it('switches between report tabs', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);

    // Default is first report (Cost Performance)
    expect(screen.getByText('EV - AC. Negative means over budget.')).toBeTruthy();

    // Click Forecast tab
    fireEvent.click(screen.getByText('Forecast at Completion'));
    expect(screen.getByText('BAC / CPI. Projected final cost.')).toBeTruthy();
  });

  it('shows empty state when no reports', () => {
    // Mock an empty project with no tasks
    const project = createProject({ wbs: [] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);

    // The report should still render with the metrics (all zero)
    expect(screen.getByText('Earned Value Management')).toBeTruthy();
  });

  it('displays metric status indicators', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', cost: 1000, progress: 100 }),
      ],
    });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);

    // Should show status icons
    const hasStatusIcon = (content: string) =>
      content.includes('✅') || content.includes('❌') ||
      content.includes('⚠️') || content.includes('ℹ️');
    const statusIcons = screen.getAllByText(hasStatusIcon);
    expect(statusIcons.length).toBeGreaterThan(0);
  });

  it('shows chart data section', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<EvmReport project={project} asOfDate="2026-01-15" />);

    // Chart section should be visible
    expect(screen.getByText('Visual Comparison')).toBeTruthy();
  });

  it('uses default report id from props', () => {
    const project = createProject({ wbs: [createTask()] });
    render(
      <EvmReport
        project={project}
        asOfDate="2026-01-15"
        defaultReportId="schedule"
      />,
    );

    // Schedule report should be active, showing schedule-specific metrics
    expect(screen.getAllByText('Schedule Performance').length).toBeGreaterThan(0);
    // Schedule variance description is shown
    expect(screen.getByText(/EV - PV/)).toBeTruthy();
  });
});
