import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryProvider, useHistory } from './HistoryContext';
import type { Workbook } from '../types';

/**
 * Test component that exposes history actions.
 */
function TestComponent() {
  const { canUndo, canRedo, pushHistory, undo, redo, historyLog, workbook } = useHistory();

  const makeEdit = () => {
    const newWb: Workbook = {
      ...workbook,
      id: `wb-${Date.now()}`,
      lastModified: Date.now(),
    };
    pushHistory(newWb, 'Test edit');
  };

  return (
    <div>
      <span data-testid="can-undo">{String(canUndo)}</span>
      <span data-testid="can-redo">{String(canRedo)}</span>
      <span data-testid="log-count">{historyLog.length}</span>
      <button data-testid="edit" onClick={makeEdit}>Edit</button>
      <button data-testid="undo" onClick={() => undo()}>Undo</button>
      <button data-testid="redo" onClick={() => redo()}>Redo</button>
    </div>
  );
}

function createTestWorkbook(): Workbook {
  return {
    id: 'test-wb',
    title: 'Test',
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
    lastModified: Date.now(),
  };
}

describe('HistoryContext', () => {
  it('provides initial state with no history', () => {
    render(
      <HistoryProvider initialWorkbook={createTestWorkbook()}>
        <TestComponent />
      </HistoryProvider>
    );

    expect(screen.getByTestId('can-undo').textContent).toBe('false');
    expect(screen.getByTestId('can-redo').textContent).toBe('false');
    expect(screen.getByTestId('log-count').textContent).toBe('0');
  });

  it('tracks history after edits', () => {
    render(
      <HistoryProvider initialWorkbook={createTestWorkbook()}>
        <TestComponent />
      </HistoryProvider>
    );

    fireEvent.click(screen.getByTestId('edit'));
    fireEvent.click(screen.getByTestId('edit'));

    expect(screen.getByTestId('can-undo').textContent).toBe('true');
    expect(screen.getByTestId('log-count').textContent).toBe('2');
  });

  it('undo reverts to previous state', () => {
    render(
      <HistoryProvider initialWorkbook={createTestWorkbook()}>
        <TestComponent />
      </HistoryProvider>
    );

    fireEvent.click(screen.getByTestId('edit'));
    fireEvent.click(screen.getByTestId('edit'));
    fireEvent.click(screen.getByTestId('undo'));

    expect(screen.getByTestId('can-redo').textContent).toBe('true');
    expect(screen.getByTestId('log-count').textContent).toBe('1');
  });

  it('redo re-applies undone state', () => {
    render(
      <HistoryProvider initialWorkbook={createTestWorkbook()}>
        <TestComponent />
      </HistoryProvider>
    );

    fireEvent.click(screen.getByTestId('edit'));
    fireEvent.click(screen.getByTestId('undo'));
    fireEvent.click(screen.getByTestId('redo'));

    expect(screen.getByTestId('can-undo').textContent).toBe('true');
    expect(screen.getByTestId('can-redo').textContent).toBe('false');
  });

  it('clears redo stack on new edit', () => {
    render(
      <HistoryProvider initialWorkbook={createTestWorkbook()}>
        <TestComponent />
      </HistoryProvider>
    );

    fireEvent.click(screen.getByTestId('edit'));
    fireEvent.click(screen.getByTestId('undo'));
    expect(screen.getByTestId('can-redo').textContent).toBe('true');

    // New edit clears redo
    fireEvent.click(screen.getByTestId('edit'));
    expect(screen.getByTestId('can-redo').textContent).toBe('false');
  });

  it('throws when used outside provider', () => {
    // Suppress console.error for this expected error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useHistory must be used within a HistoryProvider');

    spy.mockRestore();
  });

  it('resets history with a new workbook', () => {
    // TestComponent with resetHistory access
    function ResetComponent() {
      const { resetHistory, pushHistory, canUndo, workbook } = useHistory();
      return (
        <div>
          <span data-testid="can-undo">{String(canUndo)}</span>
          <span data-testid="wb-title">{workbook.title}</span>
          <button data-testid="edit" onClick={() => pushHistory({ ...workbook, lastModified: Date.now() }, 'Edit')}>Edit</button>
          <button data-testid="reset" onClick={() => resetHistory({ ...workbook, title: 'Reset Book', lastModified: Date.now() })}>Reset</button>
        </div>
      );
    }

    render(
      <HistoryProvider initialWorkbook={createTestWorkbook()}>
        <ResetComponent />
      </HistoryProvider>
    );

    // Make an edit
    fireEvent.click(screen.getByTestId('edit'));
    expect(screen.getByTestId('can-undo').textContent).toBe('true');

    // Reset history
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('can-undo').textContent).toBe('false');
    expect(screen.getByTestId('wb-title').textContent).toBe('Reset Book');
  });
});
