// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { getDefaultCurrency, formatCurrency, SUPPORTED_CURRENCIES, getCurrencySymbol, getCurrencyFormatPattern, getEffectiveCurrency, getEffectiveCountry, getPersistedCountry, setPersistedCountry, getCurrencyForCountry, SUPPORTED_COUNTRIES, getCountryFromLocale } from './currency';

describe('currency', () => {
  describe('getDefaultCurrency', () => {
    it('returns USD for en-US locale', () => {
      expect(getDefaultCurrency('en-US')).toBe('USD');
    });

    it('returns AUD for en-AU locale', () => {
      expect(getDefaultCurrency('en-AU')).toBe('AUD');
    });

    it('returns EUR for de-DE locale', () => {
      expect(getDefaultCurrency('de-DE')).toBe('EUR');
    });

    it('returns GBP for en-GB locale', () => {
      expect(getDefaultCurrency('en-GB')).toBe('GBP');
    });

    it('returns JPY for ja-JP locale', () => {
      expect(getDefaultCurrency('ja-JP')).toBe('JPY');
    });

    it('returns CAD for en-CA locale', () => {
      expect(getDefaultCurrency('en-CA')).toBe('CAD');
    });

    it('returns NZD for en-NZ locale', () => {
      expect(getDefaultCurrency('en-NZ')).toBe('NZD');
    });

    it('returns CHF for de-CH locale', () => {
      expect(getDefaultCurrency('de-CH')).toBe('CHF');
    });

    it('returns ZAF for en-ZA locale', () => {
      expect(getDefaultCurrency('en-ZA')).toBe('ZAR');
    });

    it('returns BRL for pt-BR locale', () => {
      expect(getDefaultCurrency('pt-BR')).toBe('BRL');
    });

    it('falls back to USD for unknown locale', () => {
      expect(getDefaultCurrency('xx-XX')).toBe('USD');
    });

    it('falls back to USD for empty locale', () => {
      expect(getDefaultCurrency('')).toBe('USD');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD for en-US', () => {
      const result = formatCurrency(1000, 'USD', 'en-US');
      expect(result).toContain('1,000');
      expect(result).toContain('$');
    });

    it('formats EUR for de-DE', () => {
      const result = formatCurrency(1000, 'EUR', 'de-DE');
      expect(result).toContain('1.000');
    });

    it('formats AUD for en-AU', () => {
      const result = formatCurrency(1000, 'AUD', 'en-AU');
      expect(result).toContain('1,000');
    });
  });

  describe('getCurrencySymbol', () => {
    it('returns $ for USD en-US', () => {
      expect(getCurrencySymbol('USD', 'en-US')).toBe('$');
    });

    it('returns € for EUR de-DE', () => {
      expect(getCurrencySymbol('EUR', 'de-DE')).toBe('€');
    });

    it('returns £ for GBP en-GB', () => {
      expect(getCurrencySymbol('GBP', 'en-GB')).toBe('£');
    });

    it('returns A$ for AUD en-AU', () => {
      const symbol = getCurrencySymbol('AUD', 'en-AU');
      expect(symbol).toContain('$');
    });

    it('returns ¥ for JPY ja-JP', () => {
      expect(getCurrencySymbol('JPY', 'ja-JP')).toBe('￥');
    });
  });

  describe('getCurrencyFormatPattern', () => {
    it('returns $#,##0.00 for USD en-US', () => {
      expect(getCurrencyFormatPattern('USD', 'en-US')).toBe('$#,##0.00');
    });

    it('returns €#,##0.00 for EUR de-DE', () => {
      expect(getCurrencyFormatPattern('EUR', 'de-DE')).toBe('€#,##0.00');
    });

    it('returns £#,##0.00 for GBP en-GB', () => {
      expect(getCurrencyFormatPattern('GBP', 'en-GB')).toBe('£#,##0.00');
    });
  });

  describe('SUPPORTED_CURRENCIES', () => {
    it('includes major currencies', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('AUD');
      expect(SUPPORTED_CURRENCIES).toContain('EUR');
      expect(SUPPORTED_CURRENCIES).toContain('GBP');
      expect(SUPPORTED_CURRENCIES).toContain('JPY');
    });

    it('has at least 10 currencies', () => {
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('getCountryFromLocale', () => {
    it('returns AU for en-AU locale', () => {
      expect(getCountryFromLocale('en-AU')).toBe('AU');
    });

    it('returns US for en-US locale', () => {
      expect(getCountryFromLocale('en-US')).toBe('US');
    });

    it('returns DE for de-DE locale', () => {
      expect(getCountryFromLocale('de-DE')).toBe('DE');
    });

    it('falls back to US for locale without country', () => {
      expect(getCountryFromLocale('en')).toBe('US');
    });
  });

  describe('getCurrencyForCountry', () => {
    it('returns AUD for AU', () => {
      expect(getCurrencyForCountry('AU')).toBe('AUD');
    });

    it('returns USD for US', () => {
      expect(getCurrencyForCountry('US')).toBe('USD');
    });

    it('returns EUR for DE', () => {
      expect(getCurrencyForCountry('DE')).toBe('EUR');
    });

    it('falls back to USD for unknown country', () => {
      expect(getCurrencyForCountry('XX')).toBe('USD');
    });
  });

  describe('persisted country', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns null when no country is persisted', () => {
      expect(getPersistedCountry()).toBeNull();
    });

    it('persists and retrieves country', () => {
      setPersistedCountry('AU');
      expect(getPersistedCountry()).toBe('AU');
    });

    it('getEffectiveCurrency returns persisted currency', () => {
      setPersistedCountry('AU');
      expect(getEffectiveCurrency()).toBe('AUD');
    });

    it('getEffectiveCountry returns persisted country', () => {
      setPersistedCountry('AU');
      expect(getEffectiveCountry()).toBe('AU');
    });

    it('getEffectiveCurrency falls back to locale when no persisted country', () => {
      localStorage.clear();
      // Without persisted country, falls back to locale detection
      const currency = getEffectiveCurrency();
      expect(typeof currency).toBe('string');
      expect(currency.length).toBe(3);
    });
  });

  describe('SUPPORTED_COUNTRIES', () => {
    it('includes Australia', () => {
      const au = SUPPORTED_COUNTRIES.find((c) => c.code === 'AU');
      expect(au).toBeTruthy();
      expect(au!.currency).toBe('AUD');
    });

    it('includes United States', () => {
      const us = SUPPORTED_COUNTRIES.find((c) => c.code === 'US');
      expect(us).toBeTruthy();
      expect(us!.currency).toBe('USD');
    });

    it('has at least 10 countries', () => {
      expect(SUPPORTED_COUNTRIES.length).toBeGreaterThanOrEqual(10);
    });
  });
});
