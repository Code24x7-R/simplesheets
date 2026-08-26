// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Web Share API Wrapper
 *
 * Uses the native OS share sheet to send the workbook as a `.ssjson` file.
 * Falls back to a download on browsers that don't support file sharing.
 */

import type { Workbook } from '../types';
import type { ShareResult } from '../cloud/types';

/** File extension for SimpleSheets documents. */
export const SSJSON_EXT = '.ssjson';

/** MIME type for .ssjson files. */
export const SSJSON_MIME = 'application/json';

/**
 * Feature-detect whether the browser supports sharing files via the Web Share API.
 * Both `navigator.share` and `navigator.canShare` must be present, and `canShare`
 * must report that file sharing is allowed.
 *
 * @returns True if the browser can share files.
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probe = new File(['{}'], `probe${SSJSON_EXT}`, { type: SSJSON_MIME });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Trigger a browser download of the workbook as a `.ssjson` file.
 *
 * @param workbook - The workbook to download.
 * @param fileName - The filename (without extension).
 */
export function downloadDocument(workbook: Workbook, fileName: string): void {
  const json = JSON.stringify(workbook, null, 2);
  const blob = new Blob([json], { type: SSJSON_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith(SSJSON_EXT) ? fileName : `${fileName}${SSJSON_EXT}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share a workbook using the native OS share sheet, or fall back to download.
 *
 * @param workbook - The workbook to share.
 * @param title - The document title (used as the filename base).
 * @returns 'shared' if the share sheet was shown, 'cancelled' if the user dismissed it,
 *          or 'fallback' if the browser doesn't support file sharing and download was used.
 */
export async function shareDocument(workbook: Workbook, title: string): Promise<ShareResult> {
  const fileName = title.endsWith(SSJSON_EXT) ? title : `${title}${SSJSON_EXT}`;

  if (!canShareFiles()) {
    downloadDocument(workbook, fileName);
    return 'fallback';
  }

  const json = JSON.stringify(workbook, null, 2);
  const file = new File([json], fileName, { type: SSJSON_MIME });

  try {
    await navigator.share({ files: [file], title: fileName.replace(SSJSON_EXT, '') });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled';
    }
    throw err;
  }
}
