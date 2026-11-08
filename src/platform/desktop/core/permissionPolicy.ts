// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Desktop permission policy.
 *
 * SimpleSheets needs no device access. The one exception is the Local Font
 * Access API, which powers the system-font picker. That permission is granted
 * only to the trusted, top-level application frame.
 */

/** Permissions the desktop app may grant to the trusted main frame. */
export const ALLOWED_DESKTOP_PERMISSIONS = ['local-fonts'] as const;

/**
 * Decide whether a renderer permission request should be allowed.
 *
 * @param permission - Electron/Chromium permission name.
 * @param trustedMainFrame - True only for the app's top-level trusted frame.
 * @returns True when the permission is explicitly supported.
 */
export function isAllowedDesktopPermission(
  permission: string,
  trustedMainFrame: boolean,
): boolean {
  return (
    trustedMainFrame &&
    (ALLOWED_DESKTOP_PERMISSIONS as readonly string[]).includes(permission)
  );
}
