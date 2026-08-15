// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyDrawer } from './DependencyDrawer';
import type { WBSTask, Resource, TaskDependency } from '../types';

function createTask(overrides: Partial<WBSTask> = {}): WBSTask {
  return {
    id: 'task-1',
    name: 'Test Task',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-15',
    endDate: '2026-01-20',
    duration: 5,
    progress: 0,
    effort: 40,
    effortUnit: 'hours',
    cost: 1000,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    status: 'not_started',
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

function createResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'res-1',
    name: 'John Doe',
    role: 'Developer',
    costRate: 500,
    costCurrency: 'USD',
    availability: 100,
    color: '#3B82F6',
    ...overrides,
  };
}

describe('DependencyDrawer', () => {
  const allTasks = [
    createTask({ id: 'pred-1', name: 'Design', startDate: '2026-01-05', endDate: '2026-01-10', status: 'done' }),
    createTask({ id: 'pred-2', name: 'API Design', startDate: '2026-01-08', endDate: '2026-01-12', status: 'in_progress' }),
    createTask({ id: 'task-1', name: 'Build Code', startDate: '2026-01-15', endDate: '2026-01-20' }),
    createTask({ id: 'succ-1', name: 'Testing', startDate: '2026-01-21', endDate: '2026-01-25' }),
  ];

  const resources = [createResource()];

  it('renders nothing when isOpen is false', () => {
    const task = allTasks[2]; // Build Code
    const { container } = render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={false}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders task name in header when open', () => {
    const task = allTasks[2];
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );
    expect(screen.getByText('Build Code')).toBeTruthy();
  });

  it('shows "No dependencies defined" when task has no deps', () => {
    const task = createTask({ dependencies: [] });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );
    expect(screen.getByText('No dependencies defined')).toBeTruthy();
  });

  it('renders existing dependencies as cards', () => {
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-1', type: 'FS', lag: 0 },
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );
    expect(screen.getByText('Design')).toBeTruthy();
  });

  it('shows "Ready to start" when no predecessors', () => {
    const task = createTask({ dependencies: [] });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );
    expect(screen.getByText('Ready to start')).toBeTruthy();
  });

  it('shows "Blocked by predecessors" when predecessor not done', () => {
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-2', type: 'FS', lag: 0 }, // API Design (in_progress)
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );
    expect(screen.getByText('Blocked by predecessors')).toBeTruthy();
  });

  it('opens add dependency form when button clicked', () => {
    const task = createTask({ dependencies: [] });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('+ Add Dependency'));
    expect(screen.getByText('Add New Dependency')).toBeTruthy();
    expect(screen.getByText('Select predecessor...')).toBeTruthy();
  });

  it('adds a new dependency when form submitted', () => {
    const onSave = jest.fn();
    const task = createTask({ dependencies: [] });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={onSave}
      />,
    );

    // Open add form
    fireEvent.click(screen.getByText('+ Add Dependency'));

    // Select predecessor
    const select = screen.getByText('Select predecessor...').closest('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'pred-1' } });

    // Click Add
    fireEvent.click(screen.getByText('Add'));

    // The new dependency card should appear
    expect(screen.getByText('Design')).toBeTruthy();
  });

  it('removes a dependency when × button clicked', () => {
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-1', type: 'FS', lag: 0 },
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );

    // Click remove button
    const removeButton = screen.getByTitle('Remove dependency');
    fireEvent.click(removeButton);

    // Should show empty state
    expect(screen.getByText('No dependencies defined')).toBeTruthy();
  });

  it('calls onSaveDependencies when Save Changes clicked', () => {
    const onSave = jest.fn();
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-1', type: 'FS', lag: 0 },
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={onSave}
      />,
    );

    // Modify lag to create a change
    const lagInput = screen.getByTitle('Lag days (negative = lead)') as HTMLInputElement;
    fireEvent.change(lagInput, { target: { value: '2' } });

    // Click Save
    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSave).toHaveBeenCalledWith('task-1', [{ predecessorId: 'pred-1', type: 'FS', lag: 2 }]);
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = jest.fn();
    const task = createTask({ dependencies: [] });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={onClose}
        onSaveDependencies={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('displays relationship types correctly', () => {
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-1', type: 'SS', lag: -2 },
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );

    // The lag input should show -2
    const lagInput = screen.getByTitle('Lag days (negative = lead)') as HTMLInputElement;
    expect(lagInput.value).toBe('-2');
  });

  it('shows impact preview when dependencies change', () => {
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-1', type: 'FS', lag: 0 },
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );

    // Modify the lag to create a change that triggers impact
    const lagInput = screen.getByTitle('Lag days (negative = lead)') as HTMLInputElement;
    fireEvent.change(lagInput, { target: { value: '3' } });

    // Impact preview should appear when there are changes
    expect(screen.getByText('Impact Preview')).toBeTruthy();
  });

  it('resets changes when Reset clicked', () => {
    const deps: TaskDependency[] = [
      { predecessorId: 'pred-1', type: 'FS', lag: 0 },
    ];
    const task = createTask({ id: 'task-1', dependencies: deps });
    render(
      <DependencyDrawer
        task={task}
        allTasks={allTasks}
        resources={resources}
        isOpen={true}
        onClose={() => {}}
        onSaveDependencies={() => {}}
      />,
    );

    // Modify lag
    const lagInput = screen.getByTitle('Lag days (negative = lead)') as HTMLInputElement;
    fireEvent.change(lagInput, { target: { value: '5' } });
    expect(lagInput.value).toBe('5');

    // Click Reset
    fireEvent.click(screen.getByText('Reset'));
    expect(lagInput.value).toBe('0');
  });
});
