import type { Workbook, Selection } from '../types';

interface ToolbarProps {
  workbook: Workbook;
  selection: Selection | null;
  onUndo: () => void;
  onRedo: () => void;
  onMerge: () => void;
  onUnmerge: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  canUndo: boolean;
  canRedo: boolean;
  frozenRows: number;
  frozenCols: number;
}

/**
 * Toolbar component with undo/redo, merge, and freeze controls.
 */
export function Toolbar({
  onUndo,
  onRedo,
  onMerge,
  onUnmerge,
  onFreeze,
  onUnfreeze,
  canUndo,
  canRedo,
  frozenRows,
  frozenCols,
  selection,
}: ToolbarProps) {
  const hasSelection = selection !== null;
  const hasRangeSelection =
    hasSelection &&
    (selection.endRow !== selection.startRow || selection.endCol !== selection.startCol);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
      {/* Undo / Redo */}
      <button
        className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>
      <button
        className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        ↪ Redo
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Merge */}
      <button
        className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onMerge}
        disabled={!hasRangeSelection}
        title="Merge selected cells"
      >
        ⊞ Merge
      </button>
      <button
        className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onUnmerge}
        disabled={!hasSelection}
        title="Unmerge selected cell"
      >
        ⊟ Unmerge
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Freeze */}
      <button
        className="toolbar-btn"
        onClick={onFreeze}
        title="Freeze top row and left column"
      >
        ⊡ Freeze
      </button>
      <button
        className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onUnfreeze}
        disabled={frozenRows === 0 && frozenCols === 0}
        title="Unfreeze panes"
      >
        ⊡ Unfreeze
      </button>

    </div>
  );
}
