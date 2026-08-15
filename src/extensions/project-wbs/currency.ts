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
 * Uses Intl.NumberFormat to resolve the currency for the user's locale,
 * with a fallback mapping for broader coverage.
 *
 * @param locale - Optional locale string (e.g., 'en-AU', 'de-DE'). Defaults to navigator.language.
 * @returns ISO 4217 currency code (e.g., 'USD', 'AUD', 'EUR')
 */
export function getDefaultCurrency(locale?: string): string {
  const userLocale = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

  try {
    // Use Intl.NumberFormat to get currency for locale
    const formatter = new Intl.NumberFormat(userLocale, { style: 'currency', currency: 'USD' });
    const resolved = formatter.resolvedOptions().currency;
    if (resolved && resolved !== 'USD') {
      return resolved;
    }
  } catch {
    // Intl not available or unsupported locale
  }

  // Fallback: parse country code from locale
  const parts = userLocale.split('-');
  if (parts.length >= 2) {
    const countryCode = parts[1].toUpperCase();
    return COUNTRY_TO_CURRENCY[countryCode] || 'USD';
  }

  return 'USD';
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
