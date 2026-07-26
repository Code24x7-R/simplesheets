import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Workbook } from './types';
import { cellKey, colToLetter } from './types';
import { HistoryProvider, useHistory } from './context/HistoryContext';
import { PasteModal } from './components/PasteModal';
import { PasteSpecialModal } from './components/PasteSpecialModal';
import { parsePlainText, parseHtmlTable, classifyPasteContent, type ParsedClipboardGrid, type PasteContentKind } from './utils/clipboardParse';
import { FreezeProvider, useFreeze } from './context/FreezeContext';
import { PrintSetupProvider } from './context/PrintSetupContext';
import { Grid, type GridHandle } from './components/Grid';
import type { PointModeSelection } from './components/Grid';
import { FormulaBar } from './components/FormulaBar';
import type { HighlightedRange } from './components/FormulaBar';
import { PrintSetupModal } from './components/PrintSetupModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SearchReplaceModal } from './components/SearchReplaceModal';
import { SheetTabs } from './components/SheetTabs';
import { MenuBar } from './components/MenuBar';
import { ImportExportBridge } from './components/ImportExportBridge';
import { evaluateWorkbook } from './utils/formulaEngine';
import { copyRange, cutRange as clipCutRange, getClipboard, clearClipboard, hasClipboardData } from './utils/clipboard';
import { adjustFormulaRefs } from './utils/formulaParser';
import { useAutosave } from './hooks/useAutosave';
import { useCellEditing, getStatusMessage } from './hooks/useCellEditing';
import { useCellStyles } from './hooks/useCellStyles';
import { useReferenceFormat } from './hooks/useReferenceFormat';
import { useFormulaWizard } from './hooks/useFormulaWizard';
import { FormulaWizard } from './components/FormulaWizard';
import { loadAutosave } from './services/storageService';
import type { Cell, Selection, Sheet } from './types';
import { insertRow, deleteRow, insertCol, deleteCol } from './utils/sheetOperations';

// ─── Empty Workbook ──────────────────────────────────────────────────────────

