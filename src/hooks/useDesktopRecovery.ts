// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Debounced main-owned recovery snapshots for the desktop edition. */

import { useEffect } from 'react';
import type { Workbook } from '../types';
import { getPlatform } from '../platform';

const RECOVERY_DEBOUNCE_MS = 500;

/**
 * Persist dirty desktop workbooks to `recovery.json`.
 *
 * @param workbook - Current workbook.
 * @param isDirty - Whether the workbook differs from its saved snapshot.
 * @param currentPath - In-place document path, if any.
 * @param enabled - False until startup recovery has been resolved.
 * @param onError - Receives write failures (for example, a >100 MB snapshot).
 */
export function useDesktopRecovery(
  workbook: Workbook,
  isDirty: boolean,
  currentPath: string | null,
  enabled: boolean,
  onError?: (message: string) => void,
): void {
  useEffect(() => {
    const platform = getPlatform();
    if (!platform.capabilities.recovery || !enabled) return;

    if (!isDirty) {
      void platform.clearRecovery();
      return;
    }

    const timer = setTimeout(() => {
      void platform
        .writeRecovery({
          workbook,
          path: currentPath,
          displayName: workbook.title || 'Untitled',
        })
        .then((result) => {
          if (!result.ok) onError?.(result.message);
        });
    }, RECOVERY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [workbook, isDirty, currentPath, enabled, onError]);
}
