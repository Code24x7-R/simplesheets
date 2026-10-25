// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FONT_SIZES, snapFontSize } from '../hooks/useCellStyle';

interface FontSizeInputProps {
  /** Current font size in px. */
  value: number;
  /** Called with the snapped size when the user commits a value. */
  onChange: (size: number) => void;
}

/**
 * Excel-style font-size box: an editable field plus a dropdown of the
 * standard sizes.
 *
 * A typed (custom) value snaps to the nearest standard size on Enter or blur,
 * so 11.5 becomes 12 and 13 becomes 14. The field then displays the snapped
 * value. Escape reverts without applying.
 */
export function FontSizeInput({ value, onChange }: FontSizeInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the field in sync when the active cell's size changes externally.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  /** Snap the draft to the nearest standard size and commit it. */
  const commit = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const snapped = snapFontSize(parsed);
    setDraft(String(snapped));
    if (snapped !== value) onChange(snapped);
  }, [draft, value, onChange]);

  const selectSize = useCallback(
    (size: number) => {
      setDraft(String(size));
      setOpen(false);
      if (size !== value) onChange(size);
    },
    [value, onChange],
  );

  return (
    <div className="font-size-input" ref={rootRef}>
      <input
        className="font-size-input-field"
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Keep global shortcuts (Ctrl+B, etc.) from firing while typing.
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            setOpen(false);
          } else if (e.key === 'Escape') {
            setDraft(String(value));
            setOpen(false);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label="Font Size"
        title="Font Size"
      />
      <button
        type="button"
        className="font-size-input-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        tabIndex={-1}
        aria-label="Font size options"
        title="Font size options"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="font-size-dropdown" onClick={(e) => e.stopPropagation()}>
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`font-size-option ${size === value ? 'font-size-option-active' : ''}`}
              // Keep the field focused so its onBlur doesn't commit mid-click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