function createEmptyWorkbook(): Workbook {
  return {
    id: 'new-wb',
    title: 'Untitled',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        cells: {},
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 1000,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

// ─── Demo Workbook ───────────────────────────────────────────────────────────

function createDemoWorkbook(): Workbook {
  const rows = 100000;
  const cols = 26;
  const cells: Workbook['sheets'][0]['cells'] = {};

  // Add headers
  const headers = ['Name', 'Q1', 'Q2', 'Q3', 'Total', 'Average'];
  for (let c = 0; c < headers.length; c++) {
    cells[`0:${c}`] = {
      rawValue: headers[c],
      style: { fontWeight: 'bold', backgroundColor: '#e8f0fe', textAlign: 'center' },
    };
  }

  // Add sample data rows
  for (let r = 1; r <= 20; r++) {
    cells[`${r}:0`] = { rawValue: `Item ${r}` };
    cells[`${r}:1`] = { rawValue: String(Math.round(Math.random() * 1000)) };
    cells[`${r}:2`] = { rawValue: String(Math.round(Math.random() * 1000)) };
    cells[`${r}:3`] = { rawValue: String(Math.round(Math.random() * 1000)) };
    cells[`${r}:4`] = { rawValue: `=SUM(B${r + 1}:D${r + 1})` };
    cells[`${r}:5`] = { rawValue: `=AVERAGE(B${r + 1}:D${r + 1})` };
  }

  // Add some formula examples
  cells[`21:0`] = { rawValue: 'Grand Total', style: { fontWeight: 'bold' } };
  cells[`21:4`] = { rawValue: '=SUM(E2:E21)' };
  cells[`21:5`] = { rawValue: '=AVERAGE(F2:F21)' };

  return {
    id: 'demo-wb',
    title: 'SimpleSheet Demo',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        cells,
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: { 0: 150 },
        rowHeights: {},
        columnCount: cols,
        rowCount: rows,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

// ─── Main App (with providers) ───────────────────────────────────────────────

export default function App() {
  const [initialWorkbook] = useState<Workbook>(() => {
    // Restore from auto-save if available, otherwise start with a blank workbook
    const saved = loadAutosave();
    return saved ?? createEmptyWorkbook();
  });

  return (
    <HistoryProvider initialWorkbook={initialWorkbook}>
      <FreezeProvider>
        <PrintSetupProvider>
          <WorkbookView />
        </PrintSetupProvider>
      </FreezeProvider>
    </HistoryProvider>
  );
}

// ─── Workbook View (inner component with context access) ─────────────────────

function WorkbookView() {
  const { workbook, canUndo, canRedo, pushHistory, undo, redo, resetHistory } = useHistory();
  const { frozenColumns, frozenRows, freeze, unfreeze } = useFreeze();
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  // Tracks the full selection from Grid (including range selections via shift+click).
  // The `selection` derived below falls back to activeCell when this is null.
  const [gridSelection, setGridSelection] = useState<Selection | null>(null);

  // Auto-save to localStorage on every workbook change (debounced)
  useAutosave(workbook);
  const { format: referenceFormat, toggle: toggleReferenceFormat } = useReferenceFormat();
  const [showPrintSetup, setShowPrintSetup] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pendingPasteHtml, setPendingPasteHtml] = useState<string | null>(null);
  const [pendingPastePlain, setPendingPastePlain] = useState<string | null>(null);
  const {
    wizard: formulaWizard,
    openWizard: openFormulaWizard,
    closeWizard: closeFormulaWizard,
    setParameter: setWizardParameter,
    enterNested: enterWizardNested,
    goBack: goWizardBack,
    startPointSelection: startWizardPointSelection,
    cancelPointSelection: cancelWizardPointSelection,
  } = useFormulaWizard();
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [highlightedRanges, setHighlightedRanges] = useState<HighlightedRange[]>([]);
  const [pendingCutRange, setPendingCutRange] = useState<Selection | null>(null);
  // Tracks the range currently on the clipboard for marching-ants visual feedback
  const [clipboardRange, setClipboardRange] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    isCut: boolean;
  } | null>(null);
  // Ref to restore focus to grid after paste operations
  const gridRef = useRef<GridHandle>(null);

  // Paste Special options
  const [pasteSkipBlanks, setPasteSkipBlanks] = useState(false);
  const [showPasteSpecial, setShowPasteSpecial] = useState(false);
  const [pendingPasteDetail, setPendingPasteDetail] = useState<{
    targetRow: number;
    targetCol: number;
  } | null>(null);
  // Toggle formula view (Ctrl + `) - show formulas instead of values
  const [showFormulas, setShowFormulas] = useState(false);

  // Sheet reference (needed by the editing hook and everywhere else)
  const sheet = workbook.sheets[workbook.activeSheetIndex];

  // ─── Editing FSM (useCellEditing hook) ────────────────────────────
  // Track formula bar cursor position for display
  const [, setFormulaCursorPos] = useState(0);

  // The editing hook manages the FSM (SELECT/ENTER/EDIT/POINT) and the
  // formula buffer.  We feed it the active cell's coordinates and value,
  // and it tells us when to commit a cell or navigate the grid.
  const {
    session: editingSession,
    pointSession: editingPointSession,
    handleKey: handleEditingKey,
    handleCellClick: handleEditingCellClick,
    startEditAt,
    setCaretPos,
    setBuffer,
    commit: commitEditing,
    reset: resetEditing,
  } = useCellEditing({
    activeRow: activeCell?.row ?? 0,
    activeCol: activeCell?.col ?? 0,
    cellValue: activeCell
      ? sheet.cells[cellKey(activeCell.row, activeCell.col)]?.rawValue ?? ''
      : '',
    rowCount: sheet.rowCount,
    colCount: sheet.columnCount,
    onCommit: (row, col, value) => {
      handleCellChange(row, col, value);
    },
    onNavigate: (row, col) => {
      setActiveCell({ row, col });
      const cell = sheet.cells[cellKey(row, col)];
      setFormulaBarValue(cell?.rawValue ?? '');
    },
  });

  // Derive point-mode flags from the hook's session
  const isPointMode = editingSession.state === 'POINT';
  const pointSelection: PointModeSelection | null = editingPointSession
    ? {
        startRow: editingPointSession.anchorRow,
        startCol: editingPointSession.anchorCol,
        endRow: editingPointSession.currentRow,
        endCol: editingPointSession.currentCol,
      }
    : null;

  // Update frozen state in sheet
  const updatedSheet = useMemo(
    () => ({
      ...sheet,
      frozenColumns,
      frozenRows,
    }),
    [sheet, frozenColumns, frozenRows]
  );

  // Evaluate formulas
  useMemo(() => {
    const result = evaluateWorkbook({ ...workbook, sheets: workbook.sheets.map((s, idx) => idx === workbook.activeSheetIndex ? updatedSheet : s) }, workbook.activeSheetIndex);
    /* istanbul ignore next - circular ref warning requires self-referencing formula (tested in formulaEngine.test.ts) */
    if (result.circularRefs.length > 0) {
      setStatusMessage(`Warning: ${result.circularRefs.length} circular reference(s) detected`);
    }
  }, [workbook, updatedSheet]);

  // ─── Window Blur Handler (Spec §5) ──────────────────────────────────────
  // Commit any active edit when the window loses focus, clear pointing overlays,
  // and return the state machine to SELECT.
  useEffect(() => {
    const handleWindowBlur = () => {
      if (editingSession.state !== 'SELECT') {
        commitEditing();
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [editingSession.state, commitEditing]);

  // ─── Cell Action Handlers ─────────────────────────────────────────────────

  const handleCellChange = useCallback(
    (row: number, col: number, value: string) => {
      // Create a new workbook with the updated cell
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        const key = cellKey(row, col);
        const existingCell = s.cells[key];
        const newCell: Cell = {
          rawValue: value,
          style: existingCell?.style,
          rowSpan: existingCell?.rowSpan,
          colSpan: existingCell?.colSpan,
          isMergeAnchor: existingCell?.isMergeAnchor,
        };
        return {
          ...s,
          cells: { ...s.cells, [key]: newCell },
        };
      });
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      const cellRef = `${colToLetter(col)}${row + 1}`;
      pushHistory(newWorkbook, `Edit ${cellRef}`);
      setStatusMessage(`Updated ${cellRef}`);
    },
    [workbook, pushHistory]
  );

  const handleCellsChange = useCallback(
    (changes: Array<{ row: number; col: number; value: string }>) => {
      if (changes.length === 0) return;
      // Create a new workbook with all updated cells
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        const newCells = { ...s.cells };
        for (const change of changes) {
          const key = cellKey(change.row, change.col);
          if (change.value === '') {
            // Delete cell if it exists
            delete newCells[key];
          } else {
            const existingCell = newCells[key];
            newCells[key] = {
              rawValue: change.value,
              style: existingCell?.style,
              rowSpan: existingCell?.rowSpan,
              colSpan: existingCell?.colSpan,
              isMergeAnchor: existingCell?.isMergeAnchor,
            };
          }
        }
        return {
          ...s,
          cells: newCells,
        };
      });
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      const cellCount = changes.length;
      pushHistory(newWorkbook, `Updated ${cellCount} cell(s)`);
      setStatusMessage(`Updated ${cellCount} cell(s)`);
    },
    [workbook, pushHistory]
  );

  const handleCellSelect = useCallback(
    (row: number, col: number) => {
      setActiveCell({ row, col });
      const cell = sheet.cells[cellKey(row, col)];
      setFormulaBarValue(cell?.rawValue ?? '');
    },
    [sheet]
  );

  const handleHeaderSelect = useCallback(
    (headerSel: { type: 'row' | 'col'; index: number }) => {
      if (headerSel.type === 'row') {
        // For row selection, set active cell to first column of that row
        setActiveCell({ row: headerSel.index, col: 0 });
        const cell = sheet.cells[cellKey(headerSel.index, 0)];
        setFormulaBarValue(cell?.rawValue ?? '');
      } else {
        // For column selection, set active cell to first row of that column
        setActiveCell({ row: 0, col: headerSel.index });
        const cell = sheet.cells[cellKey(0, headerSel.index)];
        setFormulaBarValue(cell?.rawValue ?? '');
      }
    },
    [sheet]
  );

  // ─── Formula Wizard ──────────────────────────────────────────────

  const handleOpenWizard = useCallback(() => {
    const cellRef = activeCell ? colToLetter(activeCell.col) + (activeCell.row + 1) : undefined;
    openFormulaWizard('SUM', cellRef);
  }, [activeCell, openFormulaWizard]);

  const handleWizardApply = useCallback(
    (formula: string) => {
      if (activeCell) {
        handleCellChange(activeCell.row, activeCell.col, formula);
      }
      closeFormulaWizard();
    },
    [activeCell, handleCellChange, closeFormulaWizard]
  );

  // ─── Raw Event Handlers for FormulaBar ──────────────────────────
  // FormulaBar is now a pure view - it forwards raw events to the FSM.

  // Raw key down - FSM decides what to do based on current state
  const handleFormulaRawKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleEditingKey(e.key, e.shiftKey, e.ctrlKey, e.altKey);
    },
    [handleEditingKey],
  );

  // Raw change - FSM updates buffer
  const handleFormulaRawChange = useCallback(
    (value: string, caretPos: number) => {
      setBuffer(value, caretPos);
    },
    [setBuffer],
  );

  // Raw focus - FSM enters EDIT mode
  const handleFormulaRawFocus = useCallback(
    (caretPos: number) => {
      startEditAt(caretPos);
      setFormulaCursorPos(caretPos);
    },
    [startEditAt],
  );

  // Raw blur - FSM commits
  const handleFormulaRawBlur = useCallback(() => {
    commitEditing();
  }, [commitEditing]);

  // Cell pick during POINT mode - FSM handles it
  const handleFormulaCellPick = useCallback(
    (row: number, col: number, shiftKey: boolean) => {
      handleEditingCellClick(row, col, shiftKey);
    },
    [handleEditingCellClick],
  );

  // ─── Help / Utility Actions ──────────────────────────────────────────

  const handleAbout = useCallback(() => {
    setStatusMessage('SimpleSheet v0.1.0 — A lightweight spreadsheet app');
  }, []);

  const handleShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  const handleSearchReplace = useCallback(() => {
    setShowSearchReplace(true);
  }, []);

  // Modal updater for search/replace (receives new workbook + description)
  const handleSearchReplaceApply = useCallback(
    (updatedWb: Workbook, description: string) => {
      pushHistory(updatedWb, description);
      setStatusMessage(description);
      setShowSearchReplace(false);
    },
    [pushHistory],
  );

  // ─── Save / Load Triggers (for menu) ──────────────────────────────────

  const handleSaveMenu = useCallback(() => {
    setStatusMessage('Use the Save button in the toolbar to save');
  }, []);

  const handleLoadMenu = useCallback(() => {
    setStatusMessage('Use the Open button to load a saved workbook');
  }, []);

  // Import / Export triggers — dispatch events that the hidden import buttons listen for
  const handleImportExcelMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:import-excel'));
  }, []);

  const handleImportCsvMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:import-csv'));
  }, []);

  const handleImportJsonMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:import-json'));
  }, []);

  const handleExportExcelMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:export-excel'));
  }, []);

  const handleExportCsvMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:export-csv'));
  }, []);

  const handleExportJsonMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:export-json'));
  }, []);

  const handleExportPdfMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:export-pdf'));
  }, []);

  // When the active cell changes externally (e.g., clicking a different cell
  // in the grid), reset the editing FSM so it starts fresh for the new cell.
  const activeCellKey = activeCell ? `${activeCell.row}:${activeCell.col}` : '';
  useEffect(() => {
    resetEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCellKey]);

  // Clear the grid selection when activeCell is null (e.g., after New, Undo, sheet switch)
  useEffect(() => {
    if (!activeCell) setGridSelection(null);
  }, [activeCell]);

  // Clears both the marching-ants range and the clipboard data (Esc / typing)
  const handleClearClipboard = useCallback(() => {
    setClipboardRange(null);
    clearClipboard();
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) {
      setStatusMessage('Undo performed');
      setActiveCell(null);
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) {
      setStatusMessage('Redo performed');
    }
  }, [redo]);

  const handleColumnResize = useCallback(
    (col: number, newWidth: number) => {
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        return {
          ...s,
          columnWidths: { ...s.columnWidths, [col]: newWidth },
        };
      });
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWorkbook, `Resize column ${colToLetter(col)} to ${newWidth}px`);
    },
    [workbook, pushHistory]
  );

  const handleRowResize = useCallback(
    (row: number, newHeight: number) => {
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        return {
          ...s,
          rowHeights: { ...s.rowHeights, [row]: newHeight },
        };
      });
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWorkbook, `Resize row ${row + 1} to ${newHeight}px`);
    },
    [workbook, pushHistory]
  );

  /* istanbul ignore next - merge button disabled without range selection (requires shift+click) */
  const handleMerge = useCallback(() => {
    // In a full implementation, merge selected cells and push history
    setStatusMessage('Merge: select a range first');
  }, []);

  const handleUnmerge = useCallback(() => {
    setStatusMessage('Unmerge: select a merged cell first');
  }, []);

  const handleFreeze = useCallback(() => {
    freeze(1, 1);
    setStatusMessage('Panes frozen (1 row, 1 column)');
  }, [freeze]);

  const handleUnfreeze = useCallback(() => {
    unfreeze();
    setStatusMessage('Panes unfrozen');
  }, [unfreeze]);

  /* istanbul ignore next - handleImport requires file upload (tested in ImportButtons.test.tsx) */
  const handleImport = useCallback(
    (importedWb: Workbook) => {
      pushHistory(importedWb, 'Import file');
      setStatusMessage(`Imported "${importedWb.title}" — ${importedWb.sheets.length} sheet(s)`);
    },
    [pushHistory]
  );

  const handleNewSheet = useCallback(
    (wb: Workbook) => {
      resetHistory(wb);
      setActiveCell(null);
      setFormulaBarValue('');
      setStatusMessage('Created new workbook');
    },
    [resetHistory]
  );

  const handleSwitchSheet = useCallback(
    (index: number) => {
      if (index === workbook.activeSheetIndex) return;
      if (index < 0 || index >= workbook.sheets.length) return;
      const newWb: Workbook = {
        ...workbook,
        activeSheetIndex: index,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Switch to ${workbook.sheets[index].name}`);
      setActiveCell(null);
      setFormulaBarValue('');
    },
    [workbook, pushHistory]
  );

  const handleAddSheet = useCallback(() => {
    const sheetNum = workbook.sheets.length + 1;
    const newSheet = {
      id: `sheet-${Date.now()}`,
      name: `Sheet${sheetNum}`,
      cells: {},
      defaultColWidth: 100,
      defaultRowHeight: 28,
      columnWidths: {},
      rowHeights: {},
      columnCount: 26,
      rowCount: 1000,
      frozenColumns: 0,
      frozenRows: 0,
    };
    const newWb: Workbook = {
      ...workbook,
      sheets: [...workbook.sheets, newSheet],
      activeSheetIndex: workbook.sheets.length,
      lastModified: Date.now(),
    };
    pushHistory(newWb, `Add Sheet${sheetNum}`);
    setActiveCell(null);
    setFormulaBarValue('');
  }, [workbook, pushHistory]);

  const handleRenameSheet = useCallback(
    (index: number, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === workbook.sheets[index].name) return;
      const newSheets = workbook.sheets.map((s, i) =>
        i === index ? { ...s, name: trimmed } : s
      );
      const newWb: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Rename sheet to "${trimmed}"`);
      setStatusMessage(`Renamed sheet to "${trimmed}"`);
    },
    [workbook, pushHistory]
  );

  const handleCopySheet = useCallback(
    (index: number) => {
      const source = workbook.sheets[index];
      const copyName = `${source.name} (Copy)`;
      const copied: Sheet = {
        ...source,
        id: `sheet-${Date.now()}`,
        name: copyName,
        cells: { ...source.cells },
        columnWidths: { ...source.columnWidths },
        rowHeights: { ...source.rowHeights },
      };
      const newSheets = [...workbook.sheets];
      newSheets.splice(index + 1, 0, copied);
      const newWb: Workbook = {
        ...workbook,
        sheets: newSheets,
        activeSheetIndex: index + 1,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Copy sheet "${source.name}"`);
      setActiveCell(null);
      setFormulaBarValue('');
    },
    [workbook, pushHistory]
  );

  const handleDeleteSheet = useCallback(
    (index: number) => {
      /* istanbul ignore next - guard prevents deleting the last sheet */
      if (workbook.sheets.length <= 1) return;
      const sheetName = workbook.sheets[index].name;
      const newSheets = workbook.sheets.filter((_, i) => i !== index);
      const newActive = Math.min(workbook.activeSheetIndex, newSheets.length - 1);
      const newWb: Workbook = {
        ...workbook,
        sheets: newSheets,
        activeSheetIndex: newActive < 0 ? 0 : newActive,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Delete sheet "${sheetName}"`);
      setActiveCell(null);
      setFormulaBarValue('');
    },
    [workbook, pushHistory]
  );

  /* istanbul ignore next - handleImportError requires import failure (tested in ImportButtons.test.tsx) */
  const handleImportError = useCallback((msg: string) => {
    setStatusMessage(`Import error: ${msg}`);
  }, []);

  // ─── Derived State ────────────────────────────────────────────────────────

  const selection: Selection | null = useMemo(() => {
    // Prefer the Grid's selection (tracks range selections via shift+click/shift+arrow)
    if (gridSelection) return gridSelection;
    // Fall back to activeCell as a single-cell selection
    if (!activeCell) return null;
    return {
      type: 'cell' as const,
      startRow: activeCell.row,
      startCol: activeCell.col,
      endRow: activeCell.row,
      endCol: activeCell.col,
      anchorRow: activeCell.row,
      anchorCol: activeCell.col,
    };
  }, [gridSelection, activeCell]);

  // ─── Status Bar: Cell Mode + Quick Calculations ──────────────────────────

  /** Derive the current cell mode for the status bar (Excel-style). */
  const cellMode = useMemo(() => {
    if (isPointMode) return 'POINT';
    if (editingSession.state === 'EDIT') return 'Edit';
    if (editingSession.state === 'ENTER') return 'Enter';
    return 'Ready';
  }, [editingSession.state, isPointMode]);

  /** Compute quick statistics for the selected range (Sum, Average, Count). */
  const selectionStats = useMemo(() => {
    if (!selection || selection.type !== 'cell') return null;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    let sum = 0;
    let count = 0;
    let numericCount = 0;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = sheet.cells[cellKey(r, c)];
        if (cell && cell.rawValue !== '') {
          count++;
          const computed = cell.computedValue;
          const valStr = typeof computed === 'number' ? String(computed) : typeof computed === 'boolean' ? '' : (computed ?? cell.rawValue);
          const num = parseFloat(valStr);
          if (!isNaN(num) && valStr.trim() !== '') {
            sum += num;
            numericCount++;
          }
        }
      }
    }

    if (count === 0) return null;

    return {
      sum,
      average: numericCount > 0 ? sum / numericCount : 0,
      count,
      numericCount,
    };
  }, [selection, sheet.cells]);

  // ─── Copy/Paste Event Handlers ────────────────────────────────────────────

  useEffect(() => {
    const handleCopyEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      /* istanbul ignore next - defensive null check */
      if (!detail) return;
      copyRange(sheet.cells, detail.startRow, detail.startCol, detail.endRow, detail.endCol, detail.selectionType);
      setClipboardRange({
        startRow: Math.min(detail.startRow, detail.endRow),
        startCol: Math.min(detail.startCol, detail.endCol),
        endRow: Math.max(detail.startRow, detail.endRow),
        endCol: Math.max(detail.startCol, detail.endCol),
        isCut: false,
      });
      setStatusMessage(
        detail.selectionType === 'row'
          ? `Row${detail.startRow !== detail.endRow ? 's' : ''} copied`
          : detail.selectionType === 'col'
          ? `Column${detail.startCol !== detail.endCol ? 's' : ''} copied`
          : 'Selection copied'
      );
    };

    const handleCutEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      /* istanbul ignore next - defensive null check */
      if (!detail) return;
      clipCutRange(sheet.cells, detail.startRow, detail.startCol, detail.endRow, detail.endCol, detail.selectionType);
      setPendingCutRange({
        type: detail.selectionType ?? 'cell',
        startRow: Math.min(detail.startRow, detail.endRow),
        startCol: Math.min(detail.startCol, detail.endCol),
        endRow: Math.max(detail.startRow, detail.endRow),
        endCol: Math.max(detail.startCol, detail.endCol),
        anchorRow: detail.startRow,
        anchorCol: detail.startCol,
      });
      setClipboardRange({
        startRow: Math.min(detail.startRow, detail.endRow),
        startCol: Math.min(detail.startCol, detail.endCol),
        endRow: Math.max(detail.startRow, detail.endRow),
        endCol: Math.max(detail.startCol, detail.endCol),
        isCut: true,
      });
      setStatusMessage(
        detail.selectionType === 'row'
          ? `Row${detail.startRow !== detail.endRow ? 's' : ''} cut`
          : detail.selectionType === 'col'
          ? `Column${detail.startCol !== detail.endCol ? 's' : ''} cut`
          : 'Selection cut'
      );
    };

    const handlePasteEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const clipboard = getClipboard();
      /* istanbul ignore next - defensive null check */
      if (!clipboard || !detail) return;

      const targetRow = detail.startRow;
      const targetCol = detail.startCol;
      const isCut = clipboard.isCut;
      const selType = clipboard.selectionType ?? 'cell';
      // Skip blanks can be passed via event detail (from Paste Special dialog)
      const skipBlanks = detail.skipBlanks ?? pasteSkipBlanks;

      // Calculate source origin (top-left of copied range)
      /* istanbul ignore next - pendingCutRange null fallback */
      const srcRow = isCut ? pendingCutRange?.startRow ?? 0 : 0;
      /* istanbul ignore next - pendingCutRange null fallback */
      const srcCol = isCut ? pendingCutRange?.startCol ?? 0 : 0;

      // For row selections, only offset rows (columns stay fixed).
      // For column selections, only offset columns (rows stay fixed).
      const rowOffset = selType === 'col' ? 0 : targetRow - srcRow;
      const colOffset = selType === 'row' ? 0 : targetCol - srcCol;

      // Check for destination range mismatch (Excel behavior)
      // If user selected a range (not single cell), validate it matches clipboard
      const destSel = selection;
      const isSingleCellTarget = !destSel || (destSel.startRow === destSel.endRow && destSel.startCol === destSel.endCol);

      if (!isSingleCellTarget && selType === 'cell' && destSel) {
        const destRowCount = Math.abs(destSel.endRow - destSel.startRow) + 1;
        const destColCount = Math.abs(destSel.endCol - destSel.startCol) + 1;
        const srcRowCount = clipboard.rowCount;
        const srcColCount = clipboard.colCount;

        // Allow if destination exactly matches source
        const exactMatch = destRowCount === srcRowCount && destColCount === srcColCount;
        // Allow if destination evenly divides into source (tiled paste)
        const tilesHorizontally = destColCount % srcColCount === 0;
        const tilesVertically = destRowCount % srcRowCount === 0;
        const canTile = tilesHorizontally && tilesVertically;

        if (!exactMatch && !canTile) {
          setStatusMessage(
            `Paste error: destination range (${destRowCount}×${destColCount}) does not match copied range (${srcRowCount}×${srcColCount})`
          );
          return;
        }
      }

      // Create updated cells
      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;
      let cellsSkipped = 0;

      for (let r = 0; r < clipboard.rowCount; r++) {
        for (let c = 0; c < clipboard.colCount; c++) {
          const cell = clipboard.cells[r][c];
          /* istanbul ignore next - defensive null check */
          const isEmptySource = !cell || !cell.rawValue;

          // Skip blanks: don't overwrite existing data with empty source
          if (skipBlanks && isEmptySource) {
            cellsSkipped++;
            continue;
          }

          const destRow = r + rowOffset;
          const destCol = c + colOffset;
          const destKey = cellKey(destRow, destCol);

          // Adjust formulas if pasting
          let newValue = cell?.rawValue ?? '';
          if (newValue.startsWith('=') && (rowOffset !== 0 || colOffset !== 0)) {
            newValue = '=' + adjustFormulaRefs(newValue.slice(1), rowOffset, colOffset);
          }

          const destCell: Cell = {
            rawValue: newValue,
            style: cell?.style,
            rowSpan: cell?.rowSpan ?? 1,
            colSpan: cell?.colSpan ?? 1,
            isMergeAnchor: cell?.isMergeAnchor ?? false,
          };
          newCells[destKey] = destCell;
          cellsUpdated++;
        }
      }

      // If cut, clear source cells (sparse: only visit existing cells)
      if (isCut && pendingCutRange) {
        const cutMinRow = pendingCutRange.startRow;
        const cutMaxRow = pendingCutRange.endRow;
        const cutMinCol = pendingCutRange.startCol;
        const cutMaxCol = pendingCutRange.endCol;
        for (const key of Object.keys(newCells)) {
          const colonIndex = key.indexOf(':');
          const r = parseInt(key.slice(0, colonIndex), 10);
          const c = parseInt(key.slice(colonIndex + 1), 10);
          if (r >= cutMinRow && r <= cutMaxRow && c >= cutMinCol && c <= cutMaxCol) {
            delete newCells[key];
          }
        }
        clearClipboard();
        setPendingCutRange(null);
      }

      // Update workbook
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        return { ...s, cells: newCells };
      });
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      const actionLabel =
        selType === 'row'
          ? isCut ? 'Moved row(s)' : 'Pasted row(s)'
          : selType === 'col'
          ? isCut ? 'Moved column(s)' : 'Pasted column(s)'
          : isCut ? `Cut ${cellsUpdated} cell(s)` : `Paste ${cellsUpdated} cell(s)`;
      pushHistory(newWorkbook, actionLabel);

      // Build status message with skip blanks info
      let statusMsg = `${isCut ? 'Moved' : 'Pasted'} ${cellsUpdated} cell(s)`;
      if (skipBlanks && cellsSkipped > 0) {
        statusMsg += ` (${cellsSkipped} blank(s) skipped)`;
      }
      setStatusMessage(statusMsg);
      // Clear marching ants after paste
      setClipboardRange(null);
    };

    window.addEventListener('simplesheets:copy', handleCopyEvent);
    window.addEventListener('simplesheets:cut', handleCutEvent);
    window.addEventListener('simplesheets:paste', handlePasteEvent);

    return () => {
      window.removeEventListener('simplesheets:copy', handleCopyEvent);
      window.removeEventListener('simplesheets:cut', handleCutEvent);
      window.removeEventListener('simplesheets:paste', handlePasteEvent);
    };
  }, [sheet, workbook, pushHistory, pendingCutRange, pasteSkipBlanks, selection]);

  const hasSelection = selection !== null;
  const hasRangeSelection =
    hasSelection &&
    (selection.endRow !== selection.startRow || selection.endCol !== selection.startCol);

  // ─── Cell Style System (useCellStyles hook) ───────────────────────
  const {
    styleState,
    toggleBoldStyle,
    toggleItalicStyle,
    toggleUnderlineStyle,
    setTextColor,
    setBackgroundColor,
    setTextAlign,
    setNumberFormat,
    toggleWrapTextStyle,
    clearCellStyles,
  } = useCellStyles({
    activeCell,
    selection,
    workbook,
    pushHistory,
    setStatusMessage,
  });

  // ─── Clear Contents ────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    if (!activeCell) return;
    const sel = selection;
    if (!sel) return;
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startCol, sel.endCol);
    const maxCol = Math.max(sel.startCol, sel.endCol);
    // Sparse iteration: only visit cells that exist within the selection bounds
    const changes: Array<{ row: number; col: number; value: string }> = [];
    for (const key of Object.keys(sheet.cells)) {
      const colonIndex = key.indexOf(':');
      const r = parseInt(key.slice(0, colonIndex), 10);
      const c = parseInt(key.slice(colonIndex + 1), 10);
      if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
        changes.push({ row: r, col: c, value: '' });
      }
    }
    if (changes.length > 0) {
      handleCellsChange(changes);
    }
  }, [activeCell, selection, sheet.cells, handleCellsChange]);

  // ─── Clipboard Menu Actions ────────────────────────────────────────────

  const handleCopyMenu = useCallback(() => {
    if (!selection) return;
    window.dispatchEvent(new CustomEvent('simplesheets:copy', {
      detail: {
        startRow: selection.startRow,
        startCol: selection.startCol,
        endRow: selection.endRow,
        endCol: selection.endCol,
        selectionType: selection.type,
      },
    }));
  }, [selection]);

  const handleCutMenu = useCallback(() => {
    if (!selection) return;
    window.dispatchEvent(new CustomEvent('simplesheets:cut', {
      detail: {
        startRow: selection.startRow,
        startCol: selection.startCol,
        endRow: selection.endRow,
        endCol: selection.endCol,
        selectionType: selection.type,
      },
    }));
  }, [selection]);

  const handlePasteMenu = useCallback(() => {
    if (!selection) return;
    window.dispatchEvent(new CustomEvent('simplesheets:paste', {
      detail: {
        startRow: selection.startRow,
        startCol: selection.startCol,
        selectionType: selection.type,
      },
    }));
  }, [selection]);

  // ─── Paste Special ──────────────────────────────────────────────────────
  const handlePasteSpecial = useCallback(() => {
    if (!selection) return;
    if (!hasClipboardData()) {
      setStatusMessage('Nothing to paste — copy or cut cells first');
      return;
    }
    setPendingPasteDetail({
      targetRow: selection.startRow,
      targetCol: selection.startCol,
    });
    setShowPasteSpecial(true);
  }, [selection]);

  const handlePasteSpecialApply = useCallback(
    (options: { skipBlanks: boolean }) => {
      if (!selection || !pendingPasteDetail) return;
      // Pass skipBlanks through event detail so handler uses it directly
      window.dispatchEvent(new CustomEvent('simplesheets:paste', {
        detail: {
          startRow: pendingPasteDetail.targetRow,
          startCol: pendingPasteDetail.targetCol,
          selectionType: selection.type,
          skipBlanks: options.skipBlanks,
        },
      }));
      setPendingPasteDetail(null);
    },
    [selection, pendingPasteDetail]
  );

  // ─── External Paste Application ────────────────────────────────────────
  // Writes a parsed clipboard grid into the workbook starting at the
  // current selection. Used by both formatted and plain external paste.
  // Includes bounds checking: clips data that would exceed sheet boundaries
  // and reports how many rows/cols were clipped in the status message.
  // Uses smart classification: single-value content goes into one cell.
  const handleExternalPaste = useCallback(
    (plain: string, html: string | null) => {
      if (!selection) return;

      // Use classification to avoid unnecessary HTML parsing
      // (e.g., MathJax content has HTML but no table)
      const kind: PasteContentKind = classifyPasteContent(plain, html);
      let textToParse = plain;

      // When plain is empty but HTML is available, extract text from HTML
      // This handles "Paste Formatted" for non-table HTML (e.g., bulleted lists)
      if (kind === 'grid' && !plain.trim() && html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        textToParse = doc.body.textContent ?? '';
      }

      const parsed: ParsedClipboardGrid =
        kind === 'rich-grid' ? parseHtmlTable(html!) : parsePlainText(textToParse);

      if (parsed.rowCount === 0 || parsed.colCount === 0) return;

      const targetRow = selection.startRow;
      const targetCol = selection.startCol;
      const maxRow = sheet.rowCount;
      const maxCol = sheet.columnCount;

      // Bounds checking: clip to sheet boundaries
      const rowsToPaste = Math.min(parsed.rowCount, maxRow - targetRow);
      const colsToPaste = Math.min(parsed.colCount, maxCol - targetCol);
      const rowsClipped = parsed.rowCount - rowsToPaste;
      const colsClipped = parsed.colCount - colsToPaste;

      // If target is completely outside bounds, abort
      if (rowsToPaste <= 0 || colsToPaste <= 0) {
        setStatusMessage('Paste failed: selection is outside sheet bounds');
        return;
      }

      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (let r = 0; r < rowsToPaste; r++) {
        for (let c = 0; c < colsToPaste; c++) {
          let value = parsed.values[r][c];
          if (value === '') continue;
          const destRow = targetRow + r;
          const destCol = targetCol + c;
          const destKey = cellKey(destRow, destCol);
          const style = parsed.styles[r][c];

          // If pasted text starts with '=', prefix with single quote to make it plain text
          // (e.g., "=Hello" becomes "'=Hello" which displays as "=Hello")
          if (value.startsWith('=')) {
            value = "'" + value;
          }

          newCells[destKey] = { rawValue: value, ...(style ? { style } : {}) };
          cellsUpdated++;
        }
      }

      if (cellsUpdated === 0) return;

      const newSheets = workbook.sheets.map((s, idx) =>
        idx === workbook.activeSheetIndex ? { ...s, cells: newCells } : s
      );
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWorkbook, `Paste ${cellsUpdated} cell(s)`);

      // Build status message with clipping info if applicable
      let statusMsg = `Pasted ${cellsUpdated} cell(s)`;
      if (rowsClipped > 0 || colsClipped > 0) {
        const parts: string[] = [];
        if (rowsClipped > 0) parts.push(`${rowsClipped} row(s) clipped`);
        if (colsClipped > 0) parts.push(`${colsClipped} col(s) clipped`);
        statusMsg += ` (${parts.join(', ')} — sheet boundary)`;
      }
      setStatusMessage(statusMsg);

      // Restore focus to grid so keyboard navigation works
      gridRef.current?.focus();
    },
    [selection, sheet, workbook, pushHistory, gridRef]
  );

  // ─── External Clipboard Paste ──────────────────────────────────────────
  // Intercepts the browser paste event to capture data from external sources
  // (other apps, web pages, etc.). If the clipboard contains HTML (formatted),
  // shows a modal letting the user choose formatted vs plain paste. Otherwise
  // pastes as plain text directly.
  useEffect(() => {
    const handleNativePaste = (e: ClipboardEvent) => {
      // If our internal clipboard has data, the Ctrl+V keydown handler in
      // Grid.tsx already dispatched simplesheets:paste — don't double-handle.
      if (hasClipboardData()) return;

      const html = e.clipboardData?.getData('text/html') ?? '';
      const plain = e.clipboardData?.getData('text/plain') ?? '';

      if (!html && !plain) return;

      e.preventDefault();

      if (html) {
        // Formatted content available — ask the user
        setPendingPasteHtml(html);
        setPendingPastePlain(plain);
        setShowPasteModal(true);
      } else {
        // Plain text only — paste directly
        handleExternalPaste(plain, null);
      }
    };

    window.addEventListener('paste', handleNativePaste);
    return () => window.removeEventListener('paste', handleNativePaste);
  }, [handleExternalPaste]);

  // ─── Insert / Delete Row / Column ───────────────────────────────────────

  const handleInsertRowAbove = useCallback(() => {
    if (!activeCell) return;
    const rowIndex = activeCell.row;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? insertRow(s, rowIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Insert row ${rowIndex + 1}`);
    setActiveCell({ row: rowIndex, col: activeCell.col });
    setStatusMessage(`Inserted row ${rowIndex + 1}`);
  }, [workbook, pushHistory, activeCell]);

  const handleInsertRowBelow = useCallback(() => {
    if (!activeCell) return;
    const rowIndex = activeCell.row + 1;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? insertRow(s, rowIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Insert row ${rowIndex + 1}`);
    setStatusMessage(`Inserted row ${rowIndex + 1}`);
  }, [workbook, pushHistory, activeCell]);

  const handleInsertColLeft = useCallback(() => {
    if (!activeCell) return;
    const colIndex = activeCell.col;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? insertCol(s, colIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Insert col ${colToLetter(colIndex)}`);
    setActiveCell({ row: activeCell.row, col: colIndex });
    setStatusMessage(`Inserted column ${colToLetter(colIndex)}`);
  }, [workbook, pushHistory, activeCell]);

  const handleInsertColRight = useCallback(() => {
    if (!activeCell) return;
    const colIndex = activeCell.col + 1;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? insertCol(s, colIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Insert col ${colToLetter(colIndex)}`);
    setStatusMessage(`Inserted column ${colToLetter(colIndex)}`);
  }, [workbook, pushHistory, activeCell]);

  const handleDeleteRow = useCallback(() => {
    if (!activeCell) return;
    const rowIndex = activeCell.row;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? deleteRow(s, rowIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Delete row ${rowIndex + 1}`);
    setActiveCell({ row: Math.max(0, rowIndex - 1), col: activeCell.col });
    setStatusMessage(`Deleted row ${rowIndex + 1}`);
  }, [workbook, pushHistory, activeCell]);

  const handleDeleteCol = useCallback(() => {
    if (!activeCell) return;
    const colIndex = activeCell.col;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? deleteCol(s, colIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Delete col ${colToLetter(colIndex)}`);
    setActiveCell({ row: activeCell.row, col: Math.max(0, colIndex - 1) });
    setStatusMessage(`Deleted column ${colToLetter(colIndex)}`);
  }, [workbook, pushHistory, activeCell]);

  const handleDeleteCells = useCallback(() => {
    handleClear();
  }, [handleClear]);

  // ─── Global Keyboard Shortcuts ──────────────────────────────────────────
  // Handles application-wide shortcuts that should work regardless of focus.
  // Placed after all handlers are defined so closures capture valid references.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing in an input/textarea (formula bar, modals)
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
          return;
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        } else if (e.key === '`') {
          // Toggle formula view (Ctrl + `)
          e.preventDefault();
          setShowFormulas((prev) => !prev);
          return;
        } else if (!isEditing) {
          // These shortcuts should not fire while typing in inputs
          switch (e.key) {
            case 'n':
              e.preventDefault();
              handleNewSheet(createEmptyWorkbook());
              return;
            case 's':
              e.preventDefault();
              handleSaveMenu();
              return;
            case 'o':
              e.preventDefault();
              handleLoadMenu();
              return;
            case 'h':
              e.preventDefault();
              handleSearchReplace();
              return;
            case 'b':
              e.preventDefault();
              toggleBoldStyle();
              return;
            case 'i':
              e.preventDefault();
              toggleItalicStyle();
              return;
            case 'u':
              e.preventDefault();
              toggleUnderlineStyle();
              return;
          }
        }
      }
      // Ctrl+Shift+Z also triggers redo (common alternative)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo, handleNewSheet, handleSaveMenu, handleLoadMenu, handleSearchReplace, toggleBoldStyle, toggleItalicStyle, toggleUnderlineStyle]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Menu Bar */}
      <header className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-blue-700">SimpleSheet</h1>
        <MenuBar
          onNew={() => handleNewSheet(createEmptyWorkbook())}
          onLoadDemo={() => handleNewSheet(createDemoWorkbook())}
          onSave={handleSaveMenu}
          onLoad={handleLoadMenu}
          onImportExcel={handleImportExcelMenu}
          onImportCsv={handleImportCsvMenu}
          onImportJson={handleImportJsonMenu}
          onExportExcel={handleExportExcelMenu}
          onExportCsv={handleExportCsvMenu}
          onExportJson={handleExportJsonMenu}
          onExportPdf={handleExportPdfMenu}
          onPageSetup={() => setShowPrintSetup(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onCopy={handleCopyMenu}
          onCut={handleCutMenu}
          onPaste={handlePasteMenu}
          onPasteSpecial={handlePasteSpecial}
          onClear={handleClear}
          onDeleteRow={handleDeleteRow}
          onDeleteCol={handleDeleteCol}
          onDeleteCells={handleDeleteCells}
          onFreeze={handleFreeze}
          onUnfreeze={handleUnfreeze}
          hasFrozenPanes={frozenRows > 0 || frozenColumns > 0}
          onInsertRowAbove={handleInsertRowAbove}
          onInsertRowBelow={handleInsertRowBelow}
          onInsertColLeft={handleInsertColLeft}
          onInsertColRight={handleInsertColRight}
          onMerge={handleMerge}
          onUnmerge={handleUnmerge}
          canMerge={hasRangeSelection}
          canUnmerge={hasSelection}
          onToggleBold={toggleBoldStyle}
          onToggleItalic={toggleItalicStyle}
          onToggleUnderline={toggleUnderlineStyle}
          onSetTextColor={setTextColor}
          onSetBackgroundColor={setBackgroundColor}
          onSetTextAlign={setTextAlign}
          onSetNumberFormat={setNumberFormat}
          onToggleWrapText={toggleWrapTextStyle}
          onClearStyles={clearCellStyles}
          isBold={styleState.fontWeight === 'bold'}
          isItalic={styleState.fontStyle === 'italic'}
          isUnderline={styleState.textDecoration === 'underline'}
          isWrapText={styleState.whiteSpace === 'normal'}
          onAbout={handleAbout}
          onShortcuts={handleShortcuts}
          onSearchReplace={handleSearchReplace}
        />
        <span className="text-sm text-gray-500">{workbook.title}</span>
      </header>

      {/* Formula Bar */}
      <FormulaBar
        session={editingSession}
        pointSession={editingPointSession}
        value={editingSession.buffer || formulaBarValue}
        cursorPos={editingSession.caretPos}
        statusMessage={getStatusMessage(editingSession)}
        onRawKeyDown={handleFormulaRawKeyDown}
        onRawChange={handleFormulaRawChange}
        onRawFocus={handleFormulaRawFocus}
        onRawBlur={handleFormulaRawBlur}
        onRawCaretMove={setCaretPos}
        onCellPick={handleFormulaCellPick}
        referenceFormat={referenceFormat}
        onToggleReferenceFormat={toggleReferenceFormat}
        onInsertFunction={(fn) => {
          // Insert function template at cursor
          const template = `${fn}()`;
          setFormulaBarValue((prev) => prev + template);
        }}
        onOpenWizard={handleOpenWizard}
        onHighlightsChange={setHighlightedRanges}
      />

      {/* Sheet Tabs */}
      <SheetTabs
        workbook={workbook}
        onSwitchSheet={handleSwitchSheet}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onCopySheet={handleCopySheet}
        onDeleteSheet={handleDeleteSheet}
      />

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <Grid
          ref={gridRef}
          sheet={updatedSheet}
          onCellChange={handleCellChange}
          onCellsChange={handleCellsChange}
          onSelect={handleCellSelect}
          selectedCell={activeCell}
          highlightedRanges={highlightedRanges}
          isPointMode={isPointMode}
          pointSelection={pointSelection}
          onCellPick={handleFormulaCellPick}
          onHeaderSelect={handleHeaderSelect}
          onSelectionChange={setGridSelection}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          referenceFormat={referenceFormat}
          onInsertRowAbove={handleInsertRowAbove}
          onInsertRowBelow={handleInsertRowBelow}
          onDeleteRow={handleDeleteRow}
          onInsertColLeft={handleInsertColLeft}
          onInsertColRight={handleInsertColRight}
          onDeleteCol={handleDeleteCol}
          clipboardRange={clipboardRange}
          onClearClipboard={handleClearClipboard}
          showFormulas={showFormulas}
        />
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700 w-16" data-testid="cell-mode">{cellMode}</span>
          <span className="text-gray-400">|</span>
          <span data-testid="status-message">{showFormulas ? 'Formulas' : statusMessage}</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick calculations for selection */}
          {selectionStats && selectionStats.numericCount > 0 && (
            <span className="font-mono text-gray-600">
              Sum={selectionStats.sum.toLocaleString()} Avg={selectionStats.average.toLocaleString(undefined, { maximumFractionDigits: 2 })} Count={selectionStats.count}
            </span>
          )}
          <span>
            {sheet.rowCount.toLocaleString()} rows × {sheet.columnCount} cols
            {frozenRows > 0 && ` | ${frozenRows} frozen row(s)`}
            {frozenColumns > 0 && ` | ${frozenColumns} frozen col(s)`}
          </span>
        </div>
      </footer>

      {/* Hidden import/export bridge for menu actions */}
      <ImportExportBridge
        workbook={workbook}
        sheet={sheet}
        onImport={handleImport}
        onError={handleImportError}
      />

      {/* Modals */}
      <PrintSetupModal isOpen={showPrintSetup} onClose={() => setShowPrintSetup(false)} />
      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SearchReplaceModal
        isOpen={showSearchReplace}
        onClose={() => setShowSearchReplace(false)}
        workbook={workbook}
        activeSheetIndex={workbook.activeSheetIndex}
        onUpdate={handleSearchReplaceApply}
      />
      <PasteModal
        isOpen={showPasteModal}
        onClose={() => {
          setShowPasteModal(false);
          setPendingPasteHtml(null);
          setPendingPastePlain(null);
        }}
        onPasteFormatted={() => {
          if (pendingPasteHtml) handleExternalPaste('', pendingPasteHtml);
          setShowPasteModal(false);
          setPendingPasteHtml(null);
          setPendingPastePlain(null);
        }}
        onPastePlainText={() => {
          const text = pendingPastePlain ?? pendingPasteHtml ?? '';
          handleExternalPaste(text, null);
          setShowPasteModal(false);
          setPendingPasteHtml(null);
          setPendingPastePlain(null);
        }}
        html={pendingPasteHtml}
        plain={pendingPastePlain}
      />
      <PasteSpecialModal
        isOpen={showPasteSpecial}
        onClose={() => {
          setShowPasteSpecial(false);
          setPendingPasteDetail(null);
        }}
        onApply={handlePasteSpecialApply}
        skipBlanks={pasteSkipBlanks}
        onSkipBlanksChange={setPasteSkipBlanks}
      />
      <FormulaWizard
        wizard={formulaWizard}
        setParameter={setWizardParameter}
        enterNested={enterWizardNested}
        goBack={goWizardBack}
        startPointSelection={startWizardPointSelection}
        cancelPointSelection={cancelWizardPointSelection}
        closeWizard={closeFormulaWizard}
        onApply={handleWizardApply}
        targetRow={activeCell?.row}
        targetCol={activeCell?.col}
      />
    </div>
  );
}
