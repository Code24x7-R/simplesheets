// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { getDefaultCurrency, formatCurrency, SUPPORTED_CURRENCIES, getCurrencySymbol, getCurrencyFormatPattern } from './currency';

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
});
