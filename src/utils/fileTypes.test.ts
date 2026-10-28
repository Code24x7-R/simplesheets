// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  NATIVE_EXT,
  LEGACY_EXT,
  ACCEPT_NATIVE,
  ACCEPT_IMPORT,
  ACCEPT_ALL,
  stripKnownExtension,
  normalizeFileName,
} from './fileTypes';

describe('fileTypes', () => {
  describe('constants', () => {
    it('defines .ssjson as native and .json as legacy', () => {
      expect(NATIVE_EXT).toBe('.ssjson');
      expect(LEGACY_EXT).toBe('.json');
    });

    it('accepts both native and legacy extensions in the native picker', () => {
      expect(ACCEPT_NATIVE).toContain('.ssjson');
      expect(ACCEPT_NATIVE).toContain('.json');
    });

    it('accepts spreadsheet formats plus native formats for import', () => {
      expect(ACCEPT_IMPORT).toContain('.xlsx');
      expect(ACCEPT_IMPORT).toContain('.xls');
      expect(ACCEPT_IMPORT).toContain('.csv');
      expect(ACCEPT_IMPORT).toContain('.tsv');
      expect(ACCEPT_IMPORT).toContain('.ssjson');
      expect(ACCEPT_IMPORT).toContain('.json');
    });

    it('combines all accepted formats and the native MIME type', () => {
      expect(ACCEPT_ALL).toContain(ACCEPT_IMPORT);
      expect(ACCEPT_ALL).toContain('application/json');
    });
  });

  describe('stripKnownExtension', () => {
    it('strips .ssjson', () => {
      expect(stripKnownExtension('budget.ssjson')).toBe('budget');
    });

    it('strips .json', () => {
      expect(stripKnownExtension('budget.json')).toBe('budget');
    });

    it('strips case-insensitively', () => {
      expect(stripKnownExtension('budget.SSJSON')).toBe('budget');
      expect(stripKnownExtension('budget.JSON')).toBe('budget');
    });

    it('returns the name unchanged when no known extension', () => {
      expect(stripKnownExtension('budget.xlsx')).toBe('budget.xlsx');
      expect(stripKnownExtension('budget')).toBe('budget');
    });

    it('does not strip an extension-only string', () => {
      expect(stripKnownExtension('.ssjson')).toBe('.ssjson');
    });
  });

  describe('normalizeFileName', () => {
    it('appends the native extension to a plain name', () => {
      expect(normalizeFileName('budget')).toBe('budget.ssjson');
    });

    it('replaces a legacy extension with the native one', () => {
      expect(normalizeFileName('budget.json')).toBe('budget.ssjson');
    });

    it('collapses a duplicated extension', () => {
      expect(normalizeFileName('budget.ssjson.ssjson')).toBe('budget.ssjson');
    });

    it('collapses repeated legacy extensions', () => {
      expect(normalizeFileName('budget.json.json')).toBe('budget.ssjson');
    });

    it('uses a custom extension when provided', () => {
      expect(normalizeFileName('budget', '.json')).toBe('budget.json');
    });

    it('sanitizes invalid filename characters', () => {
      expect(normalizeFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j.ssjson');
    });

    it('trims trailing periods and spaces', () => {
      expect(normalizeFileName('budget...')).toBe('budget.ssjson');
      expect(normalizeFileName('budget   ')).toBe('budget.ssjson');
    });

    it('falls back to Untitled for empty input', () => {
      expect(normalizeFileName('')).toBe('Untitled.ssjson');
      expect(normalizeFileName('   ')).toBe('Untitled.ssjson');
    });


  });
});
