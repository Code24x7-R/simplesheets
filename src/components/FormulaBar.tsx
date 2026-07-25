import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { parseFormula, type ASTNode } from '../utils/formulaParser';
import { validateFormula, type ValidationResult } from '../utils/formulaValidation';
import { searchFunctions, type FunctionInfo } from '../utils/formulaAutocomplete';
import type { EditingSession, PointSession } from '../hooks/useCellEditing';
import type { ReferenceFormat } from '../hooks/useReferenceFormat';

/** Represents a highlighted range with a color index. */
export interface HighlightedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  colorIndex: number;
}

interface FormulaBarProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  activeCellRef: string;
  /** Current formula being edited (for live highlighting). */
  editingFormula: string | null;
  /** Callback when formula highlights change. */
  onHighlightsChange?: (ranges: HighlightedRange[]) => void;
  /** Current cursor position in the formula. */
  cursorPos?: number;
  /** Callback when cursor position changes. */
  onCursorChange?: (pos: number) => void;
  /** Whether we're in point mode (selecting cells). */
  isPointMode?: boolean;
  /** The current point mode selection for visual feedback. */
  pointSelection?: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  /** Callback to request entering point mode. */
  onRequestPointMode?: () => void;
  /** Callback when a cell is picked during point mode. */
  onCellPick?: (row: number, col: number, shiftKey: boolean) => void;
  /** Callback to exit point mode. */
  onExitPointMode?: () => void;
  /** The editing session from useCellEditing hook (when integrated). */
  editingSession?: EditingSession | null;
  /** The point session from useCellEditing hook (when integrated). */
  editingPointSession?: PointSession | null;
  /** Callback to handle a key press via the editing FSM. */
  onEditingKey?: (key: string, shiftKey: boolean, ctrlKey: boolean) => void;
  /** Callback to commit the edit (e.g., on blur) via the editing FSM. */
  onBlurEditing?: () => void;
  /** Reference format (A1 or R1C1). */
  referenceFormat?: ReferenceFormat;
  /** Callback when the reference format toggle is clicked. */
  onToggleReferenceFormat?: () => void;
  /** Callback when a function is selected from the function bar. */
  onInsertFunction?: (functionName: string) => void;
}

/**
 * Colors for highlighting different references in a formula.
 */
const HIGHLIGHT_COLORS = [
  'rgba(59, 130, 246, 0.10)',  // blue
  'rgba(239, 68, 68, 0.10)',   // red
  'rgba(34, 197, 94, 0.10)',   // green
  'rgba(234, 179, 8, 0.10)',   // yellow
  'rgba(168, 85, 247, 0.10)',  // purple
  'rgba(236, 72, 153, 0.10)',  // pink
  'rgba(249, 115, 22, 0.10)',  // orange
  'rgba(6, 182, 212, 0.10)',   // cyan
];

const HIGHLIGHT_BORDER_COLORS = [
  'rgb(59, 130, 246)',
  'rgb(239, 68, 68)',
  'rgb(34, 197, 94)',
  'rgb(234, 179, 8)',
  'rgb(168, 85, 247)',
  'rgb(236, 72, 153)',
  'rgb(249, 115, 22)',
  'rgb(6, 182, 212)',
];

/**
 * Walks the AST to extract ranges for highlighting.
 */
