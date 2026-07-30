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
import { AboutModal } from './components/AboutModal';
import { SearchReplaceModal } from './components/SearchReplaceModal';
import { SheetTabs } from './components/SheetTabs';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { ImportExportBridge } from './components/ImportExportBridge';
import { evaluateWorkbook, evaluateFormulaPreview } from './utils/formulaEngine';
import { copyRange, cutRange as clipCutRange, getClipboard, clearClipboard, hasClipboardData, writeClipboardToSystem } from './utils/clipboard';
import { adjustFormulaRefs, prefixRefsWithSheet } from './utils/formulaParser';
import { useAutosave } from './hooks/useAutosave';
import { useCellEditing } from './hooks/useCellEditing';
import { useCellStyles } from './hooks/useCellStyles';
import { useReferenceFormat } from './hooks/useReferenceFormat';
import { useFormulaWizard } from './hooks/useFormulaWizard';
import { FormulaWizard } from './components/FormulaWizard';
import { loadAutosave } from './services/storageService';
import { downloadJson } from './services/jsonService';
import type { Cell, Selection, Sheet } from './types';
import { insertRow, deleteRow, insertCol, deleteCol } from './utils/sheetOperations';
import { computeFillSeries } from './utils/fillSeries';
import { applyPasteOptions } from './utils/pasteSpecial';
import type { PasteMode } from './utils/pasteSpecial';
import { extractColumnWidths, applyColumnWidths } from './utils/pasteWidths';
import { sortRange } from './utils/sheetSort';
import {
  createFilterState,
  type FilterState,
} from './utils/sheetFilter';
import type { ColumnFilter } from './utils/sheetFilter';

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
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  // Tracks the full selection from Grid (including range selections via shift+click).
  // The `selection` derived below falls back to activeCell when this is null.
  const [gridSelection, setGridSelection] = useState<Selection | null>(null);

  // Auto-save to localStorage on every workbook change (debounced)
  useAutosave(workbook);
  const { format: referenceFormat, toggle: toggleReferenceFormat } = useReferenceFormat();
  const [showPrintSetup, setShowPrintSetup] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pendingPasteHtml, setPendingPasteHtml] = useState<string | null>(null);
  const [pendingPastePlain, setPendingPastePlain] = useState<string | null>(null);
  const {
    wizard: formulaWizard,
    openWizard: openFormulaWizard,
    importFormula: importFormulaToWizard,
    openWithAutocomplete: openWizardWithAutocomplete,
    closeWizard: closeFormulaWizard,
    setParameter: setWizardParameter,
    enterNested: enterWizardNested,
    enterExistingNested: enterWizardExistingNested,
    goBack: goWizardBack,
    startPointSelection: startWizardPointSelection,
    cancelPointSelection: cancelWizardPointSelection,
  } = useFormulaWizard();

  // Wrapper that restores focus to grid after wizard closes
  const handleCloseWizard = useCallback(() => {
    closeFormulaWizard();
    // Restore focus to grid after modal closes
    setTimeout(() => gridRef.current?.focus(), 0);
  }, [closeFormulaWizard]);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
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
  // Ref to focus the formula bar input (Ctrl+F2)
  const formulaBarRef = useRef<{ focusInput: () => void }>(null);
  // Ref to track latest activeCell (avoids stale closures in wizard apply)
  const activeCellRef = useRef(activeCell);
  activeCellRef.current = activeCell;

  // Paste Special options
  const [pasteSkipBlanks, setPasteSkipBlanks] = useState(false);
  const [showPasteSpecial, setShowPasteSpecial] = useState(false);
  const [pendingPasteDetail, setPendingPasteDetail] = useState<{
    targetRow: number;
    targetCol: number;
  } | null>(null);
  // Toggle formula view (Ctrl + `) - show formulas instead of values
  const [showFormulas, setShowFormulas] = useState(false);
  // Filter state for auto-filter feature
  const [filterState, setFilterState] = useState<FilterState | null>(null);

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
    startEnter,
    startEdit,
    startEditAt,
    setCaretPos,
    setBuffer,
    commit: commitEditing,
    reset: resetEditing,
    autoComplete,
    acceptAutoComplete,
    navigateAutoComplete,
    dismissAutoComplete,
  } = useCellEditing({
    activeRow: activeCell?.row ?? 0,
    activeCol: activeCell?.col ?? 0,
    cellValue: activeCell
      ? sheet.cells[cellKey(activeCell.row, activeCell.col)]?.rawValue ?? ''
      : '',
    rowCount: sheet.rowCount,
    colCount: sheet.columnCount,
    onCommit: (row, col, value, batch) => {
      if (batch && selection && (selection.startRow !== selection.endRow || selection.startCol !== selection.endCol)) {
        // Batch entry: apply value to all cells in selection
        const changes: Array<{ row: number; col: number; value: string }> = [];
        for (let r = selection.startRow; r <= selection.endRow; r++) {
          for (let c = selection.startCol; c <= selection.endCol; c++) {
            changes.push({ row: r, col: c, value });
          }
        }
        handleCellsChange(changes);
      } else {
        handleCellChange(row, col, value);
      }
    },
    onNavigate: (row, col) => {
      setActiveCell({ row, col });
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
    },
    []
  );

  const handleHeaderSelect = useCallback(
    (headerSel: { type: 'row' | 'col'; index: number }) => {
      if (headerSel.type === 'row') {
        setActiveCell({ row: headerSel.index, col: 0 });
      } else {
        setActiveCell({ row: 0, col: headerSel.index });
      }
    },
    []
  );

  // ─── Formula Wizard ──────────────────────────────────────────────

  const handleWizardApply = useCallback(
    (formula: string) => {
      const cell = activeCellRef.current;
      if (cell) {
        handleCellChange(cell.row, cell.col, formula);
      }
      handleCloseWizard();
    },
    [handleCellChange, handleCloseWizard]
  );

  /**
   * Get the raw value of the active cell (for formula pre-population).
   */
  const getActiveCellValue = useCallback(() => {
    if (!activeCell) return '';
    return sheet.cells[cellKey(activeCell.row, activeCell.col)]?.rawValue ?? '';
  }, [activeCell, sheet.cells]);

  /**
   * Handle fx button click — opens FormulaWizard, pre-populating with
   * the current cell's formula if it starts with a known function name.
   * If no formula exists, shows the autocomplete picker instead.
   */
  const handleFxClick = useCallback(
    (currentValue: string) => {
      const targetCellRef = activeCell
        ? `${colToLetter(activeCell.col)}${activeCell.row + 1}`
        : undefined;

      // Try to import the existing formula
      if (currentValue && currentValue.startsWith('=')) {
        const imported = importFormulaToWizard(currentValue, targetCellRef);
        if (imported) {
          return; // Successfully imported — wizard is open with pre-populated data
        }
      }

      // No formula to import — show autocomplete picker
      openWizardWithAutocomplete(targetCellRef);
    },
    [activeCell, importFormulaToWizard, openWizardWithAutocomplete]
  );

  // ─── Raw Event Handlers for FormulaBar ──────────────────────────
  // FormulaBar is now a pure view - it forwards raw events to the FSM.

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

  // ─── Shared FSM Event Handlers (for both FormulaBar and Grid) ────
  // Both editors forward raw events to the FSM for processing.

  const handleRawKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const result = handleEditingKey(e.key, e.shiftKey, e.ctrlKey, e.altKey);
      if (result.statusMessage) {
        setStatusMessage(result.statusMessage);
      }
    },
    [handleEditingKey],
  );

  const handleRawChange = useCallback(
    (value: string, caretPos: number) => {
      const s = editingSession;
      if (s.state === 'SELECT' && value.length > 0) {
        // First character typed: start editing
        const firstChar = value[0];
        if (firstChar === '=' || firstChar === '+' || firstChar === '-') {
          startEnter(firstChar);
          if (value.length > 1) {
            setBuffer(value, caretPos);
          }
        } else {
          startEdit();
          setBuffer(value, caretPos);
        }
      } else {
        setBuffer(value, caretPos);
      }
    },
    [setBuffer, startEnter, startEdit, editingSession],
  );

  // ─── Grid Editing Callbacks ──────────────────────────────────────
  // Grid is now a pure view — these callbacks start editing in the FSM.

  const handleGridStartEdit = useCallback(
    (row: number, col: number) => {
      // Update active cell so FSM uses correct row/col.
      // Pass row/col explicitly to startEdit so it doesn't rely on
      // the stale hook closure values (which are based on activeCell
      // at render time, not the new values being set here).
      setActiveCell({ row, col });
      startEdit(row, col);
    },
    [startEdit],
  );

  const handleGridStartEnter = useCallback(
    (row: number, col: number, char: string) => {
      // Update active cell so FSM uses correct row/col
      // Pass row/col explicitly to avoid stale closure values
      setActiveCell({ row, col });
      startEnter(char, row, col);
    },
    [startEnter],
  );

  // ─── Help / Utility Actions ──────────────────────────────────────────

  const handleAbout = useCallback(() => {
    setShowAbout(true);
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
      // Restore focus to grid so keyboard navigation works
      gridRef.current?.focus();
    },
    [pushHistory],
  );

  // ─── Save / Load Triggers (for menu) ──────────────────────────────────

  const handleSaveMenu = useCallback(() => {
    downloadJson(workbook);
    setStatusMessage(`Saved "${workbook.title}" — download started`);
  }, [workbook]);

  const handleLoadMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('simplesheets:open'));
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
      gridRef.current?.focus();
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) {
      setStatusMessage('Redo performed');
      gridRef.current?.focus();
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
      setStatusMessage('Created new workbook');
      gridRef.current?.focus();
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
      gridRef.current?.focus();
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
    gridRef.current?.focus();
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
      gridRef.current?.focus();
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
      gridRef.current?.focus();
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
      gridRef.current?.focus();
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

  // Live computed result preview for the FormulaWizard
  const wizardComputedResult = useMemo(() => {
    if (!formulaWizard.isOpen || !formulaWizard.compiledFormula) return null;
    return evaluateFormulaPreview(
      formulaWizard.compiledFormula,
      workbook,
      workbook.activeSheetIndex,
    );
  }, [formulaWizard.isOpen, formulaWizard.compiledFormula, workbook]);

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
      const clipboardData = copyRange(sheet.cells, detail.startRow, detail.startCol, detail.endRow, detail.endCol, detail.selectionType, workbook.activeSheetIndex);
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
      // Also write to system clipboard for pasting into external applications
      writeClipboardToSystem(clipboardData).catch(() => {
        /* istanbul ignore next - clipboard access may be denied in some environments */
        // Silently fail - internal clipboard still works
      });
    };

    const handleCutEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      /* istanbul ignore next - defensive null check */
      if (!detail) return;
      const cutData = clipCutRange(sheet.cells, detail.startRow, detail.startCol, detail.endRow, detail.endCol, detail.selectionType, workbook.activeSheetIndex);
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
      // Also write to system clipboard for pasting into external applications
      writeClipboardToSystem(cutData).catch(() => {
        /* istanbul ignore next - clipboard access may be denied in some environments */
        // Silently fail - internal clipboard still works
      });
    };

    const handlePasteEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const rawClipboard = getClipboard();
      /* istanbul ignore next - defensive null check */
      if (!rawClipboard || !detail) return;

      // Apply paste special options (mode, transpose) to clipboard data
      const pasteMode = (detail.pasteMode as PasteMode) ?? 'all';
      const pasteTranspose = detail.pasteTranspose ?? false;
      const clipboard = applyPasteOptions(rawClipboard, { mode: pasteMode, transpose: pasteTranspose });

      const targetRow = detail.startRow;
      const targetCol = detail.startCol;
      const isCut = clipboard.isCut;
      const selType = clipboard.selectionType ?? 'cell';
      // Skip blanks can be passed via event detail (from Paste Special dialog)
      const skipBlanks = detail.skipBlanks ?? pasteSkipBlanks;

      // Check for destination range mismatch (Excel behavior)
      // If user selected a range (not single cell), validate it matches clipboard
      const destSel = selection;
      const isSingleCellTarget = !destSel || (destSel.startRow === destSel.endRow && destSel.startCol === destSel.endCol);

      // Determine the destination range
      // For single-cell paste: destination = clipboard size
      // For range paste: destination = selected range (tiled with clipboard if needed)
      let destRowCount = clipboard.rowCount;
      let destColCount = clipboard.colCount;

      if (!isSingleCellTarget && selType === 'cell' && destSel) {
        destRowCount = Math.abs(destSel.endRow - destSel.startRow) + 1;
        destColCount = Math.abs(destSel.endCol - destSel.startCol) + 1;

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

      for (let r = 0; r < destRowCount; r++) {
        for (let c = 0; c < destColCount; c++) {
          // Calculate source cell using modulo for tiled paste
          // For row selections, only tile vertically (columns stay fixed)
          // For column selections, only tile horizontally (rows stay fixed)
          const srcRow = selType === 'col' ? r : r % clipboard.rowCount;
          const srcCol = selType === 'row' ? c : c % clipboard.colCount;
          const cell = clipboard.cells[srcRow][srcCol];
          /* istanbul ignore next - defensive null check */
          const isEmptySource = !cell || !cell.rawValue;

          // Skip blanks: don't overwrite existing data with empty source
          if (skipBlanks && isEmptySource) {
            cellsSkipped++;
            continue;
          }

          const destRow = targetRow + r;
          const destCol = targetCol + c;
          const destKey = cellKey(destRow, destCol);

          // Adjust formulas if pasting
          let newValue = cell?.rawValue ?? '';
          if (newValue.startsWith('=')) {
            const formulaBody = newValue.slice(1);
            const sourceIdx = clipboard.sourceSheetIndex;
            const targetIdx = workbook.activeSheetIndex;

            if (sourceIdx !== undefined && sourceIdx !== targetIdx) {
              // Cross-sheet paste: convert relative refs to cross-sheet refs pointing back to source
              const sourceSheetName = workbook.sheets[sourceIdx]?.name;
              if (sourceSheetName) {
                newValue = '=' + prefixRefsWithSheet(formulaBody, sourceSheetName);
              }
            } else {
              // Calculate the offset from source to destination for this specific cell
              // srcRow/srcCol are clipboard indices (0-based within copied range)
              // clipboard.sourceRow/sourceCol are the original spreadsheet coordinates
              const sourceRow = clipboard.sourceRow ?? 0;
              const sourceCol = clipboard.sourceCol ?? 0;
              const cellRowOffset = destRow - (sourceRow + srcRow);
              const cellColOffset = destCol - (sourceCol + srcCol);
              if (cellRowOffset !== 0 || cellColOffset !== 0) {
                // Same-sheet paste with offset: adjust references by offset
                newValue = '=' + adjustFormulaRefs(formulaBody, cellRowOffset, cellColOffset);
              }
            }
          }

          const destCell: Cell = {
            rawValue: newValue,
            style: cell?.style,
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
      let newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        return { ...s, cells: newCells };
      });

      // Cross-sheet paste: carry column widths from source range
      const sourceIdx = clipboard.sourceSheetIndex;
      const targetIdx = workbook.activeSheetIndex;
      if (sourceIdx !== undefined && sourceIdx !== targetIdx && clipboard.sourceCol !== undefined) {
        const sourceSheet = workbook.sheets[sourceIdx];
        const srcStartCol = clipboard.sourceCol;
        const srcEndCol = clipboard.sourceCol + clipboard.colCount - 1;
        const widths = extractColumnWidths(sourceSheet, srcStartCol, srcEndCol);
        if (Object.keys(widths).length > 0) {
          const targetSheet = newSheets[targetIdx];
          newSheets = newSheets.map((s, idx) => {
            if (idx !== targetIdx) return s;
            return applyColumnWidths(targetSheet, widths, targetCol);
          });
        }
      }

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

  // ─── Cell Style System (useCellStyles hook) ───────────────────────
  const {
    styleState,
    toggleBoldStyle,
    toggleItalicStyle,
    toggleUnderlineStyle,
    toggleStrikethroughStyle,
    setTextColor,
    setBackgroundColor,
    setTextAlign,
    setNumberFormat,
    toggleWrapTextStyle,
    clearCellStyles,
    borderColor,
    setBorderColor,
    setBorderTop,
    setBorderBottom,
    setBorderLeft,
    setBorderRight,
    setBorderAll,
    setBorderOutside,
    clearBorders,
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

  // ─── Fill Series ──────────────────────────────────────────────────────

  const handleFillSeries = useCallback(
    (sourceStartRow: number, sourceStartCol: number, sourceEndRow: number, sourceEndCol: number, targetEndRow: number, targetEndCol: number) => {
      // Determine if fill is horizontal or vertical based on source shape
      const isVertical = sourceEndRow > sourceStartRow && sourceStartCol === sourceEndCol;
      const isHorizontal = sourceEndCol > sourceStartCol && sourceStartRow === sourceEndRow;
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const changes: Array<{ row: number; col: number; value: string }> = [];

      if (isVertical) {
        // Vertical fill: source is a column range (3+ rows, 1 col)
        const sourceCells: Cell[] = [];
        for (let r = sourceStartRow; r <= sourceEndRow; r++) {
          const cell = currentSheet.cells[cellKey(r, sourceStartCol)];
          if (cell) sourceCells.push(cell);
        }
        if (sourceCells.length >= 3) {
          const fillCount = targetEndRow - sourceEndRow;
          const fillValues = computeFillSeries(sourceCells, fillCount);
          if (fillValues) {
            for (let i = 0; i < fillValues.length; i++) {
              changes.push({ row: sourceEndRow + 1 + i, col: sourceStartCol, value: fillValues[i] });
            }
          }
        }
      } else if (isHorizontal) {
        // Horizontal fill: source is a row range (1 row, 3+ cols)
        const sourceCells: Cell[] = [];
        for (let c = sourceStartCol; c <= sourceEndCol; c++) {
          const cell = currentSheet.cells[cellKey(sourceStartRow, c)];
          if (cell) sourceCells.push(cell);
        }
        if (sourceCells.length >= 3) {
          const fillCount = targetEndCol - sourceEndCol;
          const fillValues = computeFillSeries(sourceCells, fillCount);
          if (fillValues) {
            for (let i = 0; i < fillValues.length; i++) {
              changes.push({ row: sourceStartRow, col: sourceEndCol + 1 + i, value: fillValues[i] });
            }
          }
        }
      }

      if (changes.length > 0) {
        handleCellsChange(changes);
      }
    },
    [workbook, handleCellsChange]
  );

  // ─── Sort ──────────────────────────────────────────────────────────

  const handleSortAscending = useCallback(() => {
    if (!selection) return;
    const currentSheet = workbook.sheets[workbook.activeSheetIndex];
    const sorted = sortRange(
      currentSheet,
      selection.startRow,
      selection.endRow,
      [{ column: selection.startCol, direction: 'asc' }],
      true
    );
    if (sorted === currentSheet) return; // No change

    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? sorted : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Sorted column ${colToLetter(selection.startCol)} ascending`);
    setStatusMessage(`Sorted column ${colToLetter(selection.startCol)} — ascending`);
  }, [workbook, pushHistory, selection]);

  const handleSortDescending = useCallback(() => {
    if (!selection) return;
    const currentSheet = workbook.sheets[workbook.activeSheetIndex];
    const sorted = sortRange(
      currentSheet,
      selection.startRow,
      selection.endRow,
      [{ column: selection.startCol, direction: 'desc' }],
      true
    );
    if (sorted === currentSheet) return; // No change

    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? sorted : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Sorted column ${colToLetter(selection.startCol)} descending`);
    setStatusMessage(`Sorted column ${colToLetter(selection.startCol)} — descending`);
  }, [workbook, pushHistory, selection]);

  // ─── Filter ──────────────────────────────────────────────────────────

  const handleToggleFilter = useCallback(() => {
    if (filterState?.active) {
      // Turn off filter
      setFilterState(null);
      setStatusMessage('Filter cleared');
    } else {
      // Turn on filter with default header row = 0
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const newFilterState = createFilterState(currentSheet, 0, {});
      newFilterState.active = true;
      setFilterState(newFilterState);
      setStatusMessage('Filter enabled — click column headers to filter');
    }
  }, [filterState, workbook]);

  const handleApplyFilter = useCallback((column: number, filter: ColumnFilter | undefined) => {
    const currentSheet = workbook.sheets[workbook.activeSheetIndex];
    const currentFilters = filterState?.filters || {};

    let newFilters: Record<number, ColumnFilter>;
    if (filter) {
      newFilters = { ...currentFilters, [column]: filter };
    } else {
      newFilters = { ...currentFilters };
      delete newFilters[column];
    }

    const newFilterState = createFilterState(currentSheet, 0, newFilters);
    newFilterState.active = true;
    setFilterState(newFilterState);

    if (filter) {
      setStatusMessage(`Filter applied to column ${colToLetter(column)} — ${newFilterState.visibleDataRows} of ${newFilterState.totalDataRows} rows visible`);
    } else {
      setStatusMessage(`Filter cleared for column ${colToLetter(column)}`);
    }
  }, [filterState, workbook]);

  const handleClearAllFilters = useCallback(() => {
    setFilterState(null);
    setStatusMessage('All filters cleared');
  }, []);

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
    (options: { mode: string; transpose: boolean; skipBlanks: boolean }) => {
      if (!selection || !pendingPasteDetail) return;
      // Pass paste options through event detail so handler uses them directly
      window.dispatchEvent(new CustomEvent('simplesheets:paste', {
        detail: {
          startRow: pendingPasteDetail.targetRow,
          startCol: pendingPasteDetail.targetCol,
          selectionType: selection.type,
          skipBlanks: options.skipBlanks,
          pasteMode: options.mode,
          pasteTranspose: options.transpose,
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
      // Ctrl+F2 toggles focus between formula bar and grid (Excel feature)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'F2') {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (isInInput) {
          // Focus is in formula bar → move to grid
          gridRef.current?.focus();
        } else {
          // Focus is in grid/elsewhere → move to formula bar
          formulaBarRef.current?.focusInput();
        }
        return;
      }
      // Ctrl+Shift+Z also triggers redo (common alternative)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+Shift+L toggles filter (Excel shortcut)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleToggleFilter();
      }
      // Ctrl+Shift+F opens Formula Wizard
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        handleFxClick(getActiveCellValue());
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo, handleNewSheet, handleSaveMenu, handleLoadMenu, handleSearchReplace, toggleBoldStyle, toggleItalicStyle, toggleUnderlineStyle, handleToggleFilter, handleFxClick, getActiveCellValue, activeCell]);

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
          onFormulaWizard={() => handleFxClick(getActiveCellValue())}
          onToggleBold={toggleBoldStyle}
          onToggleItalic={toggleItalicStyle}
          onToggleUnderline={toggleUnderlineStyle}
          onSetTextColor={setTextColor}
          onSetBackgroundColor={setBackgroundColor}
          onSetTextAlign={setTextAlign}
          onSetNumberFormat={setNumberFormat}
          onToggleWrapText={toggleWrapTextStyle}
          onClearStyles={clearCellStyles}
          onSetBorderTop={setBorderTop}
          onSetBorderBottom={setBorderBottom}
          onSetBorderLeft={setBorderLeft}
          onSetBorderRight={setBorderRight}
          onSetBorderAll={setBorderAll}
          onSetBorderOutside={setBorderOutside}
          onClearBorders={clearBorders}
          onSortAscending={handleSortAscending}
          onSortDescending={handleSortDescending}
          onToggleFilter={handleToggleFilter}
          onClearAllFilters={handleClearAllFilters}
          isFilterActive={filterState?.active || false}
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

      {/* Toolbar */}
      <Toolbar
        onToggleBold={toggleBoldStyle}
        onToggleItalic={toggleItalicStyle}
        onToggleUnderline={toggleUnderlineStyle}
        onToggleStrikethrough={toggleStrikethroughStyle}
        onSetTextColor={setTextColor}
        onSetBackgroundColor={setBackgroundColor}
        onSetAlignLeft={() => setTextAlign('left')}
        onSetAlignCenter={() => setTextAlign('center')}
        onSetAlignRight={() => setTextAlign('right')}
        onSetNumberFormat={setNumberFormat}
        onSetBorderTop={setBorderTop}
        onSetBorderBottom={setBorderBottom}
        onSetBorderLeft={setBorderLeft}
        onSetBorderRight={setBorderRight}
        onSetBorderAll={setBorderAll}
        onSetBorderOutside={setBorderOutside}
        onClearBorders={clearBorders}
        onSetBorderColor={setBorderColor}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCopy={handleCopyMenu}
        onCut={handleCutMenu}
        onPaste={handlePasteMenu}
        isBold={styleState.fontWeight === 'bold'}
        isItalic={styleState.fontStyle === 'italic'}
        isUnderline={styleState.textDecoration === 'underline'}
        canUndo={canUndo}
        canRedo={canRedo}
        borderColor={borderColor}
      />

      {/* Formula Bar */}
      <FormulaBar
        ref={formulaBarRef}
        session={editingSession}
        value={editingSession.buffer || (activeCell ? sheet.cells[cellKey(activeCell.row, activeCell.col)]?.rawValue ?? '' : '')}
        cursorPos={editingSession.caretPos}
        onRawKeyDown={handleRawKeyDown}
        onRawChange={handleRawChange}
        onRawFocus={handleFormulaRawFocus}
        onRawBlur={handleFormulaRawBlur}
        onRawCaretMove={setCaretPos}
        autoComplete={autoComplete}
        onAcceptAutoComplete={acceptAutoComplete}
        onNavigateAutoComplete={navigateAutoComplete}
        onDismissAutoComplete={dismissAutoComplete}
        referenceFormat={referenceFormat}
        onToggleReferenceFormat={toggleReferenceFormat}
        onHighlightsChange={setHighlightedRanges}
        onFxClick={handleFxClick}
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
          session={editingSession}
          onStartEnter={handleGridStartEnter}
          onStartEdit={handleGridStartEdit}
          onRawKeyDown={handleRawKeyDown}
          onRawChange={handleRawChange}
          onFillSeries={handleFillSeries}
          filterState={filterState}
          onApplyFilter={handleApplyFilter}
        />
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700 w-16" data-testid="cell-mode">{cellMode}</span>
          <span className="text-gray-400">|</span>
          <span data-testid="status-message">{showFormulas ? 'Formulas' : statusMessage}</span>
          {filterState?.active && filterState.visibleDataRows !== filterState.totalDataRows && (
            <span className="text-blue-600 font-medium" data-testid="filter-status">
              {filterState.visibleDataRows} of {filterState.totalDataRows} rows visible
            </span>
          )}
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
      <PrintSetupModal isOpen={showPrintSetup} onClose={() => { setShowPrintSetup(false); gridRef.current?.focus(); }} />
      <ShortcutsModal isOpen={showShortcuts} onClose={() => { setShowShortcuts(false); gridRef.current?.focus(); }} />
      <AboutModal isOpen={showAbout} onClose={() => { setShowAbout(false); gridRef.current?.focus(); }} />
      <SearchReplaceModal
        isOpen={showSearchReplace}
        onClose={() => { setShowSearchReplace(false); gridRef.current?.focus(); }}
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
          gridRef.current?.focus();
        }}
        onPasteFormatted={() => {
          if (pendingPasteHtml) handleExternalPaste('', pendingPasteHtml);
          setShowPasteModal(false);
          setPendingPasteHtml(null);
          setPendingPastePlain(null);
          gridRef.current?.focus();
        }}
        onPastePlainText={() => {
          const text = pendingPastePlain ?? pendingPasteHtml ?? '';
          handleExternalPaste(text, null);
          setShowPasteModal(false);
          setPendingPasteHtml(null);
          setPendingPastePlain(null);
          gridRef.current?.focus();
        }}
        html={pendingPasteHtml}
        plain={pendingPastePlain}
      />
      <PasteSpecialModal
        isOpen={showPasteSpecial}
        onClose={() => {
          setShowPasteSpecial(false);
          setPendingPasteDetail(null);
          gridRef.current?.focus();
        }}
        onApply={handlePasteSpecialApply}
        skipBlanks={pasteSkipBlanks}
        onSkipBlanksChange={setPasteSkipBlanks}
      />
      <FormulaWizard
        wizard={formulaWizard}
        setParameter={setWizardParameter}
        enterNested={enterWizardNested}
        enterExistingNested={enterWizardExistingNested}
        goBack={goWizardBack}
        startPointSelection={startWizardPointSelection}
        cancelPointSelection={cancelWizardPointSelection}
        closeWizard={handleCloseWizard}
        onApply={handleWizardApply}
        computedResult={wizardComputedResult}
        onFunctionSelect={(functionName) => {
          // User picked a function from autocomplete — open wizard with that function
          const targetCellRef = activeCell
            ? `${colToLetter(activeCell.col)}${activeCell.row + 1}`
            : undefined;
          openFormulaWizard(functionName, targetCellRef);
        }}
        targetRow={activeCell?.row}
        targetCol={activeCell?.col}
      />
    </div>
  );
}
