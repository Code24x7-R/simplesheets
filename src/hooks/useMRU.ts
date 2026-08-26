// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * React hook for the Most Recently Used (MRU) file list.
 *
 * Provides reactive access to the MRU entries plus convenience callbacks for
 * recording file opens/saves. Components re-render automatically when the MRU
 * changes.
 *
 * The hook also listens for `storage` events so that MRU updates in one tab
 * propagate to others.
 */

import { useState, useCallback, useEffect } from 'react';
import type { CloudProvider } from '../cloud/types';
import {
  loadMRU,
  addMRUEntry,
  removeMRUEntry,
  clearMRU,
  type MRUEntry,
  type MRUSource,
} from '../utils/mru';

interface UseMRUReturn {
  /** MRU entries, sorted most-recent-first. */
  entries: MRUEntry[];
  /** Record that a file was opened. */
  recordOpen: (
    name: string,
    size: number,
    source: MRUSource,
    opts?: { provider?: CloudProvider; cloudFileId?: string; path?: string },
  ) => void;
  /** Record that a file was saved. */
  recordSave: (
    name: string,
    size: number,
    source: MRUSource,
    opts?: { provider?: CloudProvider; cloudFileId?: string; path?: string },
  ) => void;
  /** Remove a single entry by id. */
  remove: (id: string) => void;
  /** Clear the entire MRU list. */
  clear: () => void;
  /** Refresh the list from storage (used after external changes). */
  refresh: () => void;
}

/**
 * Hook to manage the MRU file list.
 *
 * @returns MRU entries and mutation callbacks.
 */
export function useMRU(): UseMRUReturn {
  const [entries, setEntries] = useState<MRUEntry[]>(() => loadMRU());

  // Refresh from storage — used by the storage event listener and exposed
  // as a manual refresh callback.
  const refresh = useCallback(() => {
    setEntries(loadMRU());
  }, []);

  // Cross-tab sync: listen for localStorage changes from other tabs.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'simplesheets:mru') {
        refresh();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refresh]);

  const recordOpen = useCallback(
    (
      name: string,
      size: number,
      source: MRUSource,
      opts: { provider?: CloudProvider; cloudFileId?: string; path?: string } = {},
    ) => {
      setEntries(addMRUEntry({ name, size, source, ...opts }));
    },
    [],
  );

  const recordSave = useCallback(
    (
      name: string,
      size: number,
      source: MRUSource,
      opts: { provider?: CloudProvider; cloudFileId?: string; path?: string } = {},
    ) => {
      setEntries(addMRUEntry({ name, size, source, ...opts }));
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setEntries(removeMRUEntry(id));
  }, []);

  const clear = useCallback(() => {
    clearMRU();
    setEntries([]);
  }, []);

  return { entries, recordOpen, recordSave, remove, clear, refresh };
}
