// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Represents the frozen pane configuration.
 */
export interface FreezeState {
  /** Number of columns frozen from the left (0 = none). */
  frozenColumns: number;
  /** Number of rows frozen from the top (0 = none). */
  frozenRows: number;
}

interface FreezeContextValue {
  frozenColumns: number;
  frozenRows: number;
  freeze: (columns: number, rows: number) => void;
  freezeFirstColumn: () => void;
  freezeFirstRow: () => void;
  freezeFirstRowAndColumn: () => void;
  unfreeze: () => void;
  isFrozen: boolean;
}

const FreezeContext = createContext<FreezeContextValue | null>(null);

/**
 * Provider for freeze pane state management.
 */
export function FreezeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FreezeState>({
    frozenColumns: 0,
    frozenRows: 0,
  });

  const freeze = useCallback((columns: number, rows: number) => {
    setState({ frozenColumns: Math.max(0, columns), frozenRows: Math.max(0, rows) });
  }, []);

  const freezeFirstColumn = useCallback(() => {
    setState((prev) => ({ ...prev, frozenColumns: 1 }));
  }, []);

  const freezeFirstRow = useCallback(() => {
    setState((prev) => ({ ...prev, frozenRows: 1 }));
  }, []);

  const freezeFirstRowAndColumn = useCallback(() => {
    setState({ frozenColumns: 1, frozenRows: 1 });
  }, []);

  const unfreeze = useCallback(() => {
    setState({ frozenColumns: 0, frozenRows: 0 });
  }, []);

  const value: FreezeContextValue = {
    ...state,
    freeze,
    freezeFirstColumn,
    freezeFirstRow,
    freezeFirstRowAndColumn,
    unfreeze,
    isFrozen: state.frozenColumns > 0 || state.frozenRows > 0,
  };

  return <FreezeContext.Provider value={value}>{children}</FreezeContext.Provider>;
}

/**
 * Hook to access freeze pane context.
 */
export function useFreeze(): FreezeContextValue {
  const ctx = useContext(FreezeContext);
  if (!ctx) throw new Error('useFreeze must be used within FreezeProvider');
  return ctx;
}
