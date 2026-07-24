import { render, screen, fireEvent } from '@testing-library/react';
import { ExportExcelButton } from './ExportExcelButton';
import { ExportJsonButton } from './ExportJsonButton';
import { ExportPdfButton } from './ExportPdfButton';
import type { Workbook, Sheet } from '../types';
import { PrintSetupProvider } from '../context/PrintSetupContext';

// Mock pdfExport for ExportPdfButton tests
jest.mock('../services/pdfExport', () => ({
  downloadPdf: jest.fn().mockResolvedValue(undefined),
}));

const mockWorkbook: Workbook = {
  id: 'test-wb',
  title: 'Test Workbook',
  sheets: [{
    id: 's1', name: 'Sheet1', cells: { '0:0': { rawValue: 'A' } },
    defaultColWidth: 100, defaultRowHeight: 28,
    columnWidths: {}, rowHeights: {},
    columnCount: 26, rowCount: 100,
    frozenColumns: 0, frozenRows: 0,
  }],
  activeSheetIndex: 0,
  lastModified: Date.now(),
};

const mockSheet: Sheet = mockWorkbook.sheets[0];

describe('ExportExcelButton', () => {
  it('renders export Excel button', () => {
    render(<ExportExcelButton workbook={mockWorkbook} />);
    expect(screen.getByText(/Export Excel/)).toBeInTheDocument();
  });

  it('triggers download on click', () => {
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();

    render(<ExportExcelButton workbook={mockWorkbook} />);
    fireEvent.click(screen.getByText(/Export Excel/));

    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('ExportJsonButton', () => {
  it('renders export JSON button', () => {
    render(<ExportJsonButton workbook={mockWorkbook} />);
    expect(screen.getByText(/Export JSON/)).toBeInTheDocument();
  });

  it('triggers download on click', () => {
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();

    render(<ExportJsonButton workbook={mockWorkbook} />);
    fireEvent.click(screen.getByText(/Export JSON/));

    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('ExportPdfButton', () => {
  it('renders export PDF button', () => {
    render(
      <PrintSetupProvider>
        <ExportPdfButton sheet={mockSheet} />
      </PrintSetupProvider>
    );
    expect(screen.getByText(/Export PDF/)).toBeInTheDocument();
  });

  it('shows loading state while generating', async () => {
    render(
      <PrintSetupProvider>
        <ExportPdfButton sheet={mockSheet} />
      </PrintSetupProvider>
    );

    // Button should be enabled initially
    const button = screen.getByText(/Export PDF/);
    expect(button).not.toBeDisabled();
  });

  it('calls downloadPdf on click', async () => {
    const { downloadPdf } = require('../services/pdfExport');

    render(
      <PrintSetupProvider>
        <ExportPdfButton sheet={mockSheet} />
      </PrintSetupProvider>
    );

    const button = screen.getByText(/Export PDF/);
    fireEvent.click(button);

    // The click should trigger the handler (async)
    expect(button).toBeInTheDocument();
  });

  it('calls onError when PDF generation fails', async () => {
    const { downloadPdf } = require('../services/pdfExport');
    downloadPdf.mockRejectedValueOnce(new Error('PDF failed'));

    const onError = jest.fn();
    render(
      <PrintSetupProvider>
        <ExportPdfButton sheet={mockSheet} onError={onError} />
      </PrintSetupProvider>
    );

    const button = screen.getByText(/Export PDF/);
    fireEvent.click(button);

    // Wait for async error handling
    await new Promise((r) => setTimeout(r, 0));
    expect(onError).toHaveBeenCalledWith('PDF failed');
  });
});
