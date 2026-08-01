// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Tests for SearchReplaceModal component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchReplaceModal } from './SearchReplaceModal';
import type { Workbook } from '../types';

// ════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════

function makeWorkbook(): Workbook {
  return {
    id: 'wb-1',
    title: 'Test',
    activeSheetIndex: 0,
    sheets: [
      {
        id: 's1',
        name: 'Sheet1',
        rowCount: 100,
        columnCount: 26,
        defaultColWidth: 80,
        defaultRowHeight: 24,
        columnWidths: {},
        rowHeights: {},
        frozenRows: 0,
        frozenColumns: 0,
        cells: {
          '0:0': { rawValue: 'hello' },
          '0:1': { rawValue: 'world' },
          '0:2': { rawValue: 'Hello World' },
          '0:3': { rawValue: '=SUM(A1:B1)' },
        },
      },
      {
        id: 's2',
        name: 'Sheet2',
        rowCount: 100,
        columnCount: 26,
        defaultColWidth: 80,
        defaultRowHeight: 24,
        columnWidths: {},
        rowHeights: {},
        frozenRows: 0,
        frozenColumns: 0,
        cells: {
          '0:0': { rawValue: 'hello again' },
        },
      },
    ],
    lastModified: Date.now(),
  };
}

// ════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════

describe('SearchReplaceModal', () => {
  it('does not render when isOpen=false', () => {
    render(
      <SearchReplaceModal
        isOpen={false}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    expect(screen.queryByText('Find & Replace')).toBeNull();
  });

  it('renders when isOpen=true', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    expect(screen.getByText('Find & Replace')).toBeTruthy();
    expect(screen.getByLabelText('Find')).toBeTruthy();
    expect(screen.getByLabelText('Replace with')).toBeTruthy();
  });

  it('shows checkboxes for all options', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(/Match case/)).toBeTruthy();
    expect(screen.getByLabelText(/Match entire cell/)).toBeTruthy();
    expect(screen.getByLabelText(/Also search in formulas/)).toBeTruthy();
    expect(screen.getByLabelText(/Search all sheets/)).toBeTruthy();
  });

  it('performs search and shows match count', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    const findInput = screen.getByLabelText('Find');
    fireEvent.change(findInput, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('🔍 Search'));
    // Sheet1 has "hello" and "Hello World" = 2 matches
    expect(screen.getByText(/Found/)).toBeTruthy();
  });

  it('Replace All calls onUpdate with new workbook', () => {
    const onUpdate = jest.fn();
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'hello' } });
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByText('🔍 Search'));
    fireEvent.click(screen.getByText('Replace All'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [updatedWb, description] = onUpdate.mock.calls[0];
    expect(updatedWb.sheets[0].cells['0:0'].rawValue).toBe('hi');
    expect(description).toContain('Replace All');
  });

  it('Replace All across multiple sheets uses multi-sheet label', () => {
    const onUpdate = jest.fn();
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={onUpdate}
      />,
    );
    // Enable "Search all sheets" so replace spans both sheets
    fireEvent.click(screen.getByLabelText(/Search all sheets/));
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'hello' } });
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByText('🔍 Search'));
    fireEvent.click(screen.getByText('Replace All'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [, description] = onUpdate.mock.calls[0];
    // Multi-sheet label format (not single-sheet "Replace in Sheet1")
    expect(description).toContain('Replace All "hello"');
    expect(description).toContain('cell(s)');
  });

  it('Replace All button is disabled when no query', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    const replaceButton = screen.getByText('Replace All') as HTMLButtonElement;
    expect(replaceButton.disabled).toBe(true);
  });

  it('Reset clears inputs and results', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('🔍 Search'));
    expect(screen.getByText(/Found/)).toBeTruthy();
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.queryByText(/Found/)).toBeNull();
    expect((screen.getByLabelText('Find') as HTMLInputElement).value).toBe('');
  });

  it('Close button calls onClose', () => {
    const onClose = jest.fn();
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={onClose}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking backdrop calls onClose', () => {
    const onClose = jest.fn();
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={onClose}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    // The backdrop is the outer div with bg-black/40
    const backdrop = screen.getByText('Find & Replace').closest('.bg-black\\/40');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('Search All Sheets checkbox includes other sheets in search', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    // Enable "Search all sheets"
    fireEvent.click(screen.getByLabelText(/Search all sheets/));
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('🔍 Search'));
    // Sheet1: "hello", "Hello World" = 2; Sheet2: "hello again" = 1 → total 3
    expect(screen.getByText(/Found/)).toBeTruthy();
  });

  it('searching with empty query does not show results', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    // Click Search with empty query — should not show results
    fireEvent.click(screen.getByText('🔍 Search'));
    expect(screen.queryByText(/Found/)).toBeNull();
  });

  it('pressing Enter in Find input triggers search', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    const findInput = screen.getByLabelText('Find');
    fireEvent.change(findInput, { target: { value: 'hello' } });
    fireEvent.keyDown(findInput, { key: 'Enter' });
    expect(screen.getByText(/Found/)).toBeTruthy();
  });

  it('pressing Enter in Replace input triggers search', () => {
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={jest.fn()}
      />,
    );
    const findInput = screen.getByLabelText('Find');
    fireEvent.change(findInput, { target: { value: 'hello' } });
    const replaceInput = screen.getByLabelText('Replace with');
    fireEvent.keyDown(replaceInput, { key: 'Enter' });
    expect(screen.getByText(/Found/)).toBeTruthy();
  });

  it('Replace All does nothing when no matches found', () => {
    const onUpdate = jest.fn();
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'nonexistent' } });
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'replacement' } });
    fireEvent.click(screen.getByText('🔍 Search'));
    fireEvent.click(screen.getByText('Replace All'));
    // No matches, so onUpdate should not be called
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Replace All with empty replacement deletes matches', () => {
    const onUpdate = jest.fn();
    render(
      <SearchReplaceModal
        isOpen={true}
        onClose={jest.fn()}
        workbook={makeWorkbook()}
        activeSheetIndex={0}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'hello' } });
    // Leave replacement empty
    fireEvent.click(screen.getByText('🔍 Search'));
    fireEvent.click(screen.getByText('Replace All'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    // The matched cells should now be empty
    const updatedWb = onUpdate.mock.calls[0][0];
    expect(updatedWb.sheets[0].cells['0:0'].rawValue).toBe('');
  });
});
