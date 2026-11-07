// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Pure window-bounds validation for safe restore across display changes. */

export const MIN_WINDOW_WIDTH = 900;
export const MIN_WINDOW_HEIGHT = 600;
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;

export interface WindowBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly maximized?: boolean;
}

export interface WorkArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ResolvedWindowBounds {
  readonly bounds: WindowBounds;
  readonly maximized: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate a persisted window geometry.
 *
 * @param value - Parsed state value.
 * @returns A normalized object, or null for invalid data.
 */
export function normalizeWindowBounds(value: unknown): WindowBounds | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    !isFiniteNumber(candidate.x) ||
    !isFiniteNumber(candidate.y) ||
    !isFiniteNumber(candidate.width) ||
    !isFiniteNumber(candidate.height)
  ) {
    return null;
  }
  if (candidate.width < MIN_WINDOW_WIDTH || candidate.height < MIN_WINDOW_HEIGHT) {
    return null;
  }
  return {
    x: Math.round(candidate.x),
    y: Math.round(candidate.y),
    width: Math.round(candidate.width),
    height: Math.round(candidate.height),
    maximized: candidate.maximized === true,
  };
}

function centered(workArea: WorkArea): WindowBounds {
  const width = Math.max(
    MIN_WINDOW_WIDTH,
    Math.min(DEFAULT_WINDOW_WIDTH, workArea.width),
  );
  const height = Math.max(
    MIN_WINDOW_HEIGHT,
    Math.min(DEFAULT_WINDOW_HEIGHT, workArea.height),
  );
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  };
}

/**
 * Restore saved bounds only when they remain visible on a current display.
 *
 * @param saved - Normalized persisted bounds.
 * @param displays - Current work areas.
 * @param primary - Primary display work area.
 * @returns Safe bounds and whether to maximize after creation.
 */
export function resolveWindowBounds(
  saved: WindowBounds | null,
  displays: readonly WorkArea[],
  primary: WorkArea,
): ResolvedWindowBounds {
  const fallback = centered(primary);
  if (!saved) return { bounds: fallback, maximized: false };

  const visible = displays.find((area) =>
    saved.x < area.x + area.width &&
    saved.x + saved.width > area.x &&
    saved.y < area.y + area.height &&
    saved.y + saved.height > area.y,
  );
  if (!visible) return { bounds: fallback, maximized: false };

  const width = Math.min(saved.width, visible.width);
  const height = Math.min(saved.height, visible.height);
  if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
    return { bounds: fallback, maximized: false };
  }

  return {
    bounds: {
      x: Math.min(
        Math.max(saved.x, visible.x),
        visible.x + visible.width - width,
      ),
      y: Math.min(
        Math.max(saved.y, visible.y),
        visible.y + visible.height - height,
      ),
      width,
      height,
    },
    maximized: saved.maximized === true,
  };
}
