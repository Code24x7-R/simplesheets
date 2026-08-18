// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Data Validation Engine
 *
 * Validates cell values against data validation rules.
 */
import type { DataValidationRule } from '../types';

/** Result of validating a cell value. */
export interface ValidationResult {
  /** Whether the value is valid. */
  isValid: boolean;
  /** Error message if invalid. */
  errorMessage?: string;
  /** Error title if invalid. */
  errorTitle?: string;
  /** Error style (stop, warning, information). */
  errorStyle?: 'stop' | 'warning' | 'information';
  /** Whether to show a dropdown for list type. */
  showDropdown?: boolean;
  /** List values for dropdown. */
  listValues?: string[];
  /** Input message to show when cell is selected. */
  inputMessage?: string;
  /** Input message title. */
  inputTitle?: string;
}

/**
 * Validate a cell value against all data validation rules.
 * Returns the first failing validation result, or a passing result.
 */
export function validateCellValue(
  rules: DataValidationRule[],
  value: string | number | boolean | null,
): ValidationResult {
  if (!rules || rules.length === 0) {
    return { isValid: true };
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const result = validateAgainstRule(rule, value);
    if (!result.isValid) {
      return result;
    }
  }

  // Return the first rule's input message if valid
  const firstRule = rules.find((r) => r.enabled);
  if (firstRule) {
    return {
      isValid: true,
      showDropdown: firstRule.type === 'list' && firstRule.showDropdown,
      listValues: firstRule.type === 'list' && firstRule.listSource
        ? parseListValues(firstRule.listSource)
        : undefined,
      inputMessage: firstRule.inputMessage,
      inputTitle: firstRule.inputTitle,
    };
  }

  return { isValid: true };
}

/**
 * Validate a value against a single rule.
 */
function validateAgainstRule(
  rule: DataValidationRule,
  value: string | number | boolean | null,
): ValidationResult {
  // Allow blank if configured
  if ((value === null || value === '') && rule.allowBlank) {
    return { isValid: true };
  }

  // Reject blank if not allowed
  if ((value === null || value === '') && !rule.allowBlank) {
    return createErrorResult(rule, 'Blank values are not allowed.');
  }

  const strValue = String(value ?? '');

  switch (rule.type) {
    case 'whole':
      return validateWholeNumber(rule, strValue);
    case 'decimal':
      return validateDecimal(rule, strValue);
    case 'list':
      return validateList(rule, strValue);
    case 'date':
      return validateDate(rule, strValue);
    case 'textLength':
      return validateTextLength(rule, strValue);
    case 'custom':
      return validateCustom(rule, strValue);
    default:
      return { isValid: true };
  }
}

/**
 * Validate a whole number.
 */
function validateWholeNumber(
  rule: DataValidationRule,
  value: string,
): ValidationResult {
  // Must be a valid integer
  const num = Number(value);
  if (!Number.isInteger(num) || isNaN(num)) {
    return createErrorResult(rule, 'Please enter a whole number.');
  }

  return validateComparison(rule, num, 'whole number');
}

/**
 * Validate a decimal number.
 */
function validateDecimal(
  rule: DataValidationRule,
  value: string,
): ValidationResult {
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) {
    return createErrorResult(rule, 'Please enter a valid number.');
  }

  return validateComparison(rule, num, 'number');
}

/**
 * Validate against a list of allowed values.
 */
function validateList(
  rule: DataValidationRule,
  value: string,
): ValidationResult {
  if (!rule.listSource) return { isValid: true };

  const allowedValues = parseListValues(rule.listSource);
  if (!allowedValues.includes(value)) {
    return createErrorResult(rule, `Please select from the list: ${allowedValues.slice(0, 5).join(', ')}...`);
  }

  return { isValid: true };
}

/**
 * Validate a date.
 */
function validateDate(
  rule: DataValidationRule,
  value: string,
): ValidationResult {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return createErrorResult(rule, 'Please enter a valid date.');
  }

  const v1 = typeof rule.value1 === 'string' ? new Date(rule.value1) : null;
  const v2 = typeof rule.value2 === 'string' ? new Date(rule.value2) : null;
  const numDate = date.getTime();

  return validateComparison(rule, numDate, 'date', v1?.getTime(), v2?.getTime());
}

