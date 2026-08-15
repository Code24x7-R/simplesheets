// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen } from '@testing-library/react';
import { ResourceHeatmap } from './ResourceHeatmap';
import type { Project } from '../types';
import { createDefaultCalendar } from './calendar';

function createMockProject(): Project {
  return {
    id: 'test',
    name: 'Test Project',
    description: 'Test',
    startDate: '2026-05-01',
    endDate: '2026-05-15',
    calendar: createDefaultCalendar(),
    resources: [
      { id: 'dev1', name: 'Developer 1', role: 'Dev', costRate: 150, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
      { id: 'dev2', name: 'Developer 2', role: 'Dev', costRate: 120, costCurrency: 'USD', availability: 100, color: '#10B981' },
    ],
    risks: [],
    wbs: [
      {
        id: 'task1',
        name: 'Task 1',
        description: '',
        level: 0,
        parentId: null,
        children: [],
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        duration: 5,
        progress: 50,
        effort: 40,
        effortUnit: 'hours',
        cost: 0,
        costCurrency: 'USD',
        responsibleResourceId: 'dev1',
        dependencies: [],
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#3B82F6',
        riskIds: [],
        customFields: {},
      },
      {
        id: 'task2',
        name: 'Task 2',
        description: '',
        level: 0,
        parentId: null,
        children: [],
        startDate: '2026-05-06',
        endDate: '2026-05-10',
        duration: 5,
        progress: 0,
        effort: 40,
        effortUnit: 'hours',
        cost: 0,
        costCurrency: 'USD',
        responsibleResourceId: 'dev2',
        dependencies: [],
        isMilestone: false,
        isSummary: false,
        collapsed: false,
        color: '#10B981',
        riskIds: [],
        customFields: {},
      },
    ],
  };
}

describe('ResourceHeatmap', () => {
  it('renders without crashing', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    expect(screen.getByText('Developer 1')).toBeTruthy();
    expect(screen.getByText('Developer 2')).toBeTruthy();
  });

  it('shows resource names and roles', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    expect(screen.getByText('Developer 1')).toBeTruthy();
    expect(screen.getByText('Developer 2')).toBeTruthy();
    expect(screen.getAllByText('Dev').length).toBeGreaterThanOrEqual(2);
  });

  it('renders month label', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    const mayLabels = screen.getAllByText('May');
    expect(mayLabels.length).toBeGreaterThan(0);
  });

  it('shows empty state when no resources', () => {
    const project = createMockProject();
    project.resources = [];
    render(<ResourceHeatmap project={project} />);
    expect(screen.getByText('No Resources Defined')).toBeTruthy();
  });

  it('renders legend', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    expect(screen.getByText('Allocation:')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText('Over-allocated')).toBeTruthy();
  });

  it('renders correct number of day cells', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    // 15 days from May 1 to May 15
    const dayCells = document.querySelectorAll('.cursor-pointer');
    expect(dayCells.length).toBe(15 * 2); // 15 days × 2 resources
  });

  it('highlights working days differently from weekends', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    // May 2-3, 9-10 are weekends in 2026
    const weekendCells = document.querySelectorAll('.bg-gray-100.text-gray-400');
    expect(weekendCells.length).toBeGreaterThan(0);
  });
});
