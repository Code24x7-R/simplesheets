// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Font-family helpers shared by the grid, toolbar picker, and exporters.
 *
 * Cell styles store a single CSS family name (for example `"Calibri"`). The
 * grid falls back to the monospace stack used by the original design when no
 * family is set, so existing workbooks keep their appearance.
 */

/** Default grid font stack (matches Tailwind's `font-mono`). */
export const DEFAULT_FONT_FAMILY = 'Menlo, Monaco, Consolas, monospace';

/** Label shown by the font picker when no explicit family is set. */
export const DEFAULT_FONT_FAMILY_LABEL = 'Default (monospace)';

/**
 * Common fonts offered when the browser cannot enumerate installed fonts.
 * Covers the stock Windows 11 families plus common macOS/Linux fallbacks.
 */
export const COMMON_FONT_FAMILIES: readonly string[] = [
  'Arial',
  'Aptos',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Microsoft Sans Serif',
  'Palatino Linotype',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Helvetica',
  'Helvetica Neue',
  'Menlo',
  'Monaco',
  'Roboto',
  'Ubuntu',
  'Noto Sans',
  'DejaVu Sans',
  'Liberation Sans',
];

/** Minimal shape of a `FontData` returned by the Local Font Access API. */
interface LocalFontData {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
}

/** Browser window augmented with the Local Font Access API. */
type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

/** Result of asking the renderer for installed font families. */
export interface FontListResult {
  /** Unique family names, sorted for display. */
  families: string[];
  /** Whether the list came from the OS or the built-in fallback. */
  source: 'system' | 'fallback';
}

let cachedFontList: Promise<FontListResult> | undefined;

/**
 * Trim a stored family and discard empty values.
 *
 * @param family - Candidate family name or CSS stack.
 * @returns A usable family, or undefined.
 */
export function normalizeFontFamily(family: string | undefined | null): string | undefined {
  if (typeof family !== 'string') return undefined;
  const trimmed = family.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve a cell family to a CSS `font-family` value.
 *
 * @param family - Optional stored family.
 * @returns The stored family or the default monospace stack.
 */
export function cssFontFamily(family?: string): string {
  return normalizeFontFamily(family) ?? DEFAULT_FONT_FAMILY;
}

/**
 * Quote a single family name for a canvas/CSS font shorthand while leaving
 * comma-separated stacks untouched.
 */
function quoteFamily(family: string): string {
  if (family.includes(',') || /^['"]/.test(family)) return family;
  return /\s/.test(family) ? `"${family}"` : family;
}

/**
 * Build a canvas font shorthand for a cell.
 *
 * @param fontSize - Font size in CSS pixels.
 * @param family - Optional family name.
 * @param fontWeight - Optional weight (`bold`, `normal`, or numeric).
 * @param fontStyle - Optional style (`italic` or `normal`).
 * @returns A value usable with `CanvasRenderingContext2D.font`.
 */
export function buildCanvasFont(
  fontSize: number = 14,
  family?: string,
  fontWeight?: 'normal' | 'bold' | number,
  fontStyle?: 'normal' | 'italic',
): string {
  const parts: string[] = [];
  if (fontStyle === 'italic') parts.push('italic');
  if (fontWeight === 'bold' || (typeof fontWeight === 'number' && fontWeight >= 600)) {
    parts.push('700');
  }
  parts.push(`${fontSize}px`);
  parts.push(quoteFamily(cssFontFamily(family)));
  return parts.join(' ');
}

/**
 * Detect installed families by asking Chromium for the local font list.
 * Falls back to the curated common list when the API is unavailable or the
 * user declines the permission prompt.
 *
 * The promise is cached for the lifetime of the renderer so opening the
 * picker repeatedly does not trigger repeated permission prompts.
 */
export function listSystemFontFamilies(): Promise<FontListResult> {
  if (!cachedFontList) {
    cachedFontList = loadSystemFontFamilies();
  }
  return cachedFontList;
}

/**
 * Clear the cached font list. Used by tests and by a future "Refresh fonts"
 * action.
 */
export function resetFontFamilyCache(): void {
  cachedFontList = undefined;
}

async function loadSystemFontFamilies(): Promise<FontListResult> {
  if (typeof window === 'undefined') {
    return fallbackFontList();
  }

  const api = (window as LocalFontWindow).queryLocalFonts;
  if (typeof api !== 'function') {
    return fallbackFontList();
  }

  try {
    const fonts = await api.call(window);
    const families = Array.from(
      new Set(
        fonts
          .map((font) => normalizeFontFamily(font.family))
          .filter((family): family is string => Boolean(family)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    if (families.length === 0) return fallbackFontList();
    return { families, source: 'system' };
  } catch {
    return fallbackFontList();
  }
}

function fallbackFontList(): FontListResult {
  return { families: [...COMMON_FONT_FAMILIES], source: 'fallback' };
}
