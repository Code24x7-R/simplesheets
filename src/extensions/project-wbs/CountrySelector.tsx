// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Country Selector Component
 *
 * A dropdown for selecting the user's country, which determines the default
 * currency. The selection is persisted to localStorage.
 */

import { useState, useEffect } from 'react';
import {
  SUPPORTED_COUNTRIES,
  getEffectiveCountry,
  setPersistedCountry,
  getCurrencyForCountry,
} from '../../utils/currency';

interface CountrySelectorProps {
  onCountryChange?: (countryCode: string, currency: string) => void;
  showCurrency?: boolean;
  className?: string;
}

export function CountrySelector({
  onCountryChange,
  showCurrency = true,
  className = '',
}: CountrySelectorProps) {
  const [selectedCountry, setSelectedCountry] = useState<string>(getEffectiveCountry());

  // Sync with localStorage on mount
  useEffect(() => {
    setSelectedCountry(getEffectiveCountry());
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const countryCode = e.target.value;
    setSelectedCountry(countryCode);
    setPersistedCountry(countryCode);

    const currency = getCurrencyForCountry(countryCode);
    onCountryChange?.(countryCode, currency);
  }

  const currentCurrency = getCurrencyForCountry(selectedCountry);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-xs text-gray-500">Country:</label>
      <select
        value={selectedCountry}
        onChange={handleChange}
        className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        data-testid="country-selector"
      >
        {SUPPORTED_COUNTRIES.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name} ({country.currency})
          </option>
        ))}
      </select>
      {showCurrency && (
        <span className="text-xs text-gray-400">
          Currency: <strong>{currentCurrency}</strong>
        </span>
      )}
    </div>
  );
}
