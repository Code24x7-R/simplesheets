// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Main-process desktop state schema and recent-file operations. */

import { normalizeWindowBounds, type WindowBounds } from './windowBounds';

export const STATE_SCHEMA_VERSION = 1;
export const MAX_RECENT_FILES = 10;

export type RecentSource = 'local' | 'cloud' | 'url';

export interface RecentEntry {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly timestamp: number;
  readonly source: RecentSource;
  readonly path?: string;
  readonly handleId?: string;
  readonly provider?: string;
  readonly cloudFileId?: string;
  readonly canReopen?: boolean;
}

export interface DesktopState {
  readonly schemaVersion: typeof STATE_SCHEMA_VERSION;
  readonly recents: RecentEntry[];
  readonly lastPath: string | null;
  readonly lastDirectory: string | null;
  readonly reopenLast: boolean;
  readonly cleanExit: boolean;
  readonly legacyImported: boolean;
  readonly windowBounds: WindowBounds | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Create the first-run state. */
export function createDefaultState(): DesktopState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    recents: [],
    lastPath: null,
    lastDirectory: null,
    reopenLast: true,
    cleanExit: true,
    legacyImported: false,
    windowBounds: null,
  };
}

function normalizeRecent(value: unknown): RecentEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.name !== 'string' || value.name.length === 0) return null;
  if (typeof value.size !== 'number' || !Number.isFinite(value.size)) return null;
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null;
  if (value.source !== 'local' && value.source !== 'cloud' && value.source !== 'url') return null;
  return {
    id: value.id,
    name: value.name,
    size: value.size,
    timestamp: value.timestamp,
    source: value.source,
    path: typeof value.path === 'string' ? value.path : undefined,
    handleId: typeof value.handleId === 'string' ? value.handleId : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
    cloudFileId: typeof value.cloudFileId === 'string' ? value.cloudFileId : undefined,
    canReopen: typeof value.canReopen === 'boolean' ? value.canReopen : undefined,
  };
}

/**
 * Validate a persisted state object.
 *
 * @param value - Parsed JSON from state.json.
 * @returns A normalized state, or null for an incompatible schema.
 */
export function normalizeState(value: unknown): DesktopState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== STATE_SCHEMA_VERSION) return null;
  const recents = Array.isArray(value.recents)
    ? value.recents.map(normalizeRecent).filter((entry): entry is RecentEntry => entry !== null)
    : [];
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    recents: recents.slice(0, MAX_RECENT_FILES),
    lastPath: typeof value.lastPath === 'string' ? value.lastPath : null,
    lastDirectory: typeof value.lastDirectory === 'string' ? value.lastDirectory : null,
    reopenLast: typeof value.reopenLast === 'boolean' ? value.reopenLast : true,
    cleanExit: typeof value.cleanExit === 'boolean' ? value.cleanExit : true,
    legacyImported: value.legacyImported === true,
    windowBounds: normalizeWindowBounds(value.windowBounds),
  };
}

function recentKey(entry: RecentEntry): string {
  // Paths are normalized case-insensitively for the Windows-first target.
  return entry.path ? entry.path.replace(/\\/g, '/').toLowerCase() : entry.id;
}

/**
 * Insert or promote a recent entry, capped at ten.
 *
 * @param state - Current state.
 * @param entry - Entry to add.
 * @returns A new state with the entry first.
 */
export function upsertRecent(state: DesktopState, entry: RecentEntry): DesktopState {
  const key = recentKey(entry);
  const recents = [entry, ...state.recents.filter((item) => recentKey(item) !== key)]
    .slice(0, MAX_RECENT_FILES);
  return { ...state, recents };
}

/**
 * Remove one recent entry by id.
 *
 * @param state - Current state.
 * @param id - Entry id.
 * @returns A new state.
 */
export function removeRecent(state: DesktopState, id: string): DesktopState {
  return { ...state, recents: state.recents.filter((entry) => entry.id !== id) };
}

/**
 * Clear all recent entries.
 *
 * @param state - Current state.
 * @returns A new state.
 */
export function clearRecents(state: DesktopState): DesktopState {
  return { ...state, recents: [] };
}
