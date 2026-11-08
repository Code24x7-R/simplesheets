// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  ALLOWED_DESKTOP_PERMISSIONS,
  isAllowedDesktopPermission,
} from './permissionPolicy';

describe('desktop permission policy', () => {
  it('allows local-fonts only for the trusted main frame', () => {
    expect(isAllowedDesktopPermission('local-fonts', true)).toBe(true);
    expect(isAllowedDesktopPermission('local-fonts', false)).toBe(false);
  });

  it('denies every other permission even for the trusted frame', () => {
    for (const permission of [
      'geolocation',
      'notifications',
      'media',
      'clipboard-read',
      'midi',
      'unknown',
    ]) {
      expect(isAllowedDesktopPermission(permission, true)).toBe(false);
    }
  });

  it('exposes only the font permission in the allowlist', () => {
    expect([...ALLOWED_DESKTOP_PERMISSIONS]).toEqual(['local-fonts']);
  });
});
