// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionalFormatModal } from './ConditionalFormatModal';
import type { ConditionalFormatRule } from '../types';

function createCFRule(overrides: Partial<ConditionalFormatRule> = {}): ConditionalFormatRule {
  return {
    id: 'cf-1',
    priority: 0,
    type: 'cellValue',
    operator: 'gt',
    value1: 100,
    format: { backgroundColor: '#FFEB9C', color: '#9C5700' },
    ...overrides,
  };
}

describe('ConditionalFormatModal', () => {
  it('renders without crashing', () => {
    render(
      <ConditionalFormatModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Conditional Formatting')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConditionalFormatModal
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
      <ConditionalFormatModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/No conditional formatting rules/)).toBeTruthy();
  });

  it('shows existing rules', () => {
    const rules = [createCFRule({ id: 'cf-1' })];
    render(
      <ConditionalFormatModal
        isOpen={true}
        onClose={jest.fn()}
        rules={rules}
        onRulesChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Cell Value')).toBeTruthy();
  });

  it('opens rule editor when Add Rule is clicked', () => {
    render(
      <ConditionalFormatModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    expect(screen.getByText('Rule Type')).toBeTruthy();
  });

  it('calls onRulesChange when a rule is saved', () => {
    const onRulesChange = jest.fn();
    render(
      <ConditionalFormatModal
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
    const rules = [createCFRule({ id: 'cf-1' })];
    render(
      <ConditionalFormatModal
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
      <ConditionalFormatModal
        isOpen={true}
        onClose={onClose}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('changes rule type when selected', () => {
    render(
      <ConditionalFormatModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    fireEvent.change(screen.getByDisplayValue('Cell Value'), {
      target: { value: 'colorScale' },
    });
    expect(screen.getByText('Color Scale')).toBeTruthy();
  });

  it('shows formula input for formula type', () => {
    render(
      <ConditionalFormatModal
        isOpen={true}
        onClose={jest.fn()}
        rules={[]}
        onRulesChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Rule'));
    fireEvent.change(screen.getByDisplayValue('Cell Value'), {
      target: { value: 'formula' },
    });
    expect(screen.getByPlaceholderText('=value>100')).toBeTruthy();
  });
});
