// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Export routing: native Save dialog on desktop, existing download on web. */

import { getPlatform } from './index';
import type { FileFilter } from './types';

export type ExportStatus = 'saved' | 'canceled' | 'failed';

export interface ExportRequest {
  readonly data: Blob | string;
  readonly suggestedName: string;
  readonly filters: readonly FileFilter[];
  /** Existing browser/download behavior used by the web edition. */
  readonly download: () => void | Promise<void>;
}

export interface ExportResult {
  readonly status: ExportStatus;
  readonly path?: string;
  readonly message?: string;
}

/**
 * Save an export through the native dialog on desktop, or use the existing
 * download path on the web.
 *
 * @param request - Data, suggested name, filters, and web fallback.
 * @returns Whether the export was saved, cancelled, or failed.
 */
export async function saveExport(request: ExportRequest): Promise<ExportResult> {
  const platform = getPlatform();
  if (platform.kind !== 'desktop' || !platform.capabilities.nativeFileDialogs) {
    await request.download();
    return { status: 'saved' };
  }

  const picked = await platform.saveFileDialog({
    suggestedName: request.suggestedName,
    filters: request.filters,
  });
  if (!picked.ok) return { status: 'failed', message: picked.message };
  if (!picked.value) return { status: 'canceled' };

  const bytes = typeof request.data === 'string'
    ? new TextEncoder().encode(request.data)
    : new Uint8Array(await request.data.arrayBuffer());
  const result = await platform.writeFile({
    path: picked.value,
    data: bytes,
    expected: null,
  });
  if (!result.ok) return { status: 'failed', message: result.message };
  return { status: 'saved', path: result.value.path };
}
