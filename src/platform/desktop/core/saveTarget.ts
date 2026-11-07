// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Save-conflict classification shared by the main process and tests. */

/** Identity of a file version used to detect external changes. */
export interface FileVersion {
  readonly mtimeMs: number;
  readonly size: number;
}

/** What the save flow should do for the current on-disk file. */
export type SaveTargetState = 'write' | 'conflict' | 'missing';

/**
 * Compare the on-disk file with the version the renderer last saw.
 *
 * @param current - Current on-disk version, or null when the file is absent.
 * @param expected - Version recorded at open/save, or null for Save As.
 * @returns `write` when safe, `missing` when a known file disappeared, or
 *   `conflict` when another process changed it.
 */
export function classifySaveTarget(
  current: FileVersion | null,
  expected: FileVersion | null,
): SaveTargetState {
  if (!current) return expected ? 'missing' : 'write';
  if (!expected) return 'write';
  if (current.mtimeMs !== expected.mtimeMs || current.size !== expected.size) {
    return 'conflict';
  }
  return 'write';
}
