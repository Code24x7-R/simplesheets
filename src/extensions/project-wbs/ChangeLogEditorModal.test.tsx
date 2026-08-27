// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChangeLogEditorModal } from './ChangeLogEditorModal';
import type { ChangeLogEntry, WBSTask } from '../types';

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
    approvalGates: [],
    collapsed: false,
    color: '#3B82F6',
    riskIds: [],
    customFields: {},
    ...overrides,
  };
}

function createEntry(overrides: Partial<ChangeLogEntry> = {}): ChangeLogEntry {
  return {
    id: 'cl-1',
    date: '2026-01-15',
    taskId: null,
    changeType: 'scope',
    description: 'Scope expanded',
    costImpact: 1500,
    scheduleImpactDays: 3,
    approvedBy: 'PM',
    ...overrides,
  };
}

describe('ChangeLogEditorModal', () => {
  const tasks = [createTask()];
  const onClose = jest.fn();
  const onSave = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    onSave.mockClear();
    onDelete.mockClear();
  });

  it('renders in create mode', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} />);
    expect(screen.getByText('Add Change Log Entry')).toBeTruthy();
  });

  it('renders in edit mode', () => {
    const entry = createEntry();
    render(<ChangeLogEditorModal entry={entry} tasks={tasks} onClose={onClose} onSave={onSave} />);
    expect(screen.getByText('Edit Change Log Entry')).toBeTruthy();
  });

  it('pre-fills form in edit mode', () => {
    const entry = createEntry({ description: 'Test description', costImpact: 2000 });
    render(<ChangeLogEditorModal entry={entry} tasks={tasks} onClose={onClose} onSave={onSave} />);

    const descInput = screen.getByPlaceholderText('Describe the change and its impact...') as HTMLTextAreaElement;
    expect(descInput.value).toBe('Test description');

    // Cost input has id="cl-cost"
    const costInput = document.getElementById('cl-cost') as HTMLInputElement;
    expect(costInput.value).toBe('2000');
  });

  it('calls onClose when cancel is clicked', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with form data when Add Entry is clicked', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} />);

    // Fill description (required)
    const descInput = screen.getByPlaceholderText('Describe the change and its impact...');
    fireEvent.change(descInput, { target: { value: 'New scope change' } });

    // Click save
    fireEvent.click(screen.getByText('Add Entry'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'New scope change',
        changeType: 'scope',
      }),
    );
  });

  it('validates required fields', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} />);

    // Click save without filling description
    fireEvent.click(screen.getByText('Add Entry'));

    // Should show error
    expect(screen.getByText('Description is required')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onDelete when delete button is clicked in edit mode', () => {
    const entry = createEntry();
    render(
      <ChangeLogEditorModal
        entry={entry}
        tasks={tasks}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('cl-1');
  });

  it('does not show delete button in create mode', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} onDelete={onDelete} />);
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('allows changing change type', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} />);

    const typeSelect = screen.getByLabelText(/Change Type/) as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'risk' } });

    // Fill description and save
    const descInput = screen.getByPlaceholderText('Describe the change and its impact...');
    fireEvent.change(descInput, { target: { value: 'Risk occurred' } });

    fireEvent.click(screen.getByText('Add Entry'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: 'risk',
      }),
    );
  });

  it('allows linking to a task', () => {
    render(<ChangeLogEditorModal entry={null} tasks={tasks} onClose={onClose} onSave={onSave} />);

    const taskSelect = screen.getByLabelText(/Linked Task/) as HTMLSelectElement;
    fireEvent.change(taskSelect, { target: { value: 'task-1' } });

    // Fill description and save
    const descInput = screen.getByPlaceholderText('Describe the change and its impact...');
    fireEvent.change(descInput, { target: { value: 'Task change' } });

    fireEvent.click(screen.getByText('Add Entry'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
      }),
    );
  });
});
