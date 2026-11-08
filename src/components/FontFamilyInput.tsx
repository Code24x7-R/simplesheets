// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DEFAULT_FONT_FAMILY_LABEL,
  listSystemFontFamilies,
  normalizeFontFamily,
  type FontListResult,
} from '../utils/fontFamily';

interface FontFamilyInputProps {
  /** Current font family, or undefined for the grid default. */
  value?: string;
  /** Called with the chosen family, or undefined to restore the default. */
  onChange: (family: string | undefined) => void;
}

/**
 * Searchable font-family picker.
 *
 * Installed families are requested lazily when the dropdown opens. The
 * Local Font Access API may require a one-time browser permission; when it is
 * unavailable the picker falls back to a curated list of common system fonts.
 */
export function FontFamilyInput({ value, onChange }: FontFamilyInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fonts, setFonts] = useState<string[]>([]);
  const [source, setSource] = useState<FontListResult['source']>('fallback');
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, close]);

  // Load the installed-font list once per open. The utility caches the result.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    listSystemFontFamilies()
      .then((result) => {
        if (!active) return;
        setFonts(result.families);
        setSource(result.source);
      })
      .catch(() => {
        if (!active) return;
        setFonts([]);
        setSource('fallback');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  // Focus the search field after the dropdown mounts.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const selectFamily = useCallback(
    (family: string | undefined) => {
      onChange(normalizeFontFamily(family));
      close();
    },
    [onChange, close],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? fonts.filter((family) => family.toLowerCase().includes(normalizedQuery))
    : fonts;

  const displayValue = normalizeFontFamily(value) ?? DEFAULT_FONT_FAMILY_LABEL;

  return (
    <div className="font-family-input" ref={rootRef}>
      <button
        type="button"
        className="font-family-input-button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
        aria-label="Font Family"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Font Family"
      >
        <span className="font-family-input-label" style={{ fontFamily: value }}>
          {displayValue}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="font-family-dropdown" onClick={(event) => event.stopPropagation()}>
          <input
            ref={searchRef}
            className="font-family-search"
            type="text"
            value={query}
            placeholder="Search fonts…"
            aria-label="Search font families"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              } else if (event.key === 'Enter') {
                event.preventDefault();
                selectFamily(filtered[0]);
              }
            }}
          />

          <div className="font-family-list" role="listbox" aria-label="Font families">
            {!normalizedQuery && (
              <button
                type="button"
                role="option"
                aria-selected={!normalizeFontFamily(value)}
                className={`font-family-option ${
                  !normalizeFontFamily(value) ? 'font-family-option-active' : ''
                }`}
                onClick={() => selectFamily(undefined)}
              >
                {DEFAULT_FONT_FAMILY_LABEL}
              </button>
            )}

            {loading && <div className="font-family-note">Loading installed fonts…</div>}

            {!loading && filtered.length === 0 && (
              <div className="font-family-note">No matching fonts.</div>
            )}

            {!loading &&
              filtered.map((family) => (
                <button
                  key={family}
                  type="button"
                  role="option"
                  aria-selected={normalizeFontFamily(value) === family}
                  className={`font-family-option ${
                    normalizeFontFamily(value) === family ? 'font-family-option-active' : ''
                  }`}
                  style={{ fontFamily: family }}
                  onClick={() => selectFamily(family)}
                >
                  {family}
                </button>
              ))}
          </div>

          {!loading && source === 'fallback' && (
            <div className="font-family-note font-family-note-footer">
              Showing common fonts. Allow font access to list every installed family.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
