// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataValidationModal } from './DataValidationModal';
import type { DataValidationRule } from '../types';

function createDVRule(overrides: Partial<DataValidationRule> = {}): DataValidationRule {
  return {
    id: 'dv-1',
    type: 'whole',
    operator: 'gte',
    value1: 0,
    allowBlank: true,
    enabled: true,
    errorAlert: {
      style: 'stop',
      title: 'Invalid Entry',
      message: 'Please enter a valid value.',
    },
    ...overrides,
  };
}

describe('DataValidationModal', () => {
  it('renders without crashing', () => {
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Data Validation')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DataValidationModal
        isOpen={false}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows empty state when no rules', () => {
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/No data validation rules/)).toBeTruthy();
  });

  it('shows existing rules', () => {
    const rules = [createDVRule({ id: 'dv-1' })];
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={rules}
        onRulesChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Whole Number')).toBeTruthy();
  });

  it('opens rule editor when Add Rule is clicked', () => {
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    expect(screen.getByText('Validation Type')).toBeTruthy();
  });

  it('calls onRulesChange when a rule is saved', () => {
    const onRulesChange = jest.fn();
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={onRulesChange}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    fireEvent.click(screen.getByText('Save Rule'));
    expect(onRulesChange).toHaveBeenCalled();
  });

  it('calls onRulesChange when a rule is deleted', () => {
    const onRulesChange = jest.fn();
    const rules = [createDVRule({ id: 'dv-1' })];
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={rules}
        onRulesChange={onRulesChange}
      />,
    );
    // Click the delete button (trash icon)
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(onRulesChange).toHaveBeenCalledWith([]);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <DataValidationModal
        isOpen={true}
        onClose={onClose}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles rule enabled state', () => {
    const onRulesChange = jest.fn();
    const rules = [createDVRule({ id: 'dv-1', enabled: true })];
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={rules}
        onRulesChange={onRulesChange}
      />,
    );
    // Click the toggle checkbox
    const toggle = screen.getByTitle('Disable rule');
    fireEvent.click(toggle);
    expect(onRulesChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ enabled: false })]),
    );
  });

  it('changes validation type when selected', () => {
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    fireEvent.change(screen.getByDisplayValue('Whole Number'), {
      target: { value: 'list' },
    });
    expect(screen.getByText('List Source')).toBeTruthy();
  });

  it('shows list source input for list type', () => {
    render(
      <DataValidationModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    fireEvent.change(screen.getByDisplayValue('Whole Number'), {
      target: { value: 'list' },
    });
    expect(screen.getByText('Show dropdown in cell')).toBeTruthy();
  });
});
