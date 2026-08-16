// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialAllocationModal } from './MaterialAllocationModal';
import type { Material, MaterialAllocation, MaterialConsumption, WBSTask } from '../types';

const mockMaterial: Material = {
  id: 'mat-1',
  name: 'Steel Beams',
  description: 'Construction steel',
  classification: 'consumable',
  unit: 'each',
  unitCost: 500,
  quantity: 100,
  currency: 'USD',
  vendor: 'Steel Corp',
  depreciationMethod: 'none',
  usefulLifeMonths: 0,
  salvageValue: 0,
  acquisitionDate: null,
  billingPeriod: 'fixed',
  rentalRate: 0,
  leaseStartDate: null,
  leaseEndDate: null,
  wastageRate: 5,
  reorderPoint: 10,
  carryingCostPerUnit: 2,
  allocatedQuantity: 20,
  consumedQuantity: 10,
  status: 'delivered',
};

const mockTasks: WBSTask[] = [
  {
    id: 'task-1',
    name: 'Foundation',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    duration: 10,
    progress: 50,
    effort: 80,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82F6',
    riskIds: [],
    customFields: {},
  },
  {
    id: 'task-2',
    name: 'Framing',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2025-01-16',
    endDate: '2025-02-15',
    duration: 20,
    progress: 0,
    effort: 160,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#10B981',
    riskIds: [],
    customFields: {},
  },
];

const mockAllocations: MaterialAllocation[] = [];
const mockConsumptions: MaterialConsumption[] = [];

describe('MaterialAllocationModal', () => {
  const defaultProps = {
    material: mockMaterial,
    tasks: mockTasks,
    allocations: mockAllocations,
    consumptions: mockConsumptions,
    onClose: jest.fn(),
    onAllocate: jest.fn(),
    onRecordConsumption: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with material name', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    expect(screen.getByText('Steel Beams')).toBeInTheDocument();
  });

  it('shows material classification', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    expect(screen.getByText(/CONSUMABLE/)).toBeInTheDocument();
  });

  it('shows summary stats', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    expect(screen.getByText('Allocated')).toBeInTheDocument();
    expect(screen.getByText('Consumed')).toBeInTheDocument();
    expect(screen.getByText('Wastage')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('shows allocate tab by default', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    expect(screen.getByText('Allocate to Task')).toBeInTheDocument();
  });

  it('switches to consume tab', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Record Consumption'));
    expect(screen.getByLabelText(/used/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wastage/i)).toBeInTheDocument();
  });

  it('calls onClose when X is clicked', () => {
    const onClose = jest.fn();
    render(<MaterialAllocationModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables allocate button when no task selected', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    // The action button (not the tab) has disabled attribute
    const buttons = screen.getAllByRole('button', { name: /allocate/i });
    const allocateButton = buttons.find((b) => b.hasAttribute('disabled'));
    expect(allocateButton).toBeDefined();
    expect(allocateButton).toBeDisabled();
  });

  it('disables consume button when no task selected', () => {
    render(<MaterialAllocationModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Record Consumption'));
    // The action button (not the tab) has disabled attribute
    const buttons = screen.getAllByRole('button', { name: /record consumption/i });
    const consumeButton = buttons.find((b) => b.hasAttribute('disabled'));
    expect(consumeButton).toBeDefined();
    expect(consumeButton).toBeDisabled();
  });

  it('calls onAllocate with correct data', () => {
    const onAllocate = jest.fn();
    render(<MaterialAllocationModal {...defaultProps} onAllocate={onAllocate} />);

    fireEvent.change(screen.getByLabelText(/task/i), { target: { value: 'task-1' } });
    const qtyInput = screen.getByLabelText(/qty/i);
    fireEvent.change(qtyInput, { target: { value: '10' } });
    fireEvent.blur(qtyInput);

    // Find the action button (not the tab)
    const buttons = screen.getAllByRole('button', { name: /allocate/i });
    const allocateButton = buttons.find((b) => b.classList.contains('bg-blue-600'));
    fireEvent.click(allocateButton!);

    expect(onAllocate).toHaveBeenCalledWith(
      expect.objectContaining({
        materialId: 'mat-1',
        taskId: 'task-1',
        allocatedQuantity: 10,
      }),
    );
  });

  it('calls onRecordConsumption with correct data', () => {
    const onRecordConsumption = jest.fn();
    render(<MaterialAllocationModal {...defaultProps} onRecordConsumption={onRecordConsumption} />);

    fireEvent.click(screen.getByText('Record Consumption'));

    const taskSelect = screen.getByLabelText(/task/i);
    fireEvent.change(taskSelect, { target: { value: 'task-2' } });

    const usedInput = screen.getByLabelText(/used/i);
    fireEvent.change(usedInput, { target: { value: '5' } });
    fireEvent.blur(usedInput);

    // Find the action button (not the tab)
    const buttons = screen.getAllByRole('button', { name: /record consumption/i });
    const consumeButton = buttons.find((b) => b.classList.contains('bg-green-600'));
    fireEvent.click(consumeButton!);

    expect(onRecordConsumption).toHaveBeenCalledWith(
      expect.objectContaining({
        materialId: 'mat-1',
        taskId: 'task-2',
        quantity: 5,
      }),
    );
  });

  it('shows allocation history when allocations exist', () => {
    const allocations: MaterialAllocation[] = [
      {
        id: 'alloc-1',
        materialId: 'mat-1',
        taskId: 'task-1',
        allocatedQuantity: 10,
        consumedQuantity: 0,
        allocationDate: '2025-01-01',
        expectedReturnDate: null,
        actualCost: 5000,
        notes: '',
      },
    ];
    render(<MaterialAllocationModal {...defaultProps} allocations={allocations} />);
    expect(screen.getByText('Allocation History')).toBeInTheDocument();
    expect(screen.getByText('10 each')).toBeInTheDocument();
  });

  it('shows consumption history when consumptions exist', () => {
    const consumptions: MaterialConsumption[] = [
      {
        id: 'cons-1',
        materialId: 'mat-1',
        taskId: 'task-1',
        date: '2025-01-05',
        quantity: 5,
        wastageQuantity: 1,
        unitCostAtConsumption: 500,
        notes: '',
      },
    ];
    render(<MaterialAllocationModal {...defaultProps} consumptions={consumptions} />);
    fireEvent.click(screen.getByText('Record Consumption'));
    expect(screen.getByText('Consumption History')).toBeInTheDocument();
    expect(screen.getByText('5 each')).toBeInTheDocument();
  });
});
