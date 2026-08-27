// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { WBSTreePanel } from './WBSTreePanel';
import simpleJSON from './templates/json/simple.json';
import { templateToProject } from './templates/handler';
import type { ProjectTemplateJSON } from './templates/types';
const createSimpleWBS = () => templateToProject(simpleJSON as ProjectTemplateJSON);

describe('WBSTreePanel', () => {
  const project = createSimpleWBS();
  const defaultProps = {
    tasks: project.wbs,
    selectedTaskId: null,
    onTaskSelect: jest.fn(),
    onAddChild: jest.fn(),
    onAddSibling: jest.fn(),
    onEditTask: jest.fn(),
    onDeleteTask: jest.fn(),
    onToggleCollapse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tree panel', () => {
    render(<WBSTreePanel {...defaultProps} />);
    expect(screen.getByTestId('wbs-tree-panel')).toBeInTheDocument();
  });

  it('displays header with Add Task button', () => {
    render(<WBSTreePanel {...defaultProps} />);
    expect(screen.getByText('Work Breakdown Structure')).toBeInTheDocument();
    expect(screen.getByText('+ Add Task')).toBeInTheDocument();
  });

  it('renders task names', () => {
    render(<WBSTreePanel {...defaultProps} />);
    // The first task in the simple WBS template is 'Planning'
    expect(screen.getByText('Planning')).toBeInTheDocument();
  });

  it('calls onTaskSelect when task is clicked', () => {
    const onTaskSelect = jest.fn();
    render(<WBSTreePanel {...defaultProps} onTaskSelect={onTaskSelect} />);
    fireEvent.click(screen.getByText('Planning'));
    expect(onTaskSelect).toHaveBeenCalled();
  });

  it('calls onAddChild when + button is clicked', () => {
    const onAddChild = jest.fn();
    render(<WBSTreePanel {...defaultProps} onAddChild={onAddChild} />);
    // Find the + button in the header
    fireEvent.click(screen.getByText('+ Add Task'));
    expect(onAddChild).toHaveBeenCalledWith(null);
  });

  it('shows empty state when no tasks', () => {
    render(<WBSTreePanel {...defaultProps} tasks={[]} />);
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
  });

  it('shows task count in footer', () => {
    render(<WBSTreePanel {...defaultProps} />);
    expect(screen.getByText(/tasks total/)).toBeInTheDocument();
  });

  it('highlights selected task', () => {
    const task = project.wbs[0];
    render(<WBSTreePanel {...defaultProps} selectedTaskId={task.id} />);
    // The selected task should have a specific class or attribute
    const taskElement = screen.getByText(task.name).closest('div');
    expect(taskElement?.className).toContain('bg-blue-50');
  });

  // ─── Phase 2: Inline task status management tests ─────────────────

  it('calls onTaskStatusChange when status dot is clicked', () => {
    const onTaskStatusChange = jest.fn();
    render(<WBSTreePanel {...defaultProps} onTaskStatusChange={onTaskStatusChange} />);

    // Find the status dot (first rounded-full span in the tree)
    const statusDots = document.querySelectorAll('.rounded-full');
    // The first one is the status dot for the first task
    const statusDot = statusDots[0] as HTMLElement;
    expect(statusDot).toBeTruthy();
    fireEvent.click(statusDot);

    // Should call with the task id and the next status
    expect(onTaskStatusChange).toHaveBeenCalledWith(project.wbs[0].id, 'in_progress');
  });

  it('does not call onTaskStatusChange when prop not provided', () => {
    render(<WBSTreePanel {...defaultProps} />);

    const statusDots = document.querySelectorAll('.rounded-full');
    const statusDot = statusDots[0] as HTMLElement;
    expect(() => fireEvent.click(statusDot)).not.toThrow();
  });

  // ─── Phase 3: Context menu tests ─────────────────────────────────

  it('shows context menu on right-click with Edit and Delete actions', () => {
    const onEditTask = jest.fn();
    const onDeleteTask = jest.fn();
    render(
      <WBSTreePanel
        {...defaultProps}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
      />,
    );

    // Find a task name and right-click it
    const taskName = screen.getByText('Planning');
    fireEvent.contextMenu(taskName);

    // Context menu should appear with Edit and Delete
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('calls onEditTask when Edit is clicked in context menu', () => {
    const onEditTask = jest.fn();
    render(
      <WBSTreePanel
        {...defaultProps}
        onEditTask={onEditTask}
      />,
    );

    const taskName = screen.getByText('Planning');
    fireEvent.contextMenu(taskName);

    fireEvent.click(screen.getByText('Edit'));
    expect(onEditTask).toHaveBeenCalled();
  });

  it('calls onDeleteTask when Delete is clicked in context menu', () => {
    const onDeleteTask = jest.fn();
    render(
      <WBSTreePanel
        {...defaultProps}
        onDeleteTask={onDeleteTask}
      />,
    );

    const taskName = screen.getByText('Planning');
    fireEvent.contextMenu(taskName);

    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteTask).toHaveBeenCalled();
  });
});
