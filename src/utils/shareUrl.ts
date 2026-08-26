// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * URL Fragment Encoding for Cloud Sharing
 *
 * Encodes an entire workbook into a URL fragment so it can be shared as a link.
 * The document never leaves the user's device — the payload travels in the
 * fragment (after `#`), which is never sent to any server.
 *
 * Pipeline: Workbook → JSON → lz-string compressToEncodedURIComponent → #doc=...
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Workbook } from '../types';

/**
 * Maximum URL length we're willing to produce.
 * Browsers support ~2MB URLs, but paste bins, chat apps, and email clients
 * truncate at 2KB–16KB. 16KB is conservative — works in most contexts.
 */
const MAX_URL_SIZE = 16 * 1024;

/** Fragment identifier used to detect a shared document in the URL. */
export const DOC_FRAGMENT_PREFIX = '#doc=';

/**
 * Encode a workbook into a shareable URL.
 *
 * @param workbook - The workbook to serialize.
 * @param baseUrl - The base URL (origin + pathname) to attach the fragment to.
 * @returns A full URL with the compressed workbook in the fragment.
 */
export function encodeDocToUrl(workbook: Workbook, baseUrl: string): string {
  const json = JSON.stringify(workbook);
  const compressed = compressToEncodedURIComponent(json);
  return `${baseUrl}${DOC_FRAGMENT_PREFIX}${compressed}`;
}

/**
 * Extract a workbook from a share URL, or null if no document fragment is present.
 *
 * @param url - The URL to inspect (typically window.location.href).
 * @returns The decoded workbook, or null.
 */
export function decodeDocFromUrl(url: string): Workbook | null {
  const match = url.match(/#doc=(.+)$/);
  if (!match) return null;
  try {
    const json = decompressFromEncodedURIComponent(match[1]);
    return json ? (JSON.parse(json) as Workbook) : null;
  } catch {
    return null;
  }
}

/**
 * Estimate the byte size of the encoded URL fragment.
 * Useful for the size guard that disables Copy Link on large documents.
 *
 * @param workbook - The workbook to measure.
 * @returns Estimated byte size of the full encoded fragment.
 */
export function estimateShareSize(workbook: Workbook): number {
  const json = JSON.stringify(workbook);
  const compressed = compressToEncodedURIComponent(json);
  return encodeURIComponent(`${DOC_FRAGMENT_PREFIX}${compressed}`).length;
}

/**
 * Whether the workbook is small enough to fit in a shareable URL.
 *
 * @param workbook - The workbook to check.
 * @returns True if the encoded URL would be within MAX_URL_SIZE.
 */
export function canShareViaUrl(workbook: Workbook): boolean {
  return estimateShareSize(workbook) <= MAX_URL_SIZE;
}
