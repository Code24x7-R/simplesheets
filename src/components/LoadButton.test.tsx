import { render, screen, fireEvent } from '@testing-library/react';
import { LoadButton } from './LoadButton';
import { saveWorkbook, autosaveWorkbook } from '../services/storageService';
import type { Workbook } from '../types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const workbook1: Workbook = {
  id: 'wb-1',
  title: 'First Book',
  sheets: [
    {
      id: 's1',
      name: 'Sheet1',
      cells: {},
      defaultColWidth: 100,
      defaultRowHeight: 28,
      columnWidths: {},
      rowHeights: {},
      columnCount: 26,
      rowCount: 100,
      frozenColumns: 0,
      frozenRows: 0,
    },
  ],
  activeSheetIndex: 0,
  lastModified: 1000000000000,
};

const workbook2: Workbook = {
  id: 'wb-2',
  title: 'Second Book',
  sheets: [
    {
      id: 's2',
      name: 'Data',
      cells: {},
      defaultColWidth: 120,
      defaultRowHeight: 30,
      columnWidths: {},
      rowHeights: {},
      columnCount: 10,
      rowCount: 50,
      frozenColumns: 0,
      frozenRows: 0,
    },
  ],
  activeSheetIndex: 0,
  lastModified: 2000000000000,
};

function clearStorage(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith('simplesheets:')) {
      localStorage.removeItem(key);
    }
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('LoadButton', () => {
  beforeEach(() => {
    clearStorage();
  });

  afterAll(() => {
    clearStorage();
  });

  it('renders the load button', () => {
    render(<LoadButton onImport={jest.fn()} />);
    expect(screen.getByText('📂 Load')).toBeInTheDocument();
  });

  it('opens dialog on click', () => {
    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));
    expect(screen.getByText('Load Workbook')).toBeInTheDocument();
  });

  it('shows empty message when no saves exist', () => {
    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));
    expect(screen.getByText('No saved workbooks found')).toBeInTheDocument();
  });

  it('lists saved workbooks', () => {
    saveWorkbook('Save1', workbook1);
    saveWorkbook('Save2', workbook2);

    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));

    expect(screen.getByText('Save1')).toBeInTheDocument();
    expect(screen.getByText('Save2')).toBeInTheDocument();
  });

  it('loads a save when Load is clicked', () => {
    const onImport = jest.fn();
    saveWorkbook('LoadMe', workbook1);

    render(<LoadButton onImport={onImport} />);
    fireEvent.click(screen.getByText('📂 Load'));

    // Click the "Load" button next to "LoadMe"
    const loadButtons = screen.getAllByText('Load');
    fireEvent.click(loadButtons[0]);

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0].title).toBe('First Book');
  });

  it('shows autosave entry when it exists', () => {
    autosaveWorkbook(workbook1);

    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));

    expect(screen.getByText('Auto-save')).toBeInTheDocument();
    expect(screen.getByText('Restore')).toBeInTheDocument();
  });

  it('loads autosave when Restore is clicked', () => {
    const onImport = jest.fn();
    autosaveWorkbook(workbook1);

    render(<LoadButton onImport={onImport} />);
    fireEvent.click(screen.getByText('📂 Load'));
    fireEvent.click(screen.getByText('Restore'));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0].title).toBe('First Book');
  });

  it('deletes save on double-click delete button', () => {
    saveWorkbook('ToDelete', workbook1);

    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));

    // First click: show confirm
    const deleteButtons = screen.getAllByText('✕');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('Confirm')).toBeInTheDocument();

    // Second click: actually delete
    fireEvent.click(screen.getByText('Confirm'));

    // Save should be gone — list should be empty
    expect(screen.getByText('No saved workbooks found')).toBeInTheDocument();
  });

  it('displays sheet count and title in save entry', () => {
    saveWorkbook('Info', workbook1);

    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));

    expect(screen.getByText(/First Book · 1 sheet/)).toBeInTheDocument();
  });

  it('closes dialog on Close button', () => {
    render(<LoadButton onImport={jest.fn()} />);
    fireEvent.click(screen.getByText('📂 Load'));
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Load Workbook')).not.toBeInTheDocument();
  });

  it('calls onError when autosave load fails', () => {
    const onError = jest.fn();
    // Set corrupt autosave data — hasAutosave() returns true (key exists)
    // but loadAutosave() returns null (parse fails)
    localStorage.setItem('simplesheets:autosave', 'corrupt-data');
    localStorage.setItem('simplesheets:saves', JSON.stringify([]));

    render(<LoadButton onImport={jest.fn()} onError={onError} />);
    fireEvent.click(screen.getByText('📂 Load'));

    // The autosave entry should appear since the key exists
    expect(screen.getByText('Restore')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Restore'));

    expect(onError).toHaveBeenCalledWith('Failed to load auto-save');
  });
});
