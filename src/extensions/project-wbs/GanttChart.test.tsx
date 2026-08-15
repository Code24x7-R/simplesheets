// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { GanttChart } from './GanttChart';
import type { Project, WBSTask, Risk } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTask(overrides: Partial<WBSTask> = {}): WBSTask {
  return {
    id: 'task-1',
    name: 'Design Phase',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-05',
    endDate: '2026-01-15',
    duration: 10,
    progress: 50,
    effort: 40,
    effortUnit: 'hours',
    cost: 5000,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82EF',
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

function createRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: 'risk-1',
    projectId: 'proj-1',
    taskId: null,
    title: 'Test Risk',
    description: '',
    category: 'technical',
    probability: 3,
    impact: 4,
    riskScore: 12,
    status: 'identified',
    mitigationPlan: '',
    contingencyPlan: '',
    mitigationCost: 0,
    ownerId: null,
    identifiedDate: '2026-01-01',
    reviewDate: '2026-02-01',
    triggerCondition: '',
    residualProbability: 2,
    residualImpact: 3,
    residualRiskScore: 6,
    customFields: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GanttChart', () => {
  it('renders an SVG element', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<GanttChart project={project} width={800} height={400} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders task names', () => {
    const project = createProject({ wbs: [createTask({ name: 'My Task' })] });
    render(<GanttChart project={project} width={800} height={400} />);
    expect(screen.getByText('My Task')).toBeInTheDocument();
  });

  it('truncates long task names', () => {
    const project = createProject({ wbs: [createTask({ name: 'A very long task name that exceeds limits' })] });
    const { container } = render(<GanttChart project={project} width={800} height={400} />);
    // Text is truncated to 16 chars + '...' to make room for status icon
    const texts = container.querySelectorAll('text');
    const allText = Array.from(texts).map((t) => t.textContent).join(' ');
    expect(allText).toContain('A very long task...');
  });

  it('renders multiple tasks', () => {
    const project = createProject({
      wbs: [
        createTask({ id: 't1', name: 'Task 1' }),
        createTask({ id: 't2', name: 'Task 2', startDate: '2026-01-20', endDate: '2026-02-05' }),
      ],
    });
    render(<GanttChart project={project} width={800} height={400} />);
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('renders milestone as diamond', () => {
    const project = createProject({
      wbs: [createTask({ isMilestone: true, duration: 0 })],
    });
    render(<GanttChart project={project} width={800} height={400} />);
    const polygon = document.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
  });

  it('renders collapsed children when task is collapsed', () => {
    const project = createProject({
      wbs: [
        createTask({
          id: 'parent',
          name: 'Parent',
          isSummary: true,
          collapsed: true,
          children: [createTask({ id: 'child', name: 'Child', parentId: 'parent', level: 1 })],
        }),
      ],
    });
    render(<GanttChart project={project} width={800} height={400} />);
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('calls onTaskSelect when a task is clicked', () => {
    const onTaskSelect = jest.fn();
    const project = createProject({ wbs: [createTask({ id: 't1' })] });
    render(<GanttChart project={project} onTaskSelect={onTaskSelect} width={800} height={400} />);
    fireEvent.click(screen.getByText('Design Phase'));
    expect(onTaskSelect).toHaveBeenCalledWith('t1');
  });

  it('highlights selected task', () => {
    const project = createProject({ wbs: [createTask({ id: 't1' })] });
    render(<GanttChart project={project} selectedTaskId="t1" width={800} height={400} />);
    // Selected task text should have bold font
    const text = screen.getByText('Design Phase');
    expect(text.getAttribute('font-weight')).toBe('bold');
  });

  it('renders risk indicator when task has linked risks', () => {
    const risk = createRisk({ id: 'r1' });
    const project = createProject({
      risks: [risk],
      wbs: [createTask({ riskIds: ['r1'] })],
    });
    render(<GanttChart project={project} width={800} height={400} />);
    // Risk indicator (⚠) should be present
    const warning = document.querySelector('text[fill="#F97316"]');
    expect(warning).toBeInTheDocument();
  });

  it('renders risk heatmap when enabled', () => {
    const risk = createRisk({ id: 'r1', riskScore: 20 });
    const project = createProject({
      risks: [risk],
      wbs: [createTask({ riskIds: ['r1'] })],
    });
    render(<GanttChart project={project} showRiskHeatmap width={800} height={400} />);
    // Bar should be colored red for critical risk
    const criticalBar = document.querySelector('rect[fill="#DC2626"]');
    expect(criticalBar).toBeInTheDocument();
  });

  it('renders today marker', () => {
    // Use a project that spans today
    const today = new Date().toISOString().slice(0, 10);
    const project = createProject({
      startDate: today,
      endDate: '2026-12-31',
      wbs: [createTask({ startDate: today, endDate: today })],
    });
    render(<GanttChart project={project} showTodayMarker width={800} height={400} />);
    const todayLine = document.querySelector('line[stroke="#EF4444"]');
    expect(todayLine).toBeInTheDocument();
  });

  it('hides today marker when disabled', () => {
    const project = createProject({ wbs: [createTask()] });
    render(<GanttChart project={project} showTodayMarker={false} width={800} height={400} />);
    const todayLine = document.querySelector('line[stroke="#EF4444"]');
    expect(todayLine).not.toBeInTheDocument();
  });

  it('renders critical path with red border', () => {
    const project = createProject({ wbs: [createTask({ id: 't1' })] });
    render(
      <GanttChart
        project={project}
        showCriticalPath
        criticalPath={['t1']}
        width={800}
        height={400}
      />,
    );
    const criticalBar = document.querySelector('rect[stroke="#DC2626"]');
    expect(criticalBar).toBeInTheDocument();
  });

  it('renders progress overlay', () => {
    const project = createProject({ wbs: [createTask({ progress: 60 })] });
    render(<GanttChart project={project} showProgress width={800} height={400} />);
    // Progress overlay is a semi-transparent rect
    const overlay = document.querySelector('rect[fill="rgba(0,0,0,0.2)"]');
    expect(overlay).toBeInTheDocument();
  });

  it('supports different zoom levels', () => {
    const project = createProject({ wbs: [createTask()] });
    const { rerender } = render(<GanttChart project={project} zoom="day" width={800} height={400} />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    rerender(<GanttChart project={project} zoom="week" width={800} height={400} />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    rerender(<GanttChart project={project} zoom="month" width={800} height={400} />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('shows resource name in tooltip when task has assigned resource', () => {
    const resource = { id: 'res-1', name: 'John Doe', role: 'Developer', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82EF' };
    const task = createTask({ responsibleResourceId: 'res-1' });
    const project = createProject({ wbs: [task], resources: [resource] });
    render(<GanttChart project={project} width={800} height={400} />);
    // The title element should contain the resource name
    const titleElements = document.querySelectorAll('title');
    expect(titleElements.length).toBeGreaterThan(0);
    const taskTitle = Array.from(titleElements).find((t) => t.textContent?.includes('Resource: John Doe'));
    expect(taskTitle).toBeInTheDocument();
  });
});