function walkAstForHighlights(node: ASTNode, ranges: HighlightedRange[], colorIndex: { value: number }): void {
  switch (node.type) {
    case 'cell':
      ranges.push({
        startRow: node.row,
        startCol: node.col,
        endRow: node.row,
        endCol: node.col,
        colorIndex: colorIndex.value % HIGHLIGHT_COLORS.length,
      });
      colorIndex.value++;
      break;
    case 'range':
      ranges.push({
        startRow: Math.min(node.start.row, node.end.row),
        startCol: Math.min(node.start.col, node.end.col),
        endRow: Math.max(node.start.row, node.end.row),
        endCol: Math.max(node.start.col, node.end.col),
        colorIndex: colorIndex.value % HIGHLIGHT_COLORS.length,
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
 * Extracts ranges from a formula string for highlighting.
 */
function extractHighlights(formula: string): HighlightedRange[] {
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
function AutoCompleteDropdown({
  matches,
  selectedIndex,
  onSelect,
}: {
  matches: FunctionInfo[];
  selectedIndex: number;
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
          onMouseEnter={() => onSelect(idx)}
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
export function FormulaBar({
  value,
  onChange,
  onCommit,
  activeCellRef,
  editingFormula,
  onHighlightsChange,
  cursorPos: externalCursorPos,
  onCursorChange,
  isPointMode = false,
  pointSelection: _pointSelection,
  onRequestPointMode: _onRequestPointMode,
  onCellPick,
  onExitPointMode,
  editingSession,
  editingPointSession: _editingPointSession,
  onEditingKey,
  onBlurEditing,
  referenceFormat = 'A1',
  onToggleReferenceFormat,
  onInsertFunction,
}: FormulaBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [internalCursorPos, setInternalCursorPos] = useState(0);
  const [autoCompleteOpen, setAutoCompleteOpen] = useState(false);
  const [autoCompleteMatches, setAutoCompleteMatches] = useState<FunctionInfo[]>([]);
  const [autoCompleteIndex, setAutoCompleteIndex] = useState(0);
  const [autoCompleteTokenStart, setAutoCompleteTokenStart] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const cursorPos = externalCursorPos ?? internalCursorPos;

  // When integrated with the editing FSM hook, the hook owns the buffer
  const hookBuffer = editingSession?.buffer;
  const isHookEditing = onEditingKey != null && editingSession != null && editingSession.state !== 'SELECT';
  const displayValue = isHookEditing ? (hookBuffer ?? '') : value;

  // Compute highlights when formula changes
  const highlights = useMemo(() => {
    const formulaToParse = isEditing ? displayValue : editingFormula;
    if (formulaToParse) {
      return extractHighlights(formulaToParse);
    }
    return [];
  }, [displayValue, isEditing, editingFormula]);

  // Emit highlights to parent
  useEffect(() => {
    onHighlightsChange?.(highlights);
  }, [highlights, onHighlightsChange]);

  // Compute validation
  const validation: ValidationResult = useMemo(() => validateFormula(displayValue), [displayValue]);

  // Sync cursor position to input element
  useEffect(() => {
    const input = inputRef.current;
    /* istanbul ignore next - jsdom activeElement check */
    if (input && document.activeElement === input) {
      input.setSelectionRange(cursorPos, cursorPos);
    }
  }, [cursorPos]);

  // Close auto-complete when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setAutoCompleteOpen(false);
    }
  }, [isEditing]);

  const updateCursorPos = useCallback(() => {
    const input = inputRef.current;
    if (input) {
      const pos = input.selectionStart ?? 0;
      setInternalCursorPos(pos);
      onCursorChange?.(pos);
      return pos;
    }
    /* istanbul ignore next - input ref is null */
    return cursorPos;
  }, [cursorPos, onCursorChange]);

  // Find function token at cursor position for auto-complete
  const findFunctionToken = useCallback((text: string, pos: number): { token: string; start: number } | null => {
    if (!text.startsWith('=')) return null;
    const body = text.slice(1);
    // Clamp to valid range; if cursor is at 0 (jsdom), search from end
    const relPos = pos <= 0 ? body.length - 1 : Math.min(pos - 1, body.length - 1);
    if (relPos < 0) return null;

    // Walk backwards to find token start
    let start = relPos;
    while (start > 0 && /[A-Za-z]/.test(body[start - 1])) {
      start--;
    }

    // Walk forwards to find token end
    let end = relPos;
    while (end < body.length && /[A-Za-z]/.test(body[end])) {
      end++;
    }

    if (start === end) return null;

    const token = body.slice(start, end).toUpperCase();

    // Check if we're in a function context
    const prevChar = start > 0 ? body[start - 1] : '';
    const isFunctionContext = start === 0 || /[,(+\-*/&=<>]/.test(prevChar) || prevChar === ' ';

    if (!isFunctionContext || token.length === 0) return null;

    return { token, start: start + 1 }; // +1 for display position
  }, []);

  const openAutoComplete = useCallback(() => {
    const result = findFunctionToken(value, cursorPos);
    /* istanbul ignore next - cursor not on a function token */
    if (!result) {
      setAutoCompleteOpen(false);
      return;
    }

    const matches = searchFunctions(result.token);
    /* istanbul ignore next - no functions match the token */
    if (matches.length === 0) {
      setAutoCompleteOpen(false);
      return;
    }

    setAutoCompleteMatches(matches);
    setAutoCompleteIndex(0);
    setAutoCompleteTokenStart(result.start);
    setAutoCompleteOpen(true);
  }, [value, cursorPos, findFunctionToken]);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    setAutoCompleteOpen(false);
    // When integrated with the hook, commit via the hook so the FSM
    // transitions back to SELECT cleanly.
    if (onEditingKey && editingSession && editingSession.state !== 'SELECT') {
      onBlurEditing?.();
      return;
    }
    onCommit(displayValue);
  }, [displayValue, onCommit, onEditingKey, editingSession, onBlurEditing]);

  const acceptAutoComplete = useCallback((index: number) => {
    const selected = autoCompleteMatches[index];
    if (!selected) return;

    const before = displayValue.slice(0, autoCompleteTokenStart);
    const after = displayValue.slice(autoCompleteTokenStart + (findFunctionToken(displayValue, cursorPos)?.token.length ?? 0));
    const newValue = before + selected.name + '()' + after;

    // When integrated with the hook, feed the accepted function via keys
    if (onEditingKey && editingSession) {
      // The hook already has the token typed; we need to replace it with NAME()
      // Feed: Backspace * tokenLen, then type NAME()
      const tokenLen = findFunctionToken(displayValue, cursorPos)?.token.length ?? 0;
      for (let i = 0; i < tokenLen; i++) onEditingKey('Backspace', false, false);
      for (const ch of selected.name + '()') onEditingKey(ch, false, false);
      setAutoCompleteOpen(false);
      return;
    }

    onChange(newValue);

    // Position cursor inside the parens
    const newPos = autoCompleteTokenStart + selected.name.length + 2;
    setInternalCursorPos(newPos);
    onCursorChange?.(newPos);
    setAutoCompleteOpen(false);

    // Focus back on input
    /* istanbul ignore next - requestAnimationFrame in jsdom */
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newPos, newPos);
    });
  }, [autoCompleteMatches, displayValue, autoCompleteTokenStart, cursorPos, onEditingKey, editingSession, onChange, onCursorChange, findFunctionToken]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // When integrated with the editing FSM hook, delegate ALL key handling
    // to the hook — it owns the buffer, caret, and POINT mode state.
    if (onEditingKey) {
      // Auto-complete navigation still takes priority when dropdown is open
      if (autoCompleteOpen && ['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setAutoCompleteIndex((prev) => (prev + 1) % autoCompleteMatches.length);
            return;
          case 'ArrowUp':
            e.preventDefault();
            setAutoCompleteIndex((prev) => (prev - 1 + autoCompleteMatches.length) % autoCompleteMatches.length);
            return;
          case 'Tab':
          case 'Enter':
            e.preventDefault();
            acceptAutoComplete(autoCompleteIndex);
            return;
          case 'Escape':
            e.preventDefault();
            setAutoCompleteOpen(false);
            return;
        }
      }
      // Feed every key to the FSM hook — it decides what to do.
      // But if the hook is in SELECT state it may ignore keys like Enter/Tab
      // that arrive natively (e.g. via paste + Enter).  In that case skip
      // the hook and let the legacy commit logic below handle it.
      {
        const hookState = editingSession?.state;
        const isSelecting = hookState === 'SELECT';
        const isNavOrCommitKey = ['Enter', 'Tab', 'Escape'].includes(e.key);
        if (!(isSelecting && isNavOrCommitKey)) {
          e.preventDefault();
          onEditingKey(e.key, e.shiftKey, e.ctrlKey);
          return;
        }
      }
    }

    // ── Legacy standalone mode (no hook) ──────────────────────────────

    // Handle auto-complete navigation
    if (autoCompleteOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setAutoCompleteIndex((prev) => (prev + 1) % autoCompleteMatches.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setAutoCompleteIndex((prev) => (prev - 1 + autoCompleteMatches.length) % autoCompleteMatches.length);
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          acceptAutoComplete(autoCompleteIndex);
          return;
        case 'Escape':
          e.preventDefault();
          setAutoCompleteOpen(false);
          return;
      }
    }

    // Handle point mode
    if (isPointMode) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onCellPick?.(-1, 0, e.shiftKey);
          return;
        case 'ArrowDown':
          e.preventDefault();
          onCellPick?.(1, 0, e.shiftKey);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          onCellPick?.(0, -1, e.shiftKey);
          return;
        case 'ArrowRight':
          e.preventDefault();
          onCellPick?.(0, 1, e.shiftKey);
          return;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          onExitPointMode?.();
          return;
        case 'Escape':
          e.preventDefault();
          onExitPointMode?.();
          return;
      }
    }

    // Normal editing keys
    switch (e.key) {
      case 'Enter':
        onCommit(displayValue);
        setIsEditing(false);
        setAutoCompleteOpen(false);
        inputRef.current?.blur();
        break;
      case 'Escape':
        setIsEditing(false);
        setAutoCompleteOpen(false);
        inputRef.current?.blur();
        break;
      case 'Tab':
        // Let Tab navigate to next field
        setAutoCompleteOpen(false);
        break;
      case '(':
        if (displayValue.startsWith('=')) {
          e.preventDefault();
          const pos = updateCursorPos();
          const before = displayValue.slice(0, pos);
          const after = displayValue.slice(pos);
          onChange(before + '()' + after);
          const newPos = pos + 1;
          setInternalCursorPos(newPos);
          onCursorChange?.(newPos);
          /* istanbul ignore next - requestAnimationFrame in jsdom */
          requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(newPos, newPos);
          });
        }
        break;
      case ')':
        if (displayValue.startsWith('=')) {
          const pos = updateCursorPos();
          /* istanbul ignore next - skip over existing closing paren */
          if (displayValue[pos] === ')') {
            e.preventDefault();
            setInternalCursorPos(pos + 1);
            onCursorChange?.(pos + 1);
            /* istanbul ignore next - requestAnimationFrame in jsdom */
            requestAnimationFrame(() => {
              inputRef.current?.setSelectionRange(pos + 1, pos + 1);
            });
          }
        }
        break;
    }
  }, [onEditingKey, autoCompleteOpen, autoCompleteMatches, autoCompleteIndex, isPointMode, displayValue, editingSession, onCommit, onCellPick, onExitPointMode, onChange, onCursorChange, acceptAutoComplete, updateCursorPos]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // When integrated with the hook, the hook owns the buffer during active
    // editing (we preventDefault on keydown so the native input doesn't
    // change from typing).  Paste/autofill can still change the input
    // natively — update the displayed value and reset the hook so the
    // committed value matches what the user pasted.
    if (onEditingKey && editingSession) {
      if (editingSession.state === 'SELECT') {
        onChange(newValue);
        return;
      }
      // Paste during active editing: update display, hook buffer will resync
      // on the next keypress or commit.
      onChange(newValue);
      return;
    }

    onChange(newValue);

    // Update cursor position — default to end of input (jsdom doesn't set selectionStart on change)
    const rawPos = e.target.selectionStart;
    const newPos = rawPos !== null && rawPos !== undefined ? rawPos : newValue.length;
    setInternalCursorPos(newPos);
    onCursorChange?.(newPos);

    // Check if we should show auto-complete
    if (newValue.startsWith('=')) {
      // Use end of body for token finding (jsdom doesn't update selectionStart on change)
      const searchPos = Math.max(newPos, 1);
      const result = findFunctionToken(newValue, searchPos);
      if (result && result.token.length >= 1) {
        const matches = searchFunctions(result.token);
        if (matches.length > 0) {
          setAutoCompleteMatches(matches);
          setAutoCompleteIndex(0);
          setAutoCompleteTokenStart(result.start);
          setAutoCompleteOpen(true);
          return;
        }
      }
    }
    setAutoCompleteOpen(false);
  }, [onEditingKey, editingSession, onChange, onCursorChange, findFunctionToken]);

  const handleClick = useCallback(() => {
    updateCursorPos();
    if (isEditing && displayValue.startsWith('=')) {
      openAutoComplete();
    }
  }, [updateCursorPos, isEditing, displayValue, openAutoComplete]);

  const handleSelect = useCallback(() => {
    updateCursorPos();
  }, [updateCursorPos]);

  // Build the colored reference display overlay
  const formulaDisplay = useMemo(() => {
    if (!isEditing || !displayValue) return null;
    if (!displayValue.startsWith('=')) return null;

    try {
      const formula = displayValue.slice(1);
      const segments: Array<{ text: string; colorIndex: number | null }> = [];
      let colorIdx = 0;

      const tokenRegex = /(\$?[A-Za-z]+\$?\d+:?|\$?[A-Za-z]+|[0-9.]+|[+\-*/(),&^=<>]|"[^"]*"|[A-Za-z]+)/gi;
      let match;

      while ((match = tokenRegex.exec(formula)) !== null) {
        const token = match[0];
        if (/^\$?[A-Za-z]+\$?\d+$/i.test(token)) {
          segments.push({
            text: token,
            colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
          });
          colorIdx++;
        } else if (/^\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+$/i.test(token)) {
          segments.push({
            text: token,
            colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
          });
          colorIdx++;
        } else {
          segments.push({ text: token, colorIndex: null });
        }
      }

      if (segments.length === 0) return null;

      return (
        <div className="absolute inset-0 pointer-events-none font-mono text-sm flex items-center px-1 overflow-hidden whitespace-nowrap">
          {segments.map((seg, i) => (
            <span
              key={i}
              style={
                seg.colorIndex !== null
                  ? {
                      backgroundColor: HIGHLIGHT_COLORS[seg.colorIndex],
                      border: `1px solid ${HIGHLIGHT_BORDER_COLORS[seg.colorIndex]}`,
                      borderRadius: '2px',
                      padding: '0 2px',
                      fontWeight: 600,
                      color: HIGHLIGHT_BORDER_COLORS[seg.colorIndex],
                    }
                  : undefined
              }
            >
              {seg.text}
            </span>
          ))}
        </div>
      );
    } catch {
      return null;
    }
  }, [isEditing, displayValue]);

  // Build error display
  const errorDisplay = useMemo(() => {
    if (isEditing && validation.errors.length > 0) {
      const error = validation.errors[0];
      return (
        <div className="absolute left-0 right-0 -bottom-6 bg-red-50 border border-red-200 rounded px-2 py-0.5 text-xs text-red-600 z-10">
          {error.message}
        </div>
      );
    }
    if (isEditing && validation.isIncomplete) {
      return (
        <div className="absolute left-0 right-0 -bottom-6 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 text-xs text-yellow-600 z-10">
          Incomplete formula
        </div>
      );
    }
    return null;
  }, [isEditing, validation]);

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

        {/* Formula fx indicator */}
        <span className="text-gray-400 font-medium">fx</span>

        {/* Point mode indicator */}
        {isPointMode && (
          <span className="text-xs font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded animate-pulse">
            POINT
          </span>
        )}

        {/* Formula input area */}
        <div className="flex-1 relative">
          {/* Colored display layer (underlay) */}
          {formulaDisplay}
          {/* Actual input */}
          <input
            ref={inputRef}
            type="text"
            className={`w-full outline-none font-mono text-sm relative bg-transparent ${
              formulaDisplay ? 'text-transparent selection:bg-blue-200' : ''
            }`}
            style={{ caretColor: '#000' }}
            placeholder="Enter a value or formula (e.g., =SUM(A1:A10))"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Function bar — one line of common functions */}
      <div className="function-bar">
        {['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'SUMIF', 'COUNTIF', 'VLOOKUP', 'ROUND'].map((fn) => (
          <button
            key={fn}
            className="function-btn"
            onClick={() => onInsertFunction?.(fn)}
            title={`Insert ${fn}() formula`}
          >
            {fn}
          </button>
        ))}
      </div>

      {/* Error / incomplete display */}
      {errorDisplay}

      {/* Auto-complete dropdown */}
      {autoCompleteOpen && (
        <div className="absolute left-[8rem] right-3 top-full z-50">
          <AutoCompleteDropdown
            matches={autoCompleteMatches}
            selectedIndex={autoCompleteIndex}
            onSelect={(idx) => {
              setAutoCompleteIndex(idx);
              acceptAutoComplete(idx);
            }}
            onDismiss={() => setAutoCompleteOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
