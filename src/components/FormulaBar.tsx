// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useCallback, useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { parseFormula, type ASTNode } from '../utils/formulaParser';
import { validateFormula, type ValidationResult } from '../utils/formulaValidation';
import { type FunctionInfo } from '../utils/formulaAutocomplete';
import type { EditingSession } from '../hooks/useCellEditing';
import type { ReferenceFormat } from '../hooks/useReferenceFormat';
import { colToLetter } from '../types';
import { FormulaHighlightOverlay, computeHighlightSegments } from './FormulaHighlightOverlay';
import { HIGHLIGHT_COLORS } from '../utils/highlightColors';

/** Represents a highlighted range with a color index. */
export interface HighlightedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  colorIndex: number;
  /** Sheet name for cross-sheet references (undefined for same-sheet). */
  sheetName?: string;
  /** Start position in formula text (for cursor-based navigation). */
  startPos?: number;
  /** End position in formula text (for cursor-based navigation). */
  endPos?: number;
}

export interface FormulaBarProps {
  // ── Read-only state from FSM ─────────────────────────────────────────
  /** Current editing session state. */
  session: EditingSession;
  /** Current display value (formula buffer or cell value). */
  value: string;
  /** Current cursor position within the buffer. */
  cursorPos: number;

  // ── Raw event handlers (FSM decides what to do) ─────────────────────
  /** Raw key down event - FSM processes based on current state. */
  onRawKeyDown: (e: React.KeyboardEvent) => void;
  /** Raw change event - FSM updates buffer. */
  onRawChange: (value: string, caretPos: number) => void;
  /** Raw focus event - FSM enters EDIT mode. */
  onRawFocus: (caretPos: number) => void;
  /** Raw blur event - FSM commits or cancels. */
  onRawBlur: () => void;
  /** Caret moved (click) - FSM updates caret position. */
  onRawCaretMove: (caretPos: number) => void;

  // ── Auto-complete state from FSM ──────────────────────────────────
  /** Auto-complete state derived from the current buffer and caret. */
  autoComplete: { open: boolean; matches: FunctionInfo[]; index: number; tokenStart: number };
  /** Accept the auto-complete suggestion at the given index. */
  onAcceptAutoComplete: (index: number) => void;
  /** Navigate the auto-complete selection (+1 = down, -1 = up). */
  onNavigateAutoComplete: (delta: number) => void;
  /** Dismiss the auto-complete dropdown. */
  onDismissAutoComplete: () => void;

  // ── UI callbacks (non-editing) ──────────────────────────────────────
  /** Reference format (A1 or R1C1). */
  referenceFormat?: ReferenceFormat;
  /** Callback when the reference format toggle is clicked. */
  onToggleReferenceFormat?: () => void;
  /** Callback when formula highlights change. */
  onHighlightsChange?: (ranges: HighlightedRange[]) => void;
  /**
   * Callback when the cursor is on a cross-sheet reference.
   * Provides the sheet name and range info for navigation.
   * Called with null when cursor leaves all cross-sheet refs.
   */
  onCrossSheetRefChange?: (info: { sheetName: string; startRow: number; startCol: number; endRow: number; endCol: number; startPos: number; endPos: number } | null) => void;
  /** Callback when the fx button is clicked — opens FormulaWizard with current formula. */
  onFxClick?: (currentValue: string) => void;
  /** Callback when a cross-sheet reference is clicked in the formula bar. */
  onCrossSheetClick?: (sheetName: string, cellRef: string) => void;
}

/**
 * Walks the AST to extract ranges for highlighting.
 * Cross-sheet references (those with a sheetName) are skipped — they
 * reference cells on a different sheet and should not be highlighted
 * on the current sheet.
 */
