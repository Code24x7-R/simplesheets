/**
 * Formula Wizard AST Compiler
 *
 * Converts the wizard's internal AST representation into
 * valid spreadsheet formula syntax.
 *
 * @see excel-formulas.md Section 6
 */

import type { FormulaASTNode } from './formulaWizardSchema';
import { getFunctionSchema } from './formulaWizardSchema';
import { colToLetter } from '../types';

/**
 * Compiles a FormulaASTNode tree into a valid spreadsheet formula string.
 *
 * Recursively resolves nested functions and trims trailing optional
 * empty parameters.
 *
 * @param node - The AST node to compile
 * @param nodeMap - Map of all AST nodes (for resolving nested references)
 * @returns The compiled formula string (without leading '=')
 */
export function compileASTNodeToString(
  node: FormulaASTNode,
  nodeMap: Map<string, FormulaASTNode>
): string {
  const args: string[] = [];

  // Get the schema for parameter ordering
  const schema = getFunctionSchema(node.functionName);

  if (!schema) {
    // Unknown function: use raw parameter values in insertion order
    for (const paramVal of Object.values(node.parameterValues)) {
      if (paramVal.isNestedFunction && paramVal.nestedNodeId) {
        const childNode = nodeMap.get(paramVal.nestedNodeId);
        if (childNode) {
          args.push(compileASTNodeToString(childNode, nodeMap));
        }
      } else if (paramVal.rawValue) {
        args.push(paramVal.rawValue);
      }
    }
    return `${node.functionName}(${args.join(', ')})`;
  }

  // Use schema parameter order
  for (const param of schema.parameters) {
    const paramVal = node.parameterValues[param.id];
    if (!paramVal) {
      if (param.isRequired) {
        args.push(''); // Placeholder for incomplete syntax
      }
      continue;
    }

    if (paramVal.isNestedFunction && paramVal.nestedNodeId) {
      const childNode = nodeMap.get(paramVal.nestedNodeId);
      if (childNode) {
        args.push(compileASTNodeToString(childNode, nodeMap));
      } else {
        args.push('');
      }
    } else {
      args.push(paramVal.rawValue);
    }
  }

  // Handle extra variadic parameters (B-010 fix)
  // When a function accepts variadic args (e.g., SUM(number1, [number2], ...)),
  // the import function stores extra args with IDs like "number2_1", "number2_2", etc.
  // We need to collect and compile these in order.
  const lastParam = schema.parameters[schema.parameters.length - 1];
  if (lastParam?.isVariadic) {
    const variadicPrefix = `${lastParam.id}_`;
    const variadicParams: Array<{ index: string; value: string }> = [];

    for (const [paramId, paramVal] of Object.entries(node.parameterValues)) {
      if (paramId.startsWith(variadicPrefix)) {
        const index = paramId.slice(variadicPrefix.length);
        let compiled = '';
        if (paramVal.isNestedFunction && paramVal.nestedNodeId) {
          const childNode = nodeMap.get(paramVal.nestedNodeId);
          if (childNode) {
            compiled = compileASTNodeToString(childNode, nodeMap);
          }
        } else {
          compiled = paramVal.rawValue;
        }
        variadicParams.push({ index, value: compiled });
      }
    }

    // Sort by numeric index to ensure correct order
    variadicParams.sort((a, b) => parseInt(a.index, 10) - parseInt(b.index, 10));
    for (const vp of variadicParams) {
      args.push(vp.value);
    }
  }

  // Trim trailing optional empty parameters
  while (args.length > 0 && args[args.length - 1] === '') {
    args.pop();
  }

  return `${node.functionName}(${args.join(', ')})`;
}

/**
 * Compiles a full AST tree to a formula string (with leading '=').
 */
export function compileASTToFormula(
  rootNode: FormulaASTNode,
  nodeMap: Map<string, FormulaASTNode>
): string {
  return `=${compileASTNodeToString(rootNode, nodeMap)}`;
}

/**
 * Validates a parameter value against its expected type.
 *
 * @param value - The raw string value entered by the user
 * @param paramType - The expected parameter type
 * @returns An error message if invalid, or null if valid
 */
