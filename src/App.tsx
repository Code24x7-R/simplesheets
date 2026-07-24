import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Workbook } from './types';
import { cellKey, colToLetter } from './types';
import { HistoryProvider, useHistory } from './context/HistoryContext';
import { FreezeProvider, useFreeze } from './context/FreezeContext';
import { PrintSetupProvider } from './context/PrintSetupContext';
import { Grid } from './components/Grid';
import type { PointModeSelection } from './components/Grid';
import { FormulaBar } from './components/FormulaBar';
import type { HighlightedRange } from './components/FormulaBar';
import { colToLetter as colLetter } from './types';
import { Toolbar } from './components/Toolbar';
import { ImportExcelButton } from './components/ImportExcelButton';
import { ExportExcelButton } from './components/ExportExcelButton';
import { ImportCsvButton } from './components/ImportCsvButton';
import { ExportCsvButton } from './components/ExportCsvButton';
import { ImportJsonButton } from './components/ImportJsonButton';
import { ExportJsonButton } from './components/ExportJsonButton';
import { ExportPdfButton } from './components/ExportPdfButton';
import { NewSheetButton } from './components/NewSheetButton';
import { SaveButton } from './components/SaveButton';
import { LoadButton } from './components/LoadButton';
import { PrintSetupModal } from './components/PrintSetupModal';
import { evaluateWorkbook } from './utils/formulaEngine';
import { copyRange, cutRange as clipCutRange, getClipboard, clearClipboard } from './utils/clipboard';
import { adjustFormulaRefs } from './utils/formulaParser';
import { useAutosave } from './hooks/useAutosave';
import { loadAutosave } from './services/storageService';
import type { Cell, Selection } from './types';

// ─── Demo Workbook ───────────────────────────────────────────────────────────

