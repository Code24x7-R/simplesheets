import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Workbook } from './types';
import { cellKey, colToLetter } from './types';
import { HistoryProvider, useHistory } from './context/HistoryContext';
import { PasteModal } from './components/PasteModal';
import { parsePlainText, parseHtmlTable, type ParsedClipboardGrid } from './utils/clipboardParse';
import { FreezeProvider, useFreeze } from './context/FreezeContext';
import { PrintSetupProvider } from './context/PrintSetupContext';
import { Grid } from './components/Grid';
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
import { useCellEditing } from './hooks/useCellEditing';
import { useCellStyles } from './hooks/useCellStyles';
import { useReferenceFormat, toR1C1 } from './hooks/useReferenceFormat';
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

  // Sheet reference (needed by the editing hook and everywhere else)
  const sheet = workbook.sheets[workbook.activeSheetIndex];

  // ─── Editing FSM (useCellEditing hook) ────────────────────────────
  const [formulaCursorPos, setFormulaCursorPos] = useState(0);

  // The editing hook manages the FSM (SELECT/ENTER/EDIT/POINT) and the
  // formula buffer.  We feed it the active cell's coordinates and value,
  // and it tells us when to commit a cell or navigate the grid.
  const {
    session: editingSession,
    pointSession: editingPointSession,
    handleKey: handleEditingKey,
    handleCellClick: handleEditingCellClick,
    startEditAt,
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

      // Calculate source origin (top-left of copied range)
      /* istanbul ignore next - pendingCutRange null fallback */
      const srcRow = isCut ? pendingCutRange?.startRow ?? 0 : 0;
      /* istanbul ignore next - pendingCutRange null fallback */
      const srcCol = isCut ? pendingCutRange?.startCol ?? 0 : 0;

      // For row selections, only offset rows (columns stay fixed).
      // For column selections, only offset columns (rows stay fixed).
      const rowOffset = selType === 'col' ? 0 : targetRow - srcRow;
      const colOffset = selType === 'row' ? 0 : targetCol - srcCol;

      // Create updated cells
      const newCells = { ...sheet.cells };
      let cellsUpdated = 0;

      for (let r = 0; r < clipboard.rowCount; r++) {
        for (let c = 0; c < clipboard.colCount; c++) {
          const cell = clipboard.cells[r][c];
          /* istanbul ignore next - defensive null check */
          if (!cell) continue;

          const destRow = r + rowOffset;
          const destCol = c + colOffset;
          const destKey = cellKey(destRow, destCol);

          // Adjust formulas if pasting
          let newValue = cell.rawValue;
          if (cell.rawValue.startsWith('=') && (rowOffset !== 0 || colOffset !== 0)) {
            newValue = '=' + adjustFormulaRefs(cell.rawValue.slice(1), rowOffset, colOffset);
          }

          const destCell: Cell = {
            rawValue: newValue,
            style: cell.style,
            rowSpan: cell.rowSpan,
            colSpan: cell.colSpan,
            isMergeAnchor: cell.isMergeAnchor,
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
      setStatusMessage(`${isCut ? 'Moved' : 'Pasted'} ${cellsUpdated} cell(s)`);
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
  }, [sheet, workbook, pushHistory, pendingCutRange]);

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
      setStatusMessage(`Updated ${cellRef} = ${value}`);
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

  const handleFormulaBarCommit = useCallback(
    (value: string) => {
      if (activeCell) {
        handleCellChange(activeCell.row, activeCell.col, value);
      }
    },
    [activeCell, handleCellChange]
  );

  const handleFormulaChange = useCallback((value: string) => {
    setFormulaBarValue(value);
  }, []);

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

  // ─── Editing FSM Bridge ───────────────────────────────────────────
  // These callbacks connect the FormulaBar and Grid to the useCellEditing
  // hook.  The hook owns the buffer, caret, and POINT-mode state machine.

  // FormulaBar calls this for every keypress when integrated with the hook.
  // We use the returned session to keep formulaCursorPos in sync, and the
  // navigate delta to move the active cell when the hook requests it.
  const handleFormulaEditingKey = useCallback(
    (key: string, shiftKey: boolean, ctrlKey: boolean) => {
      const result = handleEditingKey(key, shiftKey, ctrlKey);
      // Keep the FormulaBar cursor synced with the hook's caret position
      if (result.session.caretPos !== editingSession.caretPos) {
        setFormulaCursorPos(result.session.caretPos);
      }
      // Handle navigation that the hook couldn't apply internally
      // (e.g., arrow keys in SELECT state return a navigate delta)
      if (result.navigate && result.session.state === 'SELECT') {
        const baseRow = activeCell?.row ?? 0;
        const baseCol = activeCell?.col ?? 0;
        const newRow = Math.max(0, Math.min(sheet.rowCount - 1, baseRow + result.navigate.dRow));
        const newCol = Math.max(0, Math.min(sheet.columnCount - 1, baseCol + result.navigate.dCol));
        const cell = sheet.cells[cellKey(newRow, newCol)];
        setActiveCell({ row: newRow, col: newCol });
        setFormulaBarValue(cell?.rawValue ?? '');
      }
    },
    [handleEditingKey, editingSession.caretPos, activeCell, sheet],
  );

  // Grid calls this when a cell is clicked during POINT mode
  const handleFormulaCellClick = useCallback(
    (row: number, col: number, shiftKey: boolean) => {
      handleEditingCellClick(row, col, shiftKey);
    },
    [handleEditingCellClick],
  );

  // Commit the current edit (used when FormulaBar loses focus)
  const handleFormulaBlurEditing = useCallback(() => {
    commitEditing();
  }, [commitEditing]);

  // When the formula bar is focused, enter EDIT mode at the caret position
  // so the user can edit the existing formula in-place (instead of replacing it)
  const handleFormulaFocusEditing = useCallback(
    (caretPosition: number) => {
      startEditAt(caretPosition);
    },
    [startEditAt],
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

  // ─── Global Keyboard Shortcuts (Undo/Redo) ──────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
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
  }, [handleUndo, handleRedo]);

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

  const activeCellRef = activeCell
    ? referenceFormat === 'R1C1'
      ? toR1C1(activeCell.row, activeCell.col)
      : `${colToLetter(activeCell.col)}${activeCell.row + 1}`
    : (referenceFormat === 'R1C1' ? 'R1C1' : 'A1');

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

  // ─── External Paste Application ────────────────────────────────────────
  // Writes a parsed clipboard grid into the workbook starting at the
  // current selection. Used by both formatted and plain external paste.
  // Includes bounds checking: clips data that would exceed sheet boundaries
  // and reports how many rows/cols were clipped in the status message.
  // Uses smart classification: single-value content goes into one cell.
  const handleExternalPaste = useCallback(
    (plain: string, html: string | null) => {
      if (!selection) return;

      const parsed: ParsedClipboardGrid = html
        ? parseHtmlTable(html)
        : parsePlainText(plain);

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

          // Adjust relative formula references (e.g., =A1 pasted at C3 becomes =C3)
          if (value.startsWith('=')) {
            value = '=' + adjustFormulaRefs(value.slice(1), r, c);
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
    },
    [selection, sheet, workbook, pushHistory]
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
        value={formulaBarValue}
        onChange={handleFormulaChange}
        onCommit={handleFormulaBarCommit}
        activeCellRef={activeCellRef}
        editingFormula={formulaBarValue.startsWith('=') ? formulaBarValue : null}
        onHighlightsChange={setHighlightedRanges}
        cursorPos={formulaCursorPos}
        onCursorChange={setFormulaCursorPos}
        isPointMode={isPointMode}
        pointSelection={pointSelection}
        editingSession={editingSession}
        editingPointSession={editingPointSession}
        onEditingKey={handleFormulaEditingKey}
        onBlurEditing={handleFormulaBlurEditing}
        onFocusEditing={handleFormulaFocusEditing}
        referenceFormat={referenceFormat}
        onToggleReferenceFormat={toggleReferenceFormat}
        onInsertFunction={(fn) => {
          // Insert function template at cursor
          const template = `${fn}()`;
          setFormulaBarValue((prev) => prev + template);
        }}
        onOpenWizard={handleOpenWizard}
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
          sheet={updatedSheet}
          onCellChange={handleCellChange}
          onCellsChange={handleCellsChange}
          onSelect={handleCellSelect}
          selectedCell={activeCell}
          highlightedRanges={highlightedRanges}
          isPointMode={isPointMode}
          pointSelection={pointSelection}
          onCellPick={handleFormulaCellClick}
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
        />
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <span>{statusMessage}</span>
        <div className="flex items-center gap-4">
          {activeCell && sheet.cells[cellKey(activeCell.row, activeCell.col)]?.computedValue !== undefined && (
            <span className="font-mono text-gray-600">
              {String(sheet.cells[cellKey(activeCell.row, activeCell.col)]?.computedValue)}
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
