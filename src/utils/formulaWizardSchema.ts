// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Formula Wizard Data Model
 *
 * Structured function schemas and parameter definitions
 * for the Nested Formula Wizard.
 *
 * @see excel-formulas.md Section 2
 */

export type ParameterType = 'RANGE' | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'ANY' | 'FUNCTION';

export interface FunctionParameter {
  id: string;
  name: string;
  description: string;
  type: ParameterType;
  isRequired: boolean;
  isVariadic?: boolean;
  defaultValue?: string | number | boolean;
  validationRegex?: string;
  allowNestedFunction: boolean;
}

export interface FunctionDefinition {
  name: string;
  category: 'MATH' | 'STATISTICAL' | 'LOGICAL' | 'LOOKUP' | 'TEXT' | 'DATE' | 'INFO' | 'CONDITIONAL';
  description: string;
  parameters: FunctionParameter[];
  returnType: ParameterType;
  syntaxTemplate: string;
  /** Optional list of constraints/guidance notes displayed to the user. */
  constraints?: string[];
}

export interface ParameterNodeValue {
  parameterId: string;
  rawValue: string;
  isNestedFunction: boolean;
  nestedNodeId?: string;
}

export interface FormulaASTNode {
  id: string;
  parentId?: string;
  functionName: string;
  parameterValues: Record<string, ParameterNodeValue>;
}

// ─── Function Schema Definitions ──────────────────────────────────────────