function walkAstForHighlights(node: ASTNode, ranges: HighlightedRange[], colorIndex: { value: number }): void {
  switch (node.type) {
    case 'cell':
      if (node.sheetName) break; // cross-sheet ref — don't highlight on current sheet
      ranges.push({
        startRow: node.row,
        startCol: node.col,
        endRow: node.row,
        endCol: node.col,
        colorIndex: colorIndex.value % HIGHLIGHT_COLORS.length,
        startPos: node.pos,
        endPos: node.endPos,
      });
      colorIndex.value++;
      break;
    case 'range':
      if (node.sheetName) break; // cross-sheet ref — don't highlight on current sheet
      ranges.push({
        startRow: Math.min(node.start.row, node.end.row),
        startCol: Math.min(node.start.col, node.end.col),
        endRow: Math.max(node.start.row, node.end.row),
        endCol: Math.max(node.start.col, node.end.col),
        colorIndex: colorIndex.value % HIGHLIGHT_COLORS.length,
        startPos: node.pos,
        endPos: node.endPos,
      });
      colorIndex.value++;
      break;
    case 'binary':
      walkAstForHighlights(node.left, ranges, colorIndex);
      walkAstForHighlights(node.right, ranges, colorIndex);
      break;
    case 'unary':
      walkAstForHighlights(node.operand, ranges, colorIndex);
      break;
    case 'function':
      node.args.forEach(arg => walkAstForHighlights(arg, ranges, colorIndex));
      break;
  }
}

/**
 * Extracts cross-sheet references from the AST with their text positions.
 * These are used for click-to-navigate behavior.
 */
function walkAstForCrossSheetRefs(node: ASTNode, refs: { sheetName: string; startRow: number; startCol: number; endRow: number; endCol: number; pos?: number; endPos?: number }[]): void {
  switch (node.type) {
    case 'cell':
      if (node.sheetName) {
        refs.push({ sheetName: node.sheetName, startRow: node.row, startCol: node.col, endRow: node.row, endCol: node.col, pos: node.pos, endPos: node.endPos });
      }
      break;
    case 'range':
      if (node.sheetName) {
        refs.push({ sheetName: node.sheetName, startRow: Math.min(node.start.row, node.end.row), startCol: Math.min(node.start.col, node.end.col), endRow: Math.max(node.start.row, node.end.row), endCol: Math.max(node.start.col, node.end.col), pos: node.pos, endPos: node.endPos });
      }
      break;
    case 'binary':
      walkAstForCrossSheetRefs(node.left, refs);
      walkAstForCrossSheetRefs(node.right, refs);
      break;
    case 'unary':
      walkAstForCrossSheetRefs(node.operand, refs);
      break;
    case 'function':
      node.args.forEach(arg => walkAstForCrossSheetRefs(arg, refs));
      break;
  }
}

/**
 * Finds the cross-sheet reference at the given cursor position.
 * Returns null if cursor is not on a cross-sheet ref.
 */
