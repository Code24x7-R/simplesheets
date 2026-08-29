// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
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
import { ColumnRowSizeModal } from './components/ColumnRowSizeModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { AboutModal } from './components/AboutModal';
import { CloudStorageModal } from './components/CloudStorageModal';
import { FilenameModal } from './components/FilenameModal';
import { SearchReplaceModal } from './components/SearchReplaceModal';
import { SheetTabs } from './components/SheetTabs';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { ConditionalFormatModal } from './components/ConditionalFormatModal';
import { DataValidationModal } from './components/DataValidationModal';
import { NamedRangesModal } from './components/NamedRangesModal';
import type { ConditionalFormatRule, DataValidationRule } from './types';
import { ImportExportBridge } from './components/ImportExportBridge';
import { evaluateWorkbook, evaluateFormulaPreview, buildDependencyGraph } from './utils/formulaEngine';
import { copyRange, cutRange as clipCutRange, getClipboard, clearClipboard, hasClipboardData, writeClipboardToSystem } from './utils/clipboard';
import { adjustFormulaRefs, prefixRefsWithSheet } from './utils/formulaParser';
import { useAutosave } from './hooks/useAutosave';
import { useCellEditing } from './hooks/useCellEditing';
import { useCellStyles } from './hooks/useCellStyles';
import { useReferenceFormat } from './hooks/useReferenceFormat';
import { useFormulaWizard } from './hooks/useFormulaWizard';
import { useMRU } from './hooks/useMRU';
import type { MRUEntry } from './utils/mru';
import { FormulaWizard } from './components/FormulaWizard';
import { loadAutosave } from './services/storageService';
import { downloadJson } from './services/jsonService';
import { downloadExcel } from './services/excelExport';
import { downloadCsv } from './services/csvService';
import { downloadPdf } from './services/pdfExport';
import type { Cell, Selection, Sheet, NamedRange } from './types';
import { insertRow, deleteRow, insertCol, deleteCol } from './utils/sheetOperations';
import { computeFillSeries } from './utils/fillSeries';
import { applyPasteOptions } from './utils/pasteSpecial';
import type { PasteMode } from './utils/pasteSpecial';
import { extractColumnWidths, applyColumnWidths } from './utils/pasteWidths';
import { sortRange, getCurrentRegion } from './utils/sheetSort';
import { SortDialog } from './components/SortDialog';
import type { SortDirection } from './utils/sheetSort';
import {
  createFilterState,
  type FilterState,
} from './utils/sheetFilter';
import type { ColumnFilter } from './utils/sheetFilter';
import { ChartDialog } from './components/ChartDialog';
import { ChartOverlay } from './components/charts/ChartOverlay';
import type { ChartConfig } from './types';
import { createDemoWorkbook } from './utils/demoWorkbook';
import { useChartSettings } from './hooks/useChartSettings';
import { SheetLinkProvider } from './components/SheetLink';
import { ProjectView } from './extensions/project-wbs/ProjectView';
import { createBlankTasksSheet, createWorkbookFromTemplate, createRisksSheet, createResourcesSheet, createMaterialsSheet, createActualsSheet, createAllocationsSheet, createConsumptionsSheet, workbookToProject, projectModelToProject, projectModelToWorkbook } from './extensions/project-wbs/sheetToProject';
import { TASKS_SHEET_NAME, RISKS_SHEET_NAME, RESOURCES_SHEET_NAME, MATERIALS_SHEET_NAME, ACTUALS_SHEET_NAME, ALLOCATIONS_SHEET_NAME, CONSUMPTIONS_SHEET_NAME } from './extensions/project-wbs/sheetToProject';
import type { Project } from './extensions/types';
import type { ProjectModel, ColumnMapping } from './types';

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

  // Ref to hold pending extension data (set by ProjectView save, applied to next workbook push)
  const { frozenColumns, frozenRows, freeze, unfreeze } = useFreeze();
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  // Tracks the full selection from Grid (including range selections via shift+click).
  // The `selection` derived below falls back to activeCell when this is null.
  const [gridSelection, setGridSelection] = useState<Selection | null>(null);

  // Auto-save to localStorage on every workbook change (debounced)
  useAutosave(workbook);
  const { format: referenceFormat, toggle: toggleReferenceFormat } = useReferenceFormat();
  const { entries: recentFiles, recordOpen: recordOpenMRU, recordSave: recordSaveMRU, remove: removeMRU, clear: clearMRU } = useMRU();
  const [showPrintSetup, setShowPrintSetup] = useState(false);
  const [showColumnRowSize, setShowColumnRowSize] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudModalMode, setCloudModalMode] = useState<'save' | 'open'>('save');
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [showSortDialog, setShowSortDialog] = useState(false);
  const [pendingSortDirection, setPendingSortDirection] = useState<SortDirection>('asc');
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
    applyPointSelection: applyWizardPointSelection,
  } = useFormulaWizard();

  // State to capture the target cell when the wizard opens (B-011 fix)
  // This prevents the formula from being placed in the wrong cell when
  // the user selects a range during POINT mode (which changes activeCell)
  const [wizardTargetCell, setWizardTargetCell] = useState<{ row: number; col: number } | null>(null);

  // State to capture the source sheet index when the wizard opens (B-029 fix)
  // This prevents the formula from being written to the wrong sheet when
  // the user navigates to another sheet during POINT mode range selection
  const [wizardTargetSheetIndex, setWizardTargetSheetIndex] = useState<number | null>(null);

  // Wrapper that restores focus to grid after wizard closes
  const handleCloseWizard = useCallback(() => {
    // Capture target cell before resetting it
    const targetCell = wizardTargetCell;
    closeFormulaWizard();
    // Reset target cell so next wizard open captures fresh target
    setWizardTargetCell(null);
    // Reset source sheet index so next wizard open captures fresh sheet
    setWizardTargetSheetIndex(null);
    // Restore focus to the target cell after modal closes
    setTimeout(() => {
      if (targetCell) {
        gridRef.current?.focusCell(targetCell.row, targetCell.col);
      } else {
        gridRef.current?.focus();
      }
    }, 0);
  }, [closeFormulaWizard, wizardTargetCell]);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [highlightedRanges, setHighlightedRanges] = useState<HighlightedRange[]>([]);
  // Cross-sheet navigation state
  const [crossSheetNavigation, setCrossSheetNavigation] = useState<{
    sheetName: string;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    sourceSheetIndex: number; // the sheet that owns the formula being edited
  } | null>(null);
  const [pendingCrossSheetRef, setPendingCrossSheetRef] = useState<{
    sheetName: string;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);
  const crossSheetSourceRef = useRef<number | null>(null); // sheet index to return to
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

  // Per-sheet active cell tracking — each sheet remembers its own active cell
  // so switching sheets restores the correct position (keyed by sheet id).
  const sheetActiveCellsRef = useRef<Map<string, { row: number; col: number }>>(new Map());

  // Whenever activeCell changes, persist it into the per-sheet map
  // keyed by the current sheet's id.
  useEffect(() => {
    if (activeCell) {
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      if (currentSheet) {
        sheetActiveCellsRef.current.set(currentSheet.id, { row: activeCell.row, col: activeCell.col });
      }
    }
  }, [activeCell, workbook.sheets, workbook.activeSheetIndex]);

  // Helper: restore the saved active cell for a given sheet (or default to A1).
  // Used by all sheet-switching handlers so each sheet remembers its position.
  const restoreActiveCellForSheet = useCallback((sheetId: string) => {
    const saved = sheetActiveCellsRef.current.get(sheetId);
    setActiveCell(saved ?? { row: 0, col: 0 });
    setGridSelection(null);
    // Scrolling to the restored cell is handled by a useEffect in Grid
    // that fires when the sheet prop changes (uses the new sheet's virtualizer)
  }, []);

  // Paste Special options
  const [pasteSkipBlanks, setPasteSkipBlanks] = useState(false);
  const [showPasteSpecial, setShowPasteSpecial] = useState(false);
  const [pendingPasteDetail, setPendingPasteDetail] = useState<{
    targetRow: number;
    targetCol: number;
  } | null>(null);
  // Toggle formula view (Ctrl + `) - show formulas instead of values
  const [showFormulas, setShowFormulas] = useState(false);
  const [showConditionalFormat, setShowConditionalFormat] = useState(false);
  const [showDataValidation, setShowDataValidation] = useState(false);
  const [showNamedRanges, setShowNamedRanges] = useState(false);
  // Filename modal state for save/export operations
  const [filenameModal, setFilenameModal] = useState<{
    isOpen: boolean;
    title: string;
    defaultName: string;
    extension: string;
    onConfirm: (filename: string) => void;
  }>({ isOpen: false, title: '', defaultName: '', extension: '', onConfirm: () => {} });
  // Filter state for auto-filter feature
  const [filterState, setFilterState] = useState<FilterState | null>(null);
  // Ref to always capture current filterState for pushHistory calls
  const filterStateRef = useRef<FilterState | null>(null);
  filterStateRef.current = filterState;
  // Ref to always capture current gridSelection for pushHistory calls
  const gridSelectionRef = useRef<Selection | null>(null);
  gridSelectionRef.current = gridSelection;

  // Project / WBS extension state
  const [showProjectView, setShowProjectView] = useState(false);
  const [showProjectTab, setShowProjectTab] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Chart state
  const [showChartDialog, setShowChartDialog] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [chartPointMode, setChartPointMode] = useState(false);
  const [namedRangePointMode, setNamedRangePointMode] = useState(false);
  const { settings: chartSettings, updateSettings: updateChartSettings } = useChartSettings();

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

  // Derive wizard POINT mode from the wizard state
  const isWizardPointMode = formulaWizard.state === 'POINT_SELECTION';

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
    const result = evaluateWorkbook({ ...workbook, sheets: workbook.sheets.map((s, idx) => idx === workbook.activeSheetIndex ? updatedSheet : s) }, workbook.activeSheetIndex, filterState?.hiddenRows);
    /* istanbul ignore next - circular ref warning requires self-referencing formula (tested in formulaEngine.test.ts) */
    if (result.circularRefs.length > 0) {
      setStatusMessage(`Warning: ${result.circularRefs.length} circular reference(s) detected`);
    }
  }, [workbook, updatedSheet, filterState?.hiddenRows]);

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
    (row: number, col: number, value: string, sheetIndex?: number) => {
      // Allow writing to a specific sheet (used by FormulaWizard B-029 fix)
      // Falls back to the active sheet when not provided
      const targetSheetIdx = sheetIndex ?? workbook.activeSheetIndex;
      // Create a new workbook with the updated cell
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== targetSheetIdx) return s;
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
        // When writing to a non-active sheet, switch active sheet too so
        // focus lands on the source sheet (B-029 fix)
        activeSheetIndex: targetSheetIdx,
        lastModified: Date.now(),
      };
      const cellRef = `${colToLetter(col)}${row + 1}`;
      pushHistory(newWorkbook, `Edit ${cellRef}`, filterStateRef.current, gridSelectionRef.current);
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
      pushHistory(newWorkbook, `Updated ${cellCount} cell(s)`, filterStateRef.current, gridSelectionRef.current);
      setStatusMessage(`Updated ${cellCount} cell(s)`);
    },
    [workbook, pushHistory]
  );

  const handleCellSelect = useCallback(
    (row: number, col: number) => {
      setActiveCell({ row, col });
      setSelectedChartId(null);
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
      // Use the target cell captured when the wizard opened (B-011 fix)
      // This prevents the formula from being placed in the wrong cell
      // when the user selects a range during POINT mode
      const cell = wizardTargetCell ?? activeCellRef.current;
      // Use the source sheet index captured when the wizard opened (B-029 fix)
      // This prevents the formula from being written to the wrong sheet
      // when the user navigates to another sheet during POINT mode.
      // handleCellChange writes to that sheet and switches activeSheetIndex.
      const targetSheetIdx = wizardTargetSheetIndex ?? workbook.activeSheetIndex;
      if (cell) {
        handleCellChange(cell.row, cell.col, formula, targetSheetIdx);
      }
      handleCloseWizard();
    },
    [handleCellChange, handleCloseWizard, wizardTargetCell, wizardTargetSheetIndex, workbook.activeSheetIndex]
  );

  /**
   * Handle wizard POINT mode range selection accepted.
   * Called when the user selects a range on the grid and presses Enter.
   * The wizard's applyPointSelection updates the parameter value and
   * returns to the WIZARD_ROOT state, causing the modal to reappear.
   */
  const handleWizardPointSelection = useCallback(
    (range: string) => {
      applyWizardPointSelection(range);
    },
    [applyWizardPointSelection]
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

      // Capture target cell so formula is placed in the correct cell
      // even if activeCell changes during POINT mode range selection
      setWizardTargetCell(activeCell ?? null);

      // Capture source sheet index so formula is placed on the correct
      // sheet even if the user navigates to another sheet during POINT mode
      setWizardTargetSheetIndex(workbook.activeSheetIndex);

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
    [activeCell, importFormulaToWizard, openWizardWithAutocomplete, workbook]
  );

  // ─── Cross-Sheet Navigation ──────────────────────────────────────
  // Handle cross-sheet ref detection from formula bar
  const handleCrossSheetRefChange = useCallback(
    (info: { sheetName: string; startRow: number; startCol: number; endRow: number; endCol: number; startPos: number; endPos: number } | null) => {
      setPendingCrossSheetRef(info);
    },
    []
  );

  // Navigate to source sheet for cross-sheet ref editing
  const handleNavigateToCrossSheet = useCallback(
    (sheetName?: string, cellRef?: string) => {
      // Support both popup-based (pendingCrossSheetRef) and direct click (sheetName/cellRef)
      const targetSheet = sheetName || pendingCrossSheetRef?.sheetName;
      if (!targetSheet) return;
      const targetIndex = workbook.sheets.findIndex((s) => s.name === targetSheet);
      if (targetIndex === -1) return;
      if (targetIndex === workbook.activeSheetIndex) return;

      // Parse cell ref for navigation target (e.g., "A1" -> row 0, col 0)
      let startRow = 0;
      let startCol = 0;
      let endRow = 0;
      let endCol = 0;
      if (cellRef) {
        // Parse cell ref like "A1" or "A1:B5"
        const parts = cellRef.split(':');
        const firstCell = parts[0].match(/\$?([A-Za-z]+)\$?(\d+)/);
        if (firstCell) {
          startCol = firstCell[1].split('').reduce((acc, ch) => acc * 26 + (ch.toUpperCase().charCodeAt(0) - 64), 0) - 1;
          startRow = parseInt(firstCell[2], 10) - 1;
          endRow = startRow;
          endCol = startCol;
        }
        if (parts.length === 2) {
          const secondCell = parts[1].match(/\$?([A-Za-z]+)\$?(\d+)/);
          if (secondCell) {
            endCol = secondCell[1].split('').reduce((acc, ch) => acc * 26 + (ch.toUpperCase().charCodeAt(0) - 64), 0) - 1;
            endRow = parseInt(secondCell[2], 10) - 1;
          }
        }
      } else if (pendingCrossSheetRef) {
        startRow = pendingCrossSheetRef.startRow;
        startCol = pendingCrossSheetRef.startCol;
        endRow = pendingCrossSheetRef.endRow;
        endCol = pendingCrossSheetRef.endCol;
      }

      // Save the source sheet (where the formula being edited lives)
      crossSheetSourceRef.current = workbook.activeSheetIndex;

      // Save current active cell for the sheet we're leaving so return works correctly
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      if (currentSheet && activeCell) {
        sheetActiveCellsRef.current.set(currentSheet.id, { row: activeCell.row, col: activeCell.col });
      }

      const newWb: Workbook = {
        ...workbook,
        activeSheetIndex: targetIndex,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Navigate to ${targetSheet}`, filterStateRef.current, gridSelectionRef.current);

      setCrossSheetNavigation({
        sheetName: targetSheet,
        startRow,
        startCol,
        endRow,
        endCol,
        sourceSheetIndex: crossSheetSourceRef.current,
      });
      setPendingCrossSheetRef(null);
      setStatusMessage(`Viewing ${targetSheet}! range — click formula bar to return`);

      // Highlight the target range on the source sheet
      setHighlightedRanges([{
        startRow,
        startCol,
        endRow,
        endCol,
        colorIndex: 0,
        sheetName: targetSheet,
      }]);

      // Select the target range
      setActiveCell({ row: startRow, col: startCol });
      gridRef.current?.focus();
    },
    [pendingCrossSheetRef, workbook, pushHistory, activeCell]
  );

  // Return from cross-sheet navigation to source sheet
  const handleReturnFromCrossSheet = useCallback(
    () => {
      const sourceIndex = crossSheetSourceRef.current;
      if (sourceIndex === null || sourceIndex === workbook.activeSheetIndex) return;

      const newWb: Workbook = {
        ...workbook,
        activeSheetIndex: sourceIndex,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Return to ${workbook.sheets[sourceIndex].name}`, filterStateRef.current, gridSelectionRef.current);
      crossSheetSourceRef.current = null;
      setCrossSheetNavigation(null);
      setPendingCrossSheetRef(null);
      // Restore the source sheet's saved active cell
      restoreActiveCellForSheet(workbook.sheets[sourceIndex].id);
      gridRef.current?.focus();
    },
    [workbook, pushHistory, restoreActiveCellForSheet]
  );

  // ─── Raw Event Handlers for FormulaBar ──────────────────────────
  // FormulaBar is now a pure view - it forwards raw events to the FSM.

  // Raw focus - FSM enters EDIT mode
  const handleFormulaRawFocus = useCallback(
    (caretPos: number) => {
      // If we're in cross-sheet navigation mode, clicking the formula bar
      // returns to the source sheet instead of starting edit
      if (crossSheetSourceRef.current !== null && crossSheetNavigation) {
        handleReturnFromCrossSheet();
        return;
      }
      startEditAt(caretPos);
      setFormulaCursorPos(caretPos);
    },
    [startEditAt, handleReturnFromCrossSheet, crossSheetNavigation],
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

  // Clears both the marching-ants range and the clipboard data (Esc / typing)
  const handleClearClipboard = useCallback(() => {
    setClipboardRange(null);
    clearClipboard();
  }, []);

  const handleGridStartEnter = useCallback(
    (row: number, col: number, char: string) => {
      // Update active cell so FSM uses correct row/col
      // Pass row/col explicitly to avoid stale closure values
      setActiveCell({ row, col });
      // Excel behavior: typing clears clipboard (marching ants disappear)
      handleClearClipboard();
      startEnter(char, row, col);
    },
    [startEnter, handleClearClipboard],
  );

  // ─── Help / Utility Actions ──────────────────────────────────────────

  const handleAbout = useCallback(() => {
    setShowAbout(true);
  }, []);

  const handleShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  const handleSimpleDocs = useCallback(() => {
    window.open('https://simpledocs.mouseclick.au', '_blank', 'noopener,noreferrer');
  }, []);

  const handleSaveToCloud = useCallback(() => {
    setCloudModalMode('save');
    setShowCloudModal(true);
  }, []);

  const handleOpenFromCloud = useCallback(() => {
    setCloudModalMode('open');
    setShowCloudModal(true);
  }, []);

  const handleOpenRecent = useCallback(
    (entry: MRUEntry) => {
      if (entry.source === 'url' && entry.path) {
        // URL-opened documents: load from the share link fragment
        window.location.href = entry.path;
        return;
      }
      if (entry.source === 'cloud') {
        // Cloud files: open via the cloud modal in open mode
        setCloudModalMode('open');
        setShowCloudModal(true);
        setStatusMessage(`Reopen "${entry.name}" from ${entry.provider ?? 'cloud'} — select the file in the cloud modal.`);
        return;
      }
      // Local files: trigger the file picker (same as File → Open)
      window.dispatchEvent(new CustomEvent('simplesheets:open'));
      setStatusMessage(`Reopen "${entry.name}" — select the file in the picker.`);
    },
    [],
  );

  const handleSearchReplace = useCallback(() => {
    setShowSearchReplace(true);
  }, []);

  // Modal updater for search/replace (receives new workbook + description)
  const handleSearchReplaceApply = useCallback(
    (updatedWb: Workbook, description: string) => {
      pushHistory(updatedWb, description, filterStateRef.current, gridSelectionRef.current);
      setStatusMessage(description);
      setShowSearchReplace(false);
      // Restore focus to grid so keyboard navigation works
      gridRef.current?.focus();
    },
    [pushHistory],
  );

  // ─── Save / Load Triggers (for menu) ──────────────────────────────────

  const openFilenameModal = useCallback(
    (title: string, defaultName: string, extension: string, onConfirm: (filename: string) => void) => {
      setFilenameModal({ isOpen: true, title, defaultName, extension, onConfirm });
    },
    [],
  );

  const closeFilenameModal = useCallback(() => {
    setFilenameModal((prev) => ({ ...prev, isOpen: false }));
    gridRef.current?.focus();
  }, []);

  /**
   * Callback after CloudStorageModal saves a file locally.
   * Records MRU, updates the workbook title, and pushes to history.
   */
  const handleSaveFile = useCallback(
    (filename: string, sizeBytes: number) => {
      recordSaveMRU(`${filename}.ssjson`, sizeBytes, 'local');
      const updatedWb: Workbook = { ...workbook, title: filename, lastModified: Date.now() };
      pushHistory(updatedWb, `Saved as "${filename}"`, filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory, recordSaveMRU],
  );

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
    const defaultName = workbook.title.replace(/[^a-zA-Z0-9-_]/g, '_') || 'Untitled';
    openFilenameModal('Export Excel', defaultName, 'xlsx', (filename) => {
      downloadExcel(workbook, filename);
      setStatusMessage(`Exported "${filename}.xlsx" — download started`);
      closeFilenameModal();
    });
  }, [workbook, openFilenameModal, closeFilenameModal]);

  const handleExportCsvMenu = useCallback(() => {
    const defaultName = (sheet.name || workbook.title).replace(/[^a-zA-Z0-9-_]/g, '_') || 'Untitled';
    openFilenameModal('Export CSV', defaultName, 'csv', (filename) => {
      downloadCsv(sheet, filename);
      setStatusMessage(`Exported "${filename}.csv" — download started`);
      closeFilenameModal();
    });
  }, [workbook, sheet, openFilenameModal, closeFilenameModal]);

  const handleExportJsonMenu = useCallback(() => {
    const defaultName = workbook.title.replace(/[^a-zA-Z0-9-_]/g, '_') || 'Untitled';
    openFilenameModal('Export JSON', defaultName, 'json', (filename) => {
      downloadJson(workbook, filename);
      setStatusMessage(`Exported "${filename}.json" — download started`);
      closeFilenameModal();
    });
  }, [workbook, openFilenameModal, closeFilenameModal]);

  const handleExportPdfMenu = useCallback(() => {
    const defaultName = (sheet.name || workbook.title).replace(/[^a-zA-Z0-9-_]/g, '_') || 'Untitled';
    openFilenameModal('Export PDF', defaultName, 'pdf', (filename) => {
      downloadPdf(sheet, {
        filename,
        setup: {
          orientation: 'portrait',
          pageSize: 'A4',
          scaling: 'fit-to-page',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      });
      setStatusMessage(`Exported "${filename}.pdf" — download started`);
      closeFilenameModal();
    });
  }, [workbook, sheet, openFilenameModal, closeFilenameModal]);

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

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) {
      setStatusMessage('Undo performed');
      if (prev.gridSelection) {
        const sel = prev.gridSelection as Selection;
        setGridSelection(sel);
        setActiveCell({ row: sel.anchorRow, col: sel.anchorCol });
      } else {
        setGridSelection(null);
        setActiveCell(null);
      }
      if (prev.filterState) {
        setFilterState(prev.filterState as FilterState);
      } else {
        setFilterState(null);
      }
      gridRef.current?.focus();
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) {
      setStatusMessage('Redo performed');
      if (next.filterState) {
        setFilterState(next.filterState as FilterState);
      } else {
        setFilterState(null);
      }
      if (next.gridSelection) {
        const sel = next.gridSelection as Selection;
        setGridSelection(sel);
        setActiveCell({ row: sel.anchorRow, col: sel.anchorCol });
      } else {
        setGridSelection(null);
        setActiveCell(null);
      }
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
      pushHistory(newWorkbook, `Resize column ${colToLetter(col)} to ${newWidth}px`, filterStateRef.current, gridSelectionRef.current);
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
      pushHistory(newWorkbook, `Resize row ${row + 1} to ${newHeight}px`, filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory]
  );

  const handleColumnRowSizeApply = useCallback(
    (params: { type: 'col' | 'row'; size: number; applyToAll: boolean; index: number }) => {
      const { type, size, applyToAll, index } = params;
      const newSheets = workbook.sheets.map((s, idx) => {
        if (idx !== workbook.activeSheetIndex) return s;
        if (applyToAll) {
          return {
            ...s,
            ...(type === 'col'
              ? { defaultColWidth: size }
              : { defaultRowHeight: size }),
          };
        }
        return {
          ...s,
          ...(type === 'col'
            ? { columnWidths: { ...s.columnWidths, [index]: size } }
            : { rowHeights: { ...s.rowHeights, [index]: size } }),
        };
      });
      const newWorkbook: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      const label = applyToAll
        ? `Default ${type === 'col' ? 'column width' : 'row height'} -> ${size}px`
        : `${type === 'col' ? `Column ${colToLetter(index)}` : `Row ${index + 1}`} -> ${size}px`;
      pushHistory(newWorkbook, label, filterStateRef.current, gridSelectionRef.current);
      setStatusMessage(label);
    },
    [workbook, pushHistory]
  );



  const handleFreeze = useCallback(() => {
    // Excel behavior: freeze all rows above and all columns to the left
    // of the active cell (the selection anchor). E.g. active cell C3
    // (row=2, col=2) freezes rows 0-1 and columns 0-1.
    // Use gridSelection.anchorRow/anchorCol which correctly tracks the
    // active cell even when a range is selected.
    const anchorRow = gridSelection?.anchorRow ?? activeCell?.row ?? 0;
    const anchorCol = gridSelection?.anchorCol ?? activeCell?.col ?? 0;
    freeze(anchorCol, anchorRow);
    if (anchorRow === 0 && anchorCol === 0) {
      setStatusMessage('No panes frozen — select a cell below row 1 or right of column A');
    } else {
      setStatusMessage(`Panes frozen (${anchorRow} row${anchorRow === 1 ? '' : 's'}, ${anchorCol} col${anchorCol === 1 ? '' : 's'})`);
    }
  }, [freeze, gridSelection, activeCell]);

  const handleUnfreeze = useCallback(() => {
    unfreeze();
    setStatusMessage('Panes unfrozen');
  }, [unfreeze]);

  /**
   * Strips the file extension from a filename (e.g., "budget.json" -> "budget").
   * Returns the original string if no extension is found.
   */
  const stripExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot <= 0) return filename; // no dot, or dot is first char (hidden file)
    return filename.slice(0, lastDot);
  };

  /* istanbul ignore next - handleImport requires file upload (tested in ImportButtons.test.tsx) */
  const handleImport = useCallback(
    (importedWb: Workbook, filename?: string) => {
      // If a filename is provided (from file picker), use it as the title (sans extension)
      const title = filename ? stripExtension(filename) : importedWb.title;
      const wbWithTitle: Workbook = title !== importedWb.title
        ? { ...importedWb, title, lastModified: Date.now() }
        : importedWb;
      pushHistory(wbWithTitle, 'Import file', filterStateRef.current, gridSelectionRef.current);
      setStatusMessage(`Imported "${title}" — ${wbWithTitle.sheets.length} sheet(s)`);

      // Record in MRU: local file open
      if (filename) {
        recordOpenMRU(filename, importedWb.sheets.reduce((acc, s) => acc + Object.keys(s.cells).length, 0) * 50, 'local');
      }

      // Check if imported workbook has project data and show project tab
      const hasProjectData = importedWb.extensions?.['project-wbs'] ||
        importedWb.sheets.some((s) => s.name === TASKS_SHEET_NAME);
      if (hasProjectData) {
        setShowProjectTab(true);
      }
    },
    [pushHistory, recordOpenMRU]
  );

  const handleNewSheet = useCallback(
    (wb: Workbook) => {
      resetHistory(wb);
      // Clear per-sheet active cells — new workbook has fresh sheet ids
      sheetActiveCellsRef.current.clear();
      // Default to A1 on the first sheet
      restoreActiveCellForSheet(wb.sheets[0].id);
      // Clear project state — new workbook has no project data
      setCurrentProject(null);
      setShowProjectView(false);
      setShowProjectTab(false);
      setStatusMessage('Created new workbook');
      gridRef.current?.focus();
    },
    [resetHistory, restoreActiveCellForSheet]
  );

  const handleSwitchSheet = useCallback(
    (index: number) => {
      if (index === workbook.activeSheetIndex) return;
      if (index < 0 || index >= workbook.sheets.length) return;

      // Save current active cell for the sheet we're leaving
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      if (currentSheet && activeCell) {
        sheetActiveCellsRef.current.set(currentSheet.id, { row: activeCell.row, col: activeCell.col });
      }

      const newWb: Workbook = {
        ...workbook,
        activeSheetIndex: index,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Switch to ${workbook.sheets[index].name}`, filterStateRef.current, gridSelectionRef.current);

      // Restore the target sheet's saved active cell (or default to A1)
      restoreActiveCellForSheet(workbook.sheets[index].id);
      gridRef.current?.focus();
    },
    [workbook, pushHistory, activeCell, restoreActiveCellForSheet]
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
    pushHistory(newWb, `Add Sheet${sheetNum}`, filterStateRef.current, gridSelectionRef.current);
    // New sheet has no saved position — defaults to A1
    restoreActiveCellForSheet(newSheet.id);
    gridRef.current?.focus();
  }, [workbook, pushHistory, restoreActiveCellForSheet]);

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
      pushHistory(newWb, `Rename sheet to "${trimmed}"`, filterStateRef.current, gridSelectionRef.current);
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
      pushHistory(newWb, `Copy sheet "${source.name}"`, filterStateRef.current, gridSelectionRef.current);
      // Copied sheet has no saved position — defaults to A1
      restoreActiveCellForSheet(copied.id);
      gridRef.current?.focus();
    },
    [workbook, pushHistory, restoreActiveCellForSheet]
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
      pushHistory(newWb, `Delete sheet "${sheetName}"`, filterStateRef.current, gridSelectionRef.current);
      // Clean up the deleted sheet's saved position
      sheetActiveCellsRef.current.delete(workbook.sheets[index].id);
      // Restore the target sheet's saved active cell (or default to A1)
      const newActiveSheet = newSheets[newActive < 0 ? 0 : newActive];
      restoreActiveCellForSheet(newActiveSheet.id);
      gridRef.current?.focus();
    },
    [workbook, pushHistory, restoreActiveCellForSheet]
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
      filterState?.hiddenRows,
    );
  }, [formulaWizard.isOpen, formulaWizard.compiledFormula, workbook, filterState?.hiddenRows]);

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
      const copyCount = clipboardData.rowCount * clipboardData.colCount;
      setStatusMessage(
        detail.selectionType === 'row'
          ? `Copied ${copyCount} cell(s) (row${detail.startRow !== detail.endRow ? 's' : ''})`
          : detail.selectionType === 'col'
          ? `Copied ${copyCount} cell(s) (column${detail.startCol !== detail.endCol ? 's' : ''})`
          : `Copied ${copyCount} cell(s)`
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
      const cutCount = cutData.rowCount * cutData.colCount;
      setStatusMessage(
        detail.selectionType === 'row'
          ? `Cut ${cutCount} cell(s) (row${detail.startRow !== detail.endRow ? 's' : ''})`
          : detail.selectionType === 'col'
          ? `Cut ${cutCount} cell(s) (column${detail.startCol !== detail.endCol ? 's' : ''})`
          : `Cut ${cutCount} cell(s)`
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

          // Filtered paste protection: skip hidden rows so we don't
          // silently overwrite data the user can't see (Excel behavior).
          const fs = filterStateRef.current;
          if (fs?.active && fs.hiddenRows.has(destRow)) {
            cellsSkipped++;
            continue;
          }

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

          // Formatting-only paste: preserve destination cell content,
          // apply only the style from the source
          if (pasteMode === 'formatting') {
            const existingDest = newCells[destKey];
            const mergedStyle = {
              ...existingDest?.style,
              ...cell?.style,
            };
            const destCell: Cell = {
              rawValue: existingDest?.rawValue ?? '',
              style: Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined,
            };
            if (existingDest?.computedValue !== undefined) {
              destCell.computedValue = existingDest.computedValue;
            }
            newCells[destKey] = destCell;
            cellsUpdated++;
          } else {
            const destCell: Cell = {
              rawValue: newValue,
              style: cell?.style,
            };
            newCells[destKey] = destCell;
            cellsUpdated++;
          }
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
      pushHistory(newWorkbook, actionLabel, filterStateRef.current, gridSelectionRef.current);

      // Build status message with skip info (blanks + hidden rows)
      let statusMsg = `${isCut ? 'Moved' : 'Pasted'} ${cellsUpdated} cell(s)`;
      if (cellsSkipped > 0) {
        statusMsg += ` (${cellsSkipped} skipped — hidden rows / blanks)`;
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

  /**
   * Resolves the actual sort range, expanding a single-cell selection
   * to its surrounding data region (Excel's "Current Region").
   */
  const resolveSortRange = useCallback(
    (sheet: Sheet): { startRow: number; endRow: number; startCol: number; endCol: number } => {
      if (!selection) return { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };

      const isSingleCell =
        selection.startRow === selection.endRow && selection.startCol === selection.endCol;

      if (isSingleCell) {
        // Expand to the contiguous data region around the active cell
        return getCurrentRegion(sheet, selection.startRow, selection.startCol);
      }

      return {
        startRow: Math.min(selection.startRow, selection.endRow),
        endRow: Math.max(selection.startRow, selection.endRow),
        startCol: Math.min(selection.startCol, selection.endCol),
        endCol: Math.max(selection.startCol, selection.endCol),
      };
    },
    [selection]
  );

  /** Applies a sort given resolved params. Shared by quick-sort and dialog. */
  const applySort = useCallback(
    (
      sheet: Sheet,
      startRow: number,
      endRow: number,
      sortColumns: Array<{ column: number; direction: SortDirection }>,
      hasHeader: boolean
    ) => {
      const sorted = sortRange(sheet, startRow, endRow, sortColumns, hasHeader);
      if (sorted === sheet) return; // No change

      const newSheets = workbook.sheets.map((s, idx) =>
        idx === workbook.activeSheetIndex ? sorted : s
      );
      const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
      const colDesc =
        sortColumns.length === 1
          ? `column ${colToLetter(sortColumns[0].column)}`
          : `${sortColumns.length} columns`;
      const dirDesc = sortColumns[0].direction === 'asc' ? 'ascending' : 'descending';
      pushHistory(newWb, `Sorted ${colDesc} ${dirDesc}`, filterStateRef.current, gridSelectionRef.current);
      setStatusMessage(`Sorted ${colDesc} — ${dirDesc}`);

      // Recompute filter against sorted data so hiddenRows indices stay correct.
      // sortRange physically reorders rows, invalidating the old hiddenRows set.
      if (filterState?.active) {
        const currentSheet = newSheets[workbook.activeSheetIndex];
        const recomputed = createFilterState(currentSheet, filterState.headerRow, filterState.filters);
        recomputed.active = true;
        setFilterState(recomputed);
      }
    },
    [workbook, pushHistory, filterState]
  );

  /** Quick sort A→Z: active cell's column, no header pinning (matches Excel quick sort). */
  const handleSortAscending = useCallback(() => {
    if (!selection || !activeCell) return;
    const currentSheet = workbook.sheets[workbook.activeSheetIndex];
    const range = resolveSortRange(currentSheet);
    applySort(currentSheet, range.startRow, range.endRow, [{ column: activeCell.col, direction: 'asc' }], false);
  }, [workbook, selection, activeCell, resolveSortRange, applySort]);

  /** Quick sort Z→A: active cell's column, no header pinning. */
  const handleSortDescending = useCallback(() => {
    if (!selection || !activeCell) return;
    const currentSheet = workbook.sheets[workbook.activeSheetIndex];
    const range = resolveSortRange(currentSheet);
    applySort(currentSheet, range.startRow, range.endRow, [{ column: activeCell.col, direction: 'desc' }], false);
  }, [workbook, selection, activeCell, resolveSortRange, applySort]);

  /** Opens the multi-column Sort dialog, pre-filled with the active cell's column. */
  const handleOpenSortDialog = useCallback(
    (direction: SortDirection) => {
      if (!selection || !activeCell) return;
      setPendingSortDirection(direction);
      setShowSortDialog(true);
    },
    [selection, activeCell]
  );

  /** Applies a sort from the dialog (multi-column + header option). */
  const handleSortDialogApply = useCallback(
    (levels: Array<{ column: number; direction: SortDirection }>, hasHeader: boolean) => {
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const range = resolveSortRange(currentSheet);
      applySort(currentSheet, range.startRow, range.endRow, levels, hasHeader);
    },
    [workbook, resolveSortRange, applySort]
  );

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

  // ─── Extension Helpers ─────────────────────────────────────────

  /**
   * Get the column mapping for the current project from workbook extensions.
   */
  function getProjectColumnMapping(): ColumnMapping | null {
    const extData = workbook.extensions?.['project-wbs'];
    if (extData?.data && typeof extData.data === 'object') {
      const data = extData.data as { columnMapping?: ColumnMapping };
      return data.columnMapping ?? null;
    }
    return null;
  }

  // ─── Extension Handlers ─────────────────────────────────────────

  const handleProjectNew = useCallback((templateId: string) => {
    // Create a workbook from the template data (4 sheets: tasks, risks, resources, materials)
    const newWorkbook = createWorkbookFromTemplate(templateId);
    if (!newWorkbook) return;

    // Replace workbook sheets with the new project sheets
    const updatedWb = {
      ...workbook,
      sheets: newWorkbook.sheets,
      activeSheetIndex: 0,
      extensions: undefined, // Clear any previous extension data
      lastModified: Date.now(),
    };
    pushHistory(updatedWb, `New project from template: ${newWorkbook.sheets[0].name}`, filterStateRef.current, gridSelectionRef.current);

    // Convert the workbook to a project and open the view
    const project = projectModelToProject(
      workbookToProject(updatedWb, TASKS_SHEET_NAME, undefined, newWorkbook.sheets[0].name)
    );

    setCurrentProject(project);
    setShowProjectView(true);
    setShowProjectTab(true);
  }, [workbook, pushHistory]);

  const handleProjectNewSheet = useCallback(() => {
    // Create a blank project workbook with all 7 project sheets
    const tasksSheet = createBlankTasksSheet();
    const risksSheet = createRisksSheet();
    const resourcesSheet = createResourcesSheet();
    const materialsSheet = createMaterialsSheet();
    const actualsSheet = createActualsSheet();
    const allocationsSheet = createAllocationsSheet();
    const consumptionsSheet = createConsumptionsSheet();

    const newSheets = [tasksSheet, risksSheet, resourcesSheet, materialsSheet, actualsSheet, allocationsSheet, consumptionsSheet];
    const updatedWb = {
      ...workbook,
      sheets: newSheets,
      activeSheetIndex: 0,
      extensions: undefined,
      lastModified: Date.now(),
    };
    pushHistory(updatedWb, 'New project workbook', filterStateRef.current, gridSelectionRef.current);

    // Auto-convert the workbook to a project and open the view
    const project = projectModelToProject(
      workbookToProject(updatedWb, TASKS_SHEET_NAME, undefined, 'Project Plan')
    );

    setCurrentProject(project);
    setShowProjectView(true);
    setShowProjectTab(true);
  }, [workbook, pushHistory]);

  const handleSaveProjectData = useCallback(
    (model: ProjectModel, mapping: ColumnMapping | null, sheetId: string | null) => {
      // Build the extension data to persist
      const extensionData = {
        extensionId: 'project-wbs',
        schemaVersion: '1.0.0',
        data: {
          project: model,
          columnMapping: mapping,
          sourceSheetId: sheetId,
        },
      };

      // Create new sheets from the project model
      const newWorkbook = projectModelToWorkbook(model, mapping);

      // Replace existing project sheets (by name) with new ones
      const projectSheetNames = new Set([TASKS_SHEET_NAME, RISKS_SHEET_NAME, RESOURCES_SHEET_NAME, MATERIALS_SHEET_NAME, ACTUALS_SHEET_NAME, ALLOCATIONS_SHEET_NAME, CONSUMPTIONS_SHEET_NAME]);
      const existingNonProjectSheets = workbook.sheets.filter(
        (s) => !projectSheetNames.has(s.name)
      );

      // Build updated sheets: non-project sheets + new project sheets
      const updatedSheets = [...existingNonProjectSheets, ...newWorkbook.sheets];

      // Push a history entry with the extension data and updated sheets
      const updatedWb: typeof workbook = {
        ...workbook,
        sheets: updatedSheets,
        extensions: {
          ...workbook.extensions,
          'project-wbs': extensionData,
        },
        lastModified: Date.now(),
      };
      pushHistory(updatedWb, 'Update project plan');
    },
    [workbook, pushHistory],
  );

  // ─── Conditional Formatting Handlers ────────────────────────────────

  const handleOpenConditionalFormat = useCallback(() => {
    setShowConditionalFormat(true);
  }, []);

  const handleCloseConditionalFormat = useCallback(() => {
    setShowConditionalFormat(false);
  }, []);

  const handleConditionalFormatRulesChange = useCallback(
    (rules: ConditionalFormatRule[]) => {
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const updatedSheet = { ...sheet, conditionalFormats: rules };
      const updatedSheets = [...workbook.sheets];
      updatedSheets[workbook.activeSheetIndex] = updatedSheet;
      const newWorkbook = { ...workbook, sheets: updatedSheets, lastModified: Date.now() };
      pushHistory(newWorkbook, 'Update conditional formatting', filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory],
  );

  // ─── Data Validation Handlers ───────────────────────────────────────

  const handleOpenDataValidation = useCallback(() => {
    setShowDataValidation(true);
  }, []);

  const handleCloseDataValidation = useCallback(() => {
    setShowDataValidation(false);
  }, []);

  const handleDataValidationRulesChange = useCallback(
    (rules: DataValidationRule[]) => {
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      const updatedSheet = { ...sheet, dataValidations: rules };
      const updatedSheets = [...workbook.sheets];
      updatedSheets[workbook.activeSheetIndex] = updatedSheet;
      const newWorkbook = { ...workbook, sheets: updatedSheets, lastModified: Date.now() };
      pushHistory(newWorkbook, 'Update data validation', filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory],
  );

  // ─── Named Ranges Handlers ──────────────────────────────────────────

  const handleOpenNamedRanges = useCallback(() => {
    setShowNamedRanges(true);
    // Cancel any active chart range picker session.
    setChartPointMode(false);
    setNamedRangePointMode(false);
  }, []);

  const handleCloseNamedRanges = useCallback(() => {
    setShowNamedRanges(false);
    // Cancel any active range picker session so the grid returns to normal.
    setNamedRangePointMode(false);
  }, []);

  const handleNamedRangesChange = useCallback(
    (ranges: NamedRange[]) => {
      const newWorkbook = { ...workbook, namedRanges: ranges, lastModified: Date.now() };
      pushHistory(newWorkbook, 'Update named ranges', filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory],
  );

  // ─── Chart Handlers ──────────────────────────────────────────────────

  const handleInsertChart = useCallback(() => {
    setEditingChart(null);
    setShowChartDialog(true);
  }, []);

  const handleEditChart = useCallback((chart: ChartConfig) => {
    setEditingChart(chart);
    setShowChartDialog(true);
  }, []);

  const handleChartApply = useCallback(
    (chartConfig: ChartConfig) => {
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const existingCharts = currentSheet.charts ?? [];
      const chartIndex = existingCharts.findIndex((c) => c.id === chartConfig.id);

      let updatedCharts: ChartConfig[];
      let description: string;

      if (chartIndex >= 0) {
        // Update existing chart
        updatedCharts = [...existingCharts];
        updatedCharts[chartIndex] = chartConfig;
        description = 'Updated chart';
      } else {
        // Add new chart
        updatedCharts = [...existingCharts, chartConfig];
        description = `Inserted ${chartConfig.type} chart`;
      }

      // Update the sheet with new charts array
      const updatedSheets = [...workbook.sheets];
      updatedSheets[workbook.activeSheetIndex] = {
        ...currentSheet,
        charts: updatedCharts,
      };

      const newWorkbook = {
        ...workbook,
        sheets: updatedSheets,
        lastModified: Date.now(),
      };

      pushHistory(newWorkbook, description, filterStateRef.current, gridSelectionRef.current);
      setStatusMessage(description);
    },
    [workbook, pushHistory],
  );

  const handleDeleteChart = useCallback(
    (chartId: string) => {
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const existingCharts = currentSheet.charts ?? [];
      const updatedCharts = existingCharts.filter((c) => c.id !== chartId);

      const updatedSheets = [...workbook.sheets];
      updatedSheets[workbook.activeSheetIndex] = {
        ...currentSheet,
        charts: updatedCharts,
      };

      const newWorkbook = {
        ...workbook,
        sheets: updatedSheets,
        lastModified: Date.now(),
      };

      pushHistory(newWorkbook, 'Deleted chart', filterStateRef.current, gridSelectionRef.current);
      setStatusMessage('Chart deleted');
      setSelectedChartId(null);
    },
    [workbook, pushHistory],
  );

  const handleMoveChart = useCallback(
    (chartId: string, row: number, col: number) => {
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const existingCharts = currentSheet.charts ?? [];
      const updatedCharts = existingCharts.map((c) =>
        c.id === chartId ? { ...c, row, col } : c,
      );

      const updatedSheets = [...workbook.sheets];
      updatedSheets[workbook.activeSheetIndex] = {
        ...currentSheet,
        charts: updatedCharts,
      };

      const newWorkbook = {
        ...workbook,
        sheets: updatedSheets,
        lastModified: Date.now(),
      };

      // Don't push history on every move — too noisy. Just update state.
      // History is pushed on insert/delete only.
      pushHistory(newWorkbook, 'Moved chart', filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory],
  );

  // ─── Chart Range Picker ────────────────────────────────────────────

  const handleToggleChartRangePicker = useCallback(() => {
    setChartPointMode((prev) => !prev);
  }, []);

  const handleChartPointSelection = useCallback(
    (range: string) => {
      // Update the chart range in the dialog via a custom event
      // The ChartDialog listens for this and updates its dataRange
      window.dispatchEvent(new CustomEvent('simplesheets:chartRangeSelected', {
        detail: { range },
      }));
      setChartPointMode(false);
    },
    [],
  );

  // ─── Named Range Range Picker ─────────────────────────────────────

  const handleToggleNamedRangeRangePicker = useCallback(() => {
    setNamedRangePointMode((prev) => !prev);
  }, []);

  const handleNamedRangePointSelection = useCallback(
    (range: string) => {
      // Update the named range reference in the modal via a custom event
      // The NamedRangesModal listens for this and updates its draft
      window.dispatchEvent(new CustomEvent('simplesheets:namedRangeSelected', {
        detail: { range },
      }));
      setNamedRangePointMode(false);
    },
    [],
  );

  const handleResizeChart = useCallback(
    (chartId: string, width: number, height: number) => {
      const currentSheet = workbook.sheets[workbook.activeSheetIndex];
      const existingCharts = currentSheet.charts ?? [];
      const chart = existingCharts.find((c) => c.id === chartId);
      if (!chart) return;

      const updatedCharts = existingCharts.map((c) =>
        c.id === chartId ? { ...c, width, height } : c,
      );

      const updatedSheets = [...workbook.sheets];
      updatedSheets[workbook.activeSheetIndex] = {
        ...currentSheet,
        charts: updatedCharts,
      };

      const newWorkbook = {
        ...workbook,
        sheets: updatedSheets,
        lastModified: Date.now(),
      };

      pushHistory(newWorkbook, 'Resized chart', filterStateRef.current, gridSelectionRef.current);
    },
    [workbook, pushHistory],
  );

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
      const newWb: Workbook = {
        ...workbook,
        sheets: newSheets,
        lastModified: Date.now(),
      };
      pushHistory(newWb, `Paste ${cellsUpdated} cell(s)`, filterStateRef.current, gridSelectionRef.current);

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
    pushHistory(newWb, `Insert row ${rowIndex + 1}`, filterStateRef.current, gridSelectionRef.current);
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
    pushHistory(newWb, `Insert row ${rowIndex + 1}`, filterStateRef.current, gridSelectionRef.current);
    setStatusMessage(`Inserted row ${rowIndex + 1}`);
  }, [workbook, pushHistory, activeCell]);

  const handleInsertColLeft = useCallback(() => {
    if (!activeCell) return;
    const colIndex = activeCell.col;
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? insertCol(s, colIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Insert col ${colToLetter(colIndex)}`, filterStateRef.current, gridSelectionRef.current);
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
    pushHistory(newWb, `Insert col ${colToLetter(colIndex)}`, filterStateRef.current, gridSelectionRef.current);
    setStatusMessage(`Inserted column ${colToLetter(colIndex)}`);
  }, [workbook, pushHistory, activeCell]);

  // ─── Delete Guard: check reverse dependencies before deleting ───────
  /**
   * Returns the set of formula cell keys that depend on any of the given
   * cell keys (via the reverse dependency graph). Used to warn before
   * deleting rows/columns that would break formula references.
   */
  const getDependentsForKeys = useCallback(
    (keys: string[]): string[] => {
      const sheet = workbook.sheets[workbook.activeSheetIndex];
      if (!sheet) return [];
      const { reverseDeps } = buildDependencyGraph(sheet);
      const dependents = new Set<string>();
      for (const key of keys) {
        const deps = reverseDeps.get(key);
        if (deps) {
          for (const d of deps) dependents.add(d);
        }
      }
      return [...dependents];
    },
    [workbook],
  );

  const handleDeleteRow = useCallback(() => {
    if (!activeCell) return;
    const rowIndex = activeCell.row;
    // Collect all cell keys in the row being deleted
    const sheet = workbook.sheets[workbook.activeSheetIndex];
    const keysInRow: string[] = [];
    for (let c = 0; c < sheet.columnCount; c++) {
      keysInRow.push(cellKey(rowIndex, c));
    }
    const dependents = getDependentsForKeys(keysInRow);
    if (dependents.length > 0) {
      const msg = `Deleting this row will break ${dependents.length} formula(s) that reference it. Continue?`;
      if (!window.confirm(msg)) return;
    }
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? deleteRow(s, rowIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Delete row ${rowIndex + 1}`, filterStateRef.current, gridSelectionRef.current);
    setActiveCell({ row: Math.max(0, rowIndex - 1), col: activeCell.col });
    setStatusMessage(`Deleted row ${rowIndex + 1}`);
  }, [workbook, pushHistory, activeCell, getDependentsForKeys]);

  const handleDeleteCol = useCallback(() => {
    if (!activeCell) return;
    const colIndex = activeCell.col;
    // Collect all cell keys in the column being deleted
    const sheet = workbook.sheets[workbook.activeSheetIndex];
    const keysInCol: string[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      keysInCol.push(cellKey(r, colIndex));
    }
    const dependents = getDependentsForKeys(keysInCol);
    if (dependents.length > 0) {
      const msg = `Deleting this column will break ${dependents.length} formula(s) that reference it. Continue?`;
      if (!window.confirm(msg)) return;
    }
    const newSheets = workbook.sheets.map((s, idx) =>
      idx === workbook.activeSheetIndex ? deleteCol(s, colIndex) : s
    );
    const newWb: Workbook = { ...workbook, sheets: newSheets, lastModified: Date.now() };
    pushHistory(newWb, `Delete col ${colToLetter(colIndex)}`, filterStateRef.current, gridSelectionRef.current);
    setActiveCell({ row: activeCell.row, col: Math.max(0, colIndex - 1) });
    setStatusMessage(`Deleted column ${colToLetter(colIndex)}`);
  }, [workbook, pushHistory, activeCell, getDependentsForKeys]);

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
              handleSaveToCloud();
              return;
            case 'o':
              e.preventDefault();
              handleOpenFromCloud();
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
      // Ctrl+Shift+V opens Paste Special dialog (Excel shortcut)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handlePasteSpecial();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo, handleNewSheet, handleSaveToCloud, handleOpenFromCloud, handleSearchReplace, toggleBoldStyle, toggleItalicStyle, toggleUnderlineStyle, handleToggleFilter, handleFxClick, getActiveCellValue, handlePasteSpecial, activeCell]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Menu Bar */}
      <header className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-blue-700">SimpleSheets</h1>
        <MenuBar
          onNew={() => handleNewSheet(createEmptyWorkbook())}
          onLoadDemo={() => handleNewSheet(createDemoWorkbook())}
          onImportExcel={handleImportExcelMenu}
          onImportCsv={handleImportCsvMenu}
          onImportJson={handleImportJsonMenu}
          onExportExcel={handleExportExcelMenu}
          onExportCsv={handleExportCsvMenu}
          onExportJson={handleExportJsonMenu}
          onExportPdf={handleExportPdfMenu}
          onPageSetup={() => setShowPrintSetup(true)}
          onSaveToCloud={handleSaveToCloud}
          onOpenFromCloud={handleOpenFromCloud}
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
          onChart={handleInsertChart}
          onOpenNamedRanges={handleOpenNamedRanges}
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
          onColumnRowSize={() => setShowColumnRowSize(true)}
          onSortAscending={handleSortAscending}
          onSortDescending={handleSortDescending}
          onOpenSortDialog={handleOpenSortDialog}
          onToggleFilter={handleToggleFilter}
          onClearAllFilters={handleClearAllFilters}
          isFilterActive={filterState?.active || false}
          isBold={styleState.fontWeight === 'bold'}
          isItalic={styleState.fontStyle === 'italic'}
          isUnderline={styleState.textDecoration === 'underline'}
          isWrapText={styleState.whiteSpace === 'normal'}
          onAbout={handleAbout}
          onShortcuts={handleShortcuts}
          onSimpleDocs={handleSimpleDocs}
          onSearchReplace={handleSearchReplace}
          onProjectNew={handleProjectNew}
          onProjectNewSheet={handleProjectNewSheet}
          recentFiles={recentFiles}
          onOpenRecent={handleOpenRecent}
          onRemoveRecent={removeMRU}
          onClearRecent={clearMRU}
          onAfterMenuAction={() => gridRef.current?.focus()}
        />
        <span className="text-sm text-gray-500">{workbook.title}</span>
      </header>

      {/* Toolbar */}
      <Toolbar
        onToggleBold={toggleBoldStyle}
        onToggleItalic={toggleItalicStyle}
        onToggleUnderline={toggleUnderlineStyle}
        onToggleStrikethrough={toggleStrikethroughStyle}
        onChart={handleInsertChart}
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
        onOpenConditionalFormat={handleOpenConditionalFormat}
        onOpenDataValidation={handleOpenDataValidation}
        onOpenNamedRanges={handleOpenNamedRanges}
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
        onCrossSheetRefChange={handleCrossSheetRefChange}
        onFxClick={handleFxClick}
        onCrossSheetClick={handleNavigateToCrossSheet}
        namedRanges={workbook.namedRanges}
        activeSheetId={sheet.id}
      />

      {/* Cross-sheet navigation tip */}
      {pendingCrossSheetRef && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[92px] z-50 bg-blue-50 border border-blue-200 rounded-lg shadow-md px-3 py-2 flex items-center gap-2 text-xs">
          <span className="text-blue-700">
            📋 <strong>{pendingCrossSheetRef.sheetName}</strong>!{colToLetter(pendingCrossSheetRef.startCol)}{pendingCrossSheetRef.startRow + 1}:{colToLetter(pendingCrossSheetRef.endCol)}{pendingCrossSheetRef.endRow + 1}
          </span>
          <button
            className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            onClick={() => handleNavigateToCrossSheet()}
          >
            Go to sheet
          </button>
          <button
            className="px-2 py-0.5 text-gray-500 hover:text-gray-700"
            onClick={() => setPendingCrossSheetRef(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Sheet Tabs + Project Tab */}
      <SheetTabs
        workbook={workbook}
        showProjectView={showProjectView}
        showProjectTab={showProjectTab}
        onSwitchSheet={(idx) => {
          handleSwitchSheet(idx);
          // Switching to a sheet tab exits project view
          if (showProjectView) setShowProjectView(false);
        }}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onCopySheet={handleCopySheet}
        onDeleteSheet={handleDeleteSheet}
        onShowProjectView={() => {
          // Always re-convert workbook to project to pick up any edits made in sheet view.
          // Changes made in Project view are already synced to the workbook via syncProjectToSheet,
          // so re-converting here is safe and ensures sheet edits (resources, risks, etc.) are reflected.
          const tasksSheet = workbook.sheets.find((s) => s.name === TASKS_SHEET_NAME);
          if (tasksSheet) {
            // Multi-sheet project format
            const extData = workbook.extensions?.['project-wbs'];
            const mapping = extData?.data
              ? (extData.data as { columnMapping?: ColumnMapping }).columnMapping
              : undefined;
            const model = workbookToProject(workbook, TASKS_SHEET_NAME, mapping ?? undefined);
            const project = projectModelToProject(model);
            setCurrentProject(project);
          }
          setShowProjectView(true);
        }}
      />

      {/* Project View (shown when Project tab is active) */}
      {showProjectView && currentProject && (
        <div className="flex-1 overflow-hidden">
          <ProjectView
            project={currentProject}
            activeSheet={sheet}
            columnMapping={getProjectColumnMapping()}
            onSaveProject={handleSaveProjectData}
            onProjectChange={(project) => setCurrentProject(project)}
          />
        </div>
      )}
      {/* Grid — shown when Project tab is not active */}
      {!showProjectView && (
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
          conditionalFormats={sheet.conditionalFormats}
          session={editingSession}
          onStartEnter={handleGridStartEnter}
          onStartEdit={handleGridStartEdit}
          onRawKeyDown={handleRawKeyDown}
          onRawChange={handleRawChange}
          onFillSeries={handleFillSeries}
          filterState={filterState}
          onApplyFilter={handleApplyFilter}
          autoComplete={autoComplete}
          onAcceptAutoComplete={acceptAutoComplete}
          onNavigateAutoComplete={navigateAutoComplete}
          onDismissAutoComplete={dismissAutoComplete}
          wizardPointMode={isWizardPointMode || chartPointMode || namedRangePointMode}
          onWizardPointSelection={
            isWizardPointMode
              ? handleWizardPointSelection
              : chartPointMode
              ? handleChartPointSelection
              : handleNamedRangePointSelection
          }
        />
        <ChartOverlay
          sheet={updatedSheet}
          workbook={workbook}
          onSelectChart={setSelectedChartId}
          onMoveChart={handleMoveChart}
          onResizeChart={handleResizeChart}
          onDeleteChart={handleDeleteChart}
          onEditChart={handleEditChart}
          selectedChartId={selectedChartId}
        />
      </div>
      )}

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
        {/* Cross-sheet navigation indicator */}
        {crossSheetNavigation && (
          <span className="text-blue-600 font-medium">
            📋 Viewing {crossSheetNavigation.sheetName} — click formula bar to return
          </span>
        )}
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
      <ColumnRowSizeModal
        isOpen={showColumnRowSize}
        onClose={() => { setShowColumnRowSize(false); gridRef.current?.focus(); }}
        currentCol={activeCell?.col ?? 0}
        currentRow={activeCell?.row ?? 0}
        defaultColWidth={workbook.sheets[workbook.activeSheetIndex]?.defaultColWidth ?? 100}
        defaultRowHeight={workbook.sheets[workbook.activeSheetIndex]?.defaultRowHeight ?? 28}
        onApply={handleColumnRowSizeApply}
      />
      <SortDialog
        isOpen={showSortDialog}
        onClose={() => { setShowSortDialog(false); gridRef.current?.focus(); }}
        columnCount={sheet.columnCount}
        defaultColumn={activeCell?.col ?? 0}
        defaultDirection={pendingSortDirection}
        defaultHasHeader={false}
        rowCount={selection ? Math.abs(selection.endRow - selection.startRow) + 1 : 0}
        onApply={handleSortDialogApply}
      />
      <ShortcutsModal isOpen={showShortcuts} onClose={() => { setShowShortcuts(false); gridRef.current?.focus(); }} />
      <AboutModal isOpen={showAbout} onClose={() => { setShowAbout(false); gridRef.current?.focus(); }} />
      <CloudStorageModal
        isOpen={showCloudModal}
        onClose={() => { setShowCloudModal(false); gridRef.current?.focus(); }}
        mode={cloudModalMode}
        workbook={workbook}
        onOpenDocument={handleImport}
        onStatusMessage={setStatusMessage}
        onSaveFile={handleSaveFile}
      />
      <FilenameModal
        isOpen={filenameModal.isOpen}
        title={filenameModal.title}
        defaultName={filenameModal.defaultName}
        extension={filenameModal.extension}
        onConfirm={filenameModal.onConfirm}
        onCancel={closeFilenameModal}
      />
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
          // Capture target cell so formula is placed in the correct cell
          setWizardTargetCell(activeCell ?? null);
          // Capture source sheet so formula is placed on the correct sheet
          setWizardTargetSheetIndex(workbook.activeSheetIndex);
          openFormulaWizard(functionName, targetCellRef);
        }}
        onAcceptPointSelection={() => {
          // Accept the current point selection (for touch devices)
          gridRef.current?.acceptPointSelection();
        }}
        targetRow={wizardTargetCell?.row}
        targetCol={wizardTargetCell?.col}
      />
      <ChartDialog
        isOpen={showChartDialog}
        onClose={() => {
          setShowChartDialog(false);
          setEditingChart(null);
          setSelectedChartId(null);
          gridRef.current?.focus();
        }}
        onApply={handleChartApply}
        sheet={sheet}
        initialRange={
          gridSelection
            ? `${colToLetter(gridSelection.startCol)}${gridSelection.startRow + 1}:${colToLetter(gridSelection.endCol)}${gridSelection.endRow + 1}`
            : undefined
        }
        existingChart={editingChart ?? undefined}
        isRangePickerActive={chartPointMode}
        onToggleRangePicker={handleToggleChartRangePicker}
        initialSettings={chartSettings}
        onSettingsChange={updateChartSettings}
        workbook={workbook}
      />
      <ConditionalFormatModal
        isOpen={showConditionalFormat}
        onClose={handleCloseConditionalFormat}
        rules={sheet.conditionalFormats ?? []}
        onRulesChange={handleConditionalFormatRulesChange}
      />
      <DataValidationModal
        isOpen={showDataValidation}
        onClose={handleCloseDataValidation}
        rules={sheet.dataValidations ?? []}
        onRulesChange={handleDataValidationRulesChange}
      />
      <NamedRangesModal
        isOpen={showNamedRanges}
        onClose={handleCloseNamedRanges}
        namedRanges={workbook.namedRanges ?? []}
        onNamedRangesChange={handleNamedRangesChange}
        sheets={workbook.sheets}
        activeSheetId={sheet.id}
        isRangePickerActive={namedRangePointMode}
        onToggleRangePicker={handleToggleNamedRangeRangePicker}
      />
      <SheetLinkProvider workbook={workbook} />
    </div>
  );
}
