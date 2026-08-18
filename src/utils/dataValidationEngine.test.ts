// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import {
  validateCellValue,
  generateValidationId,
  createDefaultValidationRule,
} from './dataValidationEngine';
import type { DataValidationRule } from '../types';

function createValidationRule(overrides: Partial<DataValidationRule> = {}): DataValidationRule {
  return {
    id: 'test-dv',
    type: 'whole',
    operator: 'gte',
    value1: 0,
    allowBlank: true,
    enabled: true,
    errorAlert: {
      style: 'stop',
      title: 'Invalid Entry',
      message: 'Please enter a valid value.',
    },
    ...overrides,
  };
}

describe('validateCellValue', () => {
  it('returns valid for empty rules', () => {
    const result = validateCellValue([], 'any value');
    expect(result.isValid).toBe(true);
  });

  it('returns valid when value passes whole number validation', () => {
    const rules = [createValidationRule({ type: 'whole', operator: 'gte', value1: 0 })];
    const result = validateCellValue(rules, 5);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for non-integer in whole number validation', () => {
    const rules = [createValidationRule({ type: 'whole', operator: 'gte', value1: 0 })];
    const result = validateCellValue(rules, 3.14);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('returns invalid for value below minimum', () => {
    const rules = [createValidationRule({ type: 'whole', operator: 'gte', value1: 10 })];
    const result = validateCellValue(rules, 5);
    expect(result.isValid).toBe(false);
  });

  it('returns valid for value in between range', () => {
    const rules = [createValidationRule({
      type: 'whole',
      operator: 'between',
      value1: 0,
      value2: 100,
    })];
    const result = validateCellValue(rules, 50);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for value outside between range', () => {
    const rules = [createValidationRule({
      type: 'whole',
      operator: 'between',
      value1: 0,
      value2: 100,
    })];
    const result = validateCellValue(rules, 150);
    expect(result.isValid).toBe(false);
  });

  it('returns valid for decimal validation', () => {
    const rules = [createValidationRule({ type: 'decimal', operator: 'gte', value1: 0 })];
    const result = validateCellValue(rules, 3.14);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for non-numeric in decimal validation', () => {
    const rules = [createValidationRule({ type: 'decimal', operator: 'gte', value1: 0 })];
    const result = validateCellValue(rules, 'abc');
    expect(result.isValid).toBe(false);
  });

  it('returns valid for list validation with matching value', () => {
    const rules = [createValidationRule({
      type: 'list',
      operator: 'eq',
      value1: '',
      listSource: 'Apple, Banana, Cherry',
    })];
    const result = validateCellValue(rules, 'Banana');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for list validation with non-matching value', () => {
    const rules = [createValidationRule({
      type: 'list',
      operator: 'eq',
      value1: '',
      listSource: 'Apple, Banana, Cherry',
    })];
    const result = validateCellValue(rules, 'Orange');
    expect(result.isValid).toBe(false);
  });

  it('returns valid for date validation', () => {
    const rules = [createValidationRule({
      type: 'date',
      operator: 'gte',
      value1: '2025-01-01',
    })];
    const result = validateCellValue(rules, '2025-06-15');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for date before minimum', () => {
    const rules = [createValidationRule({
      type: 'date',
      operator: 'gte',
      value1: '2025-01-01',
    })];
    const result = validateCellValue(rules, '2024-06-15');
    expect(result.isValid).toBe(false);
  });

  it('returns valid for text length validation', () => {
    const rules = [createValidationRule({
      type: 'textLength',
      operator: 'lte',
      value1: 10,
    })];
    const result = validateCellValue(rules, 'short');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for text exceeding max length', () => {
    const rules = [createValidationRule({
      type: 'textLength',
      operator: 'lte',
      value1: 5,
    })];
    const result = validateCellValue(rules, 'this is too long');
    expect(result.isValid).toBe(false);
  });

  it('allows blank when allowBlank is true', () => {
    const rules = [createValidationRule({
      type: 'whole',
      operator: 'gte',
      value1: 0,
      allowBlank: true,
    })];
    const result = validateCellValue(rules, '');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for blank when allowBlank is false', () => {
    const rules = [createValidationRule({
      type: 'whole',
      operator: 'gte',
      value1: 0,
      allowBlank: false,
    })];
    const result = validateCellValue(rules, '');
    expect(result.isValid).toBe(false);
  });

  it('skips disabled rules', () => {
    const rules = [createValidationRule({
      type: 'whole',
      operator: 'gte',
      value1: 100,
      enabled: false,
    })];
    const result = validateCellValue(rules, 5);
    expect(result.isValid).toBe(true);
  });

  it('returns input message from first enabled rule', () => {
    const rules = [createValidationRule({
      inputTitle: 'Enter Value',
      inputMessage: 'Please enter a number between 0 and 100',
    })];
    const result = validateCellValue(rules, 50);
    expect(result.isValid).toBe(true);
    expect(result.inputTitle).toBe('Enter Value');
    expect(result.inputMessage).toBe('Please enter a number between 0 and 100');
  });

  it('returns list values for list type with dropdown', () => {
    const rules = [createValidationRule({
      type: 'list',
      operator: 'eq',
      value1: '',
      listSource: 'A, B, C',
      showDropdown: true,
    })];
    const result = validateCellValue(rules, 'A');
    expect(result.isValid).toBe(true);
    expect(result.showDropdown).toBe(true);
    expect(result.listValues).toEqual(['A', 'B', 'C']);
  });
});

describe('generateValidationId', () => {
  it('generates unique IDs', () => {
    const id1 = generateValidationId();
    const id2 = generateValidationId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^dv-/);
  });
});

describe('createDefaultValidationRule', () => {
  it('creates a rule with default values', () => {
    const rule = createDefaultValidationRule();
    expect(rule.id).toBeTruthy();
    expect(rule.type).toBe('whole');
    expect(rule.operator).toBe('gte');
    expect(rule.value1).toBe(0);
    expect(rule.allowBlank).toBe(true);
    expect(rule.enabled).toBe(true);
  });
});