export const FUNCTION_SCHEMAS: Record<string, FunctionDefinition> = {
  // Math functions
  SUM: {
    name: 'SUM',
    category: 'MATH',
    description: 'Adds all numbers in a range',
    returnType: 'NUMBER',
    syntaxTemplate: 'SUM(number1, [number2], ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Primary range or value to sum', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or numbers to add', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  SUBTOTAL: {
    name: 'SUBTOTAL',
    category: 'MATH',
    description: 'Returns a subtotal using a specified aggregate function; ignores hidden rows and nested subtotals',
    returnType: 'NUMBER',
    syntaxTemplate: 'SUBTOTAL(function_num, range1, [range2], ...)',
    parameters: [
      { id: 'function_code', name: 'Function_code', description: '1-11 includes hidden rows, 101-111 ignores hidden (9=SUM, 1=AVERAGE, 4=MAX, 5=MIN, 2=COUNT)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'range1', name: 'Range1', description: 'Primary range to aggregate', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'range2', name: 'Range2', description: 'Additional ranges (optional)', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: false },
    ],
  },
  AVERAGE: {
    name: 'AVERAGE',
    category: 'MATH',
    description: 'Returns the average of a range',
    returnType: 'NUMBER',
    syntaxTemplate: 'AVERAGE(number1, [number2], ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Primary range or value for arithmetic mean', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  ROUND: {
    name: 'ROUND',
    category: 'MATH',
    description: 'Rounds to specified digits',
    returnType: 'NUMBER',
    syntaxTemplate: 'ROUND(number, num_digits)',
    parameters: [
      { id: 'number', name: 'Number', description: 'Target value or nested calculation to round', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
      { id: 'num_digits', name: 'Num_digits', description: 'Number of decimal places', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  ABS: {
    name: 'ABS',
    category: 'MATH',
    description: 'Absolute value',
    returnType: 'NUMBER',
    syntaxTemplate: 'ABS(number)',
    parameters: [
      { id: 'number', name: 'Number', description: 'Value or nested function requiring absolute magnitude', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
    ],
  },
  COUNT: {
    name: 'COUNT',
    category: 'MATH',
    description: 'Counts numbers in a range',
    returnType: 'NUMBER',
    syntaxTemplate: 'COUNT(value1, [value2], ...)',
    parameters: [
      { id: 'value1', name: 'Value1', description: 'Range or value to count', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'value2', name: 'Value2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  COUNTA: {
    name: 'COUNTA',
    category: 'MATH',
    description: 'Counts non-empty cells',
    returnType: 'NUMBER',
    syntaxTemplate: 'COUNTA(value1, [value2], ...)',
    parameters: [
      { id: 'value1', name: 'Value1', description: 'Range or value to count', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'value2', name: 'Value2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  MIN: {
    name: 'MIN',
    category: 'MATH',
    description: 'Returns the smallest number',
    returnType: 'NUMBER',
    syntaxTemplate: 'MIN(number1, [number2], ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value to find minimum', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  MAX: {
    name: 'MAX',
    category: 'MATH',
    description: 'Returns the largest number',
    returnType: 'NUMBER',
    syntaxTemplate: 'MAX(number1, [number2], ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value to find maximum', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  PRODUCT: {
    name: 'PRODUCT',
    category: 'MATH',
    description: 'Multiplies all numbers',
    returnType: 'NUMBER',
    syntaxTemplate: 'PRODUCT(number1, [number2], ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value to multiply', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  SQRT: {
    name: 'SQRT',
    category: 'MATH',
    description: 'Square root',
    returnType: 'NUMBER',
    syntaxTemplate: 'SQRT(number)',
    parameters: [
      { id: 'number', name: 'Number', description: 'Value to take square root of', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
    ],
  },
  POWER: {
    name: 'POWER',
    category: 'MATH',
    description: 'Number raised to a power',
    returnType: 'NUMBER',
    syntaxTemplate: 'POWER(base, exponent)',
    parameters: [
      { id: 'base', name: 'Base', description: 'The base number', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
      { id: 'exponent', name: 'Exponent', description: 'The exponent', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  MOD: {
    name: 'MOD',
    category: 'MATH',
    description: 'Remainder after division',
    returnType: 'NUMBER',
    syntaxTemplate: 'MOD(dividend, divisor)',
    parameters: [
      { id: 'dividend', name: 'Dividend', description: 'The number to be divided', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
      { id: 'divisor', name: 'Divisor', description: 'The number to divide by', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  INT: {
    name: 'INT',
    category: 'MATH',
    description: 'Rounds down to nearest integer',
    returnType: 'NUMBER',
    syntaxTemplate: 'INT(number)',
    parameters: [
      { id: 'number', name: 'Number', description: 'Value to round down', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
    ],
  },

  // Conditional aggregation
  SUMIF: {
    name: 'SUMIF',
    category: 'CONDITIONAL',
    description: 'Sum cells matching criteria',
    returnType: 'NUMBER',
    syntaxTemplate: 'SUMIF(range, criteria, [sum_range])',
    parameters: [
      { id: 'range', name: 'Range', description: 'Evaluated range for conditional check', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'criteria', name: 'Criteria', description: 'Expression, number, or text determining sum', type: 'STRING', isRequired: true, allowNestedFunction: false },
      { id: 'sum_range', name: 'Sum_range', description: 'Actual cells to add (if different from range)', type: 'RANGE', isRequired: false, allowNestedFunction: false },
    ],
  },
  COUNTIF: {
    name: 'COUNTIF',
    category: 'CONDITIONAL',
    description: 'Count cells matching criteria',
    returnType: 'NUMBER',
    syntaxTemplate: 'COUNTIF(range, criteria)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Range of cells to count', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'criteria', name: 'Criteria', description: 'Criteria in form of number, expression, or text', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  AVERAGEIF: {
    name: 'AVERAGEIF',
    category: 'CONDITIONAL',
    description: 'Average of cells matching criteria',
    returnType: 'NUMBER',
    syntaxTemplate: 'AVERAGEIF(range, criteria, [avg_range])',
    parameters: [
      { id: 'range', name: 'Range', description: 'Evaluated range for conditional check', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'criteria', name: 'Criteria', description: 'Expression, number, or text', type: 'STRING', isRequired: true, allowNestedFunction: false },
      { id: 'avg_range', name: 'Avg_range', description: 'Actual cells to average (if different from range)', type: 'RANGE', isRequired: false, allowNestedFunction: false },
    ],
  },
  SUMIFS: {
    name: 'SUMIFS',
    category: 'CONDITIONAL',
    description: 'Sum with multiple criteria',
    returnType: 'NUMBER',
    syntaxTemplate: 'SUMIFS(sum_range, crit_range1, crit1, ...)',
    parameters: [
      { id: 'sum_range', name: 'Sum_range', description: 'Range to sum', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'crit_range1', name: 'Crit_range1', description: 'First criteria range', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'crit1', name: 'Crit1', description: 'First criteria', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  COUNTIFS: {
    name: 'COUNTIFS',
    category: 'CONDITIONAL',
    description: 'Count with multiple criteria',
    returnType: 'NUMBER',
    syntaxTemplate: 'COUNTIFS(crit_range1, crit1, ...)',
    parameters: [
      { id: 'crit_range1', name: 'Crit_range1', description: 'First criteria range', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'crit1', name: 'Crit1', description: 'First criteria', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },

  // Logical
  IF: {
    name: 'IF',
    category: 'LOGICAL',
    description: 'Conditional: if true then A else B',
    returnType: 'ANY',
    syntaxTemplate: 'IF(condition, true_val, [false_val])',
    parameters: [
      { id: 'condition', name: 'Condition', description: 'Expression that evaluates to TRUE or FALSE', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
      { id: 'true_val', name: 'True_val', description: 'Value returned when condition is TRUE', type: 'ANY', isRequired: true, allowNestedFunction: true },
      { id: 'false_val', name: 'False_val', description: 'Value returned when condition is FALSE', type: 'ANY', isRequired: false, allowNestedFunction: true },
    ],
  },
  AND: {
    name: 'AND',
    category: 'LOGICAL',
    description: 'True if all conditions are true',
    returnType: 'BOOLEAN',
    syntaxTemplate: 'AND(cond1, [cond2], ...)',
    parameters: [
      { id: 'cond1', name: 'Cond1', description: 'First condition', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
      { id: 'cond2', name: 'Cond2', description: 'Additional conditions', type: 'BOOLEAN', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  OR: {
    name: 'OR',
    category: 'LOGICAL',
    description: 'True if any condition is true',
    returnType: 'BOOLEAN',
    syntaxTemplate: 'OR(cond1, [cond2], ...)',
    parameters: [
      { id: 'cond1', name: 'Cond1', description: 'First condition', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
      { id: 'cond2', name: 'Cond2', description: 'Additional conditions', type: 'BOOLEAN', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  NOT: {
    name: 'NOT',
    category: 'LOGICAL',
    description: 'Reverses a logical value',
    returnType: 'BOOLEAN',
    syntaxTemplate: 'NOT(condition)',
    parameters: [
      { id: 'condition', name: 'Condition', description: 'Condition to reverse', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
    ],
  },
  IFERROR: {
    name: 'IFERROR',
    category: 'LOGICAL',
    description: 'Returns value if no error, else alt',
    returnType: 'ANY',
    syntaxTemplate: 'IFERROR(value, altValue)',
    parameters: [
      { id: 'value', name: 'Value', description: 'Value to check for errors', type: 'ANY', isRequired: true, allowNestedFunction: true },
      { id: 'altValue', name: 'AltValue', description: 'Value to return if error', type: 'ANY', isRequired: true, allowNestedFunction: true },
    ],
  },

  // Text
  CONCAT: {
    name: 'CONCAT',
    category: 'TEXT',
    description: 'Joins text strings',
    returnType: 'STRING',
    syntaxTemplate: 'CONCAT(text1, [text2], ...)',
    parameters: [
      { id: 'text1', name: 'Text1', description: 'First text string', type: 'STRING', isRequired: true, allowNestedFunction: true },
      { id: 'text2', name: 'Text2', description: 'Additional text strings', type: 'STRING', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  CONCATENATE: {
    name: 'CONCATENATE',
    category: 'TEXT',
    description: 'Joins text strings (alias)',
    returnType: 'STRING',
    syntaxTemplate: 'CONCATENATE(text1, ...)',
    parameters: [
      { id: 'text1', name: 'Text1', description: 'First text string', type: 'STRING', isRequired: true, allowNestedFunction: true },
      { id: 'text2', name: 'Text2', description: 'Additional text strings', type: 'STRING', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  LEFT: {
    name: 'LEFT',
    category: 'TEXT',
    description: 'First N characters',
    returnType: 'STRING',
    syntaxTemplate: 'LEFT(text, [count])',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to extract from', type: 'STRING', isRequired: true, allowNestedFunction: false },
      { id: 'count', name: 'Count', description: 'Number of characters (default 1)', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
    ],
  },
  RIGHT: {
    name: 'RIGHT',
    category: 'TEXT',
    description: 'Last N characters',
    returnType: 'STRING',
    syntaxTemplate: 'RIGHT(text, [count])',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to extract from', type: 'STRING', isRequired: true, allowNestedFunction: false },
      { id: 'count', name: 'Count', description: 'Number of characters (default 1)', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
    ],
  },
  MID: {
    name: 'MID',
    category: 'TEXT',
    description: 'Substring from position',
    returnType: 'STRING',
    syntaxTemplate: 'MID(text, start, count)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to extract from', type: 'STRING', isRequired: true, allowNestedFunction: false },
      { id: 'start', name: 'Start', description: 'Starting position (1-based)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'count', name: 'Count', description: 'Number of characters to extract', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  LEN: {
    name: 'LEN',
    category: 'TEXT',
    description: 'Length of text',
    returnType: 'NUMBER',
    syntaxTemplate: 'LEN(text)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to measure', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  LOWER: {
    name: 'LOWER',
    category: 'TEXT',
    description: 'Converts to lowercase',
    returnType: 'STRING',
    syntaxTemplate: 'LOWER(text)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to convert', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  UPPER: {
    name: 'UPPER',
    category: 'TEXT',
    description: 'Converts to uppercase',
    returnType: 'STRING',
    syntaxTemplate: 'UPPER(text)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to convert', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  TRIM: {
    name: 'TRIM',
    category: 'TEXT',
    description: 'Removes extra whitespace',
    returnType: 'STRING',
    syntaxTemplate: 'TRIM(text)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to trim', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  CLEAN: {
    name: 'CLEAN',
    category: 'TEXT',
    description: 'Removes non-printable characters',
    returnType: 'STRING',
    syntaxTemplate: 'CLEAN(text)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to clean', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  TEXT: {
    name: 'TEXT',
    category: 'TEXT',
    description: 'Formats a number as text',
    returnType: 'STRING',
    syntaxTemplate: 'TEXT(number, format)',
    parameters: [
      { id: 'number', name: 'Number', description: 'Value to format', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
      { id: 'format', name: 'Format', description: 'Format string (e.g., "0.00")', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
  VALUE: {
    name: 'VALUE',
    category: 'TEXT',
    description: 'Converts text to number',
    returnType: 'NUMBER',
    syntaxTemplate: 'VALUE(text)',
    parameters: [
      { id: 'text', name: 'Text', description: 'Text string to convert', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },

  // Statistical
  MEDIAN: {
    name: 'MEDIAN',
    category: 'STATISTICAL',
    description: 'Middle value in a set',
    returnType: 'NUMBER',
    syntaxTemplate: 'MEDIAN(number1, ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  MODE: {
    name: 'MODE',
    category: 'STATISTICAL',
    description: 'Most frequent value',
    returnType: 'NUMBER',
    syntaxTemplate: 'MODE(number1, ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  STDEV: {
    name: 'STDEV',
    category: 'STATISTICAL',
    description: 'Standard deviation',
    returnType: 'NUMBER',
    syntaxTemplate: 'STDEV(number1, ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  VAR: {
    name: 'VAR',
    category: 'STATISTICAL',
    description: 'Variance',
    returnType: 'NUMBER',
    syntaxTemplate: 'VAR(number1, ...)',
    parameters: [
      { id: 'number1', name: 'Number1', description: 'Range or value', type: 'RANGE', isRequired: true, allowNestedFunction: true },
      { id: 'number2', name: 'Number2', description: 'Additional ranges or values', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
    ],
  },
  LARGE: {
    name: 'LARGE',
    category: 'STATISTICAL',
    description: 'K-th largest value',
    returnType: 'NUMBER',
    syntaxTemplate: 'LARGE(range, k)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Range of values', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'k', name: 'K', description: 'Position from largest (1 = largest)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  SMALL: {
    name: 'SMALL',
    category: 'STATISTICAL',
    description: 'K-th smallest value',
    returnType: 'NUMBER',
    syntaxTemplate: 'SMALL(range, k)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Range of values', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'k', name: 'K', description: 'Position from smallest (1 = smallest)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },

  // Date
  NOW: {
    name: 'NOW',
    category: 'DATE',
    description: 'Current date and time',
    returnType: 'NUMBER',
    syntaxTemplate: 'NOW()',
    parameters: [],
  },
  TODAY: {
    name: 'TODAY',
    category: 'DATE',
    description: 'Current date',
    returnType: 'NUMBER',
    syntaxTemplate: 'TODAY()',
    parameters: [],
  },
  YEAR: {
    name: 'YEAR',
    category: 'DATE',
    description: 'Year from a date',
    returnType: 'NUMBER',
    syntaxTemplate: 'YEAR(date)',
    parameters: [
      { id: 'date', name: 'Date', description: 'Date value', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
    ],
  },
  MONTH: {
    name: 'MONTH',
    category: 'DATE',
    description: 'Month from a date',
    returnType: 'NUMBER',
    syntaxTemplate: 'MONTH(date)',
    parameters: [
      { id: 'date', name: 'Date', description: 'Date value', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
    ],
  },
  DAY: {
    name: 'DAY',
    category: 'DATE',
    description: 'Day from a date',
    returnType: 'NUMBER',
    syntaxTemplate: 'DAY(date)',
    parameters: [
      { id: 'date', name: 'Date', description: 'Date value', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
    ],
  },
  DATE: {
    name: 'DATE',
    category: 'DATE',
    description: 'Creates a date',
    returnType: 'NUMBER',
    syntaxTemplate: 'DATE(year, month, day)',
    parameters: [
      { id: 'year', name: 'Year', description: 'Year', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'month', name: 'Month', description: 'Month (1-12)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'day', name: 'Day', description: 'Day (1-31)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  WEEKDAY: {
    name: 'WEEKDAY',
    category: 'DATE',
    description: 'Day of week (1-7)',
    returnType: 'NUMBER',
    syntaxTemplate: 'WEEKDAY(date, [type])',
    parameters: [
      { id: 'date', name: 'Date', description: 'Date value', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
      { id: 'type', name: 'Type', description: 'Type (1=default, 2=Mon=1, 3=Sun=0)', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
    ],
  },

  // Info
  ROW: {
    name: 'ROW',
    category: 'INFO',
    description: 'Row number of a cell',
    returnType: 'NUMBER',
    syntaxTemplate: 'ROW([cell])',
    parameters: [
      { id: 'cell', name: 'Cell', description: 'Cell reference (optional)', type: 'RANGE', isRequired: false, allowNestedFunction: false },
    ],
  },
  COLUMN: {
    name: 'COLUMN',
    category: 'INFO',
    description: 'Column number of a cell',
    returnType: 'NUMBER',
    syntaxTemplate: 'COLUMN([cell])',
    parameters: [
      { id: 'cell', name: 'Cell', description: 'Cell reference (optional)', type: 'RANGE', isRequired: false, allowNestedFunction: false },
    ],
  },
  ROWS: {
    name: 'ROWS',
    category: 'INFO',
    description: 'Number of rows in range',
    returnType: 'NUMBER',
    syntaxTemplate: 'ROWS(range)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Range reference', type: 'RANGE', isRequired: true, allowNestedFunction: false },
    ],
  },
  COLUMNS: {
    name: 'COLUMNS',
    category: 'INFO',
    description: 'Number of columns in range',
    returnType: 'NUMBER',
    syntaxTemplate: 'COLUMNS(range)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Range reference', type: 'RANGE', isRequired: true, allowNestedFunction: false },
    ],
  },

  // Lookup
  VLOOKUP: {
    name: 'VLOOKUP',
    category: 'LOOKUP',
    description: 'Vertical lookup in a table',
    returnType: 'ANY',
    syntaxTemplate: 'VLOOKUP(value, table, col, [exact])',
    constraints: [
      'Approximate match (default) requires the first column sorted in ascending order',
      'Column index is 1-based (1 = first column of the table)',
      'Returns #N/A if value not found (exact match) or value is smaller than all entries (approximate)',
    ],
    parameters: [
      { id: 'value', name: 'Value', description: 'Value to look up', type: 'ANY', isRequired: true, allowNestedFunction: true },
      { id: 'table', name: 'Table', description: 'Table range to search', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'col', name: 'Col', description: 'Column index in table (1-based)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'exact', name: 'Exact', description: 'Exact match (FALSE) or approximate (TRUE)', type: 'BOOLEAN', isRequired: false, allowNestedFunction: false, defaultValue: false },
    ],
  },
  HLOOKUP: {
    name: 'HLOOKUP',
    category: 'LOOKUP',
    description: 'Horizontal lookup in a table',
    returnType: 'ANY',
    syntaxTemplate: 'HLOOKUP(value, table, row, [exact])',
    constraints: [
      'Approximate match (default) requires the first row sorted in ascending order (left to right)',
      'Row index is 1-based (1 = first row of the table)',
      'Returns #N/A if value not found (exact match) or value is smaller than all entries (approximate)',
    ],
    parameters: [
      { id: 'value', name: 'Value', description: 'Value to look up', type: 'ANY', isRequired: true, allowNestedFunction: true },
      { id: 'table', name: 'Table', description: 'Table range to search', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'row', name: 'Row', description: 'Row index in table (1-based)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'exact', name: 'Exact', description: 'Exact match (FALSE) or approximate (TRUE)', type: 'BOOLEAN', isRequired: false, allowNestedFunction: false, defaultValue: false },
    ],
  },
  INDEX: {
    name: 'INDEX',
    category: 'LOOKUP',
    description: 'Value at row/col in range',
    returnType: 'ANY',
    syntaxTemplate: 'INDEX(range, row, [col])',
    constraints: [
      'Row and column numbers are 1-based (1 = first row/column)',
      'Returns #REF! if row or column exceeds range dimensions',
    ],
    parameters: [
      { id: 'range', name: 'Range', description: 'Range to index', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'row', name: 'Row', description: 'Row number (1-based)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'col', name: 'Col', description: 'Column number (1-based)', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
    ],
  },
  MATCH: {
    name: 'MATCH',
    category: 'LOOKUP',
    description: 'Position of value in range',
    returnType: 'NUMBER',
    syntaxTemplate: 'MATCH(value, range, [type])',
    constraints: [
      'Type 0: exact match — range can be unsorted',
      'Type 1 (default): largest value ≤ lookup — range must be sorted ascending',
      'Type -1: smallest value ≥ lookup — range must be sorted descending',
      'Returns #N/A if no match found',
    ],
    parameters: [
      { id: 'value', name: 'Value', description: 'Value to find', type: 'ANY', isRequired: true, allowNestedFunction: true },
      { id: 'range', name: 'Range', description: 'Range to search', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'type', name: 'Type', description: 'Match type (0=exact, 1=less, -1=greater)', type: 'NUMBER', isRequired: false, allowNestedFunction: false, defaultValue: 1 },
    ],
  },
  OFFSET: {
    name: 'OFFSET',
    category: 'LOOKUP',
    description: 'Range offset from a cell',
    returnType: 'RANGE',
    syntaxTemplate: 'OFFSET(cell, rows, cols, [h], [w])',
    parameters: [
      { id: 'cell', name: 'Cell', description: 'Starting cell reference', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'rows', name: 'Rows', description: 'Rows to offset (positive=down)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'cols', name: 'Cols', description: 'Columns to offset (positive=right)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'h', name: 'H', description: 'Height of returned range', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
      { id: 'w', name: 'W', description: 'Width of returned range', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
    ],
  },

  // ── Statistical (expanded) ────────────────────────────────────
  RANK: {
    name: 'RANK',
    category: 'STATISTICAL',
    description: 'Rank of a number in a data set',
    returnType: 'NUMBER',
    syntaxTemplate: 'RANK(number, range, [order])',
    parameters: [
      { id: 'number', name: 'Number', description: 'Value to rank', type: 'NUMBER', isRequired: true, allowNestedFunction: true },
      { id: 'range', name: 'Range', description: 'Data set to rank against', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'order', name: 'Order', description: '0=descending (default), 1=ascending', type: 'NUMBER', isRequired: false, allowNestedFunction: false },
    ],
  },
  QUARTILE: {
    name: 'QUARTILE',
    category: 'STATISTICAL',
    description: 'Quartile of a data set (0=min, 1=25%, 2=median, 3=75%, 4=max)',
    returnType: 'NUMBER',
    syntaxTemplate: 'QUARTILE(range, quart)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Data set', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'quart', name: 'Quart', description: 'Quartile (0-4)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },
  PERCENTILE: {
    name: 'PERCENTILE',
    category: 'STATISTICAL',
    description: 'K-th percentile of a data set (k between 0 and 1)',
    returnType: 'NUMBER',
    syntaxTemplate: 'PERCENTILE(range, k)',
    parameters: [
      { id: 'range', name: 'Range', description: 'Data set', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'k', name: 'K', description: 'Percentile value (0-1)', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
    ],
  },

  // ── Conditional Aggregation (expanded) ─────────────────────────
  AVERAGEIFS: {
    name: 'AVERAGEIFS',
    category: 'CONDITIONAL',
    description: 'Average of cells matching multiple criteria',
    returnType: 'NUMBER',
    syntaxTemplate: 'AVERAGEIFS(avgRange, critRange1, crit1, ...)',
    parameters: [
      { id: 'avg_range', name: 'Avg_range', description: 'Range to average', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'crit_range1', name: 'Crit_range1', description: 'First criteria range', type: 'RANGE', isRequired: true, allowNestedFunction: false },
      { id: 'crit1', name: 'Crit1', description: 'First criteria', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },

  // ── Date (expanded) ───────────────────────────────────────────
  DATEDIF: {
    name: 'DATEDIF',
    category: 'DATE',
    description: 'Difference between two dates in years, months, or days',
    returnType: 'NUMBER',
    syntaxTemplate: 'DATEDIF(start, end, unit)',
    constraints: [
      'Unit must be "Y" (years), "M" (months), or "D" (days)',
      'Returns #VALUE! for invalid unit or if start date > end date',
    ],
    parameters: [
      { id: 'start', name: 'Start', description: 'Start date', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'end', name: 'End', description: 'End date', type: 'NUMBER', isRequired: true, allowNestedFunction: false },
      { id: 'unit', name: 'Unit', description: 'Y=years, M=months, D=days', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },

  // ── Lookup (expanded) ─────────────────────────────────────────
  INDIRECT: {
    name: 'INDIRECT',
    category: 'LOOKUP',
    description: 'Reference specified by a text string',
    returnType: 'ANY',
    syntaxTemplate: 'INDIRECT(refText)',
    parameters: [
      { id: 'ref_text', name: 'Ref_text', description: 'Reference as text', type: 'STRING', isRequired: true, allowNestedFunction: false },
    ],
  },
};

/** Map for O(1) lookup. */
const SCHEMA_MAP = new Map<string, FunctionDefinition>();
for (const schema of Object.values(FUNCTION_SCHEMAS)) {
  SCHEMA_MAP.set(schema.name, schema);
}

/**
 * Gets the function schema by name.
 */
export function getFunctionSchema(name: string): FunctionDefinition | null {
  return SCHEMA_MAP.get(name.toUpperCase()) ?? null;
}

/**
 * Gets all function schemas.
 */
export function getAllFunctionSchemas(): FunctionDefinition[] {
  return Object.values(FUNCTION_SCHEMAS);
}

/**
 * Gets function names for a specific category.
 */
export function getFunctionsByCategory(category: string): FunctionDefinition[] {
  return Object.values(FUNCTION_SCHEMAS).filter((fn) => fn.category === category);
}

/**
 * Gets all category names.
 */
export function getCategories(): string[] {
  return [...new Set(Object.values(FUNCTION_SCHEMAS).map((fn) => fn.category))];
}
