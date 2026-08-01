// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { FilenameModal } from './FilenameModal';

describe('FilenameModal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Save Workbook',
    defaultName: 'MyWorkbook',
    extension: 'json',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<FilenameModal {...defaultProps} />);
    expect(screen.getByText('Save Workbook')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MyWorkbook')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<FilenameModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the file extension', () => {
    render(<FilenameModal {...defaultProps} />);
    expect(screen.getByText('.json')).toBeInTheDocument();
  });

  it('calls onConfirm with filename when Save is clicked', () => {
    render(<FilenameModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('MyWorkbook');
  });

  it('calls onCancel when Cancel is clicked', () => {
    render(<FilenameModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    render(<FilenameModal {...defaultProps} />);
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', () => {
    render(<FilenameModal {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('updates filename when typing', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: 'NewName' } });
    expect(screen.getByDisplayValue('NewName')).toBeInTheDocument();
  });

  it('shows error for empty filename', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Filename is required')).toBeInTheDocument();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('shows error for invalid characters', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: 'file<name>' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText(/Filename contains invalid characters/)).toBeInTheDocument();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('shows error for reserved system filename', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: 'CON' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText(/reserved system filename/i)).toBeInTheDocument();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('trims whitespace from filename', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: '  MyFile  ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('MyFile');
  });

  it('clears error when user starts typing', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Filename is required')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.queryByText('Filename is required')).not.toBeInTheDocument();
  });

  it('shows error for filename starting with a period', () => {
    render(<FilenameModal {...defaultProps} />);
    const input = screen.getByDisplayValue('MyWorkbook');
    fireEvent.change(input, { target: { value: '.hidden' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText(/cannot start\/end with a period/)).toBeInTheDocument();
  });
});
