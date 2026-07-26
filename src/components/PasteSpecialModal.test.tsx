import { render, screen, fireEvent } from '@testing-library/react';
import { PasteSpecialModal } from './PasteSpecialModal';

describe('PasteSpecialModal', () => {
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

  it('does not render when isOpen is false', () => {
    render(<PasteSpecialModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Paste Special')).not.toBeInTheDocument();
  });

  it('renders the modal with title when open', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    expect(screen.getByText('Paste Special')).toBeInTheDocument();
  });

  it('shows skip blanks checkbox', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    expect(screen.getByText('Skip blanks')).toBeInTheDocument();
  });

  it('shows description for skip blanks', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    expect(screen.getByText('Prevent empty cells from overwriting existing data')).toBeInTheDocument();
  });

  it('checkbox reflects skipBlanks prop', () => {
    render(<PasteSpecialModal {...defaultProps} skipBlanks={true} />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('calls onSkipBlanksChange when checkbox is toggled', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(defaultProps.onSkipBlanksChange).toHaveBeenCalledWith(true);
  });

  it('calls onApply with options when Paste is clicked', () => {
    render(<PasteSpecialModal {...defaultProps} skipBlanks={true} />);
    fireEvent.click(screen.getByText('Paste'));
    expect(defaultProps.onApply).toHaveBeenCalledWith({ skipBlanks: true });
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    fireEvent.click(document.querySelector('.bg-black\\/30')!);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    render(<PasteSpecialModal {...defaultProps} />);
    const dialog = document.querySelector('[role="dialog"]')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
