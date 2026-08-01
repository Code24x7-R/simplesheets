// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, act } from '@testing-library/react';
import { ImportExportBridge } from './ImportExportBridge';
import { PrintSetupProvider } from '../context/PrintSetupContext';
import type { Workbook, Sheet } from '../types';

function createTestWorkbook(): Workbook {
  return {
    id: 'test-wb',
    title: 'Test',
    sheets: [createTestSheet()],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

function createTestSheet(): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
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

describe('ImportExportBridge', () => {
  const defaultProps = {
    workbook: createTestWorkbook(),
    sheet: createTestSheet(),
    onImport: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders hidden import/export buttons', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    // The bridge renders hidden buttons
    expect(screen.getByText(/Import Excel/)).toBeInTheDocument();
    expect(screen.getByText(/Import CSV/)).toBeInTheDocument();
    expect(screen.getByText(/Import JSON/)).toBeInTheDocument();
  });

  it('triggers Excel import when simplesheets:import-excel event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:import-excel'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('triggers CSV import when simplesheets:import-csv event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:import-csv'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('triggers JSON import when simplesheets:import-json event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:import-json'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
