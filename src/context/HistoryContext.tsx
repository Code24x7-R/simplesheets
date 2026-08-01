// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type { Workbook, HistoryEntry } from '../types';

// ─── State ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

interface HistoryState {
  /** Past snapshots (oldest first). */
  past: HistoryEntry[];
  /** The current workbook state (derived from the latest history entry or initial). */
  present: Workbook;
  /** Future snapshots for redo (most recent undone first). */
  future: HistoryEntry[];
}

type HistoryAction =
  | { type: 'PUSH'; entry: HistoryEntry }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; workbook: Workbook };

// ─── Reducer ────────────────────────────────────────────────────────────────

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'PUSH': {
      // When we push a new state, clear the redo stack.
      // The past entry stores the CURRENT (pre-push) filter state and selection so undo can restore them.
      const newPast = [
        ...state.past,
        ...(state.present ? [{
          workbook: state.present,
          description: action.entry.description,
          timestamp: action.entry.timestamp,
          filterState: action.entry.filterState ?? null,
          gridSelection: action.entry.gridSelection ?? null,
        }] : /* istanbul ignore next */ []),
      ].slice(-MAX_HISTORY);

      return {
        past: newPast,
        present: action.entry.workbook,
        future: [],
      };
    }

    case 'UNDO': {
      /* istanbul ignore next - UI prevents undo when empty */
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        past: newPast,
        present: previous.workbook,
        future: [
          { workbook: state.present, description: previous.description, timestamp: Date.now() },
          ...state.future,
        ].slice(0, MAX_HISTORY),
      };
    }

    case 'REDO': {
      /* istanbul ignore next - UI prevents redo when empty */
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, {
          workbook: state.present,
          description: next.description,
          timestamp: Date.now(),
        }].slice(-MAX_HISTORY),
        present: next.workbook,
        future: newFuture,
      };
    }

    case 'RESET': {
      return {
        past: [],
        present: action.workbook,
        future: [],
      };
    }

    /* istanbul ignore next - all action types are handled */
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

interface HistoryContextValue {
  /** The current workbook state. */
  workbook: Workbook;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
  /** Push a new state onto the history stack. */
  pushHistory: (workbook: Workbook, description: string, filterState?: unknown, gridSelection?: unknown) => void;
  /** Undo the last action. Returns the previous workbook state, filter state, and grid selection, or null. */
  undo: () => { workbook: Workbook; filterState: unknown; gridSelection: unknown } | null;
  /** Redo the next action. Returns the redone workbook state, filter state, and grid selection, or null. */
  redo: () => { workbook: Workbook; filterState: unknown; gridSelection: unknown } | null;
  /** Reset history with a new workbook. */
  resetHistory: (workbook: Workbook) => void;
  /** List of past action descriptions (for debugging/inspection). */
  historyLog: string[];
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

interface HistoryProviderProps {
  children: ReactNode;
  initialWorkbook: Workbook;
}

export function HistoryProvider({ children, initialWorkbook }: HistoryProviderProps) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialWorkbook,
    future: [],
  });

  const pushHistory = useCallback((workbook: Workbook, description: string, filterState?: unknown, gridSelection?: unknown) => {
    const entry: HistoryEntry = {
      workbook,
      description,
      timestamp: Date.now(),
      filterState: filterState ?? null,
      gridSelection: gridSelection ?? null,
    };
    dispatch({ type: 'PUSH', entry });
  }, []);

  const undo = useCallback((): { workbook: Workbook; filterState: unknown; gridSelection: unknown } | null => {
    if (state.past.length === 0) return null;
    dispatch({ type: 'UNDO' });
    const prev = state.past[state.past.length - 1];
    /* istanbul ignore next - defensive fallback; past entries always have workbook */
    return {
      workbook: prev?.workbook ?? state.present,
      filterState: prev?.filterState ?? null,
      gridSelection: prev?.gridSelection ?? null,
    };
  }, [state.past, state.present]);

  const redo = useCallback((): { workbook: Workbook; filterState: unknown; gridSelection: unknown } | null => {
    if (state.future.length === 0) return null;
    dispatch({ type: 'REDO' });
    /* istanbul ignore next - defensive fallback; future entries always have workbook */
    return {
      workbook: state.future[0]?.workbook ?? state.present,
      filterState: state.future[0]?.filterState ?? null,
      gridSelection: state.future[0]?.gridSelection ?? null,
    };
  }, [state.future, state.present]);

  const resetHistory = useCallback((workbook: Workbook) => {
    dispatch({ type: 'RESET', workbook });
  }, []);

  const value: HistoryContextValue = {
    workbook: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    pushHistory,
    undo,
    redo,
    resetHistory,
    historyLog: state.past.map((e) => e.description),
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook to access the undo/redo history context.
 * Must be used within a HistoryProvider.
 */
export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return ctx;
}
