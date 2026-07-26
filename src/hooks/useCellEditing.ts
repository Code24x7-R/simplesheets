/**
 * useCellEditing — Finite State Machine for spreadsheet cell editing.
 *
 * Implements the formal state machine per the excel-dataentry specification:
 *   SELECT → ENTER → EDIT → POINT (with deterministic transitions)
 *
 * This hook is the single source of truth for editing state, shared between
 * the Grid (in-cell editing) and FormulaBar components.
 */

import { useState, useCallback, useRef } from 'react';
import { colToLetter } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// State Machine Types
// ═══════════════════════════════════════════════════════════════════════════════

/** The four operational states of the editing FSM. */
export type EditingState = 'SELECT' | 'ENTER' | 'EDIT' | 'POINT';

/** Editing mode code (matches spec). */
export type ModeCode = 'ST_SEL' | 'ST_ENT' | 'ST_EDT' | 'ST_PNT';

/** Maps EditingState to its mode code. */
export const MODE_CODES: Record<EditingState, ModeCode> = {
  SELECT: 'ST_SEL',
  ENTER: 'ST_ENT',
  EDIT: 'ST_EDT',
  POINT: 'ST_PNT',
};

/** Current editing session state. */
export interface EditingSession {
  /** Current FSM state. */
  state: EditingState;
  /** Row of the cell being edited. */
  row: number;
  /** Column of the cell being edited. */
  col: number;
  /** Current text buffer value. */
  buffer: string;
  /** Original value before editing began (for Escape cancel). */
  originalValue: string;
  /** Caret position within the buffer (for EDIT/POINT states). */
  caretPos: number;
  /** Whether a formula is being constructed (buffer starts with '='). */
  isFormula: boolean;
}

/** POINT mode session tracking. */
export interface PointSession {
  /** Whether POINT mode is currently active. */
  isActive: boolean;
  /** The cell where pointing started (anchor). */
  anchorRow: number;
  /** The column where pointing started. */
  anchorCol: number;
  /** Current pointed-to cell. */
  currentRow: number;
  /** Current pointed-to column. */
  currentCol: number;
  /** Buffer position where the reference will be inserted. */
  insertPos: number;
  /** The character that triggered POINT mode. */
  triggerChar: string;
}

