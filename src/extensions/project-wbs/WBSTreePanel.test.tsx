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
});
