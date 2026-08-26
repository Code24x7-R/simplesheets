// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('NamedRangesModal', () => {
  it('renders without crashing', () => {
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={jest.fn()}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    expect(screen.getByText('Named Ranges')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <NamedRangesModal
        isOpen={false}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={jest.fn()}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows empty state when no named ranges', () => {
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={jest.fn()}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    expect(screen.getByText(/No named ranges defined/)).toBeTruthy();
  });

  it('opens the add form when "+ Add Named Range" is clicked', () => {
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={jest.fn()}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Named Range'));
    expect(screen.getByTestId('named-range-name-input')).toBeTruthy();
    expect(screen.getByTestId('named-range-reference-input')).toBeTruthy();
  });

  it('adds a new named range', () => {
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'TaxRate' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$B$5' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const ranges = onChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('TaxRate');
    expect(ranges[0].reference).toBe('$B$5');
  });

  it('validates empty name', () => {
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$A$1' },
    });
    // Leave name empty.
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Name cannot be empty/)).toBeTruthy();
  });

  it('validates duplicate name', () => {
    const existing = [createNamedRange({ name: 'SalesData' })];
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={existing}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'SalesData' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$A$1' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/already in use/)).toBeTruthy();
  });

  it('validates invalid reference', () => {
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: 'not a ref' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid reference/)).toBeTruthy();
  });

  it('rejects cell-reference-like names (A1)', () => {
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={[]}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Named Range'));
    fireEvent.change(screen.getByTestId('named-range-name-input'), {
      target: { value: 'A1' },
    });
    fireEvent.change(screen.getByTestId('named-range-reference-input'), {
      target: { value: '$B$1' },
    });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be a cell reference/)).toBeTruthy();
  });

  it('edits an existing named range', () => {
    const existing = [createNamedRange({ id: 'nr-1', name: 'OldName', reference: '$A$1' })];
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={existing}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    // Click Edit on the existing range.
    fireEvent.click(screen.getByLabelText('Edit OldName'));
    // Name field should be pre-filled.
    const nameInput = screen.getByTestId('named-range-name-input');
    expect(nameInput.getAttribute('value')).toBe('OldName');
    // Change the name.
    fireEvent.change(nameInput, { target: { value: 'NewName' } });
    fireEvent.click(screen.getByTestId('named-range-save'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const ranges = onChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('NewName');
    // ID should be preserved.
    expect(ranges[0].id).toBe('nr-1');
  });

  it('deletes a named range', () => {
    const existing = [
      createNamedRange({ id: 'nr-1', name: 'First' }),
      createNamedRange({ id: 'nr-2', name: 'Second', reference: '$B$1' }),
    ];
    const onChange = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={existing}
        onNamedRangesChange={onChange}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete First'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const ranges = onChange.mock.calls[0][0] as NamedRange[];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].name).toBe('Second');
  });

  it('closes the modal via the close button', () => {
    const onClose = jest.fn();
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={onClose}
        namedRanges={[]}
        onNamedRangesChange={jest.fn()}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays scope label for sheet-scoped names', () => {
    const existing = [
      createNamedRange({ name: 'Local', scope: 'sheet', sheetId: 'sheet-1', reference: '$A$1' }),
    ];
    render(
      <NamedRangesModal
        isOpen={true}
        onClose={jest.fn()}
        namedRanges={existing}
        onNamedRangesChange={jest.fn()}
        sheets={sheets}
        activeSheetId="sheet-1"
      />,
    );
    expect(screen.getByText('Sheet: Sheet1')).toBeTruthy();
  });
});
