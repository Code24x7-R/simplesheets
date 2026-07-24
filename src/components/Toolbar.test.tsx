import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import type { Workbook } from '../types';

const mockWorkbook: Workbook = {
  id: 'test',
  title: 'Test',
  sheets: [],
  activeSheetIndex: 0,
  lastModified: Date.now(),
};

describe('Toolbar', () => {
  it('renders undo/redo buttons', () => {
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={null}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={true}
        canRedo={false}
        frozenRows={0}
        frozenCols={0}
      />
    );

    expect(screen.getByText(/Undo/)).toBeInTheDocument();
    expect(screen.getByText(/Redo/)).toBeInTheDocument();
  });

  it('renders merge buttons', () => {
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={null}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={false}
        canRedo={false}
        frozenRows={0}
        frozenCols={0}
      />
    );

    expect(screen.getByText(/Merge/)).toBeInTheDocument();
    expect(screen.getByText(/Unmerge/)).toBeInTheDocument();
  });

  it('renders freeze buttons', () => {
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={null}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={false}
        canRedo={false}
        frozenRows={0}
        frozenCols={0}
      />
    );

    // There should be freeze/unfreeze buttons
    const buttons = screen.getAllByText(/Freeze|Unfreeze/);
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onUndo when undo button is clicked', () => {
    const onUndo = jest.fn();
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={null}
        onUndo={onUndo}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={true}
        canRedo={true}
        frozenRows={0}
        frozenCols={0}
      />
    );

    fireEvent.click(screen.getByText(/Undo/));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('disables undo button when canUndo is false', () => {
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={null}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={false}
        canRedo={false}
        frozenRows={0}
        frozenCols={0}
      />
    );

    const undoBtn = screen.getByText(/Undo/).closest('button');
    expect(undoBtn).toBeDisabled();
  });

  it('disables merge button without range selection', () => {
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={null}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={true}
        canRedo={true}
        frozenRows={0}
        frozenCols={0}
      />
    );

    const mergeBtn = screen.getByText(/Merge/).closest('button');
    expect(mergeBtn).toBeDisabled();
  });

  it('enables merge button with range selection', () => {
    const selection = { type: 'cell' as const, startRow: 0, startCol: 0, endRow: 1, endCol: 1, anchorRow: 0, anchorCol: 0 };
    render(
      <Toolbar
        workbook={mockWorkbook}
        selection={selection}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onMerge={jest.fn()}
        onUnmerge={jest.fn()}
        onFreeze={jest.fn()}
        onUnfreeze={jest.fn()}
        canUndo={true}
        canRedo={true}
        frozenRows={0}
        frozenCols={0}
      />
    );

    const mergeBtn = screen.getByText(/Merge/).closest('button');
    expect(mergeBtn).not.toBeDisabled();
  });
});
