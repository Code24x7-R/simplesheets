// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialEditorModal } from './MaterialEditorModal';
import type { Material } from '../types';

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

describe('MaterialEditorModal', () => {
  it('renders in create mode', () => {
    render(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    // Header shows "Add Material" (footer button also has this text)
    expect(screen.getAllByText('Add Material').length).toBeGreaterThan(0);
    expect(screen.getByTestId('material-editor-modal')).toBeTruthy();
  });

  it('renders in edit mode', () => {
    const material = createMaterial({ name: 'Excavator' });
    render(
      <MaterialEditorModal
        material={material}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByText('Edit Material')).toBeTruthy();
    expect(screen.getByDisplayValue('Excavator')).toBeTruthy();
  });

  it('shows validation error for empty name', () => {
    render(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    // Click the save button in the footer (last button with "Add Material")
    const buttons = screen.getAllByText('Add Material');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('Material name is required')).toBeTruthy();
  });

  it('calls onSave with form data', () => {
    const onSave = jest.fn();
    render(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={onSave}
      />,
    );

    const nameInput = screen.getByPlaceholderText('e.g., Excavator, Steel Beams, Fuel');
    fireEvent.change(nameInput, { target: { value: 'Steel Beams' } });

    // Click the save button in the footer (last button with "Add Material")
    const buttons = screen.getAllByText('Add Material');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onSave).toHaveBeenCalled();
    const savedMaterial = onSave.mock.calls[0][0] as import('../types').Material;
    expect(savedMaterial.name).toBe('Steel Beams');
  });

  it('shows CapEx fields when classification is CapEx', () => {
    render(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    // Click CapEx classification
    fireEvent.click(screen.getByText('CapEx'));
    expect(screen.getByText('CapEx Settings')).toBeTruthy();
    expect(screen.getByText('Depreciation Method')).toBeTruthy();
  });

  it('shows OpEx fields when classification is OpEx', () => {
    render(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    // Click OpEx classification
    fireEvent.click(screen.getByText('OpEx'));
    expect(screen.getByText('OpEx Settings')).toBeTruthy();
    expect(screen.getByText('Billing Period')).toBeTruthy();
  });

  it('shows Consumable fields when classification is Consumable', () => {
    render(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    // Click Consumable classification
    fireEvent.click(screen.getByText('Consumable'));
    expect(screen.getByText('Consumable Settings')).toBeTruthy();
    expect(screen.getByText('Wastage Rate (%)')).toBeTruthy();
  });

  it('shows total cost calculation', () => {
    const material = createMaterial({ unitCost: 500, quantity: 10 });
    render(
      <MaterialEditorModal
        material={material}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByText('$5,000.00')).toBeTruthy();
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    const material = createMaterial({ id: 'mat-1' });
    render(
      <MaterialEditorModal
        material={material}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('Delete Material'));
    expect(onDelete).toHaveBeenCalledWith('mat-1');
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = jest.fn();
    render(
      <MaterialEditorModal
        material={null}
        onClose={onClose}
        onSave={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows delete button only in edit mode', () => {
    const onDelete = jest.fn();
    const material = createMaterial({ id: 'mat-1', name: 'Test' });

    // In edit mode, delete button should be visible
    const { rerender } = render(
      <MaterialEditorModal
        material={material}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Delete Material')).toBeTruthy();

    // In create mode, delete button should not be visible
    rerender(
      <MaterialEditorModal
        material={null}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByText('Delete Material')).toBeNull();
  });
});
