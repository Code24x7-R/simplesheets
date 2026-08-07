// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { SortDialog } from './SortDialog';

describe('SortDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    columnCount: 5, // A through E
    defaultColumn: 1, // B
    defaultDirection: 'asc' as const,
    defaultHasHeader: false,
    rowCount: 10,
    onApply: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(<SortDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Sort Range')).not.toBeInTheDocument();
  });

  it('renders the dialog with header and info', () => {
    render(<SortDialog {...defaultProps} />);
    expect(screen.getByText('Sort Range')).toBeInTheDocument();
    expect(screen.getByText('Sorting 10 rows. Add criteria below in priority order.')).toBeInTheDocument();
  });

  it('shows the has header row checkbox (unchecked by default)', () => {
    render(<SortDialog {...defaultProps} />);
    const checkbox = screen.getByLabelText('Data has header row') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it('pre-checks header when defaultHasHeader is true', () => {
    render(<SortDialog {...defaultProps} defaultHasHeader={true} />);
    const checkbox = screen.getByLabelText('Data has header row') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('pre-fills the first level with the default column and direction', () => {
    render(<SortDialog {...defaultProps} defaultColumn={2} defaultDirection={'desc'} />);
    // The column dropdown should show C (index 2)
    const selects = screen.getAllByLabelText('Sort column 1') as HTMLSelectElement[];
    expect(selects[0].value).toBe('2');
  });

  it('adds a new sort level when clicking "Add another sort column"', () => {
    render(<SortDialog {...defaultProps} />);
    expect(screen.queryByText('Then by')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Add another sort column'));
    expect(screen.getByText('Then by')).toBeInTheDocument();
    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });

  it('removes a sort level when clicking the remove button', () => {
    render(<SortDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Add another sort column'));
    // Now there should be two levels, second one has a remove button
    const removeButtons = screen.getAllByLabelText('Remove sort level');
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[1]);
    // Back to one level
    expect(screen.queryByLabelText('Sort column 2')).not.toBeInTheDocument();
  });

  it('does not show remove button when only one level exists', () => {
    render(<SortDialog {...defaultProps} />);
    expect(screen.queryByLabelText('Remove sort level')).not.toBeInTheDocument();
  });

  it('calls onApply with single column asc when Sort is clicked', () => {
    render(<SortDialog {...defaultProps} defaultColumn={0} defaultDirection={'asc'} />);
    fireEvent.click(screen.getByText('Sort'));
    expect(defaultProps.onApply).toHaveBeenCalledWith([{ column: 0, direction: 'asc' }], false);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onApply with header=true when checkbox is checked', () => {
    render(<SortDialog {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Data has header row'));
    fireEvent.click(screen.getByText('Sort'));
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      [{ column: 1, direction: 'asc' }],
      true
    );
  });

  it('calls onApply with multiple sort levels', () => {
    render(<SortDialog {...defaultProps} defaultColumn={0} />);
    fireEvent.click(screen.getByText('+ Add another sort column'));
    // Change second level to column D (index 3), descending
    const secondSelect = screen.getByLabelText('Sort column 2') as HTMLSelectElement;
    fireEvent.change(secondSelect, { target: { value: '3' } });
    // Toggle second level to descending
    const descButtons = screen.getAllByLabelText('Sort descending');
    fireEvent.click(descButtons[1]);

    fireEvent.click(screen.getByText('Sort'));
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      [
        { column: 0, direction: 'asc' },
        { column: 3, direction: 'desc' },
      ],
      false
    );
  });

  it('calls onClose when Cancel is clicked (without applying)', () => {
    render(<SortDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking the X button', () => {
    render(<SortDialog {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    render(<SortDialog {...defaultProps} />);
    fireEvent.keyDown(screen.getByText('Sort Range').closest('div')!, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onApply on Enter key', () => {
    render(<SortDialog {...defaultProps} />);
    fireEvent.keyDown(screen.getByText('Sort Range').closest('div')!, { key: 'Enter' });
    expect(defaultProps.onApply).toHaveBeenCalled();
  });

  it('changes direction when clicking A→Z or Z→A buttons', () => {
    render(<SortDialog {...defaultProps} defaultColumn={0} defaultDirection={'asc'} />);
    // Currently asc, click Z→A
    const descButton = screen.getByLabelText('Sort descending');
    fireEvent.click(descButton);
    fireEvent.click(screen.getByText('Sort'));
    expect(defaultProps.onApply).toHaveBeenCalledWith([{ column: 0, direction: 'desc' }], false);
  });
});
