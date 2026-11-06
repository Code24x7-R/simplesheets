// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Desktop trust-boundary helpers.
 *
 * Pure functions shared by the Electron main process and Jest tests.
 * No Electron or Node imports belong here.
 */

export const APP_ORIGIN = 'app://simplesheets';
export const DEV_ORIGIN = 'http://localhost:3000';

/**
 * Build a comparison key that works for custom standard schemes too.
 * `URL.origin` returns "null" for `app:` outside a Chromium renderer, so we
 * compare protocol and host explicitly.
 */
function originKey(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

/**
 * Return true when a renderer URL belongs to one of the trusted origins.
 *
 * @param rawUrl - The URL reported by Electron for a frame or navigation.
 * @param allowedOrigins - Origins that are allowed to use privileged IPC.
 * @returns True when the URL parses and its origin is allowed.
 */
export function isTrustedOrigin(rawUrl: string, allowedOrigins: readonly string[]): boolean {
  try {
    const url = new URL(rawUrl);
    if (!url.host) return false;
    const key = originKey(url);
    return allowedOrigins.some((allowed) => {
      try {
        return originKey(new URL(allowed)) === key;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Return true when a URL may be handed to the operating system's browser.
 * Only http, https, and mailto are allowed.
 *
 * @param rawUrl - The URL requested by the renderer.
 * @returns True when the scheme is safe to open externally.
 */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}
