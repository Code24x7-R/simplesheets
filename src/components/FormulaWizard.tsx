import { useState, useCallback, useMemo } from 'react';
import type { FunctionDefinition, FunctionParameter } from '../utils/formulaWizardSchema';
import { getAllFunctionSchemas } from '../utils/formulaWizardSchema';
import { validateParameter, checkCircularReference } from '../utils/formulaWizardCompiler';
import type { WizardStateData } from '../hooks/useFormulaWizard';
import type { ReferenceFormat } from '../hooks/useReferenceFormat';
import { FunctionPicker } from './FunctionPicker';
import { compileASTNodeToString } from '../utils/formulaWizardCompiler';

/**
 * Color palette for parameter highlighting.
 * Each parameter gets a distinct color for grid highlighting.
 */
const PARAM_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgb(59, 130, 246)', text: 'rgb(29, 78, 216)' },   // blue
  { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgb(239, 68, 68)', text: 'rgb(185, 28, 28)' },     // red
  { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgb(34, 197, 94)', text: 'rgb(21, 128, 61)' },     // green
  { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgb(234, 179, 8)', text: 'rgb(161, 98, 7)' },      // yellow
  { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgb(168, 85, 247)', text: 'rgb(109, 40, 217)' },  // purple
  { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgb(236, 72, 153)', text: 'rgb(190, 24, 93)' },   // pink
  { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgb(249, 115, 22)', text: 'rgb(194, 65, 12)' },   // orange
  { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgb(6, 182, 212)', text: 'rgb(14, 116, 144)' },    // cyan
];

interface FormulaWizardProps {
  /** Current wizard state */
  wizard: WizardStateData;
  /** Set a parameter value */
  setParameter: (paramId: string, value: string, isNestedFunction?: boolean, nestedNodeId?: string) => void;
  /** Navigate into a nested function parameter */
  enterNested: (paramId: string, functionName: string) => void;
  /** Navigate into an existing nested function (from imported formula) */
  enterExistingNested?: (nestedNodeId: string) => void;
  /** Navigate back to the parent function */
  goBack: () => void;
  /** Start point selection for a parameter */
  startPointSelection: (paramIndex: number) => void;
  /** Cancel point selection */
  cancelPointSelection: () => void;
  /** Close the wizard */
  closeWizard: () => void;
  /** Apply the formula to the cell */
  onApply: (formula: string) => void;
  /** Reference format (A1 or R1C1) */
  _referenceFormat?: ReferenceFormat;
  /** Target cell row (for circular reference check) */
  targetRow?: number;
  /** Target cell column (for circular reference check) */
  targetCol?: number;
  /** Live computed result preview */
  computedResult?: string | number | boolean | null;
  /** Callback when user picks a function from the autocomplete picker */
  onFunctionSelect?: (functionName: string) => void;
}

/**
 * Formula Wizard Component
 *
 * Interactive overlay for building complex nested formulas
 * with step-by-step parameter guidance.
 *
 * @see excel-formulas.md Section 5
 */
export function FormulaWizard({
  wizard,
  setParameter,
  enterNested,
  enterExistingNested,
  goBack,
  startPointSelection,
  cancelPointSelection,
  closeWizard,
  onApply,
  _referenceFormat: _referenceFormatUnused = 'A1',
  targetRow,
  targetCol,
  computedResult,
  onFunctionSelect,
}: FormulaWizardProps) {
  const [nestedFunctionPicker, setNestedFunctionPicker] = useState<string | null>(null);

  const schema = wizard.activeSchema;
  const isPointSelection = wizard.state === 'POINT_SELECTION';

  // Build breadcrumb from node stack
  const breadcrumb = useMemo(() => {
    return wizard.nodeStack.map((node, index) => ({
      id: node.id,
      name: node.functionName,
      depth: index + 1,
      isLast: index === wizard.nodeStack.length - 1,
    }));
  }, [wizard.nodeStack]);

  // Check for circular reference
  const hasCircularRef = useMemo(() => {
    if (targetRow === undefined || targetCol === undefined) return false;
    const formula = `=${wizard.compiledFormula}`;
    return checkCircularReference(formula, targetRow, targetCol);
  }, [wizard.compiledFormula, targetRow, targetCol]);

  // Helper to get the display value for a parameter (handles nested functions)
  const getParamDisplayValue = useCallback(
    (param: FunctionParameter): { value: string; hasNested: boolean; nestedId?: string } => {
      const paramVal = wizard.activeNode?.parameterValues[param.id];
      if (!paramVal) return { value: '', hasNested: false };

      if (paramVal.isNestedFunction && paramVal.nestedNodeId) {
        // Get the compiled formula from the nested node
        const nestedNode = wizard.nodeMap.get(paramVal.nestedNodeId);
        if (nestedNode) {
          const compiled = compileASTNodeToString(nestedNode, wizard.nodeMap);
          return { value: compiled, hasNested: true, nestedId: paramVal.nestedNodeId };
        }
      }

      return { value: paramVal.rawValue, hasNested: false };
    },
    [wizard.activeNode, wizard.nodeMap],
  );

  // Handle parameter value change
  const handleParamChange = useCallback(
    (paramId: string, value: string) => {
      setParameter(paramId, value);
    },
    [setParameter]
  );

  // Handle range picker click
  const handleRangePicker = useCallback(
    (paramIndex: number) => {
      startPointSelection(paramIndex);
    },
    [startPointSelection]
  );

  // Handle nested function selection
  const handleNestedFunctionSelect = useCallback(
    (paramId: string, functionName: string) => {
      enterNested(paramId, functionName);
      setNestedFunctionPicker(null);
    },
    [enterNested]
  );

  // Handle clicking on an existing nested function to navigate into it
  const handleEnterNestedFunction = useCallback(
    (nestedNodeId: string) => {
      enterExistingNested?.(nestedNodeId);
    },
    [enterExistingNested]
  );

  // Handle apply
  const handleApply = useCallback(() => {
    const formula = `=${wizard.compiledFormula}`;
    onApply(formula);
  }, [wizard.compiledFormula, onApply]);

  // Get available functions for nesting
  const availableFunctions = useMemo(() => {
    return getAllFunctionSchemas().slice(0, 20); // Limit for dropdown
  }, []);

  // Handle Escape key: cancel POINT mode first, then close modal
  // (Must be before conditional returns - React hooks rule)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (wizard.state === 'POINT_SELECTION') {
          cancelPointSelection();
        } else {
          closeWizard();
        }
      }
    },
    [wizard.state, cancelPointSelection, closeWizard]
  );

  if (!wizard.isOpen) return null;

  // Show autocomplete picker when no formula was imported
  if (wizard.state === 'AUTOCOMPLETE') {
    return (
      <FunctionPicker
        isOpen={true}
        onSelect={(functionName) => {
          onFunctionSelect?.(functionName);
        }}
        onClose={closeWizard}
      />
    );
  }

  if (!schema) return null;

  // When in POINT mode, make modal fully click-through so the user can
  // select a range on the grid without the form blocking cells.
  const isPointMode = wizard.state === 'POINT_SELECTION';
  const overlayClass = isPointMode
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-none'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/30';
  const modalClass = isPointMode
    ? 'bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto opacity-75 pointer-events-none'
    : 'bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto';

  // POINT mode indicator — rendered OUTSIDE the modal so it stays
  // clickable even when the modal is pointer-events-none.
  const pointModeIndicator = isPointSelection && (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg text-xs text-yellow-700 pointer-events-auto">
      <span className="font-semibold">POINT mode:</span> Select a range on the grid, then click
      "Apply Range" or press Enter.
      <button
        className="ml-2 text-yellow-600 underline hover:text-yellow-800"
        onClick={cancelPointSelection}
      >
        Cancel
      </button>
    </div>
  );

  return (
    <div className={overlayClass} onKeyDown={handleKeyDown}>
      {pointModeIndicator}
      <div className={modalClass}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-sm font-semibold text-gray-700">Nested Formula Wizard</h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            onClick={closeWizard}
            title="Close wizard"
          >
            ×
          </button>
        </div>

        {/* Breadcrumb navigation */}
        <div className="px-4 py-2 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-400 font-mono">f(x)</span>
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-300">&gt;</span>}
                <button
                  className={`font-mono px-1.5 py-0.5 rounded ${
                    crumb.isLast
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    // Navigate to this depth
                    const diff = wizard.nodeStack.length - 1 - index;
                    for (let i = 0; i < diff; i++) goBack();
                  }}
                  disabled={crumb.isLast}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Current step info */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="text-xs text-blue-600">
            <span className="font-semibold">{schema.name}</span>
            {wizard.nestingDepth > 1 && (
              <span className="text-blue-400 ml-2">
                (Nested depth: {wizard.nestingDepth}/{8})
              </span>
            )}
          </div>
          <div className="text-xs text-blue-500 mt-0.5">{schema.description}</div>
        </div>

        {/* Parameter inputs */}
        <div className="px-4 py-3 space-y-3">
          {schema.parameters.map((param, index) => (
            <ParameterInput
              key={param.id}
              param={param}
              _paramIndex={index}
              value={getParamDisplayValue(param).value}
              hasNestedFunction={getParamDisplayValue(param).hasNested}
              nestedNodeId={getParamDisplayValue(param).nestedId}
              color={PARAM_COLORS[index % PARAM_COLORS.length]}
              isPointSelection={isPointSelection && wizard.pointSelectionParamIndex === index}
              onChange={(value) => handleParamChange(param.id, value)}
              onRangePicker={() => handleRangePicker(index)}
              onNestedFunction={(fn) => handleNestedFunctionSelect(param.id, fn)}
              allowNested={param.allowNestedFunction}
              nestingDepth={wizard.nestingDepth}
              availableFunctions={availableFunctions}
              nestedFunctionPicker={nestedFunctionPicker}
              setNestedFunctionPicker={setNestedFunctionPicker}
              onEnterNested={handleEnterNestedFunction}
            />
          ))}

          {schema.parameters.length === 0 && (
            <div className="text-xs text-gray-400 italic">This function takes no parameters.</div>
          )}
        </div>

        {/* Validation warnings */}
        {hasCircularRef && (
          <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            ⚠️ Selected range includes target cell and may cause circular dependency.
          </div>
        )}

        {/* Live result preview */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              <span className="font-semibold">Result:</span>{' '}
              <span className="font-mono text-gray-700">
                {computedResult !== null && computedResult !== undefined
                  ? String(computedResult)
                  : '—'}
              </span>
            </div>
            <div className="text-xs text-gray-400 font-mono truncate max-w-[200px]" title={wizard.compiledFormula}>
              ={wizard.compiledFormula}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div>
            {wizard.nestingDepth > 1 && (
              <button
                className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                onClick={goBack}
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              onClick={closeWizard}
            >
              Cancel
            </button>
            <button
              className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors font-semibold"
              onClick={handleApply}
            >
              Apply to Cell
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Parameter Input Component ──────────────────────────────────────────────

interface ParameterInputProps {
  param: FunctionParameter;
  _paramIndex: number;
  value: string;
  color: { bg: string; border: string; text: string };
  isPointSelection: boolean;
  onChange: (value: string) => void;
  onRangePicker: () => void;
  onNestedFunction: (functionName: string) => void;
  allowNested: boolean;
  nestingDepth: number;
  availableFunctions: FunctionDefinition[];
  nestedFunctionPicker: string | null;
  setNestedFunctionPicker: (paramId: string | null) => void;
  /** Whether this parameter has a nested function (for imported formulas) */
  hasNestedFunction?: boolean;
  /** ID of the nested function node (for navigation) */
  nestedNodeId?: string;
  /** Callback when user clicks on the nested function value */
  onEnterNested?: (nestedNodeId: string) => void;
}

function ParameterInput({
  param,
  _paramIndex: _paramIndexUnused,
  value,
  color,
  isPointSelection,
  onChange,
  onRangePicker,
  onNestedFunction,
  allowNested,
  nestingDepth,
  availableFunctions,
  nestedFunctionPicker,
  setNestedFunctionPicker,
  hasNestedFunction,
  nestedNodeId,
  onEnterNested,
}: ParameterInputProps) {
  const validationError = validateParameter(value, param.type);
  const showPicker = nestedFunctionPicker === param.id;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Parameter label */}
        <label
          className="text-xs font-medium w-24 flex-shrink-0 truncate"
          style={{ color: color.text }}
          title={param.description}
        >
          {param.name}
          {param.isRequired && <span className="text-red-400 ml-0.5">*</span>}
        </label>

        {/* Input field */}
        <div className="flex-1 relative">
          {hasNestedFunction && nestedNodeId && onEnterNested ? (
            // Nested function — show as clickable button-like element
            <button
              className="w-full px-2 py-1.5 text-xs font-mono border rounded text-left text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
              onClick={() => onEnterNested(nestedNodeId)}
              title="Click to edit nested function"
            >
              {value || `${param.name} (nested)`}
            </button>
          ) : (
            <input
              type="text"
              className={`w-full px-2 py-1.5 text-xs font-mono border rounded outline-none transition-colors ${
                isPointSelection
                  ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-200'
                  : validationError
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
              }`}
              style={
                value && !validationError
                  ? { borderColor: color.border, backgroundColor: color.bg }
                  : undefined
              }
              placeholder={param.description}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              readOnly={isPointSelection}
            />
          )}

          {/* Range picker button */}
          {(param.type === 'RANGE' || param.type === 'ANY') && (
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 rounded hover:bg-gray-200 hover:text-gray-600 transition-colors"
              onClick={onRangePicker}
              title="Select range on grid"
            >
              🗗
            </button>
          )}
        </div>

        {/* Nested function button */}
        {allowNested && nestingDepth < 8 && (
          <button
            className="px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded hover:bg-gray-200 hover:text-gray-600 transition-colors flex-shrink-0"
            onClick={() => setNestedFunctionPicker(showPicker ? null : param.id)}
            title="Insert nested function"
          >
            f(x)
          </button>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="mt-1 ml-26 text-[10px] text-red-500 pl-24">{validationError}</div>
      )}

      {/* Nested function picker */}
      {showPicker && (
        <div className="absolute left-24 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
          {availableFunctions.map((fn) => (
            <button
              key={fn.name}
              className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 flex items-center gap-2"
              onClick={() => onNestedFunction(fn.name)}
            >
              <span className="font-mono text-blue-600 font-semibold">{fn.name}</span>
              <span className="text-gray-400 truncate">{fn.syntaxTemplate}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
