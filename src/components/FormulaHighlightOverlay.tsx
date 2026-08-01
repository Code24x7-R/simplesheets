// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useMemo } from 'react';
import { HIGHLIGHT_COLORS, HIGHLIGHT_BORDER_COLORS } from '../utils/highlightColors';

interface FormulaHighlightOverlayProps {
  /** The formula value (including leading '='). */
  value: string;
  /** Whether the editor is active (editing). */
  isEditing: boolean;
}

/**
 * Computes the highlight segments for a formula string.
 * Returns null if there are no segments to render.
 *
 * This is exported so that callers can determine whether the overlay
 * will render anything — and thus whether to apply `text-transparent`
 * to the underlying input.
 */
export function computeHighlightSegments(value: string, isEditing: boolean): Array<{ text: string; colorIndex: number | null }> | null {
  if (!isEditing || !value || !value.startsWith('=')) return null;

  try {
    const formula = value.slice(1);
    const segs: Array<{ text: string; colorIndex: number | null }> = [];
    let colorIdx = 0;

    const tokenRegex = /(\$?[A-Za-z]+\$?\d+:?|\$?[A-Za-z]+|[0-9.]+|[+\-*/(),&^=<>]|"[^"]*"|[A-Za-z]+)/gi;
    let match;

    while ((match = tokenRegex.exec(formula)) !== null) {
      const token = match[0];
      if (/^\$?[A-Za-z]+\$?\d+$/i.test(token)) {
        segs.push({
          text: token,
          colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
        });
        colorIdx++;
      } else if (/^\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+$/i.test(token)) {
        segs.push({
          text: token,
          colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
        });
        colorIdx++;
      } else {
        segs.push({ text: token, colorIndex: null });
      }
    }

    return segs.length > 0 ? segs : null;
  } catch {
    return null;
  }
}

/**
 * Renders colored cell reference overlays for a formula string.
 * This is a shared component used by both FormulaBar and the Grid in-cell editor.
 *
 * The overlay is positioned absolutely underneath a transparent input/textarea.
 * Cell references (A1, $B$2, A1:B5) get colored backgrounds; other tokens render plain.
 */
export function FormulaHighlightOverlay({ value, isEditing }: FormulaHighlightOverlayProps) {
  const segments = useMemo(() => computeHighlightSegments(value, isEditing), [value, isEditing]);

  if (!segments) return null;

  return (
    <div className="absolute inset-0 pointer-events-none font-mono text-sm flex items-center px-1 whitespace-nowrap min-w-full">
      {segments.map((seg, i) => (
        <span
          key={i}
          style={
            seg.colorIndex !== null
              ? {
                  backgroundColor: HIGHLIGHT_COLORS[seg.colorIndex],
                  border: `1px solid ${HIGHLIGHT_BORDER_COLORS[seg.colorIndex]}`,
                  borderRadius: '2px',
                  padding: '0 2px',
                  fontWeight: 600,
                  color: HIGHLIGHT_BORDER_COLORS[seg.colorIndex],
                }
              : undefined
          }
        >
          {seg.text}
        </span>
      ))}
    </div>
  );
}
