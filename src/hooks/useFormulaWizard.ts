import { useState, useCallback } from 'react';
import type { FormulaASTNode, FunctionDefinition } from '../utils/formulaWizardSchema';
import { getFunctionSchema } from '../utils/formulaWizardSchema';
import { compileASTNodeToString } from '../utils/formulaWizardCompiler';
import { importFormulaToWizard } from '../utils/formulaWizardImport';

/**
 * Wizard state machine states.
 * @see excel-formulas.md Section 1
 */
export type WizardState =
  | 'INACTIVE'      // Spreadsheet in SELECT or EDIT
  | 'AUTOCOMPLETE'  // Showing function picker (no formula to import)
  | 'WIZARD_ROOT'   // Top-level function parameter
  | 'NESTED_STEP'   // Evaluating child parameter (depth N)
  | 'POINT_SELECTION'; // Grid mouse/keyboard range mode

/**
 * Maximum nesting depth allowed.
 * @see excel-formulas.md Section 7
 */
export const MAX_NESTING_DEPTH = 8;

/**
 * Wizard state and actions.
 */
export interface WizardStateData {
  /** Current state of the wizard */
  state: WizardState;
  /** Stack of AST nodes (for nested navigation) */
  nodeStack: FormulaASTNode[];
  /** Map of all AST nodes by ID */
  nodeMap: Map<string, FormulaASTNode>;
  /** Current active node (top of stack) */
  activeNode: FormulaASTNode | null;
  /** Current nesting depth */
  nestingDepth: number;
  /** Compiled formula string */
  compiledFormula: string;
  /** Whether the wizard is open */
  isOpen: boolean;
  /** Target cell reference for the formula */
  targetCellRef: string | null;
  /** Index of the parameter currently being edited for range selection */
  pointSelectionParamIndex: number | null;
  /** Function schema for the active node */
  activeSchema: FunctionDefinition | null;
}

/**
 * Hook return type.
 */
export interface UseFormulaWizardResult {
  /** Current wizard state */
  wizard: WizardStateData;
  /** Open the wizard with a function */
  openWizard: (functionName: string, targetCellRef?: string) => void;
  /** Import an existing formula into the wizard */
  importFormula: (formula: string, targetCellRef?: string) => boolean;
  /** Open the wizard with autocomplete picker (for cells without formulas) */
  openWithAutocomplete: (targetCellRef?: string) => void;
  /** Close the wizard */
  closeWizard: () => void;
  /** Set a parameter value */
  setParameter: (paramId: string, value: string, isNestedFunction?: boolean, nestedNodeId?: string) => void;
  /** Navigate into a nested function parameter */
  enterNested: (paramId: string, functionName: string) => void;
  /** Navigate into an existing nested function (from imported formula) */
  enterExistingNested: (nestedNodeId: string) => void;
  /** Navigate back to the parent function */
  goBack: () => void;
  /** Start point selection for a parameter */
  startPointSelection: (paramIndex: number) => void;
  /** Cancel point selection */
  cancelPointSelection: () => void;
  /** Apply point selection to current parameter */
  applyPointSelection: (range: string) => void;
  /** Compile the current formula */
  compileFormula: () => string;
  /** Reset the wizard to initial state */
  resetWizard: () => void;
}

/**
 * Formula Wizard state machine hook.
 *
 * Manages the nested formula wizard's state transitions,
 * AST construction, and formula compilation.
 *
 * @see excel-formulas.md Section 1
 */
