import { render, screen, fireEvent } from '@testing-library/react';
import { NewSheetButton } from './NewSheetButton';
import type { Workbook } from '../types';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NewSheetButton', () => {
  it('renders the new sheet button', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    expect(screen.getByText('📄 New')).toBeInTheDocument();
  });

  it('opens confirmation dialog on click', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));
    expect(screen.getByText('New Workbook')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does NOT call onNewSheet when dialog is open', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));
    expect(onNewSheet).not.toHaveBeenCalled();
  });

  it('creates a blank workbook on confirm', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));
    fireEvent.click(screen.getByText('Create'));

    expect(onNewSheet).toHaveBeenCalledTimes(1);
    const wb: Workbook = onNewSheet.mock.calls[0][0];
    expect(wb.title).toBe('Untitled');
    expect(wb.sheets).toHaveLength(1);
    expect(wb.sheets[0].name).toBe('Sheet1');
    expect(wb.sheets[0].cells).toEqual({});
    expect(wb.activeSheetIndex).toBe(0);
    expect(wb.sheets[0].columnCount).toBe(26);
    expect(wb.sheets[0].rowCount).toBe(100);
    expect(wb.sheets[0].frozenColumns).toBe(0);
    expect(wb.sheets[0].frozenRows).toBe(0);
  });

  it('closes dialog on cancel', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Workbook')).not.toBeInTheDocument();
    expect(onNewSheet).not.toHaveBeenCalled();
  });

  it('submits on Enter key', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));
    fireEvent.click(screen.getByText('Create'));
    expect(onNewSheet).toHaveBeenCalledTimes(1);
  });

  it('submits on Enter keyDown', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));
    const createButton = screen.getByText('Create');
    fireEvent.keyDown(createButton, { key: 'Enter' });
    expect(onNewSheet).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);
    fireEvent.click(screen.getByText('📄 New'));

    // The Create button has autoFocus and the keyDown handler
    const createButton = screen.getByText('Create');
    fireEvent.keyDown(createButton, { key: 'Escape' });
    expect(screen.queryByText('New Workbook')).not.toBeInTheDocument();
    expect(onNewSheet).not.toHaveBeenCalled();
  });

  it('generates unique IDs each time', () => {
    const onNewSheet = jest.fn();
    render(<NewSheetButton onNewSheet={onNewSheet} />);

    fireEvent.click(screen.getByText('📄 New'));
    fireEvent.click(screen.getByText('Create'));

    fireEvent.click(screen.getByText('📄 New'));
    fireEvent.click(screen.getByText('Create'));

    expect(onNewSheet).toHaveBeenCalledTimes(2);
    const wb1: Workbook = onNewSheet.mock.calls[0][0];
    const wb2: Workbook = onNewSheet.mock.calls[1][0];
    expect(wb1.id).not.toBe(wb2.id);
    expect(wb1.sheets[0].id).not.toBe(wb2.sheets[0].id);
  });
});
