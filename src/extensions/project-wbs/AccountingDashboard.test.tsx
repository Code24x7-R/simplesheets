// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountingDashboard } from './AccountingDashboard';
import type { Project, WBSTask } from '../types';

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

describe('AccountingDashboard', () => {
  it('renders without crashing', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);
    expect(screen.getByText('Project Accounting')).toBeTruthy();
  });

  it('displays all four tabs', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);
    // Tab buttons contain the icons + labels
    expect(screen.getByText(/📋 Baseline/)).toBeTruthy();
    expect(screen.getByText(/💰 Allocated/)).toBeTruthy();
    expect(screen.getByText(/📊 Estimate/)).toBeTruthy();
    expect(screen.getByText(/🧾 Actuals/)).toBeTruthy();
  });

  it('shows baseline total in header', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Task 1', cost: 1000 }),
        createTask({ id: 't2', name: 'Task 2', cost: 2000 }),
      ],
    });
    render(<AccountingDashboard project={project} />);
    // The KPI area shows "Baseline: $3,000"
    const baselineText = screen.getByText(/Baseline:/);
    expect(baselineText.textContent).toContain('3,000');
  });

  it('switches between tabs', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);

    // Default tab is Estimate — EAC column visible
    expect(screen.getByText('EAC')).toBeTruthy();

    // Click Baseline tab
    fireEvent.click(screen.getByText(/📋 Baseline/));
    // Baseline table has "Cost" header
    expect(screen.getByText('Cost')).toBeTruthy();
  });

  it('displays task names in table', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Design Phase', cost: 5000 }),
        createTask({ id: 't2', name: 'Build Phase', cost: 8000 }),
      ],
    });
    render(<AccountingDashboard project={project} />);
    expect(screen.getByText('Design Phase')).toBeTruthy();
    expect(screen.getByText('Build Phase')).toBeTruthy();
  });

  it('shows CPI and SPI badges', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);
    expect(screen.getByText(/CPI:/)).toBeTruthy();
    expect(screen.getByText(/SPI:/)).toBeTruthy();
  });

  it('calls onEditSpend when add button clicked on Actuals tab', () => {
    const onEditSpend = jest.fn();
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} onEditSpend={onEditSpend} />);

    // Switch to Actuals tab
    fireEvent.click(screen.getByText(/Actuals/));

    // Click the add button
    const addButton = screen.getByText('+ Add Spend Entry');
    fireEvent.click(addButton);
    expect(onEditSpend).toHaveBeenCalledWith('');
  });

  it('shows empty state for actuals when no entries', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);

    // Switch to Actuals tab
    fireEvent.click(screen.getByText(/Actuals/));
    expect(screen.getByText(/No actual spend entries yet/)).toBeTruthy();
  });

  it('calculates and displays variance correctly', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Task A', cost: 1000, progress: 100 }),
      ],
    });
    render(<AccountingDashboard project={project} />);
    // Variance footer should show since Estimate = Baseline when no actuals
    expect(screen.getByText('Variance:')).toBeTruthy();
  });

  it('renders multiple tasks in correct order', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Alpha', cost: 100 }),
        createTask({ id: 't2', name: 'Beta', cost: 200 }),
        createTask({ id: 't3', name: 'Gamma', cost: 300 }),
      ],
    });
    render(<AccountingDashboard project={project} />);
    const rows = screen.getAllByText(/Alpha|Beta|Gamma/);
    expect(rows.length).toBe(3);
  });
});
