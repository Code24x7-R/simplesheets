// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Conditional Formatting Engine
 *
 * Evaluates conditional format rules against cell values and returns
 * the applicable CSS styles to apply.
 */
import type {
  ConditionalFormatRule,
  ConditionalFormatStyle,
  ColorScaleConfig,
  DataBarConfig,
  IconSetConfig,
} from '../types';

/** Result of evaluating conditional formats for a cell. */
export interface ConditionalFormatResult {
  /** Merged style from all matching rules (by priority). */
  style: ConditionalFormatStyle;
  /** Data bar info if a dataBar rule matches. */
  dataBar?: {
    color: string;
    showValue: boolean;
    /** Percentage 0-1 for bar width. */
    percent: number;
  };
  /** Icon info if an iconSet rule matches. */
  icon?: {
    iconSet: string;
    showValue: boolean;
    /** Index into the icon set (0-based). */
    iconIndex: number;
  };
}

/**
 * Evaluate all conditional format rules for a given cell value.
 * Rules are evaluated in priority order (lower priority number = higher priority).
 */
export function evaluateConditionalFormats(
  rules: ConditionalFormatRule[],
  cellValue: string | number | boolean | null,
  allCellValues: Array<string | number | boolean | null>,
): ConditionalFormatResult | null {
  if (!rules || rules.length === 0) return null;

  // Sort by priority
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  const result: ConditionalFormatResult = {
    style: {},
  };

  let hasMatch = false;

  for (const rule of sortedRules) {
    if (evaluateRule(rule, cellValue, allCellValues)) {
      hasMatch = true;
      // Merge style (later rules override earlier ones for same properties)
      if (rule.format) {
        result.style = { ...result.style, ...rule.format };
      }
      // Capture data bar info
      if (rule.type === 'dataBar' && rule.dataBar) {
        const percent = computeDataBarPercent(rule.dataBar, cellValue, allCellValues);
        result.dataBar = {
          color: rule.dataBar.color,
          showValue: rule.dataBar.showValue,
          percent,
        };
      }
      // Capture icon set info
      if (rule.type === 'iconSet' && rule.iconSet) {
        const iconIndex = computeIconIndex(rule.iconSet, cellValue);
        result.icon = {
          iconSet: rule.iconSet.iconSet,
          showValue: rule.iconSet.showValue,
          iconIndex,
        };
      }
    }
  }

  return hasMatch ? result : null;
}

/**
 * Evaluate a single rule against a cell value.
 */
function evaluateRule(
  rule: ConditionalFormatRule,
  cellValue: string | number | boolean | null,
  _allCellValues: Array<string | number | boolean | null>,
): boolean {
  switch (rule.type) {
    case 'cellValue':
      return evaluateCellValueRule(rule, cellValue);
    case 'formula':
      return evaluateFormulaRule(rule, cellValue);
    case 'colorScale':
    case 'dataBar':
    case 'iconSet':
      // These always "match" — the visual is computed from the value
      return isNumericValue(cellValue);
    default:
      return false;
  }
}

/**
 * Evaluate a cellValue type rule.
 */
function evaluateCellValueRule(
  rule: ConditionalFormatRule,
  cellValue: string | number | boolean | null,
): boolean {
  if (cellValue === null || cellValue === '') return false;

  const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));
  const v1 = typeof rule.value1 === 'number' ? rule.value1 : parseFloat(String(rule.value1 ?? ''));
  const v2 = typeof rule.value2 === 'number' ? rule.value2 : parseFloat(String(rule.value2 ?? ''));

  // If both are numeric, compare numerically
  if (!isNaN(numValue) && !isNaN(v1)) {
    switch (rule.operator) {
      case 'gt': return numValue > v1;
      case 'gte': return numValue >= v1;
      case 'lt': return numValue < v1;
      case 'lte': return numValue <= v1;
      case 'eq': return numValue === v1;
      case 'neq': return numValue !== v1;
      case 'between': return numValue >= v1 && numValue <= (isNaN(v2) ? v1 : v2);
      case 'notBetween': return numValue < v1 || numValue > (isNaN(v2) ? v1 : v2);
      default: return false;
    }
  }

  // String comparison
  const strValue = String(cellValue);
  const str1 = String(rule.value1 ?? '');
  switch (rule.operator) {
    case 'eq': return strValue === str1;
    case 'neq': return strValue !== str1;
    case 'gt': return strValue > str1;
    case 'gte': return strValue >= str1;
    case 'lt': return strValue < str1;
    case 'lte': return strValue <= str1;
    default: return false;
  }
}

/**
 * Evaluate a formula type rule.
 * Simplified: evaluates basic comparisons like "=A1>B1".
 */
