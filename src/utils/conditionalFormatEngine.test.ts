// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import {
  evaluateConditionalFormats,
  getColorScaleColor,
  generateRuleId,
  createDefaultRule,
} from './conditionalFormatEngine';
import type { ConditionalFormatRule } from '../types';

function createRule(overrides: Partial<ConditionalFormatRule> = {}): ConditionalFormatRule {
  return {
    id: 'test-rule',
    priority: 0,
    type: 'cellValue',
    operator: 'gt',
    value1: 100,
    format: { backgroundColor: '#FF0000' },
    ...overrides,
  };
}

describe('evaluateConditionalFormats', () => {
  it('returns null for empty rules', () => {
    const result = evaluateConditionalFormats([], 50, [50]);
    expect(result).toBeNull();
  });

  it('returns null when no rules match', () => {
    const rules = [createRule({ operator: 'gt', value1: 100 })];
    const result = evaluateConditionalFormats(rules, 50, [50]);
    expect(result).toBeNull();
  });

  it('returns style when rule matches (gt)', () => {
    const rules = [createRule({ operator: 'gt', value1: 100 })];
    const result = evaluateConditionalFormats(rules, 150, [150]);
    expect(result).not.toBeNull();
    expect(result?.style.backgroundColor).toBe('#FF0000');
  });

  it('returns style when rule matches (lt)', () => {
    const rules = [createRule({ operator: 'lt', value1: 100 })];
    const result = evaluateConditionalFormats(rules, 50, [50]);
    expect(result).not.toBeNull();
    expect(result?.style.backgroundColor).toBe('#FF0000');
  });

  it('returns style when rule matches (eq)', () => {
    const rules = [createRule({ operator: 'eq', value1: 100 })];
    const result = evaluateConditionalFormats(rules, 100, [100]);
    expect(result).not.toBeNull();
  });

  it('returns style when rule matches (between)', () => {
    const rules = [createRule({ operator: 'between', value1: 50, value2: 150 })];
    const result = evaluateConditionalFormats(rules, 100, [100]);
    expect(result).not.toBeNull();
  });

  it('returns null when value is outside between range', () => {
    const rules = [createRule({ operator: 'between', value1: 50, value2: 150 })];
    const result = evaluateConditionalFormats(rules, 200, [200]);
    expect(result).toBeNull();
  });

  it('returns style when rule matches (notBetween)', () => {
    const rules = [createRule({ operator: 'notBetween', value1: 50, value2: 150 })];
    const result = evaluateConditionalFormats(rules, 200, [200]);
    expect(result).not.toBeNull();
  });

  it('evaluates string comparison (eq)', () => {
    const rules = [createRule({ operator: 'eq', value1: 'hello' })];
    const result = evaluateConditionalFormats(rules, 'hello', ['hello']);
    expect(result).not.toBeNull();
  });

  it('evaluates string comparison (neq)', () => {
    const rules = [createRule({ operator: 'neq', value1: 'hello' })];
    const result = evaluateConditionalFormats(rules, 'world', ['world']);
    expect(result).not.toBeNull();
  });

  it('returns null for null/empty cell value', () => {
    const rules = [createRule({ operator: 'gt', value1: 0 })];
    expect(evaluateConditionalFormats(rules, null, [null])).toBeNull();
    expect(evaluateConditionalFormats(rules, '', [''])).toBeNull();
  });

  it('merges styles from multiple matching rules', () => {
    const rules = [
      createRule({ id: 'r1', priority: 0, format: { backgroundColor: '#FF0000' } }),
      createRule({ id: 'r2', priority: 1, format: { color: '#00FF00' } }),
    ];
    const result = evaluateConditionalFormats(rules, 150, [150]);
    expect(result).not.toBeNull();
    expect(result?.style.backgroundColor).toBe('#FF0000');
    expect(result?.style.color).toBe('#00FF00');
  });

  it('evaluates formula rule with value placeholder', () => {
    const rules = [createRule({ type: 'formula', formula: '=value>100' })];
    const result = evaluateConditionalFormats(rules, 150, [150]);
    expect(result).not.toBeNull();
  });

  it('returns null for formula rule that does not match', () => {
    const rules = [createRule({ type: 'formula', formula: '=value>100' })];
    const result = evaluateConditionalFormats(rules, 50, [50]);
    expect(result).toBeNull();
  });

  it('returns dataBar info for dataBar rule', () => {
    const rules = [createRule({
      type: 'dataBar',
      dataBar: { color: '#638EC6', showValue: true, minType: 'min', maxType: 'max' },
    })];
    const result = evaluateConditionalFormats(rules, 50, [0, 50, 100]);
    expect(result).not.toBeNull();
    expect(result?.dataBar).toBeDefined();
    expect(result?.dataBar?.color).toBe('#638EC6');
    expect(result?.dataBar?.percent).toBeCloseTo(0.5);
  });

  it('returns icon info for iconSet rule', () => {
    const rules = [createRule({
      type: 'iconSet',
      iconSet: { iconSet: '3Arrows', showValue: true, thresholds: [0, 33, 67] },
    })];
    const result = evaluateConditionalFormats(rules, 50, [0, 50, 100]);
    expect(result).not.toBeNull();
    expect(result?.icon).toBeDefined();
    expect(result?.icon?.iconSet).toBe('3Arrows');
  });
});

describe('getColorScaleColor', () => {
  it('returns min color for minimum value', () => {
    const color = getColorScaleColor(
      { minType: 'min', minColor: '#FF0000', maxType: 'max', maxColor: '#00FF00' },
      0,
      [0, 50, 100],
    );
    expect(color).toBe('#ff0000');
  });

  it('returns max color for maximum value', () => {
    const color = getColorScaleColor(
      { minType: 'min', minColor: '#FF0000', maxType: 'max', maxColor: '#00FF00' },
      100,
      [0, 50, 100],
    );
    expect(color).toBe('#00ff00');
  });

  it('returns interpolated color for middle value', () => {
    const color = getColorScaleColor(
      { minType: 'min', minColor: '#000000', maxType: 'max', maxColor: '#FFFFFF' },
      50,
      [0, 50, 100],
    );
    // Should be a gray color
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('uses three-color scale when midColor is provided', () => {
    const color = getColorScaleColor(
      {
        minType: 'min',
        minColor: '#FF0000',
        midType: 'percentile',
        midValue: 50,
        midColor: '#FFFF00',
        maxType: 'max',
        maxColor: '#00FF00',
      },
      25,
      [0, 25, 50, 75, 100],
    );
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('generateRuleId', () => {
  it('generates unique IDs', () => {
    const id1 = generateRuleId();
    const id2 = generateRuleId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^cf-/);
  });
});

describe('createDefaultRule', () => {
  it('creates a rule with default values', () => {
    const rule = createDefaultRule();
    expect(rule.id).toBeTruthy();
    expect(rule.type).toBe('cellValue');
    expect(rule.operator).toBe('gt');
    expect(rule.value1).toBe(0);
    expect(rule.format.backgroundColor).toBe('#FFEB9C');
  });
});
