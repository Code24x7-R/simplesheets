# Technical Specification: Nested Formula Wizard

Description: Structural design, state machine, and interactive logic specification for an automated modal/panel wizard guiding users through complex nested spreadsheet function parameters, range selections, and formula syntax assembly (Excel / Google Sheets style).

Version: 1.0.0

Target Environment: Web / Browser-based DOM or Canvas Spreadsheet Engine.
## 1. System Architecture & State Machine
The Nested Formula Wizard operates as an interactive overlay context tied directly to the core spreadsheet state machine. When active, it manages function composition, variable mapping, nested parameter trees, and live grid selections without interrupting the cell state engine.
```
                  ┌────────────────────────────────────────┐
                  │              INACTIVE                  │
                  │   (Spreadsheet in SELECT or EDIT)      │
                  └───────────────────┬────────────────────┘
                                      │
                   Click "Insert Function" / Type `=FUNC(`
                                      ▼
                  ┌────────────────────────────────────────┐
                  │          WIZARD ACTIVE (ROOT)          │
                  │     (Top-level function parameter)     │
                  └─────────┬────────────────────▲─────────┘
                            │                    │
        Select parameter requiring nested function / Click "Add Nested"
                            │                    │ Click "Done" / Back
                            ▼                    │
                  ┌────────────────────────────────────────┐
                  │          NESTED STEP (DEPTH N)         │
                  │    (Evaluating child parameter model)  │
                  └───────────────────┬────────────────────┘
                                      │
                            Click range picker / Focus field
                                      ▼
                  ┌────────────────────────────────────────┐
                  │         WIZARD POINT SELECTION         │
                  │   (Grid mouse/keyboard range mode)     │
                  └────────────────────────────────────────┘
```
## 2. Parameter Data Model

Every function supported in the wizard implements a structured schema mapping its positional inputs, data types, dynamic range expectations, and nested function capabilities.

```
TypeScript
type ParameterType = 'RANGE' | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'ANY' | 'FUNCTION';

interface FunctionParameter {
  id: string;
  name: string;
  description: string;
  type: ParameterType;
  isRequired: boolean;
  isVariadic?: boolean; // For functions like SUM(num1, [num2], ...)
  defaultValue?: string | number | boolean;
  validationRegex?: string;
  allowNestedFunction: boolean;
}

interface FunctionDefinition {
  name: string;
  category: 'MATH' | 'STATISTICAL' | 'LOGICAL' | 'LOOKUP';
  description: string;
  parameters: FunctionParameter[];
  returnType: ParameterType;
  syntaxTemplate: string;
}

interface ParameterNodeValue {
  parameterId: string;
  rawValue: string; // E.g., "A1:B10", "100", or a nested AST Node ID
  isNestedFunction: boolean;
  nestedNodeId?: string;
}

interface FormulaASTNode {
  id: string;
  parentId?: string;
  functionName: string;
  parameterValues: Record<string, ParameterNodeValue>;
}
```
## 3. Supported Core Math & Statistical Functions
The wizard natively provides step-by-step structural guidance for primary formula operations, automatically validating input types and range bounds.

```
Function,Parameter,Type,Required,Description
SUM,number1,RANGE / NUMBER,Yes,Primary range or value to sum.
,number2...,RANGE / NUMBER,No (Variadic),Additional ranges or numbers to add.
AVERAGE,number1,RANGE / NUMBER,Yes,Primary range or value for arithmetic mean.
,number2...,RANGE / NUMBER,No (Variadic),Additional ranges or values.
ROUND,number,NUMBER / FUNCTION,Yes,Target value or nested calculation to round.
,num_digits,NUMBER,Yes,Number of decimal places.
SUMIF,range,RANGE,Yes,Evaluated range for conditional check.
,criteria,STRING / NUMBER,Yes,"Expression, number, or text determining sum."
,sum_range,RANGE,No,Actual cells to add (if different from range).
COUNTIF,range,RANGE,Yes,Range of cells to count.
,criteria,STRING / NUMBER,Yes,"Criteria in form of number, expression, or text."
ABS,number,NUMBER / FUNCTION,Yes,Value or nested function requiring absolute magnitude.

```

## 4. Range Selection Integration & Pointing Sync
When a parameter requires a RANGE type, the wizard synchronizes directly with the grid state machine:  Range Picker Trigger:Clicking the Range Selector Icon inside any parameter input box temporarily collapses or shifts focus to the grid.Spreadsheet engine switches to ST_PNT (POINT State).  Interactive Pointing & Dragging:Mouse drag operations or Shift + Arrow Keys select ranges on the canvas, updating the active parameter input live (e.g., B2:D15).  Selected ranges inherit the parameter color palette index for distinct highlighting.  Multi-Range & Dynamic Append:For variadic parameters (isVariadic: true), selecting a range auto-populates the current input field and dynamically renders an empty parameter row below it (number3, number4, etc.).

## 5. Visual Hierarchy & Nested Breadcrumb Navigation
To allow deep nesting (e.g., =ROUND(SUMIF(A1:A10, ">10", B1:B10), 2)), the UI maintains a hierarchical breadcrumb header.

┌────────────────────────────────────────────────────────────────────────┐
│  Nested Formula Wizard                                           [X]   │
├────────────────────────────────────────────────────────────────────────┤
│  Breadcrumb:  f(x) ROUND  >  f(x) SUMIF                                │
├────────────────────────────────────────────────────────────────────────┤
│  Current Step: SUMIF (Nested under ROUND → 'number' argument)         │
│                                                                        │
│  Range:       [ A1:A10                  ] 🗗  (Range selection)     │
│  Criteria:    [ ">10"                   ]     (Text criteria)        │
│  Sum_range:   [ B1:B10                  ] 🗗  (Range selection)     │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  Live Result Preview: 1,450.00                                         │
│  Generated Syntax:    SUMIF(A1:A10, ">10", B1:B10)                     │
├────────────────────────────────────────────────────────────────────────┤
│  [ ← Back to ROUND ]                             [ Apply to Cell ]     │
└────────────────────────────────────────────────────────────────────────┘

## 6. Real-Time AST Generator & String Compiler Algorithm
The wizard maintains an internal Abstract Syntax Tree (AST) that auto-compiles to valid spreadsheet syntax on every character or range input.

```
function compileASTNodeToString(node: FormulaASTNode, schemaMap: Record<string, FunctionDefinition>): string {
  const schema = schemaMap[node.functionName];
  if (!schema) return '';

  const args: string[] = [];

  for (const param of schema.parameters) {
    const paramVal = node.parameterValues[param.id];
    if (!paramVal) {
      if (param.isRequired) args.push(''); // Placeholder for incomplete syntax
      continue;
    }

    if (paramVal.isNestedFunction && paramVal.nestedNodeId) {
      // Resolve nested node recursively
      const childNode = getASTNodeById(paramVal.nestedNodeId);
      args.push(compileASTNodeToString(childNode, schemaMap));
    } else {
      args.push(paramVal.rawValue);
    }
  }

  // Trim trailing optional empty parameters
  while (args.length > 0 && args[args.length - 1] === '') {
    args.pop();
  }

  return `=${node.functionName}(${args.join(', ')})`;
}
```

## 7. Edge Cases & Safety Guardrails

- Edge Condition
  System Action & UX Behavior
- Type Mismatch

If a user inputs non-numeric text into a NUMBER parameter (without an = function trigger), display an inline validation warning: "Parameter expects a numeric value or valid range."Circular Reference In WizardIf a range selection includes the target cell currently host to the formula, display a warning indicator: "Selected range includes target cell $(R, C)$ and may cause circular dependency."Max Nesting DepthLimit nesting stack depth to 8 levels. Disable the "Add Nested Function" action when depth limit is reached.Modal Drag / Viewport CollisionIf the wizard modal obscures selected grid cells during range selection mode, auto-reduce panel opacity to 20% or anchor panel to the bottom screen corner.

                  