function evaluateFormulaRule(
  rule: ConditionalFormatRule,
  cellValue: string | number | boolean | null,
): boolean {
  if (!rule.formula) return false;

  // For now, support simple comparison formulas
  // Format: =value>100, =value="text", etc.
  const formula = rule.formula.replace(/^=/, '').trim();

  // Handle "value" as placeholder for current cell
  const expr = formula.replace(/\bvalue\b/gi, String(cellValue ?? ''));

  // Simple comparison parsing
  const comparisonMatch = expr.match(/^(.+?)(>=|<=|<>|>|<|=)(.+)$/);
  if (comparisonMatch) {
    const left = comparisonMatch[1].trim();
    const op = comparisonMatch[2];
    const right = comparisonMatch[3].trim().replace(/^["']|["']$/g, '');

    const leftNum = parseFloat(left);
    const rightNum = parseFloat(right);

    if (!isNaN(leftNum) && !isNaN(rightNum)) {
      switch (op) {
        case '>': return leftNum > rightNum;
        case '>=': return leftNum >= rightNum;
        case '<': return leftNum < rightNum;
        case '<=': return leftNum <= rightNum;
        case '=': return leftNum === rightNum;
        case '<>': return leftNum !== rightNum;
      }
    }

    // String comparison
    switch (op) {
      case '=': return left === right;
      case '<>': return left !== right;
      case '>': return left > right;
      case '>=': return left >= right;
      case '<': return left < right;
      case '<=': return left <= right;
    }
  }

  return false;
}

/**
 * Check if a value is numeric.
 */
function isNumericValue(value: string | number | boolean | null): boolean {
  if (value === null || value === '') return false;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return false;
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

/**
 * Compute the percentage for a data bar (0-1).
 */
function computeDataBarPercent(
  config: DataBarConfig,
  cellValue: string | number | boolean | null,
  allCellValues: Array<string | number | boolean | null>,
): number {
  const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue ?? ''));
  if (isNaN(numValue)) return 0;

  const numericValues = allCellValues
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v ?? ''))))
    .filter((v) => !isNaN(v));

  let min = Math.min(...numericValues, 0);
  let max = Math.max(...numericValues, 0);

  // Apply config overrides
  if (config.minType === 'num' && typeof config.minValue === 'number') {
    min = config.minValue;
  }
  if (config.maxType === 'num' && typeof config.maxValue === 'number') {
    max = config.maxValue;
  }

  if (max === min) return numValue >= max ? 1 : 0;

  const percent = (numValue - min) / (max - min);
  return Math.max(0, Math.min(1, percent));
}

/**
 * Compute the icon index for an icon set.
 */
function computeIconIndex(
  config: IconSetConfig,
  cellValue: string | number | boolean | null,
): number {
  const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue ?? ''));
  if (isNaN(numValue)) return 0;

  const thresholds = config.thresholds;
  let index = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (numValue >= thresholds[i]) {
      index = i + 1;
    }
  }

  // Map to icon set size
  const iconCount = getIconSetCount(config.iconSet);
  return Math.min(index, iconCount - 1);
}

/**
 * Get the number of icons in an icon set.
 */
function getIconSetCount(iconSet: string): number {
  if (iconSet.startsWith('3')) return 3;
  if (iconSet.startsWith('4')) return 4;
  if (iconSet.startsWith('5')) return 5;
  return 3;
}

/**
 * Get the color for a color scale based on value position.
 */
export function getColorScaleColor(
  config: ColorScaleConfig,
  cellValue: string | number | boolean | null,
  allCellValues: Array<string | number | boolean | null>,
): string {
  const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue ?? ''));
  if (isNaN(numValue)) return config.minColor;

  const numericValues = allCellValues
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v ?? ''))))
    .filter((v) => !isNaN(v));

  let min = Math.min(...numericValues);
  let max = Math.max(...numericValues);

  // Apply config overrides
  if (config.minType === 'num' && typeof config.minValue === 'number') {
    min = config.minValue;
  }
  if (config.maxType === 'num' && typeof config.maxValue === 'number') {
    max = config.maxValue;
  }

  if (max === min) return config.maxColor;

  const ratio = (numValue - min) / (max - min);

  // Two-color scale
  if (!config.midColor) {
    return interpolateColor(config.minColor, config.maxColor, ratio);
  }

  // Three-color scale
  if (ratio <= 0.5) {
    return interpolateColor(config.minColor, config.midColor, ratio * 2);
  }
  return interpolateColor(config.midColor, config.maxColor, (ratio - 0.5) * 2);
}

/**
 * Interpolate between two hex colors.
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generate a unique ID for a new rule.
 */
export function generateRuleId(): string {
  return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a default conditional format rule.
 */
export function createDefaultRule(): ConditionalFormatRule {
  return {
    id: generateRuleId(),
    priority: 0,
    type: 'cellValue',
    operator: 'gt',
    value1: 0,
    format: {
      backgroundColor: '#FFEB9C',
      color: '#9C5700',
    },
  };
}
