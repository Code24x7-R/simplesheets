// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialDashboard } from './MaterialDashboard';
import type { Project, Material } from '../types';

function createMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    name: 'Test Material',
    description: '',
    classification: 'consumable',
    unit: 'each',
    unitCost: 100,
    quantity: 10,
    currency: 'USD',
    vendor: null,
    depreciationMethod: 'straight-line',
    usefulLifeMonths: 36,
    salvageValue: 100,
    acquisitionDate: null,
    billingPeriod: 'daily',
    rentalRate: 50,
    leaseStartDate: null,
    leaseEndDate: null,
    wastageRate: 5,
    reorderPoint: 2,
    carryingCostPerUnit: 2,
    allocatedQuantity: 0,
    consumedQuantity: 0,
    status: 'delivered',
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

describe('MaterialDashboard', () => {
  it('renders without crashing', () => {
    const project = createProject({ materials: [createMaterial()] });
    render(<MaterialDashboard project={project} />);
    expect(screen.getByText('Materials & Assets')).toBeTruthy();
  });

  it('shows empty state when no materials', () => {
    const project = createProject({ materials: [] });
    render(<MaterialDashboard project={project} />);
    expect(screen.getByText('No materials registered.')).toBeTruthy();
  });

  it('displays material rows', () => {
    const project = createProject({
      materials: [
        createMaterial({ id: 'm1', name: 'Steel Beams' }),
        createMaterial({ id: 'm2', name: 'Concrete' }),
      ],
    });
    render(<MaterialDashboard project={project} />);
    expect(screen.getByText('Steel Beams')).toBeTruthy();
    expect(screen.getByText('Concrete')).toBeTruthy();
  });

  it('shows classification badges', () => {
    const project = createProject({
      materials: [
        createMaterial({ id: 'm1', classification: 'capex' }),
        createMaterial({ id: 'm2', classification: 'opex' }),
        createMaterial({ id: 'm3', classification: 'consumable' }),
      ],
    });
    render(<MaterialDashboard project={project} />);
    expect(screen.getByText('CAPEX')).toBeTruthy();
    expect(screen.getByText('OPEX')).toBeTruthy();
    expect(screen.getByText('CONSUMABLE')).toBeTruthy();
  });

  it('filters by classification', () => {
    const project = createProject({
      materials: [
        createMaterial({ id: 'm1', name: 'Excavator', classification: 'capex' }),
        createMaterial({ id: 'm2', name: 'Fuel', classification: 'consumable' }),
      ],
    });
    render(<MaterialDashboard project={project} />);

    // Click CapEx filter
    fireEvent.click(screen.getByText('capex'));
    expect(screen.getByText('Excavator')).toBeTruthy();
    expect(screen.queryByText('Fuel')).toBeNull();
  });

  it('shows KPI summary cards', () => {
    const project = createProject({
      materials: [
        createMaterial({
          id: 'm1',
          classification: 'capex',
          unitCost: 10000,
          quantity: 1,
          acquisitionDate: '2026-01-01',
        }),
      ],
    });
    render(<MaterialDashboard project={project} />);
    // KPI cards should show values
    expect(screen.getByText('CapEx')).toBeTruthy();
    expect(screen.getByText('OpEx')).toBeTruthy();
    expect(screen.getByText('Consumables')).toBeTruthy();
    expect(screen.getByText('Carrying')).toBeTruthy();
  });

  it('calls onAddMaterial when add button clicked', () => {
    const onAddMaterial = jest.fn();
    const project = createProject({ materials: [] });
    render(<MaterialDashboard project={project} onAddMaterial={onAddMaterial} />);

    fireEvent.click(screen.getByText('+ Add Material'));
    expect(onAddMaterial).toHaveBeenCalled();
  });

  it('calls onEditMaterial when edit clicked', () => {
    const onEditMaterial = jest.fn();
    const project = createProject({
      materials: [createMaterial({ id: 'm1', name: 'Test' })],
    });
    render(<MaterialDashboard project={project} onEditMaterial={onEditMaterial} />);

    fireEvent.click(screen.getByText('Edit'));
    expect(onEditMaterial).toHaveBeenCalledWith('m1');
  });

  it('shows item count', () => {
    const project = createProject({
      materials: [
        createMaterial({ id: 'm1' }),
        createMaterial({ id: 'm2' }),
        createMaterial({ id: 'm3' }),
      ],
    });
    render(<MaterialDashboard project={project} />);
    expect(screen.getByText('3 items')).toBeTruthy();
  });
});
