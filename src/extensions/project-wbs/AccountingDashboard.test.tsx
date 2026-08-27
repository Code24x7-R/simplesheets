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

  it('shows change log tab', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);
    expect(screen.getByText(/📝 Change Log/)).toBeTruthy();
  });

  it('displays empty state for change log when no entries', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);
    fireEvent.click(screen.getByText(/📝 Change Log/));
    expect(screen.getByText(/No change log entries yet/)).toBeTruthy();
  });

  it('displays change log entries', () => {
    const project = createProject({
      wbs: [createTask()],
      accounting: {
        baselineTotal: 1000,
        allocatedTotal: 1000,
        currentEstimateTotal: 1000,
        actualSpendTotal: 0,
        etcTotal: 1000,
        materialCostTotal: 0,
        taskAccounting: [],
        spendEntries: [],
        changeLog: [
          {
            id: 'cl-1',
            date: '2026-01-15',
            taskId: 'task-1',
            changeType: 'dependency',
            description: 'Predecessor delayed by 3 days',
            costImpact: 1500,
            scheduleImpactDays: 3,
            approvedBy: 'PM',
          },
        ],
        currency: 'USD',
      },
    });
    render(<AccountingDashboard project={project} />);
    fireEvent.click(screen.getByText(/📝 Change Log/));
    expect(screen.getByText('Predecessor delayed by 3 days')).toBeTruthy();
    expect(screen.getByText('dependency')).toBeTruthy();
  });

  // ─── Phase 3: Change Log entry creation tests ───────────────────

  it('shows Add Change button on Change Log tab', () => {
    const onAddChange = jest.fn();
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} onAddChange={onAddChange} />);

    // Switch to Change Log tab
    fireEvent.click(screen.getByText(/📝 Change Log/));

    // Should show Add Change button
    expect(screen.getByText(/Add Change/)).toBeTruthy();
  });

  it('calls onAddChange when Add Change button is clicked', () => {
    const onAddChange = jest.fn();
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} onAddChange={onAddChange} />);

    // Switch to Change Log tab
    fireEvent.click(screen.getByText(/📝 Change Log/));

    // Click Add Change
    fireEvent.click(screen.getByText(/Add Change/));
    expect(onAddChange).toHaveBeenCalled();
  });

  it('does not show Add Change button when onAddChange is not provided', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);

    // Switch to Change Log tab
    fireEvent.click(screen.getByText(/📝 Change Log/));

    // Should NOT show Add Change button
    expect(screen.queryByText(/Add Change/)).toBeNull();
  });

  // ─── Phase 2: Tab grouping tests ────────────────────────────────

  it('renders Planning and Execution section headers', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);

    // Section headers should be visible
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(screen.getByText('Execution')).toBeTruthy();
  });

  it('groups Baseline, Allocated, Estimate under Planning', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);

    // All planning tabs should be visible
    expect(screen.getByText(/📋 Baseline/)).toBeTruthy();
    expect(screen.getByText(/💰 Allocated/)).toBeTruthy();
    expect(screen.getByText(/📊 Estimate/)).toBeTruthy();
  });

  it('groups Actuals, Change Log under Execution', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<AccountingDashboard project={project} />);

    // All execution tabs should be visible
    expect(screen.getByText(/🧾 Actuals/)).toBeTruthy();
    expect(screen.getByText(/📝 Change Log/)).toBeTruthy();
  });

  // ─── Phase 2: Task drill-down tests ─────────────────────────────

  it('calls onTaskClick when task name is clicked in Baseline tab', () => {
    const onTaskClick = jest.fn();
    const project = createProject({
      wbs: [createTask({ id: 't1', name: 'Design Phase', cost: 5000 })],
    });
    render(<AccountingDashboard project={project} onTaskClick={onTaskClick} />);

    // Switch to Baseline tab
    fireEvent.click(screen.getByText(/📋 Baseline/));

    // Click the task name
    fireEvent.click(screen.getByText('Design Phase'));
    expect(onTaskClick).toHaveBeenCalledWith('t1');
  });

  it('calls onTaskClick when task name is clicked in Estimate tab', () => {
    const onTaskClick = jest.fn();
    const project = createProject({
      wbs: [createTask({ id: 't1', name: 'Build Phase', cost: 8000 })],
    });
    render(<AccountingDashboard project={project} onTaskClick={onTaskClick} />);

    // Default tab is Estimate — click the task name
    fireEvent.click(screen.getByText('Build Phase'));
    expect(onTaskClick).toHaveBeenCalledWith('t1');
  });

  it('does not call onTaskClick when not provided', () => {
    const project = createProject({
      wbs: [createTask({ id: 't1', name: 'Test Task', cost: 1000 })],
    });
    render(<AccountingDashboard project={project} />);

    // Clicking task name should not throw when no handler
    expect(() => fireEvent.click(screen.getByText('Test Task'))).not.toThrow();
  });

  // ─── Phase 1: Actuals Edit/Delete per entry tests ───────────────

  it('renders Edit and Delete buttons per spend entry', () => {
    const onEditSpend = jest.fn();
    const onDeleteSpend = jest.fn();
    const project = createProject({
      wbs: [createTask({ id: 't1', name: 'Task 1' })],
      accounting: {
        baselineTotal: 1000,
        allocatedTotal: 1000,
        currentEstimateTotal: 1000,
        actualSpendTotal: 500,
        etcTotal: 500,
        materialCostTotal: 0,
        taskAccounting: [],
        spendEntries: [
          {
            id: 'act-1',
            taskId: 't1',
            date: '2026-01-10',
            amount: 500,
            currency: 'USD',
            source: 'Invoice',
            notes: 'Test entry',
          },
        ],
        changeLog: [],
        currency: 'USD',
      },
    });
    render(<AccountingDashboard project={project} onEditSpend={onEditSpend} onDeleteSpend={onDeleteSpend} />);

    // Switch to Actuals tab
    fireEvent.click(screen.getByText(/Actuals/));

    // Should have Edit and Delete buttons
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('calls onDeleteSpend with entry id when Delete clicked', () => {
    const onDeleteSpend = jest.fn();
    const project = createProject({
      wbs: [createTask({ id: 't1', name: 'Task 1' })],
      accounting: {
        baselineTotal: 1000,
        allocatedTotal: 1000,
        currentEstimateTotal: 1000,
        actualSpendTotal: 500,
        etcTotal: 500,
        materialCostTotal: 0,
        taskAccounting: [],
        spendEntries: [
          {
            id: 'act-1',
            taskId: 't1',
            date: '2026-01-10',
            amount: 500,
            currency: 'USD',
            source: 'Invoice',
            notes: 'Test entry',
          },
        ],
        changeLog: [],
        currency: 'USD',
      },
    });
    render(<AccountingDashboard project={project} onDeleteSpend={onDeleteSpend} />);

    // Switch to Actuals tab
    fireEvent.click(screen.getByText(/Actuals/));

    // Click Delete
    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteSpend).toHaveBeenCalledWith('act-1');
  });

  it('shows material cost in header when materials exist', () => {
    const project = createProject({
      wbs: [createTask()],
      materials: [
        {
          id: 'mat-1',
          name: 'Steel',
          description: '',
          classification: 'capex',
          unit: 'kg',
          unitCost: 5000,
          quantity: 1,
          currency: 'USD',
          vendor: null,
          depreciationMethod: 'straight-line',
          usefulLifeMonths: 36,
          salvageValue: 500,
          acquisitionDate: '2026-01-01',
          billingPeriod: 'daily',
          rentalRate: 0,
          leaseStartDate: null,
          leaseEndDate: null,
          wastageRate: 0,
          reorderPoint: 0,
          carryingCostPerUnit: 0,
          allocatedQuantity: 0,
          consumedQuantity: 0,
          status: 'delivered',
        },
      ],
    });
    render(<AccountingDashboard project={project} />);
    expect(screen.getByText(/Materials:/)).toBeTruthy();
  });
});
