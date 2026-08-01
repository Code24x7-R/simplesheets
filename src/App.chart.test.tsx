// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

/**
 * Helper to find the MenuBar and click Insert → Chart.
 */
function openChartDialog() {
  render(<App />);
  // Click Insert menu
  fireEvent.click(screen.getByText('Insert'));
  // Click Chart…
  fireEvent.click(screen.getByText('Chart…'));
}

describe('App Chart Integration', () => {
  it('opens chart dialog from menu', () => {
    openChartDialog();
    expect(screen.getAllByText('Insert Chart').length).toBeGreaterThan(0);
  });

  it('shows chart type selector in dialog', () => {
    openChartDialog();
    expect(screen.getByTestId('chart-type-bar')).toBeInTheDocument();
    expect(screen.getByTestId('chart-type-line')).toBeInTheDocument();
    expect(screen.getByTestId('chart-type-pie')).toBeInTheDocument();
  });

  it('creates chart on apply', () => {
    openChartDialog();
    // Change title
    const titleInput = screen.getByTestId('chart-title');
    fireEvent.change(titleInput, { target: { value: 'My Sales Chart' } });
    // Apply
    fireEvent.click(screen.getByTestId('chart-apply'));
    // Dialog should close
    expect(screen.queryByText('Insert Chart')).not.toBeInTheDocument();
    // Chart overlay should show the chart
    expect(screen.getByTestId('chart-overlay')).toBeInTheDocument();
  });

  it('closes dialog on cancel', () => {
    openChartDialog();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Insert Chart')).not.toBeInTheDocument();
  });

  it('renders chart in overlay after creation', () => {
    openChartDialog();
    fireEvent.click(screen.getByTestId('chart-apply'));
    // The overlay should contain an SVG chart
    const overlay = screen.getByTestId('chart-overlay');
    expect(overlay.querySelector('svg')).toBeInTheDocument();
  });

  it('edits existing chart via edit button', () => {
    // First create a chart
    openChartDialog();
    const titleInput = screen.getByTestId('chart-title');
    fireEvent.change(titleInput, { target: { value: 'Editable Chart' } });
    fireEvent.click(screen.getByTestId('chart-apply'));

    // Find and click the edit button on the chart
    const editButton = screen.getByTestId(/edit-chart-/);
    fireEvent.click(editButton);

    // Dialog should open with existing chart values
    expect(screen.getByText('Edit Chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-title')).toHaveValue('Editable Chart');
  });

  it('edits existing chart via double-click on header', () => {
    // First create a chart
    openChartDialog();
    fireEvent.change(screen.getByTestId('chart-title'), { target: { value: 'Double Click Chart' } });
    fireEvent.click(screen.getByTestId('chart-apply'));

    // Double-click the chart header to edit
    const header = screen.getByTestId(/chart-header-/);
    fireEvent.doubleClick(header);

    // Dialog should open in edit mode
    expect(screen.getByText('Edit Chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-title')).toHaveValue('Double Click Chart');
  });
});
