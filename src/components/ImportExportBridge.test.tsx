// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, act } from '@testing-library/react';
import { ImportExportBridge } from './ImportExportBridge';
import { PrintSetupProvider } from '../context/PrintSetupContext';
import type { Workbook, Sheet } from '../types';

// Mock export services to prevent actual file downloads in tests
jest.mock('../services/excelExport', () => ({ downloadExcel: jest.fn() }));
jest.mock('../services/csvService', () => ({ downloadCsv: jest.fn() }));
jest.mock('../services/jsonService', () => ({
  downloadJson: jest.fn(),
  importJson: jest.fn((text: string) => {
    try {
      const wb = JSON.parse(text);
      return { success: true, workbook: wb };
    } catch {
      return { success: false, error: 'Invalid JSON' };
    }
  }),
}));
jest.mock('../services/pdfExport', () => ({ downloadPdf: jest.fn() }));

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

  it('triggers Excel export when simplesheets:export-excel event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLButtonElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:export-excel'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('triggers CSV export when simplesheets:export-csv event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLButtonElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:export-csv'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('triggers JSON export when simplesheets:export-json event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLButtonElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:export-json'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('triggers PDF export when simplesheets:export-pdf event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLButtonElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:export-pdf'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('triggers file open picker when simplesheets:open event fires', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');

    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:open'));
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('handleOpenFileChange calls onImport on valid JSON', () => {
    const onImport = jest.fn();
    const onError = jest.fn();
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} onImport={onImport} onError={onError} /></PrintSetupProvider>);

    const validWb = JSON.stringify({ id: 'wb1', title: 'Imported', sheets: [], activeSheetIndex: 0, lastModified: 0 });
    const file = new File([validWb], 'test.json', { type: 'application/json' });

    // Find the file input rendered by ImportExportBridge (last one in the DOM)
    const inputs = document.querySelectorAll('input[type="file"]');
    const input = inputs[inputs.length - 1] as HTMLInputElement;
    expect(input).toBeTruthy();

    // Mock FileReader to immediately call onload
    const readAsTextSpy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
      // Call onload synchronously with the file content
      Object.defineProperty(this, 'result', { value: validWb });
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });

    act(() => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      const changeEvent = new Event('change', { bubbles: true });
      input.dispatchEvent(changeEvent);
    });

    expect(onImport).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    readAsTextSpy.mockRestore();
  });

  it('handleOpenFileChange calls onError on invalid JSON', () => {
    const onError = jest.fn();
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} onError={onError} /></PrintSetupProvider>);

    const invalidJson = 'not valid json';
    const file = new File([invalidJson], 'bad.json', { type: 'application/json' });

    const inputs = document.querySelectorAll('input[type="file"]');
    const input = inputs[inputs.length - 1] as HTMLInputElement;

    const readAsTextSpy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
      Object.defineProperty(this, 'result', { value: invalidJson });
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });

    act(() => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      const changeEvent = new Event('change', { bubbles: true });
      input.dispatchEvent(changeEvent);
    });

    expect(onError).toHaveBeenCalled();
    readAsTextSpy.mockRestore();
  });

  it('handleOpenFileChange does nothing when no file selected', () => {
    render(<PrintSetupProvider><ImportExportBridge {...defaultProps} /></PrintSetupProvider>);

    const inputs = document.querySelectorAll('input[type="file"]');
    const input = inputs[inputs.length - 1] as HTMLInputElement;

    // Override the files getter to return null (no file selected)
    Object.defineProperty(input, 'files', { get: () => null, configurable: true });

    act(() => {
      input.dispatchEvent(new Event('change'));
    });

    expect(defaultProps.onImport).not.toHaveBeenCalled();
    expect(defaultProps.onError).not.toHaveBeenCalled();
  });
});
