import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportExcelButton } from './ImportExcelButton';
import { ImportCsvButton } from './ImportCsvButton';
import { ImportJsonButton } from './ImportJsonButton';

// Mock services
jest.mock('../services/csvService', () => ({
  importCsv: jest.fn(),
}));

jest.mock('../services/excelImport', () => ({
  importExcelFile: jest.fn(),
}));

jest.mock('../services/jsonService', () => ({
  importJson: jest.fn(),
}));

import { importCsv } from '../services/csvService';
import { importExcelFile } from '../services/excelImport';
import { importJson } from '../services/jsonService';

// Helper to create a mock file
function createMockFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' });
}

describe('ImportExcelButton', () => {
  it('renders import Excel button', () => {
    render(<ImportExcelButton onImport={jest.fn()} onError={jest.fn()} />);
    expect(screen.getByText(/Import Excel/)).toBeInTheDocument();
  });

  it('opens file picker on click', () => {
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');
    render(<ImportExcelButton onImport={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByText(/Import Excel/));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('has hidden file input', () => {
    render(<ImportExcelButton onImport={jest.fn()} onError={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input?.accept).toContain('.xlsx');
  });

  it('calls onImport when Excel file is selected', async () => {
    const mockWorkbook = { id: '1', name: 'Test', sheets: [], activeSheetIndex: 0 };
    (importExcelFile as jest.Mock).mockResolvedValue({ success: true, workbook: mockWorkbook });

    const onImport = jest.fn();
    render(<ImportExcelButton onImport={onImport} onError={jest.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('test.xlsx', 'binary-content');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(mockWorkbook);
    });
  });

  it('calls onError when Excel import fails', async () => {
    (importExcelFile as jest.Mock).mockResolvedValue({ success: false, error: 'Bad file' });

    const onError = jest.fn();
    render(<ImportExcelButton onImport={jest.fn()} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('bad.xlsx', 'not-valid');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Bad file');
    });
  });
});

describe('ImportCsvButton', () => {
  it('renders import CSV button', () => {
    render(<ImportCsvButton onImport={jest.fn()} onError={jest.fn()} />);
    expect(screen.getByText(/Import CSV/)).toBeInTheDocument();
  });

  it('opens file picker on click', () => {
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');
    render(<ImportCsvButton onImport={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByText(/Import CSV/));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('has hidden file input with csv accept', () => {
    render(<ImportCsvButton onImport={jest.fn()} onError={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input?.accept).toContain('.csv');
  });

  it('calls onImport when CSV file is selected', async () => {
    const mockWorkbook = { id: '1', name: 'Test', sheets: [], activeSheetIndex: 0 };
    (importCsv as jest.Mock).mockReturnValue({ success: true, workbook: mockWorkbook });

    const onImport = jest.fn();
    render(<ImportCsvButton onImport={onImport} onError={jest.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('test.csv', 'a,b,c\n1,2,3');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(mockWorkbook);
    });
  });

  it('calls onError when CSV import fails', async () => {
    (importCsv as jest.Mock).mockReturnValue({ success: false, error: 'Bad CSV' });

    const onError = jest.fn();
    render(<ImportCsvButton onImport={jest.fn()} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('bad.csv', 'not valid');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Bad CSV');
    });
  });

  it('does nothing when no file selected', () => {
    const onImport = jest.fn();
    render(<ImportCsvButton onImport={onImport} onError={jest.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [] });
    fireEvent.change(input);

    expect(onImport).not.toHaveBeenCalled();
  });

  it('calls onError with default message when CSV import fails without error', async () => {
    (importCsv as jest.Mock).mockReturnValue({ success: false });

    const onError = jest.fn();
    render(<ImportCsvButton onImport={jest.fn()} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('bad.csv', 'not valid');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Import failed');
    });
  });
});

describe('ImportJsonButton', () => {
  it('renders import JSON button', () => {
    render(<ImportJsonButton onImport={jest.fn()} onError={jest.fn()} />);
    expect(screen.getByText(/Import JSON/)).toBeInTheDocument();
  });

  it('opens file picker on click', () => {
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');
    render(<ImportJsonButton onImport={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByText(/Import JSON/));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('has hidden file input with json accept', () => {
    render(<ImportJsonButton onImport={jest.fn()} onError={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input?.accept).toContain('.json');
  });

  it('calls onImport when JSON file is selected', async () => {
    const mockWorkbook = { id: '1', name: 'Test', sheets: [], activeSheetIndex: 0 };
    (importJson as jest.Mock).mockReturnValue({ success: true, workbook: mockWorkbook });

    const onImport = jest.fn();
    render(<ImportJsonButton onImport={onImport} onError={jest.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('test.json', '{"name":"test"}');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(mockWorkbook);
    });
  });

  it('calls onError when JSON import fails', async () => {
    (importJson as jest.Mock).mockReturnValue({ success: false, error: 'Bad JSON' });

    const onError = jest.fn();
    render(<ImportJsonButton onImport={jest.fn()} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('bad.json', 'not json');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Bad JSON');
    });
  });

  it('calls onError with default message when JSON import fails without error', async () => {
    (importJson as jest.Mock).mockReturnValue({ success: false });

    const onError = jest.fn();
    render(<ImportJsonButton onImport={jest.fn()} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('bad.json', 'not json');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Import failed');
    });
  });

  it('calls onError with default message when Excel import fails without error', async () => {
    (importExcelFile as jest.Mock).mockResolvedValue({ success: false });

    const onError = jest.fn();
    render(<ImportExcelButton onImport={jest.fn()} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile('bad.xlsx', 'not valid');

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Import failed');
    });
  });
});
