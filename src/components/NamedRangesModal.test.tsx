// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NamedRangesModal } from './NamedRangesModal';
import type { NamedRange, Sheet } from '../types';

function createSheet(id: string, name: string): Sheet {
  return {
    id,
    name,
    cells: {},
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

function createNamedRange(overrides: Partial<NamedRange> = {}): NamedRange {
  return {
    id: 'nr-1',
    name: 'SalesData',
    reference: 'Sheet1!$A$1:$D$10',
    scope: 'workbook',
    ...overrides,
  };
}

const sheets = [createSheet('sheet-1', 'Sheet1'), createSheet('sheet-2', 'Sheet2')];

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    onClose: jest.fn(),
    namedRanges: [],
    onNamedRangesChange: jest.fn(),
    sheets,
    activeSheetId: 'sheet-1',
    isRangePickerActive: false,
    onToggleRangePicker: jest.fn(),
    ...overrides,
  };
}

describe('NamedRangesModal', () => {
  it('renders without crashing', () => {
    render(<NamedRangesModal {...baseProps()} />);
    expect(screen.getByText('Named Ranges')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<NamedRangesModal {...baseProps({ isOpen: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows empty state when no named ranges', () => {
    render(<NamedRangesModal {...baseProps()} />);
    expect(screen.getByText(/No named ranges defined/)).toBeTruthy();
  });

  it('opens the add form when "+ Add Named Range" is clicked', () => {
    render(<NamedRangesModal {...baseProps()} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    expect(screen.getByTestId('named-range-name-input')).toBeTruthy();
    expect(screen.getByTestId('named-range-reference-input')).toBeTruthy();
  });

  it('adds a new named range', () => {
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ onNamedRangesChange })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'TaxRate' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$B$5' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onNamedRangesChange).toHaveBeenCalledTimes(1);
    const ranges = onNamedRangesChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('TaxRate');
    expect(ranges[0].reference).toBe('$B$5');
  });

  it('validates empty name', () => {
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ onNamedRangesChange })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$A$1' },
    });
    // Leave name empty.
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onNamedRangesChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Name cannot be empty/)).toBeTruthy();
  });

  it('validates duplicate name', () => {
    const existing = [createNamedRange({ name: 'SalesData' })];
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ namedRanges: existing, onNamedRangesChange })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'SalesData' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$A$1' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onNamedRangesChange).not.toHaveBeenCalled();
    expect(screen.getByText(/already in use/)).toBeTruthy();
  });

  it('validates invalid reference', () => {
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ onNamedRangesChange })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: 'not a ref' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onNamedRangesChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid reference/)).toBeTruthy();
  });

  it('rejects cell-reference-like names (A1)', () => {
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ onNamedRangesChange })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'A1' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$B$1' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onNamedRangesChange).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be a cell reference/)).toBeTruthy();
  });

  it('edits an existing named range', () => {
    const existing = [createNamedRange({ id: 'nr-1', name: 'OldName', reference: '$A$1' })];
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ namedRanges: existing, onNamedRangesChange })} />);
    // Click Edit on the existing range.
    fireEvent.click(screen.getByLabelText('Edit OldName'));
    // Name field should be pre-filled.
    const nameInput = screen.getByTestId('named-range-name-input');
    expect(nameInput.getAttribute('value')).toBe('OldName');
    // Change the name.
    fireEvent.change(nameInput, { target: { value: 'NewName' } });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onNamedRangesChange).toHaveBeenCalledTimes(1);
    const ranges = onNamedRangesChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('NewName');
    // ID should be preserved.
    expect(ranges[0].id).toBe('nr-1');
  });

  it('deletes a named range from the list', () => {
    const existing = [
      createNamedRange({ id: 'nr-1', name: 'First' }),
      createNamedRange({ id: 'nr-2', name: 'Second', reference: '$B$1' }),
    ];
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ namedRanges: existing, onNamedRangesChange })} />);
    fireEvent.click(screen.getByLabelText('Delete First'));

    expect(onNamedRangesChange).toHaveBeenCalledTimes(1);
    const ranges = onNamedRangesChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('Second');
  });

  it('closes the modal via the close button', () => {
    const onClose = jest.fn();
    render(<NamedRangesModal {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays scope label for sheet-scoped names', () => {
    const existing = [
      createNamedRange({ name: 'Local', scope: 'sheet', sheetId: 'sheet-1', reference: '$A$1' }),
    ];
    render(<NamedRangesModal {...baseProps({ namedRanges: existing })} />);
    expect(screen.getByText('Sheet: Sheet1')).toBeTruthy();
  });

  // ─── Range picker ─────────────────────────────────────────────────

  it('shows a Pick Range button next to the reference input', () => {
    render(<NamedRangesModal {...baseProps()} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    expect(screen.getByTestId('named-range-pick-range')).toBeTruthy();
  });

  it('calls onToggleRangePicker when Pick Range is clicked', () => {
    const onToggleRangePicker = jest.fn();
    render(<NamedRangesModal {...baseProps({ onToggleRangePicker })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.click(screen.getByTestId('named-range-pick-range'));
    expect(onToggleRangePicker).toHaveBeenCalledTimes(1);
  });

  it('shows a minimized banner when isRangePickerActive is true', () => {
    render(<NamedRangesModal {...baseProps({ isRangePickerActive: true })} />);
    expect(screen.getByText(/Select a range on the grid for the named range/)).toBeTruthy();
    // The full modal content should NOT be visible.
    expect(screen.queryByText('+ Add Named Range')).toBeNull();
  });

  it('updates reference when a range is selected via custom event', () => {
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ onNamedRangesChange })} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    // Simulate the grid dispatching a range selection. Wrap in act() so the
    // state update from the native event listener is flushed.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('simplesheets:namedRangeSelected', { detail: { range: 'B2:D5' } }),
      );
    });
    const refInput = screen.getByTestId('named-range-reference-input');
    expect(refInput.getAttribute('value')).toBe('B2:D5');
  });

  it('cancels range picker via the banner close button', () => {
    const onToggleRangePicker = jest.fn();
    render(<NamedRangesModal {...baseProps({ isRangePickerActive: true, onToggleRangePicker })} />);
    fireEvent.click(screen.getByLabelText('Cancel range selection'));
    expect(onToggleRangePicker).toHaveBeenCalledTimes(1);
  });

  // ─── Delete in edit form ──────────────────────────────────────────

  it('shows a Delete button in the edit form for existing ranges', () => {
    const existing = [createNamedRange({ id: 'nr-1', name: 'SalesData', reference: '$A$1' })];
    render(<NamedRangesModal {...baseProps({ namedRanges: existing })} />);
    fireEvent.click(screen.getByLabelText('Edit SalesData'));
    expect(screen.getByTestId('named-range-delete')).toBeTruthy();
  });

  it('does not show a Delete button when adding a new range', () => {
    render(<NamedRangesModal {...baseProps()} />);
    fireEvent.click(screen.getByText('+ Add Named Range'));
    expect(screen.queryByTestId('named-range-delete')).toBeNull();
  });

  it('deletes the range from the edit form', () => {
    const existing = [
      createNamedRange({ id: 'nr-1', name: 'First' }),
      createNamedRange({ id: 'nr-2', name: 'Second', reference: '$B$1' }),
    ];
    const onNamedRangesChange = jest.fn();
    render(<NamedRangesModal {...baseProps({ namedRanges: existing, onNamedRangesChange })} />);
    fireEvent.click(screen.getByLabelText('Edit First'));
    fireEvent.click(screen.getByTestId('named-range-delete'));

    expect(onNamedRangesChange).toHaveBeenCalledTimes(1);
    const ranges = onNamedRangesChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('Second');
  });
});
