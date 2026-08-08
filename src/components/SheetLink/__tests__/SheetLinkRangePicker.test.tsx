// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLinkRangePicker.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { SheetLinkRangePicker } from '../SheetLinkRangePicker';
import type { Workbook } from '../../../types';

// Helper to find the confirm button (avoids ambiguity with dialog title)
function getConfirmButton(): HTMLElement {
  const matches = screen.getAllByText('Select Range');
  const btn = matches.find(el => el.tagName === 'BUTTON');
  if (!btn) throw new Error('Confirm button not found');
  return btn;
}

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestWorkbook(): Workbook {
  return {
    id: 'test-wb',
    title: 'Test',
    sheets: [
      {
        id: 's1',
        name: 'Sheet1',
        cells: {
          '0:0': { rawValue: 'Name', computedValue: 'Name' },
          '0:1': { rawValue: 'Q1', computedValue: 'Q1' },
          '1:0': { rawValue: 'Item 1', computedValue: 'Item 1' },
          '1:1': { rawValue: '100', computedValue: 100 },
        },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
      {
        id: 's2',
        name: 'Data',
        cells: {},
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

describe('SheetLinkRangePicker', () => {
  const defaultProps = {
    isOpen: true,
    prompt: 'Select data for the table',
    workbook: createTestWorkbook(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SheetLinkRangePicker {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);
    // Use getAllByText since both title and button contain 'Select Range'
    expect(screen.getAllByText('Select Range').length).toBeGreaterThanOrEqual(1);
  });

  it('displays the prompt text', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);
    expect(screen.getByText('Select data for the table')).toBeInTheDocument();
  });

  it('displays available sheet names as clickable buttons', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('inserts sheet name with ! when sheet button is clicked', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);
    fireEvent.click(screen.getByText('Sheet1'));

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10') as HTMLInputElement;
    expect(input.value).toBe('Sheet1!');
  });

  it('calls onConfirm with normalized range when confirmed', () => {
    const onConfirm = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.change(input, { target: { value: 'A1:B2' } });
    fireEvent.click(getConfirmButton());

    expect(onConfirm).toHaveBeenCalledWith('A1:B2');
  });

  it('normalizes range input (handles reversed coordinates)', () => {
    const onConfirm = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.change(input, { target: { value: 'B2:A1' } });
    fireEvent.click(getConfirmButton());

    expect(onConfirm).toHaveBeenCalledWith('A1:B2');
  });

  it('shows error for invalid range', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.change(input, { target: { value: '!!!invalid' } });

    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });

  it('shows error for non-existent sheet', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.change(input, { target: { value: 'NonExistent!A1' } });

    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('disables confirm button when input is empty', () => {
    render(<SheetLinkRangePicker {...defaultProps} />);
    const confirmBtn = getConfirmButton();
    expect(confirmBtn).toBeDisabled();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button is clicked', () => {
    const onCancel = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm on Enter key', () => {
    const onConfirm = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.change(input, { target: { value: 'A1:B2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onConfirm).toHaveBeenCalledWith('A1:B2');
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onCancel={onCancel} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows error when confirming with invalid range', () => {
    const onConfirm = jest.fn();
    render(<SheetLinkRangePicker {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByPlaceholderText('e.g., Sheet1!A1:D10');
    fireEvent.change(input, { target: { value: 'invalid' } });
    // Target the button specifically (not the dialog title)
    const buttons = screen.getAllByText('Select Range');
    const confirmBtn = buttons.find(el => el.tagName === 'BUTTON');
    fireEvent.click(confirmBtn!);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });
});