export function useFormulaWizard(): UseFormulaWizardResult {
  const [wizard, setWizard] = useState<WizardStateData>({
    state: 'INACTIVE',
    nodeStack: [],
    nodeMap: new Map(),
    activeNode: null,
    nestingDepth: 0,
    compiledFormula: '',
    isOpen: false,
    targetCellRef: null,
    pointSelectionParamIndex: null,
    activeSchema: null,
  });

  const openWizard = useCallback((functionName: string, targetCellRef?: string) => {
    const schema = getFunctionSchema(functionName);
    const node: FormulaASTNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      functionName: functionName.toUpperCase(),
      parameterValues: {},
    };

    const nodeMap = new Map<string, FormulaASTNode>();
    nodeMap.set(node.id, node);

    setWizard({
      state: 'WIZARD_ROOT',
      nodeStack: [node],
      nodeMap,
      activeNode: node,
      nestingDepth: 1,
      compiledFormula: `${functionName}()`,
      isOpen: true,
      targetCellRef: targetCellRef ?? null,
      pointSelectionParamIndex: null,
      activeSchema: schema,
    });
  }, []);

  const importFormula = useCallback(
    (formula: string, targetCellRef?: string): boolean => {
      const result = importFormulaToWizard(formula);
      if (!result) {
        // Could not import — return false so caller can fall back to autocomplete
        return false;
      }

      const { root, nodeMap } = result;
      const schema = getFunctionSchema(root.functionName);

      // Compile the formula from the imported tree
      const compiled = compileASTNodeToString(root, nodeMap);

      setWizard({
        state: 'WIZARD_ROOT',
        nodeStack: [root],
        nodeMap,
        activeNode: root,
        nestingDepth: 1,
        compiledFormula: compiled,
        isOpen: true,
        targetCellRef: targetCellRef ?? null,
        pointSelectionParamIndex: null,
        activeSchema: schema,
      });

      return true;
    },
    [],
  );

  const openWithAutocomplete = useCallback((targetCellRef?: string) => {
    setWizard({
      state: 'AUTOCOMPLETE',
      nodeStack: [],
      nodeMap: new Map(),
      activeNode: null,
      nestingDepth: 0,
      compiledFormula: '',
      isOpen: true,
      targetCellRef: targetCellRef ?? null,
      pointSelectionParamIndex: null,
      activeSchema: null,
    });
  }, []);

  const closeWizard = useCallback(() => {
    setWizard({
      state: 'INACTIVE',
      nodeStack: [],
      nodeMap: new Map(),
      activeNode: null,
      nestingDepth: 0,
      compiledFormula: '',
      isOpen: false,
      targetCellRef: null,
      pointSelectionParamIndex: null,
      activeSchema: null,
    });
  }, []);

  const setParameter = useCallback(
    (paramId: string, value: string, isNestedFunction = false, nestedNodeId?: string) => {
      setWizard((prev) => {
        if (!prev.activeNode) return prev;

        const newActiveNode: FormulaASTNode = {
          ...prev.activeNode,
          parameterValues: {
            ...prev.activeNode.parameterValues,
            [paramId]: {
              parameterId: paramId,
              rawValue: value,
              isNestedFunction,
              nestedNodeId,
            },
          },
        };

        const newNodeMap = new Map(prev.nodeMap);
        newNodeMap.set(newActiveNode.id, newActiveNode);

        const newStack = [...prev.nodeStack];
        newStack[newStack.length - 1] = newActiveNode;

        // Compile formula
        const compiled = compileASTNodeToString(newActiveNode, newNodeMap);

        return {
          ...prev,
          activeNode: newActiveNode,
          nodeStack: newStack,
          nodeMap: newNodeMap,
          compiledFormula: compiled,
        };
      });
    },
    []
  );

  const enterNested = useCallback((paramId: string, functionName: string) => {
    setWizard((prev) => {
      if (prev.nestingDepth >= MAX_NESTING_DEPTH) return prev;

      const schema = getFunctionSchema(functionName);
      const childNode: FormulaASTNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        parentId: prev.activeNode?.id,
        functionName: functionName.toUpperCase(),
        parameterValues: {},
      };

      // Update parent's parameter to reference the nested function
      let newActiveNode = prev.activeNode;
      let newStack = prev.nodeStack;
      let newNodeMap = prev.nodeMap;

      if (prev.activeNode) {
        newActiveNode = {
          ...prev.activeNode,
          parameterValues: {
            ...prev.activeNode.parameterValues,
            [paramId]: {
              parameterId: paramId,
              rawValue: '',
              isNestedFunction: true,
              nestedNodeId: childNode.id,
            },
          },
        };

        newNodeMap = new Map(prev.nodeMap);
        newNodeMap.set(newActiveNode.id, newActiveNode);
        newNodeMap.set(childNode.id, childNode);

        newStack = [...prev.nodeStack];
        newStack[newStack.length - 1] = newActiveNode;
      }

      // Push child onto stack
      const finalStack = [...newStack, childNode];

      return {
        ...prev,
        state: 'NESTED_STEP' as const,
        nodeStack: finalStack,
        nodeMap: newNodeMap,
        activeNode: childNode,
        nestingDepth: prev.nestingDepth + 1,
        activeSchema: schema,
        compiledFormula: compileASTNodeToString(newActiveNode || childNode, newNodeMap),
      };
    });
  }, []);

  const enterExistingNested = useCallback((nestedNodeId: string) => {
    setWizard((prev) => {
      const nestedNode = prev.nodeMap.get(nestedNodeId);
      if (!nestedNode) return prev;

      const nestedSchema = getFunctionSchema(nestedNode.functionName);

      // Push nested node onto stack
      const newStack = [...prev.nodeStack, nestedNode];

      return {
        ...prev,
        state: 'NESTED_STEP' as const,
        nodeStack: newStack,
        activeNode: nestedNode,
        nestingDepth: prev.nestingDepth + 1,
        activeSchema: nestedSchema,
        compiledFormula: compileASTNodeToString(nestedNode, prev.nodeMap),
      };
    });
  }, []);

  const goBack = useCallback(() => {
    setWizard((prev) => {
      if (prev.nodeStack.length <= 1) return prev;

      const newStack = prev.nodeStack.slice(0, -1);
      const parentNode = newStack[newStack.length - 1];

      const parentSchema = getFunctionSchema(parentNode.functionName);

      return {
        ...prev,
        nodeStack: newStack,
        activeNode: parentNode,
        nestingDepth: prev.nestingDepth - 1,
        state: newStack.length === 1 ? 'WIZARD_ROOT' : 'NESTED_STEP',
        activeSchema: parentSchema,
        pointSelectionParamIndex: null,
        compiledFormula: compileASTNodeToString(parentNode, prev.nodeMap),
      };
    });
  }, []);

  const startPointSelection = useCallback((paramIndex: number) => {
    setWizard((prev) => ({
      ...prev,
      state: 'POINT_SELECTION',
      pointSelectionParamIndex: paramIndex,
    }));
  }, []);

  const cancelPointSelection = useCallback(() => {
    setWizard((prev) => ({
      ...prev,
      state: prev.nodeStack.length > 1 ? 'NESTED_STEP' : 'WIZARD_ROOT',
      pointSelectionParamIndex: null,
    }));
  }, []);

  const applyPointSelection = useCallback((range: string) => {
    setWizard((prev) => {
      if (!prev.activeNode || prev.pointSelectionParamIndex === null) return prev;

      const schema = prev.activeSchema;
      if (!schema) return prev;

      const param = schema.parameters[prev.pointSelectionParamIndex];
      if (!param) return prev;

      const newActiveNode: FormulaASTNode = {
        ...prev.activeNode,
        parameterValues: {
          ...prev.activeNode.parameterValues,
          [param.id]: {
            parameterId: param.id,
            rawValue: range,
            isNestedFunction: false,
          },
        },
      };

      const newNodeMap = new Map(prev.nodeMap);
      newNodeMap.set(newActiveNode.id, newActiveNode);

      const newStack = [...prev.nodeStack];
      newStack[newStack.length - 1] = newActiveNode;

      return {
        ...prev,
        activeNode: newActiveNode,
        nodeStack: newStack,
        nodeMap: newNodeMap,
        state: prev.nodeStack.length > 1 ? 'NESTED_STEP' : 'WIZARD_ROOT',
        pointSelectionParamIndex: null,
        compiledFormula: compileASTNodeToString(newActiveNode, newNodeMap),
      };
    });
  }, []);

  const compileFormula = useCallback((): string => {
    const rootNode = wizard.nodeStack[0];
    if (!rootNode) return '';
    return `=${compileASTNodeToString(rootNode, wizard.nodeMap)}`;
  }, [wizard.nodeStack, wizard.nodeMap]);

  const resetWizard = useCallback(() => {
    setWizard({
      state: 'INACTIVE',
      nodeStack: [],
      nodeMap: new Map(),
      activeNode: null,
      nestingDepth: 0,
      compiledFormula: '',
      isOpen: false,
      targetCellRef: null,
      pointSelectionParamIndex: null,
      activeSchema: null,
    });
  }, []);

  return {
    wizard,
    openWizard,
    importFormula,
    openWithAutocomplete,
    closeWizard,
    setParameter,
    enterNested,
    enterExistingNested,
    goBack,
    startPointSelection,
    cancelPointSelection,
    applyPointSelection,
    compileFormula,
    resetWizard,
  };
}
