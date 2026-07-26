import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { parseFormula, type ASTNode } from '../utils/formulaParser';
import { validateFormula, type ValidationResult } from '../utils/formulaValidation';
import { searchFunctions, type FunctionInfo } from '../utils/formulaAutocomplete';
import type { EditingSession, PointSession } from '../hooks/useCellEditing';
import type { ReferenceFormat } from '../hooks/useReferenceFormat';
import { colToLetter } from '../types';

/** Represents a highlighted range with a color index. */
export interface HighlightedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  colorIndex: number;
}

export interface FormulaBarProps {
  // ── Read-only state from FSM ─────────────────────────────────────────
  /** Current editing session state. */
  session: EditingSession;
  /** Current POINT session (null if not in POINT mode). */
  pointSession: PointSession | null;
  /** Current display value (formula buffer or cell value). */
  value: string;
  /** Current cursor position within the buffer. */
  cursorPos: number;
  /** Status message derived from FSM state. */
  statusMessage: string;

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

  // ── Grid interaction for POINT mode ─────────────────────────────────
  /** Cell clicked during POINT mode - FSM updates selection. */
  onCellPick: (row: number, col: number, shiftKey: boolean) => void;

  // ── UI callbacks (non-editing) ──────────────────────────────────────
  /** Reference format (A1 or R1C1). */
  referenceFormat?: ReferenceFormat;
  /** Callback when the reference format toggle is clicked. */
  onToggleReferenceFormat?: () => void;
  /** Callback when a function is selected from the function bar. */
  onInsertFunction?: (functionName: string) => void;
  /** Callback when the Insert Function button is clicked (opens wizard). */
  onOpenWizard?: () => void;
  /** Callback when formula highlights change. */
  onHighlightsChange?: (ranges: HighlightedRange[]) => void;
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
  session,
  pointSession,
  value,
  cursorPos,
  statusMessage,
  onRawKeyDown,
  onRawChange,
  onRawFocus,
  onRawBlur,
  onRawCaretMove,
  onCellPick,
  referenceFormat = 'A1',
  onToggleReferenceFormat,
  onInsertFunction,
  onOpenWizard,
  onHighlightsChange,
}: FormulaBarProps) {
  const [autoCompleteOpen, setAutoCompleteOpen] = useState(false);
  const [autoCompleteMatches, setAutoCompleteMatches] = useState<FunctionInfo[]>([]);
  const [autoCompleteIndex, setAutoCompleteIndex] = useState(0);
  const [autoCompleteTokenStart, setAutoCompleteTokenStart] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Emit highlights to parent
  useEffect(() => {
    onHighlightsChange?.(highlights);
  }, [highlights, onHighlightsChange]);

  // Compute validation
  const validation: ValidationResult = useMemo(() => validateFormula(value), [value]);

  // Sync cursor/selection position to input element and scroll to keep cursor visible
  useEffect(() => {
    const input = inputRef.current;
    /* istanbul ignore next - jsdom activeElement check */
    if (input && document.activeElement === input) {
      // Set cursor position
      input.setSelectionRange(cursorPos, cursorPos);
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
    }
  }, [cursorPos, value]);

  // Close auto-complete when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setAutoCompleteOpen(false);
    }
  }, [isEditing]);

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
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? 0) : value.length;
    onRawFocus(caretPos);
  }, [onRawFocus, value.length]);

  const handleBlur = useCallback(() => {
    onRawBlur();
  }, [onRawBlur]);

  const acceptAutoComplete = useCallback((index: number) => {
    const selected = autoCompleteMatches[index];
    if (!selected) return;

    const before = value.slice(0, autoCompleteTokenStart);
    const after = value.slice(autoCompleteTokenStart + (findFunctionToken(value, cursorPos)?.token.length ?? 0));
    const newValue = before + selected.name + '()' + after;

    // Update display value
    onChange(newValue);

    // Position cursor inside the parens
    const newPos = autoCompleteTokenStart + selected.name.length + 2;
    onRawCaretMove(newPos);
    setAutoCompleteOpen(false);

    // Focus back on input
    /* istanbul ignore next - requestAnimationFrame in jsdom */
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newPos, newPos);
    });
  }, [autoCompleteMatches, value, autoCompleteTokenStart, cursorPos, onRawCaretMove, onChange, findFunctionToken]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ── Auto-complete navigation (takes priority when dropdown is open) ──
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

    // ── Ctrl+C: Copy selected text ────────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      const input = inputRef.current;
      if (input && input.selectionStart !== input.selectionEnd) {
        const selectedText = input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
        navigator.clipboard.writeText(selectedText).catch(() => {
          // Fallback: use document.execCommand
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

    // ── Handle selection-based keys natively ─────────────────────────
    // If text is selected, let the native input handle Backspace/Delete/printable
    // keys. The onChange handler will sync the result to the FSM.
    const input = inputRef.current;
    const hasSelection = input ? input.selectionStart !== input.selectionEnd : false;
    const isSelectionKey = e.key === 'Backspace' || e.key === 'Delete' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey);

    if (hasSelection && isSelectionKey) {
      // Let native input handle it - onChange will sync to FSM
      return;
    }

    // ── Forward all other keys to FSM ─────────────────────────────────
    e.preventDefault();
    onRawKeyDown(e);
  }, [autoCompleteOpen, autoCompleteMatches, autoCompleteIndex, acceptAutoComplete, value, onChange, onRawCaretMove, onRawKeyDown]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const rawPos = e.target.selectionStart;
    const newPos = rawPos !== null && rawPos !== undefined ? rawPos : newValue.length;

    // Forward to FSM
    onRawChange(newValue, newPos);

    // Check if we should show auto-complete
    if (newValue.startsWith('=')) {
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
  }, [onRawChange, findFunctionToken]);

  const handleClick = useCallback(() => {
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? 0) : value.length;
    onRawCaretMove(caretPos);
    if (isEditing && value.startsWith('=')) {
      openAutoComplete();
    }
  }, [onRawCaretMove, isEditing, value, openAutoComplete]);

  const handleSelect = useCallback(() => {
    const input = inputRef.current;
    const caretPos = input ? (input.selectionStart ?? 0) : value.length;
    onRawCaretMove(caretPos);
  }, [onRawCaretMove, value.length]);

  // Build the colored reference display overlay
  const formulaDisplay = useMemo(() => {
    if (!isEditing || !value) return null;
    if (!value.startsWith('=')) return null;

    try {
      const formula = value.slice(1);
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
        <div className="absolute inset-0 pointer-events-none font-mono text-sm flex items-center px-1 whitespace-nowrap min-w-full">
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
  }, [isEditing, value]);

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

        {/* Insert Function button */}
        {onOpenWizard && (
          <button
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
            onClick={onOpenWizard}
            title="Open formula wizard"
          >
            ƒx
          </button>
        )}

        {/* Point mode indicator */}
        {isPointMode && (
          <span className="text-xs font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded animate-pulse">
            POINT
          </span>
        )}

        {/* Formula input area */}
        <div className="flex-1 relative overflow-x-auto">
          {/* Colored display layer (underlay) */}
          {formulaDisplay}
          {/* Actual input — horizontal scroll for long content */}
          <input
            ref={inputRef}
            type="text"
            className={`outline-none font-mono text-sm relative bg-transparent min-w-full formula-input-scroll ${
              formulaDisplay ? 'text-transparent selection:bg-blue-200' : ''
            }`}
            style={{ caretColor: '#000', minWidth: '100%' }}
            placeholder="Enter a value or formula (e.g., =SUM(A1:A10))"
            value={value}
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