export function findCrossSheetRefAtCursor(formula: string, cursorPos: number): { sheetName: string; startRow: number; startCol: number; endRow: number; endCol: number; startPos: number; endPos: number } | null {
  if (!formula || !formula.startsWith('=')) return null;
  try {
    const ast = parseFormula(formula.slice(1));
    const refs: { sheetName: string; startRow: number; startCol: number; endRow: number; endCol: number; pos?: number; endPos?: number }[] = [];
    walkAstForCrossSheetRefs(ast, refs);
    for (const ref of refs) {
      if (ref.pos !== undefined && ref.endPos !== undefined && cursorPos >= ref.pos && cursorPos <= ref.endPos) {
        return { sheetName: ref.sheetName, startRow: ref.startRow, startCol: ref.startCol, endRow: ref.endRow, endCol: ref.endCol, startPos: ref.pos, endPos: ref.endPos };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts ranges from a formula string for highlighting.
 * Cross-sheet references (with sheetName) are excluded — they should not
 * be highlighted on the current sheet.
 */
export function extractHighlights(formula: string): HighlightedRange[] {
  if (!formula || !formula.startsWith('=')) return [];

  try {
    const ast = parseFormula(formula.slice(1));
    const ranges: HighlightedRange[] = [];
    walkAstForHighlights(ast, ranges, { value: 0 });
    return ranges;
  } catch {
    return [];
  }
}

/**
 * Auto-complete dropdown component.
 */
export function AutoCompleteDropdown({
  matches,
  selectedIndex,
  onHover,
  onSelect,
}: {
  matches: FunctionInfo[];
  selectedIndex: number;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
  onDismiss?: () => void;
}) {
  /* istanbul ignore next - dropdown hidden when empty */
  if (matches.length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-64 overflow-y-auto"
      /* istanbul ignore next - prevent stealing focus */
      onMouseDown={(e) => e.preventDefault()}
    >
      {matches.map((fn, idx) => (
        <div
          key={fn.name}
          className={`flex items-start gap-3 px-3 py-2 cursor-pointer ${
            idx === selectedIndex ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
          }`}
          /* istanbul ignore next - mouse handlers for dropdown items */
          onMouseDown={() => onSelect(idx)}
          onMouseEnter={() => onHover(idx)}
        >
          <span className="font-mono text-sm font-semibold text-blue-700 min-w-[80px]">
            {fn.name}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 truncate">{fn.signature}</div>
            <div className="text-xs text-gray-400">{fn.description}</div>
          </div>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {fn.category}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Formula bar with live range highlighting, auto-complete, validation, and point mode.
 */
export interface FormulaBarHandle {
  focusInput: () => void;
}

export const FormulaBar = forwardRef<FormulaBarHandle, FormulaBarProps>(function FormulaBar({
  session,
  value,
  cursorPos,
  onRawKeyDown,
  onRawChange,
  onRawFocus,
  onRawBlur,
  onRawCaretMove,
  autoComplete,
  onAcceptAutoComplete,
  onNavigateAutoComplete,
  onDismissAutoComplete,
  referenceFormat = 'A1',
  onToggleReferenceFormat,
  onHighlightsChange,
  onCrossSheetRefChange,
  onFxClick,
  onCrossSheetClick,
}, ref) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to the highlight overlay so we can sync its scroll with the input
  const overlayRef = useRef<HTMLDivElement>(null);
  // Track whether focus event should be ignored (used during Alt+Enter expansion)
  const suppressFocus = useRef(false);

  // Expose focusInput to parent for Ctrl+F2 toggle
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        // Move caret to end of existing content
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    },
  }), []);

  // Derive editing mode from FSM session state
  const isEditing = session.state !== 'SELECT';
  const isPointMode = session.state === 'POINT';

  // Compute active cell reference from session
  const activeCellRef = `${colToLetter(session.col)}${session.row + 1}`;

  // Wrapper to update value and caret position
  const onChange = useCallback((newValue: string) => {
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? newValue.length) : newValue.length;
    onRawChange(newValue, caretPos);
  }, [onRawChange]);

  // Compute highlights when formula changes
  const highlights = useMemo(() => {
    if (value && isEditing) {
      return extractHighlights(value);
    }
    return [];
  }, [value, isEditing]);

  // Detect cross-sheet reference under cursor
  const crossSheetRef = useMemo(() => {
    if (value && isEditing && cursorPos != null) {
      return findCrossSheetRefAtCursor(value, cursorPos);
    }
    return null;
  }, [value, isEditing, cursorPos]);

  // Emit cross-sheet ref info to parent
  useEffect(() => {
    onCrossSheetRefChange?.(crossSheetRef);
  }, [crossSheetRef, onCrossSheetRefChange]);

  // Emit highlights to parent
  useEffect(() => {
    onHighlightsChange?.(highlights);
  }, [highlights, onHighlightsChange]);

  // Compute validation
  const validation: ValidationResult = useMemo(() => validateFormula(value), [value]);

  // Sync overlay scroll position with the input scroll position.
  // The overlay is absolutely positioned over the input and renders the
  // colored formula segments (the input text is transparent). When the input
  // scrolls horizontally (long formula > bar width), the overlay must scroll
  // in sync or the highlights will be misaligned with the caret position.
  const syncOverlayScroll = useCallback(() => {
    const input = inputRef.current;
    const overlay = overlayRef.current;
    if (input && overlay) {
      overlay.scrollLeft = input.scrollLeft;
    }
  }, []);

  // Sync cursor position to input element and scroll to keep cursor visible
  // IMPORTANT: Only sync when there's no active selection to avoid clearing
  // the user's text selection
  useEffect(() => {
    const input = inputRef.current;
    /* istanbul ignore next - jsdom activeElement check */
    if (input && document.activeElement === input) {
      // Don't override if user has an active selection
      const hasSelection = input.selectionStart !== input.selectionEnd;
      if (!hasSelection) {
        input.setSelectionRange(cursorPos, cursorPos);
      }
      // Scroll to keep cursor visible
      const textBeforeCursor = value.slice(0, cursorPos);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const computedStyle = window.getComputedStyle(input);
        ctx.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
        const textWidth = ctx.measureText(textBeforeCursor).width;
        const padding = parseInt(computedStyle.paddingLeft) || 0;
        const cursorX = padding + textWidth;
        // Scroll if cursor is beyond visible area
        if (cursorX > input.scrollLeft + input.clientWidth) {
          input.scrollLeft = cursorX - input.clientWidth + 20;
        } else if (cursorX < input.scrollLeft) {
          input.scrollLeft = Math.max(0, cursorX - 20);
        }
      }
      // Sync overlay scroll to match input scroll
      syncOverlayScroll();
    }
  }, [cursorPos, value, syncOverlayScroll]);



  const handleFocus = useCallback(() => {
    // Suppress focus handling when expanding for Alt+Enter
    /* istanbul ignore next - edge case: suppress focus after Alt+Enter */
    if (suppressFocus.current) {
      suppressFocus.current = false;
      return;
    }
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? 0) : value.length;
    onRawFocus(caretPos);
  }, [onRawFocus, value.length]);

  const handleBlur = useCallback(() => {
    // Suppress blur-commit when expanding for Alt+Enter
    /* istanbul ignore next - edge case: suppress blur after Alt+Enter */
    if (suppressFocus.current) {
      return;
    }
    // Don't commit if we're already in SELECT state (e.g., Enter/Tab already committed)
    if (session.state === 'SELECT') {
      return;
    }
    onRawBlur();
  }, [onRawBlur, session.state]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ── Expand/Collapse Formula Bar (Ctrl + Shift + U) ────────────────
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      setExpanded((prev) => !prev);
      return;
    }

    // ── Alt+Enter: insert line break ─────────────────────────────────
    // Expand to textarea and insert a newline at the cursor position.
    if (e.key === 'Enter' && e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!expanded) {
        // Use cursorPos prop (FSM caret) instead of native selection,
        // because the native selection may not be in sync with the FSM.
        const newValue = value.slice(0, cursorPos) + '\n' + value.slice(cursorPos);
        // Mark that the next focus event should be suppressed
        suppressFocus.current = true;
        // Expand to textarea to show the newline
        setExpanded(true);
        // Update the buffer via onChange (which calls the FSM)
        onChange(newValue);
        // Update the caret position in the FSM
        onRawCaretMove(cursorPos + 1);
        return;
      }
    }

    // ── Auto-complete navigation (takes priority when dropdown is open) ──
    if (autoComplete.open && ['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onNavigateAutoComplete(1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          onNavigateAutoComplete(-1);
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          onAcceptAutoComplete(autoComplete.index);
          return;
        case 'Escape':
          e.preventDefault();
          onDismissAutoComplete();
          return;
      }
    }

    // ── Ctrl+C: Copy selected text ────────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      const input = inputRef.current;
      if (input && input.selectionStart !== input.selectionEnd) {
        const selectedText = input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
        navigator.clipboard.writeText(selectedText).catch(() => {
          // Fallback: use document.execCommand
          /* istanbul ignore next - edge case: clipboard API unavailable */
          const textArea = document.createElement('textarea');
          textArea.value = selectedText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        });
      }
      return;
    }

    // ── Ctrl+V: Paste and sync buffer ─────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      navigator.clipboard.readText().then((clipText) => {
        const input = inputRef.current;
        if (input) {
          const selStart = input.selectionStart ?? 0;
          const selEnd = input.selectionEnd ?? 0;
          const newValue = value.slice(0, selStart) + clipText + value.slice(selEnd);
          const newPos = selStart + clipText.length;
          onChange(newValue);
          onRawCaretMove(newPos);
        }
      }).catch(() => {
        // Clipboard access denied - let native paste handle it
      });
      return;
    }

    // ── Handle Shift+Arrow for text selection in EDIT mode ──────────
    // Text selection is a view concern - let native input handle it
    // But in POINT mode, Shift+Arrow extends range selection (FSM concern)
    const isEditingText = session.state === 'EDIT' || session.state === 'ENTER';
    if (isEditingText && e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      // Don't preventDefault - let native input create selection
      // The cursor sync effect will preserve the selection
      return;
    }

    // ── Clear selection on Arrow keys (no Shift) ────────────────────
    // When user has selection and presses Arrow without Shift, collapse
    // the selection to the caret position before FSM processes the key
    const input = inputRef.current;
    const hasSelection = input ? input.selectionStart !== input.selectionEnd : false;
    if (!e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && hasSelection) {
      // Collapse selection to caret (keep the side cursor is moving toward)
      const caretPos = e.key === 'ArrowLeft' ? (input?.selectionStart ?? 0) : (input?.selectionEnd ?? 0);
      input?.setSelectionRange(caretPos, caretPos);
    }

    // ── Always forward ) to FSM (commits POINT reference) ──────────
    // Must be handled before the selection check because ) is a printable
    // char that would otherwise be inserted natively when text is selected
    if (e.key === ')') {
      e.preventDefault();
      onRawKeyDown(e);
      return;
    }

    // ── Handle selection-based keys natively ─────────────────────────
    // If text is selected, let the native input handle Backspace/Delete/printable
    // keys. The onChange handler will sync the result to the FSM.
    const isSelectionKey = e.key === 'Backspace' || e.key === 'Delete' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey);

    if (hasSelection && isSelectionKey) {
      // Let native input handle it - onChange will sync to FSM
      return;
    }

    // ── Forward all other keys to FSM ─────────────────────────────────
    e.preventDefault();
    onRawKeyDown(e);
  }, [autoComplete, onAcceptAutoComplete, onNavigateAutoComplete, onDismissAutoComplete, value, onChange, onRawCaretMove, onRawKeyDown, session.state, cursorPos, expanded]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const rawPos = e.target.selectionStart;
    const newPos = rawPos !== null && rawPos !== undefined ? rawPos : newValue.length;

    // Forward to FSM (autocomplete state is derived from FSM session)
    onRawChange(newValue, newPos);
  }, [onRawChange]);

  const handleClick = useCallback(() => {
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? 0) : value.length;
    onRawCaretMove(caretPos);
  }, [onRawCaretMove, value.length]);

  const handleSelect = useCallback(() => {
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? 0) : value.length;
    onRawCaretMove(caretPos);
  }, [onRawCaretMove, value.length]);

  // Build error display
  // Only show actual errors (not incomplete) to avoid blocking sheet tabs while typing
  // Positioned ABOVE the formula bar so it doesn't obstruct the sheet tabs below
  const displayableErrors = validation.errors.filter((e) => e.severity === 'error');
  const errorDisplay = useMemo(() => {
    if (isEditing && displayableErrors.length > 0) {
      const error = displayableErrors[0];
      return (
        <div className="absolute left-0 right-0 -top-6 bg-red-50 border border-red-200 rounded px-2 py-0.5 text-xs text-red-600 z-10">
          {error.message}
        </div>
      );
    }
    if (isEditing && validation.isIncomplete) {
      return (
        <div className="absolute left-0 right-0 -top-6 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 text-xs text-yellow-600 z-10">
          Incomplete formula
        </div>
      );
    }
    return null;
  }, [isEditing, validation, displayableErrors]);

  // Only apply text-transparent when the overlay will actually render
  // segments. Without this guard, typing "=" alone would make the
  // character invisible (text-transparent applied, but no overlay).
  const showOverlay = value.startsWith('=') && isEditing && computeHighlightSegments(value, true) !== null;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-white">
        {/* Active cell reference (click to toggle A1/R1C1) */}
        <button
          className="font-mono text-sm text-gray-600 w-14 text-center border border-gray-300 rounded bg-gray-50 px-1 py-0.5 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
          onClick={onToggleReferenceFormat}
          title={`Active cell — click to switch to ${referenceFormat === 'A1' ? 'R1C1' : 'A1'} format`}
        >
          {activeCellRef}
        </button>

        {/* Formula fx indicator — click to open FormulaWizard */}
        {onFxClick ? (
          <button
            className="text-gray-400 font-medium hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
            onClick={() => onFxClick(value)}
            title="Open Formula Wizard (Ctrl+Shift+F)"
          >
            fx
          </button>
        ) : (
          <span className="text-gray-400 font-medium">fx</span>
        )}

        {/* Point mode indicator */}
        {isPointMode && (
          <span className="text-xs font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded animate-pulse">
            POINT
          </span>
        )}

        {/* Expand/Collapse button */}
        <button
          className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-1 py-0.5 rounded transition-colors"
          onClick={() => setExpanded((prev) => !prev)}
          title={expanded ? 'Collapse formula bar (Ctrl+Shift+U)' : 'Expand formula bar (Ctrl+Shift+U)'}
        >
          {expanded ? '▼' : '▲'}
        </button>

        {/* Formula input area */}
        <div className={`flex-1 relative ${expanded ? 'min-h-[80px]' : ''} overflow-x-auto`}>
          {/* Colored display layer (underlay) */}
          <FormulaHighlightOverlay ref={overlayRef} value={value} isEditing={isEditing} onCrossSheetClick={onCrossSheetClick} />
          {/* Actual input — horizontal scroll for long content */}
          {expanded ? (
            <textarea
              ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
              className={`outline-none font-mono text-sm relative bg-transparent min-w-full formula-input-scroll resize-y ${
                showOverlay ? 'text-transparent selection:bg-blue-200' : ''
              }`}
              style={{ caretColor: '#000', minWidth: '100%', minHeight: '80px' }}
              placeholder="Enter a value or formula (e.g., =SUM(A1:A10))"
              value={value}
              onChange={handleChange}
              onFocus={handleFocus}
              onScroll={syncOverlayScroll}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={handleClick}
              onSelect={handleSelect}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              className={`outline-none font-mono text-sm relative bg-transparent min-w-full formula-input-scroll ${
                showOverlay ? 'text-transparent selection:bg-blue-200' : ''
              }`}
              style={{ caretColor: '#000', minWidth: '100%' }}
              placeholder="Enter a value or formula (e.g., =SUM(A1:A10))"
              value={value}
              onChange={handleChange}
              onFocus={handleFocus}
              onScroll={syncOverlayScroll}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={handleClick}
              onSelect={handleSelect}
            />
          )}
        </div>
      </div>

      {/* Error / incomplete display */}
      {errorDisplay}

      {/* Auto-complete dropdown */}
      {autoComplete.open && (
        <div className="absolute left-[8rem] right-3 top-full z-50">
          <AutoCompleteDropdown
            matches={autoComplete.matches}
            selectedIndex={autoComplete.index}
            onHover={(idx) => onNavigateAutoComplete(idx - autoComplete.index)}
            onSelect={onAcceptAutoComplete}
            onDismiss={onDismissAutoComplete}
          />
        </div>
      )}
    </div>
  );
});