/**
 * Validate text length.
 */
function validateTextLength(
  rule: DataValidationRule,
  value: string,
): ValidationResult {
  const length = value.length;
  return validateComparison(rule, length, 'text length');
}

/**
 * Validate using a custom formula.
 */
function validateCustom(
  rule: DataValidationRule,
  value: string,
): ValidationResult {
  // For custom validation, value1 is treated as a formula
  // Simplified: check if value is truthy/non-empty
  if (!value || value.trim() === '') {
    return createErrorResult(rule, 'This value is not valid.');
  }
  return { isValid: true };
}

/**
 * Generic comparison validation.
 */
function validateComparison(
  rule: DataValidationRule,
  value: number,
  type: string,
  dateV1?: number | undefined,
  dateV2?: number | undefined,
): ValidationResult {
  const v1 = typeof rule.value1 === 'number' ? rule.value1 : parseFloat(String(rule.value1));
  const v2 = typeof rule.value2 === 'number' ? rule.value2 : parseFloat(String(rule.value2 ?? ''));

  let isValid = true;

  // Use date values if provided
  const compareV1 = dateV1 !== undefined ? dateV1 : v1;
  const compareV2 = dateV2 !== undefined ? dateV2 : v2;

  switch (rule.operator) {
    case 'between':
      isValid = value >= compareV1 && value <= (isNaN(compareV2) ? compareV1 : compareV2);
      break;
    case 'notBetween':
      isValid = value < compareV1 || value > (isNaN(compareV2) ? compareV1 : compareV2);
      break;
    case 'eq':
      isValid = value === compareV1;
      break;
    case 'neq':
      isValid = value !== compareV1;
      break;
    case 'gt':
      isValid = value > compareV1;
      break;
    case 'gte':
      isValid = value >= compareV1;
      break;
    case 'lt':
      isValid = value < compareV1;
      break;
    case 'lte':
      isValid = value <= compareV1;
      break;
  }

  if (!isValid) {
    return createErrorResult(rule, `Please enter a ${type} ${getOperatorText(rule.operator)} ${rule.value1}${rule.value2 ? ` and ${rule.value2}` : ''}.`);
  }

  return { isValid: true };
}

/**
 * Get human-readable operator text.
 */
function getOperatorText(operator: string): string {
  switch (operator) {
    case 'between': return 'between';
    case 'notBetween': return 'not between';
    case 'eq': return 'equal to';
    case 'neq': return 'not equal to';
    case 'gt': return 'greater than';
    case 'gte': return 'greater than or equal to';
    case 'lt': return 'less than';
    case 'lte': return 'less than or equal to';
    default: return '';
  }
}

/**
 * Create an error validation result.
 */
function createErrorResult(
  rule: DataValidationRule,
  defaultMessage: string,
): ValidationResult {
  return {
    isValid: false,
    errorMessage: rule.errorAlert?.message || defaultMessage,
    errorTitle: rule.errorAlert?.title || 'Invalid Entry',
    errorStyle: rule.errorAlert?.style || 'stop',
  };
}

/**
 * Parse list values from a source string.
 * Supports comma-separated values or range references.
 */
function parseListValues(source: string): string[] {
  // If it looks like a range reference (e.g., A1:A10), return as-is for now
  if (/^[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(source)) {
    return [source];
  }
  // Otherwise treat as comma-separated
  return source.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
}

/**
 * Generate a unique ID for a new validation rule.
 */
export function generateValidationId(): string {
  return `dv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a default data validation rule.
 */
export function createDefaultValidationRule(): DataValidationRule {
  return {
    id: generateValidationId(),
    type: 'whole',
    operator: 'gte',
    value1: 0,
    allowBlank: true,
    enabled: true,
    errorAlert: {
      style: 'stop',
      title: 'Invalid Entry',
      message: 'Please enter a valid number.',
    },
  };
}
