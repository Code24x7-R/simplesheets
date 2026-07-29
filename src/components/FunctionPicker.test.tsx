import { render, screen, fireEvent } from '@testing-library/react';
import { FunctionPicker } from './FunctionPicker';

describe('FunctionPicker', () => {
  const defaultProps = {
    isOpen: true,
    onSelect: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<FunctionPicker {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Choose a Function')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(<FunctionPicker {...defaultProps} />);
    expect(screen.getByText('Choose a Function')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<FunctionPicker {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search functions/)).toBeInTheDocument();
  });

  it('renders function list grouped by category', () => {
    render(<FunctionPicker {...defaultProps} />);
    // Check for category headers (title case from formulaAutocomplete)
    expect(screen.getByText('Math')).toBeInTheDocument();
    // Check for some functions
    expect(screen.getByText('SUM')).toBeInTheDocument();
  });

  it('calls onSelect when a function is clicked', () => {
    render(<FunctionPicker {...defaultProps} />);
    fireEvent.click(screen.getByText('SUM'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith('SUM');
  });

  it('calls onClose when X button is clicked', () => {
    render(<FunctionPicker {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<FunctionPicker {...defaultProps} />);
    // Click on the backdrop (outer div)
    const backdrop = screen.getByRole('dialog')?.parentElement;
    if (backdrop) {
      fireEvent.click(backdrop, {
        target: backdrop,
        currentTarget: backdrop,
      });
    }
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('filters functions as user types', () => {
    render(<FunctionPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Search functions/);
    fireEvent.change(input, { target: { value: 'SUM' } });
    expect(screen.getByText('SUM')).toBeInTheDocument();
    // A non-matching function should not appear
    expect(screen.queryByText('VLOOKUP')).not.toBeInTheDocument();
  });

  it('shows "no results" message for non-matching search', () => {
    render(<FunctionPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Search functions/);
    fireEvent.change(input, { target: { value: 'XYZNONEXISTENT' } });
    expect(screen.getByText(/No functions match/)).toBeInTheDocument();
  });

  it('handles keyboard navigation: ArrowDown', () => {
    render(<FunctionPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Search functions/);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Should have moved selection down (selected index 1)
    // Just verify no crash
    expect(input).toBeInTheDocument();
  });

  it('handles keyboard navigation: ArrowUp', () => {
    render(<FunctionPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Search functions/);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toBeInTheDocument();
  });

  it('handles keyboard navigation: Enter selects function', () => {
    render(<FunctionPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Search functions/);
    // First function should be selected by default
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSelect).toHaveBeenCalled();
  });

  it('handles keyboard navigation: Escape closes', () => {
    render(<FunctionPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Search functions/);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows function count in footer', () => {
    render(<FunctionPicker {...defaultProps} />);
    expect(screen.getByText(/functions$/)).toBeInTheDocument();
  });

  it('displays function signatures and descriptions', () => {
    render(<FunctionPicker {...defaultProps} />);
    expect(screen.getByText('Adds all numbers in a range')).toBeInTheDocument();
    expect(screen.getByText('SUM(number1, [number2], ...)')).toBeInTheDocument();
  });

  it('shows parameter count badge for functions with schema', () => {
    render(<FunctionPicker {...defaultProps} />);
    // Multiple functions have 2 params, use getAllByText
    expect(screen.getAllByText('2 params').length).toBeGreaterThan(0);
  });
});
