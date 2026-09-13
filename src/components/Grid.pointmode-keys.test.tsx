// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, fireEvent } from '@testing-library/react';
import { useState, useCallback } from 'react';
import { Grid } from './Grid';
import type { Sheet } from '../types';
import type { EditingSession } from '../hooks/useCellEditing';

// Mock the virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 10; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 1000,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < 10; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 280,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function createTestSheet(): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '12:4': { rawValue: 'E13' },
      '12:0': { rawValue: 'A13' },
      '12:1': { rawValue: 'B13' },
      '12:2': { rawValue: 'C13' },
      '12:3': { rawValue: 'D13' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 10,
    rowCount: 20,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

/**
 * Wrapper component that provides a POINT-mode session.
 * Simulates the FSM behavior for POINT mode key handling.
 */
function PointModeGrid(props: {
  sheet: Sheet;
  onRawKeyDown: (e: React.KeyboardEvent) => void;
  onRefocusEditor: () => void;
  initialSession?: Partial<EditingSession>;
}) {
  const [session, setSession] = useState<EditingSession>({
    state: 'POINT',
    row: 12,
    col: 4,
    buffer: '=AVERAGE(',
    originalValue: '',
    caretPos: 10,
    isFormula: true,
    ...props.initialSession,
  });

  const onRawKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      props.onRawKeyDown(e);
      setSession((prev) => {
        // Simulate FSM: ')' commits the reference and exits POINT mode
        if (e.key === ')' && prev.state === 'POINT') {
          return {
            ...prev,
            state: 'EDIT',
            buffer: '=AVERAGE(A13:D13)',
            caretPos: 18,
          };
        }
        return prev;
      });
    },
    [props],
  );

  return (
    <Grid
      sheet={props.sheet}
      session={session}
      onRawKeyDown={onRawKeyDown}
      onRefocusEditor={props.onRefocusEditor}
    />
  );
}

describe('Grid — POINT mode key forwarding from grid focus', () => {
  it('forwards ")" to onRawKeyDown when grid has focus during POINT mode', () => {
    const sheet = createTestSheet();
    const onRawKeyDown = jest.fn();
    const onRefocusEditor = jest.fn();

    render(
      <PointModeGrid
        sheet={sheet}
        onRawKeyDown={onRawKeyDown}
        onRefocusEditor={onRefocusEditor}
      />,
    );

    // The grid div itself has focus (simulating user clicked a cell)
    const gridDiv = document.querySelector('.overflow-auto') as HTMLElement;
    gridDiv.focus();

    // Press ")" — should be forwarded to onRawKeyDown (not swallowed)
    fireEvent.keyDown(gridDiv, { key: ')' });

    expect(onRawKeyDown).toHaveBeenCalled();
    expect(onRefocusEditor).toHaveBeenCalled();
  });

  it('does NOT forward keys when session is in SELECT state', () => {
    const sheet = createTestSheet();
    const onRawKeyDown = jest.fn();
    const onRefocusEditor = jest.fn();

    render(
      <PointModeGrid
        sheet={sheet}
        onRawKeyDown={onRawKeyDown}
        onRefocusEditor={onRefocusEditor}
        initialSession={{
          state: 'SELECT',
          row: 0,
          col: 0,
          buffer: '',
          originalValue: '',
          caretPos: 0,
          isFormula: false,
        }}
      />,
    );

    const gridDiv = document.querySelector('.overflow-auto') as HTMLElement;
    gridDiv.focus();

    fireEvent.keyDown(gridDiv, { key: ')' });

    // In SELECT mode, the grid handles keys itself — should NOT forward
    expect(onRawKeyDown).not.toHaveBeenCalled();
    expect(onRefocusEditor).not.toHaveBeenCalled();
  });

  it('does NOT forward keys when target is an INPUT element', () => {
    const sheet = createTestSheet();
    const onRawKeyDown = jest.fn();
    const onRefocusEditor = jest.fn();

    render(
      <PointModeGrid
        sheet={sheet}
        onRawKeyDown={onRawKeyDown}
        onRefocusEditor={onRefocusEditor}
        initialSession={{
          state: 'EDIT',
          row: 0,
          col: 0,
          buffer: '=SUM(',
          originalValue: '',
          caretPos: 5,
          isFormula: true,
        }}
      />,
    );

    const gridDiv = document.querySelector('.overflow-auto') as HTMLElement;

    // Create a synthetic event whose target is an INPUT element.
    // The grid's handler should detect the INPUT target and NOT forward.
    const inputTarget = document.createElement('input');
    const syntheticEvent = new KeyboardEvent('keydown', { key: ')', bubbles: true });
    Object.defineProperty(syntheticEvent, 'target', { value: inputTarget });
    gridDiv.dispatchEvent(syntheticEvent);

    expect(onRawKeyDown).not.toHaveBeenCalled();
    expect(onRefocusEditor).not.toHaveBeenCalled();
  });

  it('forwards "," to onRawKeyDown during POINT mode (multi-param formulas)', () => {
    const sheet = createTestSheet();
    const onRawKeyDown = jest.fn();
    const onRefocusEditor = jest.fn();

    render(
      <PointModeGrid
        sheet={sheet}
        onRawKeyDown={onRawKeyDown}
        onRefocusEditor={onRefocusEditor}
      />,
    );

    const gridDiv = document.querySelector('.overflow-auto') as HTMLElement;
    gridDiv.focus();

    fireEvent.keyDown(gridDiv, { key: ',' });

    expect(onRawKeyDown).toHaveBeenCalled();
    expect(onRefocusEditor).toHaveBeenCalled();
  });

  it('does NOT refocus editor for modifier-only keys (Shift) during POINT mode', () => {
    const sheet = createTestSheet();
    const onRawKeyDown = jest.fn();
    const onRefocusEditor = jest.fn();

    render(
      <PointModeGrid
        sheet={sheet}
        onRawKeyDown={onRawKeyDown}
        onRefocusEditor={onRefocusEditor}
      />,
    );

    const gridDiv = document.querySelector('.overflow-auto') as HTMLElement;
    gridDiv.focus();

    // Press Shift — grid should forward to FSM but NOT refocus formula bar
    // so user can continue shift+click range selection in POINT mode
    fireEvent.keyDown(gridDiv, { key: 'Shift', shiftKey: true });

    // onRawKeyDown IS called (FSM may need to know about shift state)
    expect(onRawKeyDown).toHaveBeenCalled();
    // But onRefocusEditor is NOT called — grid keeps focus for mouse interaction
    expect(onRefocusEditor).not.toHaveBeenCalled();
  });
});
