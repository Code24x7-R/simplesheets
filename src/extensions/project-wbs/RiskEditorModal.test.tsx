// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskEditorModal } from './RiskEditorModal';
import type { Resource, Risk, WBSTask } from '../types';

describe('RiskEditorModal', () => {
  const resources: Resource[] = [
    { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
  ];

  const allTasks: WBSTask[] = [
    {
      id: 'task-1', name: 'Design', description: '', level: 0, parentId: null, children: [],
      startDate: '2025-01-01', endDate: '2025-01-10', duration: 5, progress: 0,
      effort: 0, effortUnit: 'hours', cost: 0, costCurrency: 'USD',
      responsibleResourceId: null, dependencies: [], isMilestone: false, isSummary: false,
      collapsed: false, color: '#3B82F6', riskIds: [], customFields: {},
    },
  ];

  const existingRisk: Risk = {
    id: 'risk-1',
    projectId: 'proj-1',
    taskId: null,
    title: 'Server outage',
    description: 'Main server may go down',
    category: 'technical',
    probability: 4,
    impact: 5,
    riskScore: 20,
    status: 'identified',
    mitigationPlan: 'Add redundancy',
    contingencyPlan: 'Failover to backup',
    mitigationCost: 5000,
    ownerId: 'r1',
    identifiedDate: '2025-01-15',
    reviewDate: '2025-02-15',
    triggerCondition: 'CPU > 90%',
    residualProbability: 2,
    residualImpact: 3,
    residualRiskScore: 6,
    customFields: {},
  };

  it('renders in create mode', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByTestId('risk-editor-modal')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders in edit mode', () => {
    render(
      <RiskEditorModal
        risk={existingRisk}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Edit Risk')).toBeInTheDocument();
  });

  it('shows validation error for empty title', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    const buttons = screen.getAllByText('Add Risk');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('Risk title is required')).toBeInTheDocument();
  });

  it('calls onSave with form data', () => {
    const onSave = jest.fn();
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Enter risk title...'), {
      target: { value: 'New Risk' },
    });
    const buttons = screen.getAllByText('Add Risk');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Risk' }),
    );
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <RiskEditorModal
        risk={null}
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
    render(
      <RiskEditorModal
        risk={existingRisk}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText('Delete Risk'));
    expect(onDelete).toHaveBeenCalledWith('risk-1');
  });

  it('does not show delete button in create mode', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.queryByText('Delete Risk')).not.toBeInTheDocument();
  });

  it('renders category selector with options', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Technical')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('renders status selector with options', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Identified')).toBeInTheDocument();
    expect(screen.getByText('Mitigating')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('renders owner selector with resources', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders mitigation and contingency textareas', () => {
    render(
      <RiskEditorModal
        risk={null}
        resources={resources}
        allTasks={allTasks}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('How will you reduce this risk?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What will you do if it occurs?')).toBeInTheDocument();
  });
});
