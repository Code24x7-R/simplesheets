/**
 * Formula Wizard Import Utility
 *
 * Converts parsed formula AST (from formulaParser) into the wizard's
 * internal AST representation (FormulaASTNode tree).
 *
 * This enables pre-populating the FormulaWizard when the user opens it
 * on a cell that already contains a formula.
 */

import type { ASTNode } from './formulaParser';
import { parseFormula, cellRefToString, rangeToString } from './formulaParser';
import type { FormulaASTNode, ParameterNodeValue } from './formulaWizardSchema';
import { getFunctionSchema } from './formulaWizardSchema';

/**
 * Converts any AST node to its string representation.
 * Used for nodes that can't be represented as wizard parameters
 * (binary ops, unary ops, literals, cell refs).
 */
function astNodeToString(node: ASTNode): string {
  switch (node.type) {
    case 'number':
      return String(node.value);
    case 'string':
      return `"${node.value}"`;
    case 'boolean':
      return node.value ? 'TRUE' : 'FALSE';
    case 'cell':
      return cellRefToString(node);
    case 'range':
      return rangeToString(node);
    case 'binary': {
      const left = astNodeToString(node.left);
      const right = astNodeToString(node.right);
      return `${left} ${node.op} ${right}`;
    }
    case 'unary': {
      const operand = astNodeToString(node.operand);
      return `${node.op}${operand}`;
    }
    case 'function': {
      const args = node.args.map(astNodeToString).join(', ');
      return `${node.name}(${args})`;
    }
    /* istanbul ignore next - parser only produces known node types */
    default:
      return '';
  }
}

/**
 * Generates a unique node ID for the wizard AST.
 */
function generateNodeId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
/**
 * Result of importing a formula into wizard AST.
 */
export interface ImportResult {
  /** Root node of the wizard AST */
  root: FormulaASTNode;
  /** Map of all nodes by ID (for resolving nested references) */
  nodeMap: Map<string, FormulaASTNode>;
}

/**
 * Imports a formula string into the wizard's AST representation.
 *
 * @param formula - The formula string (e.g., "=SUM(B4:D4)")
 * @returns ImportResult with root node and node map, or null if the formula
 *          cannot be imported (no outer function, syntax error, etc.)
 *
 * @example
 * ```typescript
 * const result = importFormulaToWizard("=IF(A1>0, SUM(B4:D4), 0)");
 * if (result) {
 *   // result.root is the IF node
 *   // result.root.parameterValues['condition'].rawValue === "A1>0"
 *   // result.root.parameterValues['true_val'].isNestedFunction === true
 * }
 * ```
 */
export function importFormulaToWizard(formula: string): ImportResult | null {
  if (!formula || typeof formula !== 'string') {
    return null;
  }

  // Strip leading '=' if present
  const body = formula.startsWith('=') ? formula.slice(1) : formula;

  if (!body.trim()) {
    return null;
  }

  let ast: ASTNode;
  try {
    ast = parseFormula(body);
  } catch {
    // Syntax error — can't import
    return null;
  }

  // Only function-rooted formulas can be imported
  if (ast.type !== 'function') {
    return null;
  }

  // Build the wizard AST tree
  const nodeMap = new Map<string, FormulaASTNode>();
  const root = buildWizardTree(ast, nodeMap, undefined);

  return { root, nodeMap };
}

/**
 * Recursively builds the wizard AST tree from a parser function node.
 */
function buildWizardTree(
  funcNode: { type: 'function'; name: string; args: ASTNode[] },
  nodeMap: Map<string, FormulaASTNode>,
  parentId: string | undefined
): FormulaASTNode {
  const schema = getFunctionSchema(funcNode.name);
  const nodeId = generateNodeId();

  const parameterValues: Record<string, ParameterNodeValue> = {};

  if (schema) {
    // Map positional arguments to schema parameter IDs
    for (let i = 0; i < schema.parameters.length; i++) {
      const param = schema.parameters[i];
      const arg = funcNode.args[i];

      if (!arg) {
        continue;
      }

      if (arg.type === 'function' && param.allowNestedFunction) {
        // Nested function — recursively build child tree
        const childNode = buildWizardTree(arg, nodeMap, nodeId);
        nodeMap.set(childNode.id, childNode);
        parameterValues[param.id] = {
          parameterId: param.id,
          rawValue: '',
          isNestedFunction: true,
          nestedNodeId: childNode.id,
        };
      } else {
        parameterValues[param.id] = {
          parameterId: param.id,
          rawValue: astNodeToString(arg),
          isNestedFunction: false,
        };
      }
    }

    // Handle extra arguments (variadic)
    const lastParam = schema.parameters[schema.parameters.length - 1];
    if (lastParam?.isVariadic) {
      for (let i = schema.parameters.length; i < funcNode.args.length; i++) {
        const arg = funcNode.args[i];
        const variadicId = `${lastParam.id}_${i - schema.parameters.length + 1}`;
        if (arg.type === 'function' && lastParam.allowNestedFunction) {
          const childNode = buildWizardTree(arg, nodeMap, nodeId);
          nodeMap.set(childNode.id, childNode);
          parameterValues[variadicId] = {
            parameterId: variadicId,
            rawValue: '',
            isNestedFunction: true,
            nestedNodeId: childNode.id,
          };
        } else {
          parameterValues[variadicId] = {
            parameterId: variadicId,
            rawValue: astNodeToString(arg),
            isNestedFunction: false,
          };
        }
      }
    }
  } else {
    // Unknown function — treat all args as raw strings
    funcNode.args.forEach((arg, index) => {
      const paramId = `arg${index}`;
      parameterValues[paramId] = {
        parameterId: paramId,
        rawValue: astNodeToString(arg),
        isNestedFunction: false,
      };
    });
  }

  const node: FormulaASTNode = {
    id: nodeId,
    parentId,
    functionName: funcNode.name.toUpperCase(),
    parameterValues,
  };

  nodeMap.set(nodeId, node);
  return node;
}

/**
 * Checks if a formula string can be imported into the wizard.
 * Useful for determining whether to show autocomplete or pre-populate.
 *
 * @param formula - The formula string to check
 * @returns true if the formula starts with a recognized function
 */
export function canImportFormula(formula: string): boolean {
  if (!formula || typeof formula !== 'string') {
    return false;
  }

  const body = formula.startsWith('=') ? formula.slice(1) : formula;
  if (!body.trim()) {
    return false;
  }

  let ast: ASTNode;
  try {
    ast = parseFormula(body);
  } catch {
    return false;
  }

  if (ast.type !== 'function') {
    return false;
  }

  // Check if the function is in the wizard's schema
  return getFunctionSchema(ast.name) !== null;
}
