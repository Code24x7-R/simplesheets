// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { resolveWindowBounds, type WindowBounds } from './windowBounds';

const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 };

function bounds(overrides: Partial<WindowBounds> = {}): WindowBounds {
  return { x: 100, y: 100, width: 1200, height: 800, ...overrides };
}

describe('resolveWindowBounds', () => {
  it('restores visible bounds and clamps them on-screen', () => {
    const result = resolveWindowBounds(bounds({ x: 1800, y: 900 }), [PRIMARY], PRIMARY);
    expect(result.bounds).toEqual({ x: 720, y: 240, width: 1200, height: 800 });
    expect(result.maximized).toBe(false);
  });

  it('restores a maximized flag without fullscreen', () => {
    expect(resolveWindowBounds(bounds({ maximized: true }), [PRIMARY], PRIMARY).maximized).toBe(true);
  });

  it('centers when the saved window is off-screen', () => {
    const result = resolveWindowBounds(bounds({ x: 5000, y: 5000 }), [PRIMARY], PRIMARY);
    expect(result.bounds).toEqual({ x: 320, y: 120, width: 1280, height: 800 });
    expect(result.maximized).toBe(false);
  });

  it('centers for missing or too-small bounds', () => {
    expect(resolveWindowBounds(null, [PRIMARY], PRIMARY).bounds.width).toBe(1280);
    expect(resolveWindowBounds(bounds({ width: 500 }), [PRIMARY], PRIMARY).bounds).toEqual({
      x: 320,
      y: 120,
      width: 1280,
      height: 800,
    });
  });

  it('uses a secondary display when the saved window is visible there', () => {
    const secondary = { x: 1920, y: 0, width: 1280, height: 1024 };
    const result = resolveWindowBounds(bounds({ x: 2000, y: 50 }), [PRIMARY, secondary], PRIMARY);
    expect(result.bounds.x).toBe(2000);
    expect(result.bounds.y).toBe(50);
  });
});
