// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Packaged renderer asset resolution for the `app://` protocol.
 *
 * Pure path logic, unit-tested separately from Electron. Keeps the custom
 * protocol handler from serving anything outside the packaged `dist` folder.
 */

import path from 'node:path';

const APP_HOST = 'simplesheets';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Resolve an `app://simplesheets/...` request to an absolute file path inside
 * the packaged renderer directory.
 *
 * @param rawUrl - The full request URL.
 * @param distDir - Absolute path to the packaged `dist` directory.
 * @returns The absolute file path, or null when the request is invalid or escapes `distDir`.
 */
export function resolveAppAssetPath(rawUrl: string, distDir: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'app:' || url.host !== APP_HOST) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (pathname === '' || pathname === '/') pathname = '/index.html';
  if (pathname.includes('\0') || pathname.includes('\\')) return null;

  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '..')) return null;

  const relative = pathname.replace(/^\/+/, '');
  const root = path.resolve(distDir);
  const absolute = path.resolve(root, relative);

  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}

/**
 * Look up a MIME type for a resolved asset path.
 *
 * @param filePath - Absolute or relative file path.
 * @returns The MIME type, defaulting to `application/octet-stream`.
 */
export function mimeTypeForPath(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}
