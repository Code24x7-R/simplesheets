// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Edition detection shared with the Electron main process. */

export type DesktopEdition = 'development' | 'installed' | 'portable';

/**
 * Resolve the runtime edition.
 *
 * @param packaged - Electron `app.isPackaged`.
 * @param portableDir - `PORTABLE_EXECUTABLE_DIR` when running the portable build.
 * @returns The current edition.
 */
export function resolveEdition(
  packaged: boolean,
  portableDir: string | undefined,
): DesktopEdition {
  if (!packaged) return 'development';
  return portableDir ? 'portable' : 'installed';
}
