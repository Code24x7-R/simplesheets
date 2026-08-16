// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnRowSizeModal } from './ColumnRowSizeModal';

describe('ColumnRowSizeModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    currentCol: 2,
    currentRow: 3,
    defaultColWidth: 100,
    defaultRowHeight: 28,
    onApply: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(<ColumnRowSizeModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Column / Row Size')).not.toBeInTheDocument();
  });

  it('renders the modal title when open', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    expect(screen.getByText('Column / Row Size')).toBeInTheDocument();
  });

  it('opens in column mode by default', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    expect(screen.getByLabelText('Column Width (px)')).toBeInTheDocument();
  });

  it('opens in row mode when initialType is row', () => {
    render(<ColumnRowSizeModal {...defaultProps} initialType="row" />);
    expect(screen.getByLabelText('Row Height (px)')).toBeInTheDocument();
  });

  it('switches between column and row mode', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    expect(screen.getByLabelText('Column Width (px)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Row' }));
    expect(screen.getByLabelText('Row Height (px)')).toBeInTheDocument();
  });

  it('shows column preset buttons (50, 80, 100, 150, 200)', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    [50, 80, 100, 150, 200].forEach((val) => {
      expect(screen.getByRole('button', { name: String(val) })).toBeInTheDocument();
    });
  });

  it('shows row preset buttons (20, 28, 40, 60, 80) in row mode', () => {
    render(<ColumnRowSizeModal {...defaultProps} initialType="row" />);
    [20, 28, 40, 60, 80].forEach((val) => {
      expect(screen.getByRole('button', { name: String(val) })).toBeInTheDocument();
    });
  });

  it('preset button sets the size value', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '150' }));
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    expect(input.value).toBe('150');
  });

  it('number input changes the size value', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    expect(input.value).toBe('120');
  });

  it('toggles apply to all checkbox', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('calls onApply with column params when Apply is clicked (single column)', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    // Set a custom size
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(defaultProps.onApply).toHaveBeenCalledWith({
      type: 'col',
      size: 120,
      applyToAll: false,
      index: 2,
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onApply with row params when in row mode', () => {
    render(<ColumnRowSizeModal {...defaultProps} initialType="row" />);
    const input = screen.getByLabelText('Row Height (px)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(defaultProps.onApply).toHaveBeenCalledWith({
      type: 'row',
      size: 50,
      applyToAll: false,
      index: 3,
    });
  });

  it('calls onApply with applyToAll=true when checkbox is checked', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ applyToAll: true, type: 'col' })
    );
  });

  it('calls onClose without applying when Cancel is clicked', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('calls onClose when the X button is clicked', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('clamps size to minimum of 10', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ size: 10 })
    );
  });

  it('clamps size to maximum of 500', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ size: 500 })
    );
  });

  it('clicking outside the modal calls onClose', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    // The outer backdrop div
    fireEvent.click(document.querySelector('.bg-black\\/40')!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('pressing Enter triggers apply', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '130' } });
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ size: 130 })
    );
  });

  it('pressing Escape triggers close', () => {
    render(<ColumnRowSizeModal {...defaultProps} />);
    const input = screen.getByLabelText('Column Width (px)') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
