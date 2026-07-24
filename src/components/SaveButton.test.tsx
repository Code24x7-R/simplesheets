import { render, screen, fireEvent } from '@testing-library/react';
import { SaveButton } from './SaveButton';
import { hasSave, loadWorkbook } from '../services/storageService';
import type { Workbook } from '../types';

// ─── Test Fixture ────────────────────────────────────────────────────────────

const testWorkbook: Workbook = {
  id: 'test-wb',
  title: 'My Sheet',
  sheets: [
    {
      id: 'sheet-1',
      name: 'Sheet1',
      cells: { '0:0': { rawValue: 'Test' } },
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
  lastModified: Date.now(),
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

describe('SaveButton', () => {
  beforeEach(() => {
    clearStorage();
  });

  afterAll(() => {
    clearStorage();
  });

  it('renders the save button', () => {
    render(<SaveButton workbook={testWorkbook} />);
    expect(screen.getByText('💾 Save')).toBeInTheDocument();
  });

  it('opens prompt on click', () => {
    render(<SaveButton workbook={testWorkbook} />);
    fireEvent.click(screen.getByText('💾 Save'));
    expect(screen.getByText('Save Workbook')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter save name...')).toBeInTheDocument();
  });

  it('pre-fills the name with workbook title', () => {
    render(<SaveButton workbook={testWorkbook} />);
    fireEvent.click(screen.getByText('💾 Save'));
    const input = screen.getByPlaceholderText('Enter save name...') as HTMLInputElement;
    expect(input.value).toBe('My Sheet');
  });

  it('saves to localStorage on confirm', () => {
    const onSaved = jest.fn();
    render(<SaveButton workbook={testWorkbook} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('💾 Save'));
    const input = screen.getByPlaceholderText('Enter save name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'MySave' } });
    fireEvent.click(screen.getByText('Save'));

    expect(hasSave('MySave')).toBe(true);
    const loaded = loadWorkbook('MySave');
    expect(loaded?.title).toBe('My Sheet');
    expect(onSaved).toHaveBeenCalledWith('MySave');
  });

  it('closes dialog on cancel', () => {
    render(<SaveButton workbook={testWorkbook} />);
    fireEvent.click(screen.getByText('💾 Save'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Save Workbook')).not.toBeInTheDocument();
  });

  it('submits on Enter key', () => {
    const onSaved = jest.fn();
    render(<SaveButton workbook={testWorkbook} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('💾 Save'));
    const input = screen.getByPlaceholderText('Enter save name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'EnterSave' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(hasSave('EnterSave')).toBe(true);
    expect(onSaved).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    render(<SaveButton workbook={testWorkbook} />);
    fireEvent.click(screen.getByText('💾 Save'));
    const input = screen.getByPlaceholderText('Enter save name...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Save Workbook')).not.toBeInTheDocument();
  });

  it('calls onError for empty name', () => {
    const onError = jest.fn();
    render(<SaveButton workbook={testWorkbook} onError={onError} />);

    fireEvent.click(screen.getByText('💾 Save'));
    const input = screen.getByPlaceholderText('Enter save name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onError).toHaveBeenCalledWith('Save name cannot be empty');
  });
});
