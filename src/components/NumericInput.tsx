// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * NumericInput Component
 *
 * A numeric input that handles string-to-number conversion correctly.
 * Unlike a plain input with type="number" and a numeric value, this
 * component tracks the raw user input as a string, allowing natural
 * editing (e.g., clearing the field to type a new number) without
 * being stuck with leading zeros.
 *
 * The numeric value is only parsed and committed on blur or Enter key.
 */

import { useState, useEffect, useCallback } from 'react';

interface NumericInputProps {
  /** The numeric value to display */
  value: number;
  /** Callback fired when the numeric value changes (on blur/Enter) */
  onChange: (value: number) => void;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment for spinner buttons */
  step?: number;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Input ID for accessibility */
  id?: string;
  /** Whether to auto-focus */
  autoFocus?: boolean;
  /** Title attribute for tooltip */
  title?: string;
}

export function NumericInput({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  placeholder,
  className,
  id,
  autoFocus,
  title,
}: NumericInputProps) {
  // Track the raw string for user input
  const [draft, setDraft] = useState<string>(String(value));

  // Sync draft when value prop changes externally
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitValue = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      const final = isNaN(parsed) ? 0 : parsed;
      // Don't clamp here - let the parent component handle validation
      setDraft(String(final));
      onChange(final);
    },
    [onChange],
  );

  return (
    <input
      id={id}
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commitValue(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitValue(draft);
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={disabled}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      autoFocus={autoFocus}
      title={title}
      className={className}
    />
  );
}
