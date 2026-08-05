// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useMemo, forwardRef, useCallback } from 'react';
import { HIGHLIGHT_COLORS, HIGHLIGHT_BORDER_COLORS } from '../utils/highlightColors';

/**
 * Represents a segment of the formula string with optional metadata.
 */
export interface HighlightSegment {
  text: string;
  colorIndex: number | null;
  /** For cross-sheet refs: the sheet name (e.g., "Sheet1" from "Sheet1!A1") */
  crossSheetName?: string;
  /** For cross-sheet refs: the cell/range portion (e.g., "A1" from "Sheet1!A1") */
  crossSheetRef?: string;
}

interface FormulaHighlightOverlayProps {
  /** The formula value (including leading '='). */
  value: string;
  /** Whether the editor is active (editing). */
  isEditing: boolean;
  /** Callback when a cross-sheet reference is clicked. */
  onCrossSheetClick?: (sheetName: string, cellRef: string) => void;
}

/**
 * Computes the highlight segments for a formula string.
 * Returns null if there are no segments to render.
 *
 * This is exported so that callers can determine whether the overlay
 * will render anything — and thus whether to apply `text-transparent`
 * to the underlying input.
 */
export function computeHighlightSegments(value: string, isEditing: boolean): HighlightSegment[] | null {
  if (!isEditing || !value || !value.startsWith('=')) return null;

  try {
    const formula = value.slice(1);
    const segs: HighlightSegment[] = [];
    let colorIdx = 0;

    // Prepend the leading '=' as a plain (uncolored) segment so it remains
    // visible even though the underlying input uses text-transparent.
    segs.push({ text: '=', colorIndex: null });

    // Tokenizer: handles cell refs (A1, $A$2), ranges (A1:B5), cross-sheet refs
    // (Sheet1!A1, 'My Sheet'!A1:B5), operators, strings, numbers, function names.
    // The '!' separator and quoted sheet names are explicitly included.
    // For cross-sheet ranges, the sheet prefix may appear on both ends (Sheet1!A1:Sheet1!B5).
    // Order matters: cell refs MUST come before plain names (SUM, A, etc.) to avoid
    // partial matches (e.g., A1 being split into A + 1).
    const tokenRegex = /([A-Za-z_][A-Za-z0-9_]*!'[^']*'!\$?[A-Za-z]+\$?\d+:[A-Za-z_][A-Za-z0-9_]*!'[^']*'!\$?[A-Za-z]+\$?\d+|[A-Za-z_][A-Za-z0-9_]*!'[^']*'!\$?[A-Za-z]+\$?\d+:'[^']*'!\$?[A-Za-z]+\$?\d+|'[^']*'!\$?[A-Za-z]+\$?\d+:[A-Za-z_][A-Za-z0-9_]*!'[^']*'!\$?[A-Za-z]+\$?\d+|'[^']*'!\$?[A-Za-z]+\$?\d+:'[^']*'!\$?[A-Za-z]+\$?\d+|[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]+\$?\d+:[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]+\$?\d+|[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+|\$?[A-Za-z]+\$?\d+:[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]+\$?\d+|'[^']*'!\$?[A-Za-z]+\$?\d+:[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]+\$?\d+|'[^']*'!\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+|[A-Za-z_][A-Za-z0-9_]*!'[^']*'!\$?[A-Za-z]+\$?\d+|[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]+\$?\d+|'[^']*'!\$?[A-Za-z]+\$?\d+|\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+|\$?[A-Za-z]+\$?\d+|[0-9.]+|[+\-*/(),&^=<>!]|"[^"]*"|[A-Za-z]+)/gi;
    let match;
    let lastIndex = 0;

    while ((match = tokenRegex.exec(formula)) !== null) {
      // Capture any unmatched characters between matches as plain text
      if (match.index > lastIndex) {
        segs.push({ text: formula.slice(lastIndex, match.index), colorIndex: null });
      }
      lastIndex = match.index + match[0].length;

      const token = match[0];
      // Check if token contains '!' (cross-sheet ref)
      if (/!/i.test(token)) {
        // Cross-sheet cell ref or range (Sheet1!A1, Sheet1!A1:B5, 'My Sheet'!A1, etc.)
        // Extract sheet name and cell ref for click handling
        const bangPos = token.indexOf('!');
        let sheetName: string | undefined;
        let cellRef: string | undefined;
        if (bangPos > 0) {
          const rawSheet = token.slice(0, bangPos);
          // Remove surrounding quotes if present: 'My Sheet' -> My Sheet
          sheetName = rawSheet.replace(/^'|'$/g, '');
          cellRef = token.slice(bangPos + 1);
        }
        segs.push({
          text: token,
          colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
          crossSheetName: sheetName,
          crossSheetRef: cellRef,
        });
        colorIdx++;
      } else if (/^\$?[A-Za-z]+\$?\d+$/i.test(token)) {
        // Same-sheet cell ref (A1)
        segs.push({
          text: token,
          colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
        });
        colorIdx++;
      } else if (/^\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+$/i.test(token)) {
        // Same-sheet range (A1:B5)
        segs.push({
          text: token,
          colorIndex: colorIdx % HIGHLIGHT_COLORS.length,
        });
        colorIdx++;
      } else {
        segs.push({ text: token, colorIndex: null });
      }
    }

    // Capture any trailing unmatched characters
    if (lastIndex < formula.length) {
      segs.push({ text: formula.slice(lastIndex), colorIndex: null });
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
export const FormulaHighlightOverlay = forwardRef<HTMLDivElement, FormulaHighlightOverlayProps>(
  function FormulaHighlightOverlay({ value, isEditing, onCrossSheetClick }, ref) {
    const segments = useMemo(() => computeHighlightSegments(value, isEditing), [value, isEditing]);

    const handleClick = useCallback(
      (e: React.MouseEvent, seg: HighlightSegment) => {
        if (seg.crossSheetName && seg.crossSheetRef && onCrossSheetClick) {
          e.stopPropagation();
          onCrossSheetClick(seg.crossSheetName, seg.crossSheetRef);
        }
      },
      [onCrossSheetClick],
    );

    if (!segments) return null;

    return (
      <div
        ref={ref}
        className="absolute inset-0 pointer-events-none font-mono text-sm px-1 whitespace-nowrap min-w-full overflow-hidden select-none"
        style={{
          /* Match the input's box model exactly: the input has a 1px
             border that offsets its text content by 1px. Without this
             the overlay text is misaligned with the input caret. */
          border: '1px solid transparent',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
        }}
      >
        {segments.map((seg, i) => {
          const isCrossSheet = !!seg.crossSheetName;
          return (
          <span
            key={i}
            onClick={(e) => handleClick(e, seg)}
            style={
              seg.colorIndex !== null
                ? {
                    backgroundColor: HIGHLIGHT_COLORS[seg.colorIndex],
                    /* Use box-shadow instead of border so the highlight
                       adds zero width — colored spans must occupy the
                       same horizontal space as the plain input text so
                       the caret aligns 1:1 with characters. */
                    boxShadow: `inset 0 0 0 1px ${HIGHLIGHT_BORDER_COLORS[seg.colorIndex]}`,
                    borderRadius: '2px',
                    /* No fontWeight: bold characters are wider than normal
                       ones, causing progressive misalignment (each colored
                       cell ref shifts the caret further off). */
                    color: HIGHLIGHT_BORDER_COLORS[seg.colorIndex],
                    /* Cross-sheet refs are clickable: show pointer cursor,
                       enable pointer events, and add underline. */
                    ...(isCrossSheet
                      ? {
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          textDecoration: 'underline',
                          textDecorationStyle: 'dotted',
                        }
                      : {}),
                  }
                : undefined
            }
          >
            {seg.text}
          </span>
        );
        })}
      </div>
    );
  },
);