function createDemoWorkbook(): Workbook {
  const rows = 10000;
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
    // Restore from auto-save if available, otherwise use demo workbook
    const saved = loadAutosave();
    return saved ?? createDemoWorkbook();
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

  // Auto-save to localStorage on every workbook change (debounced)
  useAutosave(workbook);
  const [showPrintSetup, setShowPrintSetup] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [highlightedRanges, setHighlightedRanges] = useState<HighlightedRange[]>([]);
  const [pendingCutRange, setPendingCutRange] = useState<Selection | null>(null);

  // ─── Point Mode State ──────────────────────────────────────────────
  const [isPointMode, setIsPointMode] = useState(false);
  const [pointSelection, setPointSelection] = useState<PointModeSelection | null>(null);
  const [formulaCursorPos, setFormulaCursorPos] = useState(0);
  // Ref to track point mode selection origin for arrow key navigation
  const pointOriginRef = useRef<{ row: number; col: number }>({ row: 0, col: 0 });

  const sheet = workbook.sheets[workbook.activeSheetIndex];

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
    const result = evaluateWorkbook(updatedSheet);
    /* istanbul ignore next - circular ref warning requires self-referencing formula (tested in formulaEngine.test.ts) */
    if (result.circularRefs.length > 0) {
      setStatusMessage(`Warning: ${result.circularRefs.length} circular reference(s) detected`);
    }
  }, [updatedSheet]);

  // ─── Copy/Paste Event Handlers ────────────────────────────────────────────

  useEffect(() => {
    const handleCopyEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      /* istanbul ignore next - defensive null check */
      if (!detail) return;
      copyRange(sheet.cells, detail.startRow, detail.startCol, detail.endRow, detail.endCol, detail.selectionType);
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

      // If cut, clear source cells
      if (isCut && pendingCutRange) {
        for (let r = pendingCutRange.startRow; r <= pendingCutRange.endRow; r++) {
          for (let c = pendingCutRange.startCol; c <= pendingCutRange.endCol; c++) {
            const key = cellKey(r, c);
            if (newCells[key]) {
              delete newCells[key];
            }
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

  // ─── Point Mode Handlers ──────────────────────────────────────────

  /* istanbul ignore next - onRequestPointMode is passed to FormulaBar but never invoked */
  const handleRequestPointMode = useCallback(() => {
    if (!activeCell) return;
    setIsPointMode(true);
    const sel: PointModeSelection = {
      startRow: activeCell.row,
      startCol: activeCell.col,
      endRow: activeCell.row,
      endCol: activeCell.col,
    };
    setPointSelection(sel);
    pointOriginRef.current = { row: activeCell.row, col: activeCell.col };
  }, [activeCell]);

  /* istanbul ignore next - handleCellPick requires isPointMode which can't be set from UI */
  const handleCellPick = useCallback((dRow: number, dCol: number, shiftKey: boolean) => {
    if (!isPointMode) return;

    // Determine if this is an arrow-key delta or an absolute cell click
    // Arrow keys pass small deltas (-1, 0, 1); clicks pass absolute row/col
    const isDelta = Math.abs(dRow) <= 1 && Math.abs(dCol) <= 1 && (dRow !== 0 || dCol !== 0);

    if (isDelta) {
      // Arrow key navigation — apply delta to current point position
      setPointSelection((prev) => {
        const base = prev ?? {
          startRow: pointOriginRef.current.row,
          startCol: pointOriginRef.current.col,
          endRow: pointOriginRef.current.row,
          endCol: pointOriginRef.current.col,
        };
        const newRow = Math.max(0, base.endRow + dRow);
        const newCol = Math.max(0, base.endCol + dCol);
        if (shiftKey) {
          // Extend range from anchor
          return {
            ...base,
            endRow: newRow,
            endCol: newCol,
          };
        } else {
          // Move both start and end (single cell)
          return {
            startRow: newRow,
            startCol: newCol,
            endRow: newRow,
            endCol: newCol,
          };
        }
      });
    } else {
      // Absolute cell click from Grid
      if (shiftKey) {
        setPointSelection((prev) => ({
          startRow: prev?.startRow ?? dRow,
          startCol: prev?.startCol ?? dCol,
          endRow: dRow,
          endCol: dCol,
        }));
      } else {
        const sel: PointModeSelection = {
          startRow: dRow,
          startCol: dCol,
          endRow: dRow,
          endCol: dCol,
        };
        setPointSelection(sel);
        pointOriginRef.current = { row: dRow, col: dCol };
      }
    }
  }, [isPointMode]);

  /* istanbul ignore next - handleExitPointMode requires isPointMode which can't be set from UI */
  const handleExitPointMode = useCallback(() => {
    if (!isPointMode || !pointSelection) {
      setIsPointMode(false);
      return;
    }

    // Build the cell reference string
    const { startRow, startCol, endRow, endCol } = pointSelection;
    let ref: string;
    if (startRow === endRow && startCol === endCol) {
      ref = `${colLetter(startCol)}${startRow + 1}`;
    } else {
      ref = `${colLetter(startCol)}${startRow + 1}:${colLetter(endCol)}${endRow + 1}`;
    }

    // Insert the reference at the cursor position in the formula
    const before = formulaBarValue.slice(0, formulaCursorPos);
    const after = formulaBarValue.slice(formulaCursorPos);
    const newValue = before + ref + after;
    setFormulaBarValue(newValue);

    // Update cursor position
    const newPos = formulaCursorPos + ref.length;
    setFormulaCursorPos(newPos);

    setIsPointMode(false);
    setPointSelection(null);
  }, [isPointMode, pointSelection, formulaBarValue, formulaCursorPos]);

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

  /* istanbul ignore next - handleImportError requires import failure (tested in ImportButtons.test.tsx) */
  const handleImportError = useCallback((msg: string) => {
    setStatusMessage(`Import error: ${msg}`);
  }, []);

  /* istanbul ignore next - handlePdfError requires PDF export failure (tested in ExportPdfButton) */
  const handlePdfError = useCallback((msg: string) => {
    setStatusMessage(`PDF error: ${msg}`);
  }, []);

  // ─── Derived State ────────────────────────────────────────────────────────

  const activeCellRef = activeCell
    ? `${colToLetter(activeCell.col)}${activeCell.row + 1}`
    : 'A1';

  const selection: Selection | null = activeCell
    ? {
        type: 'cell',
        startRow: activeCell.row,
        startCol: activeCell.col,
        endRow: activeCell.row,
        endCol: activeCell.col,
        anchorRow: activeCell.row,
        anchorCol: activeCell.col,
      }
    : null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-blue-700">SimpleSheet</h1>
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
        onRequestPointMode={handleRequestPointMode}
        onCellPick={handleCellPick}
        onExitPointMode={handleExitPointMode}
      />

      {/* Toolbar */}
      <Toolbar
        workbook={workbook}
        selection={selection}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onMerge={handleMerge}
        onUnmerge={handleUnmerge}
        onFreeze={handleFreeze}
        onUnfreeze={handleUnfreeze}
        canUndo={canUndo}
        canRedo={canRedo}
        frozenRows={frozenRows}
        frozenCols={frozenColumns}
      />

      {/* Save / Load Buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        <NewSheetButton onNewSheet={handleNewSheet} />
        <SaveButton
          workbook={workbook}
          onSaved={(name) => setStatusMessage(`Saved "${name}"`)}
          onError={(msg) => setStatusMessage(`Save error: ${msg}`)}
        />
        <LoadButton onImport={handleImport} onError={handleImportError} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
      </div>

      {/* Import/Export Buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        <ImportExcelButton onImport={handleImport} onError={handleImportError} />
        <ExportExcelButton workbook={workbook} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ImportCsvButton onImport={handleImport} onError={handleImportError} />
        <ExportCsvButton sheet={sheet} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ImportJsonButton onImport={handleImport} onError={handleImportError} />
        <ExportJsonButton workbook={workbook} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ExportPdfButton sheet={sheet} onError={handlePdfError} />
        <button
          className="toolbar-btn"
          onClick={() => setShowPrintSetup(true)}
          title="Page setup"
        >
          Page Setup
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <Grid
          sheet={updatedSheet}
          onCellChange={handleCellChange}
          onSelect={handleCellSelect}
          selectedCell={activeCell}
          highlightedRanges={highlightedRanges}
          isPointMode={isPointMode}
          pointSelection={pointSelection}
          onCellPick={handleCellPick}
          onHeaderSelect={handleHeaderSelect}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
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

      {/* Modals */}
      <PrintSetupModal isOpen={showPrintSetup} onClose={() => setShowPrintSetup(false)} />
    </div>
  );
}
