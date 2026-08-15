// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectView } from './ProjectView';
import simpleJSON from './templates/json/simple.json';
import { templateToProject } from './templates/handler';
import type { ProjectTemplateJSON } from './templates/types';
const createSimpleWBS = () => templateToProject(simpleJSON as ProjectTemplateJSON);
import type { Sheet, ColumnMapping } from '../../types';

describe('ProjectView', () => {
  const project = createSimpleWBS();
  const mockSheet: Sheet = {
    id: 'sheet-1',
    name: 'Test Sheet',
    cells: { '0:0': { rawValue: 'Task' }, '0:1': { rawValue: 'Start' }, '1:0': { rawValue: 'My Task' }, '1:1': { rawValue: '2025-01-01' } },
    defaultColWidth: 100,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    columnCount: 6,
    rowCount: 5,
    frozenColumns: 0,
    frozenRows: 0,
  };
  const mockMapping: ColumnMapping = {
    taskCol: 0,
    startDateCol: 1,
    endDateCol: 2,
    durationCol: null,
    parentCol: null,
    dependencyCol: null,
    progressCol: null,
    resourceCol: null,
    milestoneCol: null,
    colorCol: null,
    notesCol: null,
    headerRow: 0,
  };

  it('renders project view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('project-view')).toBeInTheDocument();
  });

  it('displays project name', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Simple WBS')).toBeInTheDocument();
  });

  it('shows task and risk counts', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/tasks \|/)).toBeInTheDocument();
    expect(screen.getByText(/\| \d+ risks/)).toBeInTheDocument();
  });

  it('renders Gantt chart by default', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('switches to Risk Register view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Risk Register'));
    expect(screen.getByTestId('risk-register')).toBeInTheDocument();
  });

  it('switches to Risk Matrix view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Risk Matrix'));
    expect(screen.getByTestId('risk-matrix')).toBeInTheDocument();
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = jest.fn();
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows zoom controls in Gantt view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('displays critical risk badge when applicable', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    // Simple WBS has no critical risks by default
    expect(screen.queryByText(/critical/)).not.toBeInTheDocument();
  });
});