export function validateParameter(value: string, paramType: string): string | null {
  if (!value || value.trim() === '') {
    return null; // Empty values are handled by required/optional checks
  }

  switch (paramType) {
    case 'NUMBER':
      // Check if it's a valid number or a cell reference (which could be numeric)
      if (isNumeric(value) || isCellRef(value) || isRange(value)) {
        return null;
      }
      return 'Parameter expects a numeric value or valid range.';

    case 'RANGE':
      if (isRange(value) || isCellRef(value)) {
        return null;
      }
      return 'Parameter expects a valid range (e.g., A1:B10).';

    case 'STRING':
      // String values can be quoted text, cell refs, or expressions
      if (value.startsWith('"') && value.endsWith('"')) {
        return null;
      }
      if (isCellRef(value) || isRange(value)) {
        return null;
      }
      // Criteria expressions like ">10", "<=5", etc.
      if (/^[<>=!]+/.test(value)) {
        return null;
      }
      return null; // Allow any string for criteria flexibility

    case 'BOOLEAN':
      if (['TRUE', 'FALSE', '0', '1'].includes(value.toUpperCase())) {
        return null;
      }
      return 'Parameter expects a boolean value (TRUE/FALSE).';

    case 'FUNCTION':
      // Should be a nested function reference
      return null;

    case 'ANY':
    default:
      return null;
  }
}

/**
 * Checks if a value is numeric.
 */
function isNumeric(value: string): boolean {
  return !isNaN(Number(value)) && value.trim() !== '';
}

/**
 * Checks if a value looks like a cell reference.
 */
function isCellRef(value: string): boolean {
  return /^\$?[A-Za-z]+\$?\d+$/.test(value);
}

/**
 * Checks if a value looks like a range.
 */
function isRange(value: string): boolean {
  return /^\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+$/.test(value);
}

/**
 * Checks if a formula would create a circular reference.
 *
 * @param formula - The formula string to check
 * @param targetRow - The row of the target cell
 * @param targetCol - The column of the target cell
 * @returns true if the formula references the target cell
 */
export function checkCircularReference(
  formula: string,
  targetRow: number,
  targetCol: number
): boolean {
  if (!formula || !formula.startsWith('=')) return false;

  const body = formula.slice(1);
  const targetRef = colToLetter(targetCol) + (targetRow + 1);
  const targetRefLower = targetRef.toLowerCase();

  // Check for direct cell reference to target
  const cellRefRegex = /\$?[a-z]+\$?\d+/gi;
  const matches = body.match(cellRefRegex);

  if (matches) {
    for (const match of matches) {
      if (match.toLowerCase() === targetRefLower) {
        return true;
      }
    }
  }

  // Check if target is within any range
  const rangeRegex = /\$?[a-z]+\$?\d+:\$?[a-z]+\$?\d+/gi;
  const rangeMatches = body.match(rangeRegex);

  if (rangeMatches) {
    for (const range of rangeMatches) {
      if (isCellInRange(targetRefLower, range)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Parses a cell reference string (e.g., "$B$5") into {row, col}.
 * Returns null if the string is not a valid cell reference.
 */
function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^\$?([a-z]+)\$?(\d+)$/i);
  if (!match) return null;

  const colStr = match[1].toLowerCase();
  const row = parseInt(match[2], 10) - 1; // Convert to 0-indexed

  // Convert column letters to 0-indexed column number
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 'a'.charCodeAt(0) + 1);
  }
  col -= 1; // Convert to 0-indexed

  return { row, col };
}

/**
 * Checks if a target cell is within a range (e.g., "A1:B5").
 * Uses proper numeric comparison instead of substring matching.
 */
function isCellInRange(targetRefLower: string, range: string): boolean {
  const parts = range.split(':');
  if (parts.length !== 2) return false;

  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  const target = parseCellRef(targetRefLower);

  if (!start || !end || !target) return false;

  // Normalize range bounds (start might be greater than end)
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);

  // Check if target is within the range bounds
  return (
    target.row >= minRow &&
    target.row <= maxRow &&
    target.col >= minCol &&
    target.col <= maxCol
  );
}

/**
 * Generates a unique node ID.
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a new AST node for a function.
 */
export function createASTNode(
  functionName: string,
  parentId?: string
): FormulaASTNode {
  return {
    id: generateNodeId(),
    parentId,
    functionName: functionName.toUpperCase(),
    parameterValues: {},
  };
}
