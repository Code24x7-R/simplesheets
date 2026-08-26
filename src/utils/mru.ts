// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Most Recently Used (MRU) file list.
 *
 * Tracks workbooks that the user has opened or saved, persisted to localStorage.
 * Each entry records the file name, size, timestamp, and — critically for the
 * Save to Cloud workflow — *where* the file came from:
 *
 *  - `source: 'local'`   — a .ssjson/.json file from the device file picker
 *  - `source: 'cloud'`   — a file opened from or saved to a cloud provider
 *                           (Google Drive, OneDrive, S3-compatible)
 *  - `source: 'url'`     — a document loaded from a #doc= share link
 *
 * The MRU is surfaced in the File menu so users can reopen recent workbooks
 * with a single click. Cloud entries include the provider and cloudFileId so
 * the app can re-fetch the file from the provider when reopened.
 */

import type { CloudProvider } from '../cloud/types';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Where a file was loaded from or saved to. */
export type MRUSource = 'local' | 'cloud' | 'url';

/** A single entry in the MRU list. */
export interface MRUEntry {
  /** Unique identifier (timestamp-based). */
  id: string;
  /** Display filename (e.g. "Budget.ssjson"). */
  name: string;
  /** File size in bytes (0 if unknown, e.g. cloud files). */
  size: number;
  /** When this entry was last opened/saved (epoch ms). */
  timestamp: number;
  /** Where the file came from. */
  source: MRUSource;
  /** Cloud provider — only when source === 'cloud'. */
  provider?: CloudProvider;
  /** Cloud provider file ID — only when source === 'cloud'. */
  cloudFileId?: string;
  /** Optional path/identifier for reopening (local path hint or URL). */
  path?: string;
}

/** Payload for adding a new MRU entry (id/timestamp filled in automatically). */
export type MRUPick = Omit<MRUEntry, 'id' | 'timestamp'> & {
  /** Override the timestamp (defaults to Date.now()). */
  timestamp?: number;
  /** Override the id (defaults to timestamp-based). */
  id?: string;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PREFIX = 'simplesheets:';
const MRU_KEY = `${PREFIX}mru`;
const MAX_ENTRIES = 10;

// ─── Storage helpers ────────────────────────────────────────────────────────

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    /* istanbul ignore next - localStorage failure */
    return null;
  }
}

function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    /* istanbul ignore next - localStorage full */
    return false;
  }
}

function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* istanbul ignore next - localStorage failure */
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

/** Validate that an object conforms to the MRUEntry structure. */
function isValidMRUEntry(obj: unknown): obj is MRUEntry {
  if (typeof obj !== 'object' || obj === null) return false;
  const e = obj as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.size === 'number' &&
    typeof e.timestamp === 'number' &&
    (e.source === 'local' || e.source === 'cloud' || e.source === 'url')
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load the MRU list, sorted most-recently-used first.
 * Invalid entries are filtered out.
 */
export function loadMRU(): MRUEntry[] {
  const raw = readRaw(MRU_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMRUEntry).sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    /* istanbul ignore next - corrupted JSON */
    return [];
  }
}

/**
 * Add or update an MRU entry. If an entry with the same name and source
 * already exists, its timestamp and metadata are refreshed (moved to top).
 * The list is capped at MAX_ENTRIES.
 *
 * @param entry - The entry data (id and timestamp are auto-generated if omitted).
 * @returns The updated MRU list.
 */
export function addMRUEntry(entry: MRUPick): MRUEntry[] {
  const existing = loadMRU();

  // Deduplicate: same name + source means we refresh, not duplicate.
  const deduped = existing.filter(
    (e) => !(e.name === entry.name && e.source === entry.source),
  );

  // Generate a unique id. We combine timestamp with a random suffix so that
  // two entries created in the same millisecond still get distinct ids.
  const ts = entry.timestamp ?? Date.now();
  const newEntry: MRUEntry = {
    id: entry.id ?? `mru-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    name: entry.name,
    size: entry.size ?? 0,
    timestamp: ts,
    source: entry.source,
    provider: entry.provider,
    cloudFileId: entry.cloudFileId,
    path: entry.path,
  };

  const updated = [newEntry, ...deduped].slice(0, MAX_ENTRIES);
  writeRaw(MRU_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Remove a single MRU entry by id.
 * @returns The updated MRU list.
 */
export function removeMRUEntry(id: string): MRUEntry[] {
  const existing = loadMRU();
  const updated = existing.filter((e) => e.id !== id);
  writeRaw(MRU_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Clear the entire MRU list.
 */
export function clearMRU(): void {
  removeRaw(MRU_KEY);
}

/**
 * Record that a file was opened — convenience wrapper around addMRUEntry.
 *
 * @param name - Filename (e.g. "Budget.ssjson").
 * @param size - File size in bytes (0 if unknown).
 * @param source - Where the file came from.
 * @param opts - Optional cloud provider metadata.
 */
export function recordFileOpened(
  name: string,
  size: number,
  source: MRUSource,
  opts: { provider?: CloudProvider; cloudFileId?: string; path?: string } = {},
): MRUEntry[] {
  return addMRUEntry({ name, size, source, ...opts });
}

/**
 * Record that a file was saved — convenience wrapper around addMRUEntry.
 * Cloud saves include the provider and file ID so the file can be re-fetched.
 *
 * @param name - Filename (e.g. "Budget.ssjson").
 * @param size - File size in bytes.
 * @param source - Where the file was saved to.
 * @param opts - Optional cloud provider metadata.
 */
export function recordFileSaved(
  name: string,
  size: number,
  source: MRUSource,
  opts: { provider?: CloudProvider; cloudFileId?: string; path?: string } = {},
): MRUEntry[] {
  return addMRUEntry({ name, size, source, ...opts });
}

/**
 * Get the most recent MRU entry, or null if the list is empty.
 */
export function getMostRecent(): MRUEntry | null {
  const entries = loadMRU();
  return entries.length > 0 ? entries[0] : null;
}
