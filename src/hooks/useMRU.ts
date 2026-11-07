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
import { getPlatform } from '../platform';
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
    opts?: { provider?: CloudProvider; cloudFileId?: string; path?: string; handleId?: string; canReopen?: boolean },
  ) => void;
  /** Record that a file was saved. */
  recordSave: (
    name: string,
    size: number,
    source: MRUSource,
    opts?: { provider?: CloudProvider; cloudFileId?: string; path?: string; handleId?: string; canReopen?: boolean },
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
function entryKey(entry: MRUEntry): string {
  return entry.path ? `path:${entry.path.replace(/\\/g, '/').toLowerCase()}` : `id:${entry.id}`;
}

export function useMRU(): UseMRUReturn {
  const [platform] = useState(getPlatform);
  const desktop = platform.kind === 'desktop';
  const [entries, setEntries] = useState<MRUEntry[]>(() => loadMRU());

  // Refresh from main on desktop, or localStorage on the web.
  const refresh = useCallback(() => {
    if (!desktop) {
      setEntries(loadMRU());
      return;
    }
    void platform.listRecents().then((result) => {
      if (result.ok) setEntries(result.value as MRUEntry[]);
    });
  }, [desktop, platform]);

  useEffect(() => {
    if (desktop) refresh();
  }, [desktop, refresh]);

  // Cross-tab sync (web) and post-migration refresh (desktop).
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'simplesheets:mru') {
        refresh();
      }
    };
    const handleRecentsChanged = () => refresh();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('simplesheets:recents-changed', handleRecentsChanged);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('simplesheets:recents-changed', handleRecentsChanged);
    };
  }, [refresh]);

  const record = useCallback(
    (
      name: string,
      size: number,
      source: MRUSource,
      opts: { provider?: CloudProvider; cloudFileId?: string; path?: string; handleId?: string; canReopen?: boolean } = {},
    ) => {
      if (!desktop) {
        setEntries(addMRUEntry({ name, size, source, ...opts }));
        return;
      }
      const candidate: MRUEntry = {
        id: `pending-${Date.now()}`,
        name,
        size,
        timestamp: Date.now(),
        source,
        ...opts,
      };
      setEntries((previous) => {
        const key = entryKey(candidate);
        return [candidate, ...previous.filter((entry) => entryKey(entry) !== key)].slice(0, 10);
      });
      void platform.upsertRecent({ name, size, source, ...opts }).then((result) => {
        if (result.ok) refresh();
      });
    },
    [desktop, platform, refresh],
  );

  const recordOpen = useCallback(
    (
      name: string,
      size: number,
      source: MRUSource,
      opts: { provider?: CloudProvider; cloudFileId?: string; path?: string; handleId?: string; canReopen?: boolean } = {},
    ) => record(name, size, source, opts),
    [record],
  );

  const recordSave = useCallback(
    (
      name: string,
      size: number,
      source: MRUSource,
      opts: { provider?: CloudProvider; cloudFileId?: string; path?: string; handleId?: string; canReopen?: boolean } = {},
    ) => record(name, size, source, opts),
    [record],
  );

  const remove = useCallback(
    (id: string) => {
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
      if (desktop) void platform.removeRecent(id);
      else removeMRUEntry(id);
    },
    [desktop, platform],
  );

  const clear = useCallback(() => {
    setEntries([]);
    if (desktop) void platform.clearRecents();
    else clearMRU();
  }, [desktop, platform]);

  return { entries, recordOpen, recordSave, remove, clear, refresh };
}
