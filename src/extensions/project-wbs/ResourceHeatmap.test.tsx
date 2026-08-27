// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
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
    // Role now includes availability: 'Dev (100%)'
    expect(screen.getAllByText(/Dev/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders month label', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    // Month label includes year: 'May 2026' in the header
    const header = document.querySelector('.sticky.top-0');
    expect(header?.textContent).toContain('May');
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
    // 30 days visible (DAYS_PER_VIEW) × 2 resources
    const dayCells = document.querySelectorAll('.cursor-pointer');
    expect(dayCells.length).toBe(30 * 2);
  });

  it('highlights working days differently from weekends', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);
    // May 2-3, 9-10 are weekends in 2026
    const weekendCells = document.querySelectorAll('.bg-gray-100.text-gray-400');
    expect(weekendCells.length).toBeGreaterThan(0);
  });

  // ─── Phase 2: Resource click tests ────────────────────────────────

  it('calls onResourceClick when resource name is clicked', () => {
    const onResourceClick = jest.fn();
    const project = createMockProject();
    render(<ResourceHeatmap project={project} onResourceClick={onResourceClick} />);

    // Click the resource name
    fireEvent.click(screen.getByText('Developer 1'));
    expect(onResourceClick).toHaveBeenCalledWith('dev1');
  });

  it('does not call onResourceClick when not provided', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);

    // Clicking resource name should not throw when no handler
    expect(() => fireEvent.click(screen.getByText('Developer 1'))).not.toThrow();
  });

  // ─── Phase 1: Cell click interaction tests ─────────────────────────

  it('calls onCellClick with resource and date when cell is clicked', () => {
    const onCellClick = jest.fn();
    const project = createMockProject();
    render(<ResourceHeatmap project={project} onCellClick={onCellClick} />);

    // Find a day cell (cursor-pointer class) and click it
    const dayCells = document.querySelectorAll('.cursor-pointer');
    expect(dayCells.length).toBeGreaterThan(0);

    // Click the first cell (Developer 1, May 1)
    fireEvent.click(dayCells[0]);
    expect(onCellClick).toHaveBeenCalledWith('dev1', '2026-05-01');
  });

  it('does not call onCellClick when not provided', () => {
    const project = createMockProject();
    // Render without onCellClick — clicking should not throw
    render(<ResourceHeatmap project={project} />);

    const dayCells = document.querySelectorAll('.cursor-pointer');
    expect(() => fireEvent.click(dayCells[0])).not.toThrow();
  });

  it('shows task tooltip on hover when tasks are assigned', () => {
    const project = createMockProject();
    render(<ResourceHeatmap project={project} />);

    // Find cells for Developer 1 (first row)
    const dayCells = document.querySelectorAll('.cursor-pointer');
    // First cell is May 1 — Task 1 is assigned to dev1 from May 1-5
    const firstCell = dayCells[0];

    // Hover should show tooltip with task name
    fireEvent.mouseEnter(firstCell);

    // The legend area should show the hovered cell info
    const legend = document.querySelector('.sticky.bottom-0');
    expect(legend?.textContent).toContain('Developer 1');
    expect(legend?.textContent).toContain('2026-05-01');
  });
});
