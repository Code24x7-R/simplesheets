// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** One-time import of legacy same-origin localStorage MRU data. */

import type { RecentEntry } from './desktopState';
import { MAX_RECENT_FILES } from './desktopState';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse a legacy `simplesheets:mru` payload.
 *
 * Entries without a path are kept but marked non-reopenable, matching REC-11.
 *
 * @param raw - Raw localStorage value.
 * @returns Imported entries, newest first.
 */
export function parseLegacyMru(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: RecentEntry[] = [];
  for (const value of parsed) {
    if (!isRecord(value)) continue;
    if (typeof value.id !== 'string' || value.id.length === 0) continue;
    if (typeof value.name !== 'string' || value.name.length === 0) continue;
    if (typeof value.size !== 'number' || !Number.isFinite(value.size)) continue;
    if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) continue;
    if (value.source !== 'local' && value.source !== 'cloud' && value.source !== 'url') continue;
    const path = typeof value.path === 'string' && value.path.length > 0 ? value.path : undefined;
    entries.push({
      id: value.id,
      name: value.name,
      size: value.size,
      timestamp: value.timestamp,
      source: value.source,
      path,
      handleId: typeof value.handleId === 'string' ? value.handleId : undefined,
      provider: typeof value.provider === 'string' ? value.provider : undefined,
      cloudFileId: typeof value.cloudFileId === 'string' ? value.cloudFileId : undefined,
      canReopen: path ? value.canReopen !== false : false,
    });
    if (entries.length >= MAX_RECENT_FILES) break;
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECENT_FILES);
}

/**
 * Parse a legacy autosave payload.
 *
 * @param raw - Raw localStorage value.
 * @returns The parsed workbook, or null when invalid.
 */
export function parseLegacyAutosave(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (!Array.isArray(parsed.sheets)) return null;
    return parsed;
  } catch {
    return null;
  }
}
