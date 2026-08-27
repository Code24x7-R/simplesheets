// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskEditorModal } from './TaskEditorModal';
import simpleJSON from './templates/json/simple.json';
import { templateToProject } from './templates/handler';
import type { ProjectTemplateJSON } from './templates/types';
const createSimpleWBS = () => templateToProject(simpleJSON as ProjectTemplateJSON);
import { getAllTasks } from './treeOps';
import type { Resource } from '../types';

describe('TaskEditorModal', () => {
  const resources: Resource[] = [
    { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
    { id: 'r2', name: 'Bob', role: 'PM', costRate: 120, costCurrency: 'USD', availability: 50, color: '#10B981' },
  ];

  const project = createSimpleWBS();
  const allTasks = getAllTasks(project.wbs);

  it('renders in create mode', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByTestId('task-editor-modal')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders in edit mode', () => {
    const task = allTasks[0];
    render(
      <TaskEditorModal
        task={task}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Edit Task')).toBeInTheDocument();
  });

  it('shows validation error for empty name', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    // Click the submit button (the one in the footer, not the header)
    const buttons = screen.getAllByText('Add Task');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('Task name is required')).toBeInTheDocument();
  });

  it('calls onSave with form data when saved', () => {
    const onSave = jest.fn();
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Enter task name...'), {
      target: { value: 'Test Task' },
    });
    const buttons = screen.getAllByText('Add Task');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Task' }),
    );
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when delete button is clicked in edit mode', () => {
    const onDelete = jest.fn();
    const task = allTasks[0];
    render(
      <TaskEditorModal
        task={task}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText('Delete Task'));
    expect(onDelete).toHaveBeenCalledWith(task.id);
  });

  it('does not show delete button in create mode', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.queryByText('Delete Task')).not.toBeInTheDocument();
  });

  it('renders resource selector with options', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Alice (Dev)')).toBeInTheDocument();
    expect(screen.getByText('Bob (PM)')).toBeInTheDocument();
  });

  it('validates end date is after start date', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Enter task name...'), {
      target: { value: 'Test' },
    });
    // Find date inputs by their type="date" attribute
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    // Set start date to future and end date to past
    fireEvent.change(dateInputs[0], { target: { value: '2030-12-31' } });
    fireEvent.change(dateInputs[1], { target: { value: '2020-01-01' } });
    const buttons = screen.getAllByText('Add Task');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
  });

  it('renders milestone checkbox', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Milestone')).toBeInTheDocument();
  });

  it('renders dependencies section', () => {
    render(
      <TaskEditorModal
        task={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
    expect(screen.getByText('+ Add Dependency')).toBeInTheDocument();
  });

  // ─── Phase 4: Approval Gate tests ────────────────────────────────

  it('renders Approval Gates section in edit mode', () => {
    const task = allTasks[0];
    render(
      <TaskEditorModal
        task={task}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Approval Gates')).toBeInTheDocument();
  });

  it('shows existing approval gates', () => {
    const task = {
      ...allTasks[0],
      approvalGates: [
        {
          taskId: allTasks[0].id,
          gateType: 'approval' as const,
          approved: false,
          approvedBy: null,
          approvedDate: null,
          notes: '',
        },
      ],
    };
    render(
      <TaskEditorModal
        task={task}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Approval')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('allows adding a new approval gate', () => {
    const onSave = jest.fn();
    const task = { ...allTasks[0], approvalGates: [] };
    render(
      <TaskEditorModal
        task={task}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    // Click add approval gate
    fireEvent.click(screen.getByText('+ Add Approval Gate'));

    // Save the task
    fireEvent.click(screen.getByText('Save Changes'));

    // Should have called onSave with the new gate
    expect(onSave).toHaveBeenCalled();
    const savedTask = onSave.mock.calls[0][0];
    expect(savedTask.approvalGates).toHaveLength(1);
  });
});
