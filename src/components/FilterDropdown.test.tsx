import { render, screen, fireEvent } from '@testing-library/react';
import { FilterDropdown } from './FilterDropdown';
import type { Sheet } from '../types';
import type { ColumnFilter } from '../utils/sheetFilter';

function createTestSheet(): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'Name', computedValue: 'Name' },
      '1:0': { rawValue: 'Alice', computedValue: 'Alice' },
      '2:0': { rawValue: 'Bob', computedValue: 'Bob' },
      '3:0': { rawValue: 'Charlie', computedValue: 'Charlie' },
      '4:0': { rawValue: 'Diana', computedValue: 'Diana' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    columnCount: 5,
    rowCount: 10,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

describe('FilterDropdown', () => {
  const defaultProps = {
    sheet: createTestSheet(),
    column: 0,
    headerRow: 0,
    onApply: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with unique values from column', () => {
    render(<FilterDropdown {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<FilterDropdown {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search values...')).toBeInTheDocument();
  });

  it('filters values based on search text', () => {
    render(<FilterDropdown {...defaultProps} />);
    const searchInput = screen.getByTestId('filter-search-input');
    fireEvent.change(searchInput, { target: { value: 'ali' } });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('selects and deselects values via checkboxes', () => {
    render(<FilterDropdown {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "Select All", then one for each value
    fireEvent.click(checkboxes[1]); // Select Alice
    fireEvent.click(checkboxes[1]); // Deselect Alice
    // Should not crash
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('selects all values when "Select All" is checked', () => {
    render(<FilterDropdown {...defaultProps} />);
    const selectAllCheckbox = screen.getByTestId('filter-select-all');
    fireEvent.click(selectAllCheckbox);
    // All values should now be selected
    const applyButton = screen.getByTestId('filter-apply');
    fireEvent.click(applyButton);
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: [{ type: 'includes', values: expect.arrayContaining(['Alice', 'Bob', 'Charlie', 'Diana']) }],
      })
    );
  });

  it('calls onApply with selected values when Apply is clicked', () => {
    render(<FilterDropdown {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Select Alice
    fireEvent.click(checkboxes[2]); // Select Bob

    const applyButton = screen.getByTestId('filter-apply');
    fireEvent.click(applyButton);

    expect(defaultProps.onApply).toHaveBeenCalledWith({
      conditions: [{ type: 'includes', values: ['Alice', 'Bob'] }],
      logic: 'AND',
    });
  });

  it('calls onApply(undefined) when Clear is clicked', () => {
    render(<FilterDropdown {...defaultProps} />);
    const clearButton = screen.getByTestId('filter-clear');
    fireEvent.click(clearButton);
    expect(defaultProps.onApply).toHaveBeenCalledWith(undefined);
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<FilterDropdown {...defaultProps} />);
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows custom filter tab', () => {
    render(<FilterDropdown {...defaultProps} />);
    const customTab = screen.getByText('Custom filter');
    fireEvent.click(customTab);
    expect(screen.getByTestId('filter-custom-type')).toBeInTheDocument();
    expect(screen.getByTestId('filter-custom-value')).toBeInTheDocument();
  });

  it('applies custom filter with contains condition', () => {
    render(<FilterDropdown {...defaultProps} />);
    // Switch to custom filter
    const customTab = screen.getByText('Custom filter');
    fireEvent.click(customTab);

    // Enter filter value
    const customInput = screen.getByTestId('filter-custom-value');
    fireEvent.change(customInput, { target: { value: 'Ali' } });

    // Apply
    const applyButton = screen.getByTestId('filter-apply');
    fireEvent.click(applyButton);

    expect(defaultProps.onApply).toHaveBeenCalledWith({
      conditions: [{ type: 'contains', value: 'Ali' }],
      logic: 'AND',
    });
  });

  it('shows empty state when no values', () => {
    const emptySheet: Sheet = {
      ...createTestSheet(),
      cells: {},
    };
    render(<FilterDropdown {...defaultProps} sheet={emptySheet} />);
    expect(screen.getByText('No values')).toBeInTheDocument();
  });

  it('initializes with existing filter values selected', () => {
    const existingFilter: ColumnFilter = {
      conditions: [{ type: 'includes', values: ['Alice', 'Charlie'] }],
      logic: 'AND',
    };
    render(<FilterDropdown {...defaultProps} currentFilter={existingFilter} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes[0] is "Select All"
    // checkboxes[1] should be Alice (selected)
    // checkboxes[2] should be Bob (not selected)
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
    expect(checkboxes[3]).toBeChecked(); // Charlie
  });
});
