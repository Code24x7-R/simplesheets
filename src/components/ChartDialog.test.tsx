// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChartDialog } from './ChartDialog';
import type { Sheet } from '../types';

/**
 * Helper to create a test sheet with data.
 */
function createTestSheet(): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'Month', computedValue: 'Month' },
      '0:1': { rawValue: 'Sales', computedValue: 'Sales' },
      '1:0': { rawValue: 'Jan', computedValue: 'Jan' },
      '1:1': { rawValue: '100', computedValue: 100 },
      '2:0': { rawValue: 'Feb', computedValue: 'Feb' },
      '2:1': { rawValue: '150', computedValue: 150 },
      '3:0': { rawValue: 'Mar', computedValue: 'Mar' },
      '3:1': { rawValue: '200', computedValue: 200 },
    },
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

describe('ChartDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
    sheet: createTestSheet(),
    initialRange: 'A1:B4',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getAllByText('Insert Chart').length).toBeGreaterThan(0);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ChartDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows chart type selector', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getByTestId('chart-type-bar')).toBeInTheDocument();
    expect(screen.getByTestId('chart-type-line')).toBeInTheDocument();
    expect(screen.getByTestId('chart-type-pie')).toBeInTheDocument();
  });

  it('changes chart type on click', () => {
    render(<ChartDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('chart-type-line'));
    expect(screen.getByTestId('chart-type-line')).toHaveClass('bg-blue-50');
  });

  it('shows data range input', () => {
    render(<ChartDialog {...defaultProps} />);
    const input = screen.getByTestId('chart-data-range');
    expect(input).toHaveValue('A1:B4');
  });

  it('updates data range on change', () => {
    render(<ChartDialog {...defaultProps} />);
    const input = screen.getByTestId('chart-data-range');
    fireEvent.change(input, { target: { value: 'A1:C10' } });
    expect(input).toHaveValue('A1:C10');
  });

  it('shows title input', () => {
    render(<ChartDialog {...defaultProps} />);
    const input = screen.getByTestId('chart-title');
    expect(input).toHaveValue('Chart Title');
  });

  it('updates title on change', () => {
    render(<ChartDialog {...defaultProps} />);
    const input = screen.getByTestId('chart-title');
    fireEvent.change(input, { target: { value: 'My Chart' } });
    expect(input).toHaveValue('My Chart');
  });

  it('shows axis label inputs', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getByTestId('chart-x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('chart-y-axis')).toBeInTheDocument();
  });

  it('shows legend position selector', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getByTestId('legend-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('legend-top')).toBeInTheDocument();
    expect(screen.getByTestId('legend-none')).toBeInTheDocument();
  });

  it('changes legend position on click', () => {
    render(<ChartDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('legend-right'));
    expect(screen.getByTestId('legend-right')).toHaveClass('bg-blue-50');
  });

  it('shows data detection info', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getByText(/3 categories/)).toBeInTheDocument();
    expect(screen.getByText(/1 series detected/)).toBeInTheDocument();
  });

  it('renders preview', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getByTestId('chart-preview')).toBeInTheDocument();
    expect(screen.getByTestId('chart-preview').querySelector('svg')).toBeInTheDocument();
  });

  it('calls onApply and onClose on Insert Chart', () => {
    render(<ChartDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('chart-apply'));
    expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bar',
        title: 'Chart Title',
        dataRange: 'A1:B4',
      }),
    );
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Cancel', () => {
    render(<ChartDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('calls onClose on X button click', () => {
    render(<ChartDialog {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Edit Chart title when editing existing chart', () => {
    const existingChart = {
      id: 'existing-chart',
      type: 'line' as const,
      title: 'Existing Chart',
      dataRange: 'A1:B4',
      series: [{ label: 'Sales', dataRange: 'B1:B4' }],
      legendPosition: 'right' as const,
      width: 400,
      height: 300,
      row: 5,
      col: 3,
    };
    render(<ChartDialog {...defaultProps} existingChart={existingChart} />);
    expect(screen.getByText('Edit Chart')).toBeInTheDocument();
    expect(screen.getByText('Update Chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-title')).toHaveValue('Existing Chart');
  });
});

describe('ChartDialog Range Picker', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
    sheet: createTestSheet(),
    initialRange: 'A1:B4',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows pick range button', () => {
    render(<ChartDialog {...defaultProps} />);
    expect(screen.getByTestId('chart-range-picker')).toBeInTheDocument();
  });

  it('shows inactive state initially', () => {
    render(<ChartDialog {...defaultProps} isRangePickerActive={false} />);
    expect(screen.getByText('📎 Pick Range')).toBeInTheDocument();
  });

  it('minimizes dialog when range picker is active', () => {
    render(<ChartDialog {...defaultProps} isRangePickerActive={true} />);
    // Dialog should be minimized to a small bar, not show full form
    expect(screen.getByText(/Select a data range on the grid/)).toBeInTheDocument();
    // Full dialog elements should not be visible
    expect(screen.queryByTestId('chart-type-bar')).not.toBeInTheDocument();
  });

  it('shows pick range button in normal (non-picker) mode', () => {
    render(<ChartDialog {...defaultProps} isRangePickerActive={false} />);
    expect(screen.getByTestId('chart-range-picker')).toBeInTheDocument();
  });

  it('calls onToggleRangePicker when button is clicked', () => {
    const onToggleRangePicker = jest.fn();
    render(<ChartDialog {...defaultProps} onToggleRangePicker={onToggleRangePicker} isRangePickerActive={false} />);
    fireEvent.click(screen.getByTestId('chart-range-picker'));
    expect(onToggleRangePicker).toHaveBeenCalledTimes(1);
  });

  it('updates dataRange when chartRangeSelected event fires', () => {
    render(<ChartDialog {...defaultProps} />);
    // Dispatch a custom event simulating grid range selection
    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:chartRangeSelected', {
        detail: { range: 'A1:D10' },
      }));
    });
    expect(screen.getByTestId('chart-data-range')).toHaveValue('A1:D10');
  });
});