/** Result of a key handling operation. */
export interface KeyHandlingResult {
  /** The new editing session state after handling the key. */
  session: EditingSession;
  /** Optional new POINT session. */
  pointSession: PointSession | null;
  /** Whether the cell value should be committed to the model. */
  shouldCommit: boolean;
  /** Grid navigation delta (if arrow key caused navigation). */
  navigate: { dRow: number; dCol: number } | null;
  /** Status message for the UI. */
  statusMessage: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Characters that trigger POINT mode when followed by arrow/click. */
const POINT_TRIGGER_CHARS = new Set([
  '=', '(', ',', ':', '+', '-', '*', '/', '^', '&', '>', '<',
]);

/** Separator characters (structural + operators). */
const SEPARATOR_CHARS = new Set([
  '=', '(', ',', ':', '{', ';', '+', '-', '*', '/', '^', '&', '>', '<',
]);

/** Printable characters that start ENTER mode. */
function isPrintableChar(key: string): boolean {
  if (key.length !== 1) return false;
  const code = key.charCodeAt(0);
  // ASCII printable range, excluding control chars
  return code >= 32 && code <= 126;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POINT Mode Trigger Detection (Spec §3.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determines if POINT mode should be activated based on buffer content
 * and caret position, per the specification's deterministic trigger check.
 */
export function shouldActivatePointMode(buffer: string, caretPos: number): boolean {
  if (!buffer.startsWith('=') && !buffer.startsWith('+') && !buffer.startsWith('-')) return false;
  if (caretPos < 1) return false; // Before '=' — no trigger

  // Look at the last non-whitespace character before the caret
  const textBeforeCaret = buffer.slice(0, caretPos).trim();
  if (textBeforeCaret.length === 0) return false;

  const lastChar = textBeforeCaret[textBeforeCaret.length - 1];
  return POINT_TRIGGER_CHARS.has(lastChar);
}

/**
 * Determines if a character auto-commits the current POINT reference
 * and exits back to EDIT mode (Spec §3.3).
 */
export function isOperatorChar(key: string): boolean {
  return SEPARATOR_CHARS.has(key);
}

// ═══════════════════════════════════════════════════════════════════════════════
// F4 Reference Cycling (Spec §3.2)
// ═══════════════════════════════════════════════════════════════════════════════

/** Reference types in F4 cycling order. */
type RefType = 'relative' | 'absolute' | 'absRow' | 'absCol';

const F4_CYCLE_ORDER: RefType[] = ['relative', 'absolute', 'absRow', 'absCol'];

/** Formats a cell reference according to its type. */
function formatRef(row: number, col: number, refType: RefType): string {
  const colLetter = colToLetter(col);
  const rowNum = row + 1;
  switch (refType) {
    case 'relative': return `${colLetter}${rowNum}`;
    case 'absolute': return `$${colLetter}$${rowNum}`;
    case 'absRow': return `${colLetter}$${rowNum}`;
    case 'absCol': return `$${colLetter}${rowNum}`;
  }
}

/** Parses a reference type from an existing reference string. */
function parseRefType(ref: string): RefType {
  const startsWithDollar = ref.startsWith('$');
  const hasDollarBeforeNumber = /\$[A-Za-z]+\$/.test(ref) || /^[A-Za-z]+\$/.test(ref);

  if (ref.includes('$$')) return 'absolute'; // $A$1
  if (startsWithDollar && hasDollarBeforeNumber) return 'absolute';
  if (startsWithDollar) return 'absCol'; // $A1
  if (hasDollarBeforeNumber) return 'absRow'; // A$1
  return 'relative'; // A1
}

/** Cycles a cell reference to the next F4 state. */
export function cycleReference(ref: string): string {
  // Extract row/col from the reference
  const match = ref.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
  if (!match) return ref;

  const colLetters = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);

  // Convert column letters to number
  let col = 0;
  for (const ch of colLetters) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  col -= 1; // 0-based
  const row = rowNum - 1; // 0-based

  // Determine current type and cycle
  const currentType = parseRefType(ref);
  const currentIdx = F4_CYCLE_ORDER.indexOf(currentType);
  const nextType = F4_CYCLE_ORDER[(currentIdx + 1) % F4_CYCLE_ORDER.length];

  return formatRef(row, col, nextType);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Word Boundary Navigation (for Ctrl+Arrow)
// ═══════════════════════════════════════════════════════════════════════════════

/** Find the next word boundary position moving left from caret. */
function findWordBoundaryLeft(text: string, caretPos: number): number {
  if (caretPos <= 0) return 0;
  // Skip whitespace
  let pos = caretPos;
  while (pos > 0 && /\s/.test(text[pos - 1])) pos--;
  // Skip word characters
  while (pos > 0 && /\S/.test(text[pos - 1])) pos--;
  return pos;
}

/** Find the next word boundary position moving right from caret. */
function findWordBoundaryRight(text: string, caretPos: number): number {
  if (caretPos >= text.length) return text.length;
  // Skip whitespace
  let pos = caretPos;
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  // Skip word characters
  while (pos < text.length && /\S/.test(text[pos])) pos++;
  return pos;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Token Reference Extraction (for F4 cycling)
// ═══════════════════════════════════════════════════════════════════════════════

/** Finds the cell reference token at or near a caret position. */
function findRefAtCaret(buffer: string, caretPos: number): { start: number; end: number; ref: string } | null {
  // Match cell refs and ranges: $A$1, A1, A1:B5, etc.
  const refRegex = /(\$?[A-Za-z]+\$?(\d+)(:\$?[A-Za-z]+\$?(\d+))?)/g;
  let match;

  while ((match = refRegex.exec(buffer)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // Caret is within or adjacent to this reference
    if (caretPos >= start && caretPos <= end) {
      return { start, end, ref: match[0] };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Options & Return
// ═══════════════════════════════════════════════════════════════════════════════

interface UseCellEditingOptions {
  /** The active cell row. */
  activeRow: number;
  /** The active cell column. */
  activeCol: number;
  /** Current cell value (raw). */
  cellValue: string;
  /** Total row count (for bounds checking). */
  rowCount: number;
  /** Total column count (for bounds checking). */
  colCount: number;
  /** Callback when a cell value is committed. */
  onCommit: (row: number, col: number, value: string) => void;
  /** Callback when navigation occurs (returns whether it was handled). */
  onNavigate?: (row: number, col: number) => void;
}

interface UseCellEditingReturn {
  /** Current editing session. */
  session: EditingSession;
  /** Current POINT session (null if not in POINT mode). */
  pointSession: PointSession | null;
  /** Handle a keyboard event — returns navigation delta if any. */
  handleKey: (key: string, shiftKey: boolean, ctrlKey: boolean, altKey?: boolean) => KeyHandlingResult;
  /** Handle a cell click (for POINT mode). */
  handleCellClick: (row: number, col: number, shiftKey: boolean) => KeyHandlingResult;
  /** Start editing a cell (ENTER mode — replaces content). */
  startEnter: (key: string) => void;
  /** Start editing a cell (EDIT mode — preserves content). */
  startEdit: () => void;
  /** Start editing a cell (EDIT mode — preserves content) with caret at specific position. */
  startEditAt: (caretPosition: number) => void;
  /** Commit the current buffer and transition to SELECT. */
  commit: (moveDirection?: { dRow: number; dCol: number }) => void;
  /** Cancel editing and restore original value. */
  cancel: () => void;
  /** Reset to SELECT state (e.g., on cell navigation). */
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useCellEditing({
  activeRow,
  activeCol,
  cellValue,
  rowCount,
  colCount,
  onCommit,
  onNavigate,
}: UseCellEditingOptions): UseCellEditingReturn {
  const [session, setSession] = useState<EditingSession>({
    state: 'SELECT',
    row: activeRow,
    col: activeCol,
    buffer: '',
    originalValue: cellValue,
    caretPos: 0,
    isFormula: false,
  });

  const [pointSession, setPointSession] = useState<PointSession | null>(null);

  // Refs for latest values (to avoid stale closures)
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pointRef = useRef(pointSession);
  pointRef.current = pointSession;

  // ─── State Transitions ─────────────────────────────────────────────────

  const startEnter = useCallback((key: string) => {
    const newBuffer = key;
    const isFormula = key === '=' || key === '+' || key === '-';
    setSession({
      state: 'ENTER',
      row: activeRow,
      col: activeCol,
      buffer: newBuffer,
      originalValue: cellValue,
      caretPos: newBuffer.length,
      isFormula,
    });
    setPointSession(null);
  }, [activeRow, activeCol, cellValue]);

  const startEdit = useCallback(() => {
    const buffer = cellValue;
    setSession({
      state: 'EDIT',
      row: activeRow,
      col: activeCol,
      buffer,
      originalValue: cellValue,
      caretPos: buffer.length,
      isFormula: buffer.startsWith('='),
    });
    setPointSession(null);
  }, [activeRow, activeCol, cellValue]);

  const startEditAt = useCallback((caretPosition: number) => {
    const buffer = cellValue;
    const clampedCaret = Math.max(0, Math.min(buffer.length, caretPosition));
    setSession({
      state: 'EDIT',
      row: activeRow,
      col: activeCol,
      buffer,
      originalValue: cellValue,
      caretPos: clampedCaret,
      isFormula: buffer.startsWith('='),
    });
    setPointSession(null);
  }, [activeRow, activeCol, cellValue]);

  const commit = useCallback((moveDirection?: { dRow: number; dCol: number }) => {
    const s = sessionRef.current;
    onCommit(s.row, s.col, s.buffer);

    if (moveDirection && onNavigate) {
      const newRow = Math.max(0, Math.min(rowCount - 1, s.row + moveDirection.dRow));
      const newCol = Math.max(0, Math.min(colCount - 1, s.col + moveDirection.dCol));
      onNavigate(newRow, newCol);
    }

    setSession((prev) => ({ ...prev, state: 'SELECT', buffer: '', caretPos: 0, isFormula: false }));
    setPointSession(null);
  }, [onCommit, onNavigate, rowCount, colCount]);

  const cancel = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      state: 'SELECT',
      buffer: '',
      caretPos: 0,
      isFormula: false,
    }));
    setPointSession(null);
  }, []);

  const reset = useCallback(() => {
    setSession({
      state: 'SELECT',
      row: activeRow,
      col: activeCol,
      buffer: '',
      originalValue: cellValue,
      caretPos: 0,
      isFormula: false,
    });
    setPointSession(null);
  }, [activeRow, activeCol, cellValue]);

  // ─── Enter POINT Mode ──────────────────────────────────────────────────

  const enterPointMode = useCallback((s: EditingSession) => {
    const textBeforeCaret = s.buffer.slice(0, s.caretPos).trim();
    const lastChar = textBeforeCaret.length > 0 ? textBeforeCaret[textBeforeCaret.length - 1] : '';

    setPointSession({
      isActive: true,
      anchorRow: s.row,
      anchorCol: s.col,
      currentRow: s.row,
      currentCol: s.col,
      insertPos: s.caretPos,
      triggerChar: lastChar,
    });

    setSession((prev) => ({ ...prev, state: 'POINT' }));
  }, []);

  // ─── Keyboard Handler ──────────────────────────────────────────────────

  const handleKey = useCallback((key: string, shiftKey: boolean, ctrlKey: boolean, altKey?: boolean): KeyHandlingResult => {
    const s = sessionRef.current;
    const result: KeyHandlingResult = {
      session: s,
      pointSession: pointRef.current,
      shouldCommit: false,
      navigate: null,
      statusMessage: null,
    };

    // ── SELECT state ─────────────────────────────────────────────────
    if (s.state === 'SELECT') {
      if (isPrintableChar(key)) {
        startEnter(key);
        const isFormula = key === '=' || key === '+' || key === '-';
        result.session = { ...s, state: 'ENTER', buffer: key, caretPos: 1, isFormula };
        return result;
      }

      if (key === 'F2') {
        startEdit();
        const isFormula = cellValue.startsWith('=') || cellValue.startsWith('+') || cellValue.startsWith('-');
        result.session = { ...s, state: 'EDIT', buffer: cellValue, caretPos: cellValue.length, isFormula };
        return result;
      }

      // Escape clears multi-cell selection (Spec §2)
      if (key === 'Escape') {
        result.statusMessage = 'Selection cleared';
        result.shouldCommit = false;
        return result;
      }

      // Navigation in SELECT state
      if (key.startsWith('Arrow')) {
        const nav = getNavigationDelta(key, shiftKey);
        if (nav) {
          result.navigate = nav;
          result.statusMessage = null;
        }
        return result;
      }

      // Shift+Enter moves up, Shift+Tab moves left (Spec §2)
      if (key === 'Enter' && shiftKey) {
        result.navigate = { dRow: -1, dCol: 0 };
        return result;
      }
      if (key === 'Tab' && shiftKey) {
        result.navigate = { dRow: 0, dCol: -1 };
        return result;
      }

      // Home / Ctrl+Home (Spec §2)
      if (key === 'Home') {
        if (ctrlKey) {
          result.navigate = { dRow: -s.row, dCol: -s.col }; // to (0,0)
        } else {
          result.navigate = { dRow: 0, dCol: -s.col }; // to column 0
        }
        return result;
      }

      // Delete/Backspace clears cell
      if (key === 'Backspace' || key === 'Delete') {
        onCommit(s.row, s.col, '');
        result.shouldCommit = true;
        result.statusMessage = 'Cell cleared';
        return result;
      }

      return result;
    }

    // ── ENTER state ───────────────────────────────────────────────────
    if (s.state === 'ENTER') {
      if (key === 'Escape') {
        cancel();
        result.session = { ...s, state: 'SELECT' };
        result.statusMessage = 'Edit cancelled';
        return result;
      }

      // Enter handling: supports Alt+Enter, Ctrl+Enter, Shift+Enter
      if (key === 'Enter') {
        // Alt+Enter — insert line break (Spec §2)
        if (altKey) {
          const newBuffer = s.buffer.slice(0, s.caretPos) + '\n' + s.buffer.slice(s.caretPos);
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: prev.caretPos + 1 }));
          result.session = { ...s, buffer: newBuffer, caretPos: s.caretPos + 1 };
          return result;
        }
        // Ctrl+Enter — commit and stay (Spec §2)
        if (ctrlKey) {
          commit({ dRow: 0, dCol: 0 });
          result.session = { ...s, state: 'SELECT' };
          result.statusMessage = 'Value committed';
          return result;
        }
        // Normal Enter — commit and move
        const dir = shiftKey ? { dRow: -1, dCol: 0 } : { dRow: 1, dCol: 0 };
        commit(dir);
        result.session = { ...s, state: 'SELECT' };
        result.navigate = dir;
        result.statusMessage = 'Value committed';
        return result;
      }

      if (key === 'Tab') {
        const dir = shiftKey ? { dRow: 0, dCol: -1 } : { dRow: 0, dCol: 1 };
        commit(dir);
        result.session = { ...s, state: 'SELECT' };
        result.navigate = dir;
        return result;
      }

      if (key === 'F2') {
        // Toggle to EDIT mode (caret at end)
        setSession((prev) => ({ ...prev, state: 'EDIT' }));
        result.session = { ...s, state: 'EDIT' };
        return result;
      }

      if (key === 'F4') {
        // Cycle reference at end of buffer (Spec §2 — ENTER state)
        const refInfo = findRefAtCaret(s.buffer, s.buffer.length);
        if (refInfo) {
          const cycled = cycleReference(refInfo.ref);
          const newBuffer = s.buffer.slice(0, refInfo.start) + cycled + s.buffer.slice(refInfo.end);
          const newCaret = refInfo.start + cycled.length;
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: newCaret }));
          result.session = { ...s, buffer: newBuffer, caretPos: newCaret };
          result.statusMessage = `Reference: ${cycled}`;
        }
        return result;
      }

      // Ctrl+Enter — commit and stay in cell (Spec §2)
      if (key === 'Enter' && ctrlKey) {
        commit({ dRow: 0, dCol: 0 });
        result.session = { ...s, state: 'SELECT' };
        result.statusMessage = 'Value committed';
        return result;
      }

      // Alt+Enter — insert line break (Spec §2)
      if (key === 'Enter' && !shiftKey && !ctrlKey) {
        // Check if this is Alt+Enter (handled by checking modifier in Grid)
        // We handle it here if the event has altKey passed through
      }

      // Home / End / Ctrl+Home / Ctrl+End — move caret (Spec §2)
      if (key === 'Home' && !ctrlKey) {
        const newCaret = 0;
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }

      if (key === 'End' && !ctrlKey) {
        const newCaret = s.buffer.length;
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }

      // Plain arrow keys - move caret by 1 character
      if (key === 'ArrowLeft' && !ctrlKey && !shiftKey) {
        const newCaret = Math.max(0, s.caretPos - 1);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }
      if (key === 'ArrowRight' && !ctrlKey && !shiftKey) {
        const newCaret = Math.min(s.buffer.length, s.caretPos + 1);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }
      // Ctrl+Left/Right — move caret by word (Spec §2)
      if (key === 'ArrowLeft' && ctrlKey && !shiftKey) {
        const newCaret = findWordBoundaryLeft(s.buffer, s.caretPos);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }
      if (key === 'ArrowRight' && ctrlKey && !shiftKey) {
        const newCaret = findWordBoundaryRight(s.buffer, s.caretPos);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }

      if (isPrintableChar(key)) {
        const newBuffer = s.buffer + key;
        const newCaret = newBuffer.length;
        const isFormula = newBuffer.startsWith('=') || newBuffer.startsWith('+') || newBuffer.startsWith('-');

        // Check if this should trigger POINT mode (e.g., typing = or separator after =)
        if (shouldActivatePointMode(newBuffer, newCaret)) {
          // Explicit colon duplication (Spec §3.3.1): if typing : after a
          // single cell reference, duplicate it as the default endpoint
          if (key === ':') {
            const refBeforeColon = extractRefBeforeCaret(s.buffer, s.caretPos);
            if (refBeforeColon) {
              const dupBuffer = s.buffer.slice(0, s.caretPos) + ':' + refBeforeColon;
              const dupCaret = dupBuffer.length;
              setSession((prev) => ({ ...prev, buffer: dupBuffer, caretPos: dupCaret, isFormula }));
              enterPointMode({ ...s, buffer: dupBuffer, caretPos: dupCaret, isFormula });
              result.session = { ...s, state: 'POINT', buffer: dupBuffer, caretPos: dupCaret, isFormula };
              return result;
            }
          }
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: newCaret, isFormula }));
          enterPointMode({ ...s, buffer: newBuffer, caretPos: newCaret, isFormula });
          result.session = { ...s, state: 'POINT', buffer: newBuffer, caretPos: newCaret, isFormula };
          return result;
        }

        setSession((prev) => ({
          ...prev,
          buffer: newBuffer,
          caretPos: newCaret,
          isFormula,
        }));
        result.session = { ...s, buffer: newBuffer, caretPos: newCaret, isFormula };
        return result;
      }

      if (key === 'Backspace') {
        if (s.buffer.length > 0) {
          const newBuffer = s.buffer.slice(0, -1);
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: newBuffer.length }));
          result.session = { ...s, buffer: newBuffer, caretPos: newBuffer.length };
        }
        return result;
      }

      if (key.startsWith('Arrow')) {
        // In ENTER mode, arrow keys commit and navigate
        const nav = getNavigationDelta(key, false);
        if (nav) {
          commit(nav);
          result.session = { ...s, state: 'SELECT' };
          result.navigate = nav;
        }
        return result;
      }

      /* istanbul ignore next - defensive return for unhandled keys */
      return result;
    }

    // ── EDIT state ────────────────────────────────────────────────────
    if (s.state === 'EDIT') {
      if (key === 'Escape') {
        cancel();
        result.session = { ...s, state: 'SELECT' };
        result.statusMessage = 'Edit cancelled';
        return result;
      }

      // Enter handling: supports Alt+Enter, Ctrl+Enter, Shift+Enter
      if (key === 'Enter') {
        // Alt+Enter — insert line break (Spec §2)
        if (altKey) {
          const newBuffer = s.buffer.slice(0, s.caretPos) + '\n' + s.buffer.slice(s.caretPos);
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: prev.caretPos + 1 }));
          result.session = { ...s, buffer: newBuffer, caretPos: s.caretPos + 1 };
          return result;
        }
        // Ctrl+Enter — commit and stay (Spec §2)
        if (ctrlKey) {
          commit({ dRow: 0, dCol: 0 });
          result.session = { ...s, state: 'SELECT' };
          result.statusMessage = 'Value committed';
          return result;
        }
        // Normal Enter — commit and move
        const dir = shiftKey ? { dRow: -1, dCol: 0 } : { dRow: 1, dCol: 0 };
        commit(dir);
        result.session = { ...s, state: 'SELECT' };
        result.navigate = dir;
        return result;
      }

      if (key === 'Tab') {
        const dir = shiftKey ? { dRow: 0, dCol: -1 } : { dRow: 0, dCol: 1 };
        commit(dir);
        result.session = { ...s, state: 'SELECT' };
        result.navigate = dir;
        return result;
      }

      if (key === 'F2') {
        // Toggle to POINT mode
        enterPointMode(s);
        result.session = { ...s, state: 'POINT' };
        return result;
      }

      if (key === 'F4') {
        // Cycle reference at caret
        const refInfo = findRefAtCaret(s.buffer, s.caretPos);
        if (refInfo) {
          const cycled = cycleReference(refInfo.ref);
          const newBuffer = s.buffer.slice(0, refInfo.start) + cycled + s.buffer.slice(refInfo.end);
          const newCaret = refInfo.start + cycled.length;
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: newCaret }));
          result.session = { ...s, buffer: newBuffer, caretPos: newCaret };
          result.statusMessage = `Reference: ${cycled}`;
        }
        return result;
      }

      // Home / End — caret movement (Spec §2)
      if (key === 'Home' && !ctrlKey) {
        setSession((prev) => ({ ...prev, caretPos: 0 }));
        result.session = { ...s, caretPos: 0 };
        return result;
      }
      if (key === 'End' && !ctrlKey) {
        setSession((prev) => ({ ...prev, caretPos: s.buffer.length }));
        result.session = { ...s, caretPos: s.buffer.length };
        return result;
      }
      // Plain arrow keys - move caret by 1 character
      if (key === 'ArrowLeft' && !ctrlKey && !shiftKey) {
        const newCaret = Math.max(0, s.caretPos - 1);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }
      if (key === 'ArrowRight' && !ctrlKey && !shiftKey) {
        const newCaret = Math.min(s.buffer.length, s.caretPos + 1);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }
      // Ctrl+Arrow keys - move caret by word boundary
      if (key === 'ArrowLeft' && ctrlKey && !shiftKey) {
        const newCaret = findWordBoundaryLeft(s.buffer, s.caretPos);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }
      if (key === 'ArrowRight' && ctrlKey && !shiftKey) {
        const newCaret = findWordBoundaryRight(s.buffer, s.caretPos);
        setSession((prev) => ({ ...prev, caretPos: newCaret }));
        result.session = { ...s, caretPos: newCaret };
        return result;
      }

      if (isPrintableChar(key)) {
        // Check if this should trigger POINT mode (caret after separator)
        if (shouldActivatePointMode(s.buffer + key, s.caretPos + 1)) {
          // Explicit colon duplication (Spec §3.3.1): if typing : after a
          // single cell reference, duplicate it as the default endpoint
          if (key === ':') {
            const refBeforeColon = extractRefBeforeCaret(s.buffer, s.caretPos);
            if (refBeforeColon) {
              const newBuffer = s.buffer.slice(0, s.caretPos) + ':' + refBeforeColon;
              const newCaret = newBuffer.length;
              setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: newCaret }));
              enterPointMode({ ...s, buffer: newBuffer, caretPos: newCaret });
              result.session = { ...s, state: 'POINT', buffer: newBuffer, caretPos: newCaret };
              return result;
            }
          }
          // Insert char first, then enter POINT
          const newBuffer = s.buffer.slice(0, s.caretPos) + key + s.buffer.slice(s.caretPos);
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: s.caretPos + 1 }));
          enterPointMode({ ...s, buffer: newBuffer, caretPos: s.caretPos + 1 });
          result.session = { ...s, state: 'POINT', buffer: newBuffer, caretPos: s.caretPos + 1 };
          return result;
        }

        // Insert at caret
        const newBuffer = s.buffer.slice(0, s.caretPos) + key + s.buffer.slice(s.caretPos);
        const isFormula = newBuffer.startsWith('=') || newBuffer.startsWith('+') || newBuffer.startsWith('-');
        setSession((prev) => ({
          ...prev,
          buffer: newBuffer,
          caretPos: prev.caretPos + 1,
          isFormula,
        }));
        result.session = { ...s, buffer: newBuffer, caretPos: s.caretPos + 1, isFormula };
        return result;
      }

      if (key === 'Backspace') {
        if (s.caretPos > 0) {
          const newBuffer = s.buffer.slice(0, s.caretPos - 1) + s.buffer.slice(s.caretPos);
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: prev.caretPos - 1 }));
          result.session = { ...s, buffer: newBuffer, caretPos: s.caretPos - 1 };
        }
        return result;
      }

      if (key === 'Delete') {
        if (s.caretPos < s.buffer.length) {
          const newBuffer = s.buffer.slice(0, s.caretPos) + s.buffer.slice(s.caretPos + 1);
          setSession((prev) => ({ ...prev, buffer: newBuffer }));
          result.session = { ...s, buffer: newBuffer };
        }
        return result;
      }

      if (key.startsWith('Arrow') && !shiftKey) {
        // Move caret in EDIT mode (no commit)
        const nav = getNavigationDelta(key, false);
        if (nav) {
          if (key === 'ArrowLeft' && s.caretPos > 0) {
            setSession((prev) => ({ ...prev, caretPos: prev.caretPos - 1 }));
            result.session = { ...s, caretPos: s.caretPos - 1 };
          } else if (key === 'ArrowRight' && s.caretPos < s.buffer.length) {
            setSession((prev) => ({ ...prev, caretPos: prev.caretPos + 1 }));
            result.session = { ...s, caretPos: s.caretPos + 1 };
          } else if (key === 'ArrowUp' || key === 'ArrowDown') {
            // Single line: commit and navigate
            commit(nav);
            result.session = { ...s, state: 'SELECT' };
            result.navigate = nav;
          }
        }
        return result;
      }

      // Home / Ctrl+Home — move caret (Spec §2)
      if (key === 'Home') {
        if (ctrlKey) {
          setSession((prev) => ({ ...prev, caretPos: 0 }));
          result.session = { ...s, caretPos: 0 };
        } else {
          setSession((prev) => ({ ...prev, caretPos: 0 }));
          result.session = { ...s, caretPos: 0 };
        }
        return result;
      }

      /* istanbul ignore next - defensive return for unhandled keys */
      return result;
    }

    // ── POINT state ────────────────────────────────────────────────────
    if (s.state === 'POINT') {
      if (key === 'Escape') {
        // Abort pointing, return to EDIT
        setSession((prev) => ({ ...prev, state: 'EDIT' }));
        setPointSession(null);
        result.session = { ...s, state: 'EDIT' };
        result.pointSession = null;
        return result;
      }

      if (key === 'F2') {
        // Switch to EDIT at caret
        setSession((prev) => ({ ...prev, state: 'EDIT' }));
        setPointSession(null);
        result.session = { ...s, state: 'EDIT' };
        result.pointSession = null;
        return result;
      }

      if (key === 'F4') {
        // Cycle current reference
        const ps = pointRef.current;
        if (ps) {
          const refStr = formatPointRef(ps);
          const cycled = cycleReference(refStr);
          // Replace the reference in buffer at insertPos
          const newBuffer = insertRefAt(s.buffer, ps.insertPos, cycled, s.caretPos);
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: ps.insertPos + cycled.length }));
          result.session = { ...s, buffer: newBuffer, caretPos: ps.insertPos + cycled.length };
        }
        return result;
      }

      // Backspace/Delete in POINT — delete target reference token, return to EDIT (Spec §2)
      if (key === 'Backspace' || key === 'Delete') {
        // Remove the reference from buffer at insertPos to caretPos, return to EDIT
        const ps = pointRef.current;
        if (ps) {
          const newBuffer = s.buffer.slice(0, ps.insertPos) + s.buffer.slice(s.caretPos);
          const newCaret = ps.insertPos;
          setSession((prev) => ({ ...prev, state: 'EDIT', buffer: newBuffer, caretPos: newCaret }));
          setPointSession(null);
          result.session = { ...s, state: 'EDIT', buffer: newBuffer, caretPos: newCaret };
          result.pointSession = null;
          result.statusMessage = 'Reference removed';
        }
        return result;
      }

      // Home / Ctrl+Home — move pointing box (Spec §2)
      if (key === 'Home') {
        const ps = pointRef.current;
        if (ps) {
          if (ctrlKey) {
            // Move to (0,0)
            const newPs = { ...ps, currentRow: 0, currentCol: 0 };
            setPointSession(newPs);
            result.pointSession = newPs;
          } else {
            // Move to column 0
            const newPs = { ...ps, currentCol: 0 };
            setPointSession(newPs);
            result.pointSession = newPs;
          }
        }
        return result;
      }

      if (key.startsWith('Arrow')) {
        // Navigate the pointing box
        const nav = getNavigationDelta(key, shiftKey);
        if (nav) {
          const ps = pointRef.current;
          if (ps) {
            const newRow = Math.max(0, Math.min(rowCount - 1, ps.currentRow + nav.dRow));
            const newCol = Math.max(0, Math.min(colCount - 1, ps.currentCol + nav.dCol));
            const newPs = { ...ps, currentRow: newRow, currentCol: newCol };
            setPointSession(newPs);
            result.pointSession = newPs;
          }
        }
        return result;
      }

      // Typing a cell reference character (A-Z, 0-9, $) exits POINT mode
      // and inserts the character — matches Excel behavior where you can
      // either navigate with arrows OR type the reference directly.
      if (isPrintableChar(key) && /[A-Za-z0-9$]/.test(key)) {
        const newBuffer = s.buffer.slice(0, s.caretPos) + key + s.buffer.slice(s.caretPos);
        setSession((prev) => ({ ...prev, state: 'EDIT', buffer: newBuffer, caretPos: s.caretPos + 1 }));
        setPointSession(null);
        result.session = { ...s, state: 'EDIT', buffer: newBuffer, caretPos: s.caretPos + 1 };
        result.pointSession = null;
        return result;
      }

      // ')' commits the current reference and closes the function
      if (key === ')') {
        const ps = pointRef.current;
        if (ps) {
          const refStr = formatPointRef(ps);
          const beforeRef = s.buffer.slice(0, ps.insertPos);
          const newBuffer = beforeRef + refStr + ')';
          const newCaret = newBuffer.length;
          setSession((prev) => ({ ...prev, state: 'EDIT', buffer: newBuffer, caretPos: newCaret }));
          setPointSession(null);
          result.session = { ...s, state: 'EDIT', buffer: newBuffer, caretPos: newCaret };
          result.pointSession = null;
        }
        return result;
      }

      // Explicit colon (Spec §3.3.1) — if pointing at a single cell, duplicate
      // it as the default trailing range endpoint (e.g., =SUM(A1: → =SUM(A1:A1))
      if (key === ':') {
        const ps = pointRef.current;
        if (ps && ps.anchorRow === ps.currentRow && ps.anchorCol === ps.currentCol) {
          // Single cell reference — duplicate as endpoint
          const anchorRef = `${colToLetter(ps.anchorCol)}${ps.anchorRow + 1}`;
          const beforeRef = s.buffer.slice(0, ps.insertPos);
          const afterRef = s.buffer.slice(s.caretPos);
          const newBuffer = beforeRef + anchorRef + ':' + anchorRef + afterRef;
          const newCaret = beforeRef.length + anchorRef.length * 2 + 1;
          setSession((prev) => ({ ...prev, buffer: newBuffer, caretPos: newCaret }));
          result.session = { ...s, buffer: newBuffer, caretPos: newCaret };
          return result;
        }
        // Fall through to operator commit if already a range
      }

      if (isOperatorChar(key)) {
        // Auto-commit reference and exit POINT → EDIT
        const ps = pointRef.current;
        if (ps) {
          const refStr = formatPointRef(ps);
          const beforeRef = s.buffer.slice(0, ps.insertPos);
          // Replace from insertPos onward with the committed ref + operator
          const newBuffer = beforeRef + refStr + key;
          const newCaret = newBuffer.length;
          setSession((prev) => ({ ...prev, state: 'EDIT', buffer: newBuffer, caretPos: newCaret }));
          setPointSession(null);
          result.session = { ...s, state: 'EDIT', buffer: newBuffer, caretPos: newCaret };
          result.pointSession = null;
          result.statusMessage = `Added ${refStr}`;
        }
        return result;
      }

      if (key === 'Enter' || key === 'Tab') {
        // Commit reference AND commit cell value
        const ps = pointRef.current;
        if (ps) {
          const refStr = formatPointRef(ps);
          const newBuffer = s.buffer.slice(0, ps.insertPos) + refStr;
          // Determine direction: Enter=down, Shift+Enter=up, Tab=right, Shift+Tab=left
          let direction: { dRow: number; dCol: number };
          if (key === 'Enter') {
            direction = shiftKey ? { dRow: -1, dCol: 0 } : { dRow: 1, dCol: 0 };
          } else {
            direction = shiftKey ? { dRow: 0, dCol: -1 } : { dRow: 0, dCol: 1 };
          }
          // Commit the cell with the final buffer
          onCommit(s.row, s.col, newBuffer);
          if (onNavigate) {
            const newRow = Math.max(0, Math.min(rowCount - 1, s.row + direction.dRow));
            const newCol = Math.max(0, Math.min(colCount - 1, s.col + direction.dCol));
            onNavigate(newRow, newCol);
          }
          setSession((prev) => ({ ...prev, state: 'SELECT', buffer: '', caretPos: 0, isFormula: false }));
          setPointSession(null);
          result.session = { ...s, state: 'SELECT', buffer: '', caretPos: 0, isFormula: false };
          result.pointSession = null;
          result.navigate = direction;
        }
        return result;
      }

      /* istanbul ignore next - defensive return for unhandled keys */
      return result;
    }

    /* istanbul ignore next - defensive return for unknown state */
    return result;
  }, [cellValue, rowCount, colCount, onCommit, onNavigate, startEnter, startEdit, commit, cancel, enterPointMode]);

  // ─── Cell Click Handler (for POINT mode) ──────────────────────────────

  const handleCellClick = useCallback((row: number, col: number, _shiftKey: boolean): KeyHandlingResult => {
    const s = sessionRef.current;
    const result: KeyHandlingResult = {
      session: s,
      pointSession: pointRef.current,
      shouldCommit: false,
      navigate: null,
      statusMessage: null,
    };

    if (s.state === 'POINT') {
      // Update the pointed-to cell
      setPointSession((prev) => {
        if (!prev) return prev;
        return { ...prev, currentRow: row, currentCol: col };
      });
      result.pointSession = pointRef.current;
    }

    return result;
  }, []);

  return {
    session,
    pointSession,
    handleKey,
    handleCellClick,
    startEnter,
    startEdit,
    startEditAt,
    commit,
    cancel,
    reset,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function getNavigationDelta(key: string, _shiftKey: boolean): { dRow: number; dCol: number } | null {
  switch (key) {
    case 'ArrowUp': return { dRow: -1, dCol: 0 };
    case 'ArrowDown': return { dRow: 1, dCol: 0 };
    case 'ArrowLeft': return { dRow: 0, dCol: -1 };
    case 'ArrowRight': return { dRow: 0, dCol: 1 };
    /* istanbul ignore next - defensive default */
    default: return null;
  }
}

function formatPointRef(ps: PointSession): string {
  if (ps.anchorRow === ps.currentRow && ps.anchorCol === ps.currentCol) {
    return `${colToLetter(ps.anchorCol)}${ps.anchorRow + 1}`;
  }
  const r1 = Math.min(ps.anchorRow, ps.currentRow);
  const c1 = Math.min(ps.anchorCol, ps.currentCol);
  const r2 = Math.max(ps.anchorRow, ps.currentRow);
  const c2 = Math.max(ps.anchorCol, ps.currentCol);
  return `${colToLetter(c1)}${r1 + 1}:${colToLetter(c2)}${r2 + 1}`;
}

function insertRefAt(buffer: string, insertPos: number, ref: string, caretPos: number): string {
  // Replace text from insertPos to caretPos with the cycled reference
  return buffer.slice(0, insertPos) + ref + buffer.slice(caretPos);
}

/**
 * Extracts a single cell reference (e.g., "A1", "$B$2") that ends at the caret
 * position. Returns null if no complete reference is found.
 * Used for colon auto-duplication (Spec §3.3.1).
 */
function extractRefBeforeCaret(buffer: string, caretPos: number): string | null {
  // Match a cell reference at the end of the text before caret
  const textBefore = buffer.slice(0, caretPos);
  const match = textBefore.match(/(\$?[A-Za-z]+\$?\d+)$/);
  return match ? match[1] : null;
}
