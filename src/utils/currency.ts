// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Currency Detection Utility
 *
 * Detects the default currency based on browser locale
 * using Intl.NumberFormat for accurate locale-to-currency mapping.
 */

/**
 * Mapping of country codes to ISO 4217 currency codes.
 * Covers the most common locales for project templates.
 */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // North America
  US: 'USD',
  CA: 'CAD',
  MX: 'MXN',

  // Europe
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZK: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  BG: 'BGN',
  HR: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  EE: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  MT: 'EUR',
  CY: 'EUR',
  IS: 'ISK',
  // Oceania
  AU: 'AUD',
  NZ: 'NZD',
  // Asia
  JP: 'JPY',
  CN: 'CNY',
  KR: 'KRW',
  IN: 'INR',
  SG: 'SGD',
  HK: 'HKD',
  TW: 'TWD',
  TH: 'THB',
  MY: 'MYR',
  ID: 'IDR',
  PH: 'PHP',
  VN: 'VND',
  // Middle East
  AE: 'AED',
  SA: 'SAR',
  IL: 'ILS',
  TR: 'TRY',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
  JO: 'JOD',
  // Africa
  ZA: 'ZAR',
  EG: 'EGP',
  NG: 'NGN',
  KE: 'KES',
  // South America
  BR: 'BRL',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
};

/**
 * Get the default currency for the current browser locale.
 *
 * Detects the country from the locale and maps it to a currency code,
 * with a fallback mapping for broader coverage.
 *
 * @param locale - Optional locale string (e.g., 'en-AU', 'de-DE'). Defaults to navigator.language.
 * @returns ISO 4217 currency code (e.g., 'USD', 'AUD', 'EUR')
 */
export function getDefaultCurrency(locale?: string): string {
  const userLocale = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

  // First, try to extract country code from locale (e.g., 'en-AU' -> 'AU')
  const parts = userLocale.split('-');
  if (parts.length >= 2) {
    const countryCode = parts[1].toUpperCase();
    const currency = COUNTRY_TO_CURRENCY[countryCode];
    if (currency) {
      return currency;
    }
  }

  // Fallback: try to detect currency from locale using Intl.DisplayNames
  // This approach doesn't require knowing the currency upfront
  try {
    // Use a known locale to get the currency for the target locale
    // We iterate through supported currencies to find one that matches the locale
    for (const currency of SUPPORTED_CURRENCIES) {
      const formatter = new Intl.NumberFormat(userLocale, { style: 'currency', currency });
      const resolved = formatter.resolvedOptions().currency;
      if (resolved === currency) {
        // Verify this currency is appropriate for the locale's country
        const parts = userLocale.split('-');
        if (parts.length >= 2) {
          const countryCode = parts[1].toUpperCase();
          if (COUNTRY_TO_CURRENCY[countryCode] === currency) {
            return currency;
          }
        }
      }
    }
  } catch {
    // Intl not available or unsupported locale
  }

  // Final fallback: parse country code from locale
  if (parts.length >= 2) {
    const countryCode = parts[1].toUpperCase();
    return COUNTRY_TO_CURRENCY[countryCode] || 'USD';
  }

  return 'USD';
}

/**
 * Get the country code from a locale string.
 * @param locale - Locale string (e.g., 'en-AU', 'de-DE')
 * @returns ISO 3166-1 alpha-2 country code (e.g., 'AU', 'DE')
 */
export function getCountryFromLocale(locale?: string): string {
  const userLocale = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  const parts = userLocale.split('-');
  if (parts.length >= 2) {
    return parts[1].toUpperCase();
  }
  return 'US';
}

/**
 * Get all supported countries for dropdown selection.
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'KR', name: 'South Korea', currency: 'KRW' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'TH', name: 'Thailand', currency: 'THB' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  { code: 'PH', name: 'Philippines', currency: 'PHP' },
  { code: 'VN', name: 'Vietnam', currency: 'VND' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number]['code'];

const COUNTRY_CURRENCY_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_COUNTRIES.map((c) => [c.code, c.currency]),
);

/**
 * Get the currency for a given country code.
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns ISO 4217 currency code
 */
export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || 'USD';
}

/**
 * Persistence key for country/currency settings.
 */
const COUNTRY_STORAGE_KEY = 'simplesheets:country';

/**
 * Get the persisted country code from localStorage.
 * @returns The stored country code or null if not set.
 */
export function getPersistedCountry(): string | null {
  try {
    return localStorage.getItem(COUNTRY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist the country code to localStorage.
 * @param countryCode - ISO 3166-1 alpha-2 country code
 */
export function setPersistedCountry(countryCode: string): void {
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, countryCode);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the effective currency, considering persisted country preference.
 * Priority: persisted country > browser locale > USD fallback
 * @returns ISO 4217 currency code
 */
export function getEffectiveCurrency(): string {
  const persistedCountry = getPersistedCountry();
  if (persistedCountry) {
    return getCurrencyForCountry(persistedCountry);
  }
  return getDefaultCurrency();
}

/**
 * Get the effective country code, considering persisted preference.
 * @returns ISO 3166-1 alpha-2 country code
 */
export function getEffectiveCountry(): string {
  return getPersistedCountry() || getCountryFromLocale();
}

/**
 * Get all supported currencies for dropdown selection.
 * Used in ResourceEditorModal and other currency inputs.
 */
export const SUPPORTED_CURRENCIES = [
  'USD',
  'AUD',
  'CAD',
  'EUR',
  'GBP',
  'NZD',
  'JPY',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'SGD',
  'HKD',
  'CNY',
  'KRW',
  'INR',
  'ZAR',
  'BRL',
  'MXN',
  'AED',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Get the currency symbol for the current locale.
 * @param currency - ISO 4217 currency code
 * @param locale - Optional locale string
 * @returns Currency symbol (e.g., '$', '€', '£')
 */
export function getCurrencySymbol(currency: string, locale?: string): string {
  const userLocale = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  try {
    const formatter = new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Get the number format pattern for currency based on locale.
 * Returns an Excel-compatible format string like '$#,##0.00'.
 * @param currency - ISO 4217 currency code
 * @param locale - Optional locale string
 * @returns Excel number format pattern
 */
export function getCurrencyFormatPattern(currency: string, locale?: string): string {
  const symbol = getCurrencySymbol(currency, locale);
  return `${symbol}#,##0.00`;
}

/**
 * Format a currency amount with proper symbol for the given locale.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  const userLocale = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  try {
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
