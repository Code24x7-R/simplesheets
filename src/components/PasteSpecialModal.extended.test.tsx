// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { PasteSpecialModal } from './PasteSpecialModal';

describe('PasteSpecialModal — Extended Options', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
    skipBlanks: false,
    onSkipBlanksChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getPasteButton(): HTMLElement {
    return screen.getByRole('button', { name: /^Paste$/i });
  }

  it('renders paste mode options when open', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    expect(screen.getByText('Paste Special')).toBeInTheDocument();
    expect(screen.getByText(/Everything/)).toBeInTheDocument();
    expect(screen.getByText(/Formulas/)).toBeInTheDocument();
    expect(screen.getByText(/Values/)).toBeInTheDocument();
    expect(screen.getByText(/Formatting/)).toBeInTheDocument();
  });

  it('defaults to "Everything" mode', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const everythingRadio = screen.getByLabelText(/Everything/) as HTMLInputElement;
    expect(everythingRadio.checked).toBe(true);
  });

  it('selects "Formulas" mode when clicked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Formulas/));
    const formulasRadio = screen.getByLabelText(/Formulas/) as HTMLInputElement;
    expect(formulasRadio.checked).toBe(true);
  });

  it('selects "Values" mode when clicked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Values/));
    const valuesRadio = screen.getByLabelText(/Values/) as HTMLInputElement;
    expect(valuesRadio.checked).toBe(true);
  });

  it('selects "Formatting" mode when clicked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Formatting/));
    const formattingRadio = screen.getByLabelText(/Formatting/) as HTMLInputElement;
    expect(formattingRadio.checked).toBe(true);
  });

  it('renders transpose checkbox', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    expect(screen.getByText(/Transpose/)).toBeInTheDocument();
  });

  it('transpose checkbox is unchecked by default', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const checkbox = screen.getByLabelText(/Transpose/) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('toggles transpose checkbox', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const checkbox = screen.getByLabelText(/Transpose/) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('calls onApply with "all" mode and no transpose when Paste clicked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(getPasteButton());
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'all', transpose: false })
    );
  });

  it('calls onApply with "formulas" mode when selected', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Formulas/));
    fireEvent.click(getPasteButton());
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'formulas' })
    );
  });

  it('calls onApply with "values" mode when selected', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Values/));
    fireEvent.click(getPasteButton());
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'values' })
    );
  });

  it('calls onApply with "formatting" mode when selected', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Formatting/));
    fireEvent.click(getPasteButton());
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'formatting' })
    );
  });

  it('calls onApply with transpose=true when transpose checked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const checkbox = screen.getByLabelText(/Transpose/);
    fireEvent.click(checkbox);
    fireEvent.click(getPasteButton());
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ transpose: true })
    );
  });

  it('calls onApply with both mode and transpose', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(/Values/));
    fireEvent.click(screen.getByLabelText(/Transpose/));
    fireEvent.click(getPasteButton());
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'values', transpose: true })
    );
  });

  it('does not render when isOpen is false', () => {
    render(<PasteSpecialModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Paste Special')).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const dialog = document.querySelector('[role="dialog"]')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
