/**
 * Shared highlight colors for formula reference highlighting.
 * Used by both Grid.tsx (cell backgrounds) and FormulaBar.tsx (reference overlay).
 */

/** Background tint colors for highlighted cell references. */
export const HIGHLIGHT_COLORS = [
  'rgba(59, 130, 246, 0.10)',  // blue
  'rgba(239, 68, 68, 0.10)',   // red
  'rgba(34, 197, 94, 0.10)',   // green
  'rgba(234, 179, 8, 0.10)',   // yellow
  'rgba(168, 85, 247, 0.10)',  // purple
  'rgba(236, 72, 153, 0.10)',  // pink
  'rgba(249, 115, 22, 0.10)',  // orange
  'rgba(6, 182, 212, 0.10)',   // cyan
];

/** Border colors for highlighted cell references. */
export const HIGHLIGHT_BORDER_COLORS = [
  'rgb(59, 130, 246)',
  'rgb(239, 68, 68)',
  'rgb(34, 197, 94)',
  'rgb(234, 179, 8)',
  'rgb(168, 85, 247)',
  'rgb(236, 72, 153)',
  'rgb(249, 115, 22)',
  'rgb(6, 182, 212)',
];
