# Autocomplete Normalization — Plan & Dev Steps

**Status: COMPLETE ✅** (2026-07-28)

**Goal:** Consolidate autocomplete state + logic into the FSM (`useCellEditing`), make `FormulaBar` a pure view, and eliminate duplicated state/detection in `App.tsx`.

**Result:** 1543 tests pass (up from 1542, the pre-existing POINT-mode bug is fixed), lint clean, type-check clean, build succeeds. All debug logging removed.

---

## Current Problems (from workflow analysis)

| # | Problem | Location |
|---|---------|----------|
| 1 | `handleFormulaRawKeyDown` calls `handleEditingKey` but only `console.log`s the result — `navigate`, `statusMessage`, `shouldCommit` all discarded | App.tsx:396 |
| 2 | Two sources of truth for FormulaBar display value: `editingSession.buffer` (FSM) vs `formulaBarValue` (App state) | App.tsx:1538 |
| 3 | `shouldActivatePointMode` called in 3 places (FSM internal + App.tsx rawChange + App.tsx cellEdit) — duplicated detection | useCellEditing.ts + App.tsx:431,477 |
| 4 | `handleCellEditChange` duplicates FSM logic: branches on SELECT/POINT/ENTER/EDIT, diffs with `prevEditValueRef` | App.tsx:444 |
| 5 | Autocomplete state (`open`, `matches`, `index`, `tokenStart`) lives in FormulaBar view instead of FSM | FormulaBar.tsx:184-187 |
| 6 | Autocomplete open/close driven by `useEffect` watching `value`/`cursorPos` props — indirect & fragile | FormulaBar.tsx:335-337 |
| 7 | Debug `console.log` left in production code | useCellEditing.ts:1060,1083, App.tsx:399 |
| 8 | `findFunctionToken` has jsdom-specific hack (`pos <= 0 ? body.length - 1 : ...`) | FormulaBar.tsx:278 |

---

## Target Architecture

```
useCellEditing (FSM) — SINGLE SOURCE OF TRUTH
  ├─ session: { state, buffer, caretPos, isFormula, ... }
  ├─ pointSession: { isActive, anchorRow/Col, currentRow/Col, insertPos }
  ├─ autoComplete: { open, matches, index, tokenStart }  ← MOVED HERE
  ├─ acceptAutoComplete(index)                           ← NEW
  ├─ navigateAutoComplete(delta)                         ← NEW
  ├─ dismissAutoComplete()                               ← NEW
  └─ handleKey(...) → KeyHandlingResult (unchanged)

FormulaBar — PURE VIEW
  ├─ Receives autoComplete state via props (no internal state)
  ├─ handleKeyDown: intercepts ArrowUp/Down/Tab/Enter/Escape ONLY when autoComplete.open
  │   └─ forwards to onAcceptAutoComplete / onNavigateAutoComplete / onDismissAutoComplete
  ├─ All other keys → onRawKeyDown (unchanged)
  ├─ Renders AutoCompleteDropdown from props.matches / props.index
  └─ No useEffect for autocomplete (FSM owns it)

App.tsx — THINNER WIRING
  ├─ Removes formulaBarValue state (derive value from FSM)
  ├─ handleFormulaRawKeyDown uses result.navigate + result.statusMessage
  ├─ handleFormulaRawChange: calls setBuffer only (FSM detects POINT internally)
  ├─ handleCellEditChange: simplified (no prevEditValueRef diffing)
  └─ Removes all debug console.log
```

---

## Dev Steps

Each step is independently compilable and testable. Run `npm run lint && npm run type-check && npm test` after each.

---

### Step 1: Add autocomplete state + actions to `useCellEditing` FSM

**File:** `src/hooks/useCellEditing.ts`

**1a.** Add `FunctionInfo` import and auto-complete state to the hook:
```ts
import { searchFunctions, type FunctionInfo } from '../utils/formulaAutocomplete';
// New state (alongside session and pointSession):
const [autoCompleteOpen, setAutoCompleteOpen] = useState(false);
const [autoCompleteMatches, setAutoCompleteMatches] = useState<FunctionInfo[]>([]);
const [autoCompleteIndex, setAutoCompleteIndex] = useState(0);
const [autoCompleteTokenStart, setAutoCompleteTokenStart] = useState(0);
```

**1b.** Add `findFunctionToken` helper (move from FormulaBar, remove jsdom hack):
```ts
function findFunctionToken(text: string, pos: number): { token: string; start: number } | null {
  if (!text.startsWith('=')) return null;
  const body = text.slice(1);
  const relPos = Math.min(pos - 1, body.length - 1);
  if (relPos < 0) return null;
  if (!/[A-Za-z]/.test(body[relPos])) return null;
  let start = relPos;
  while (start > 0 && /[A-Za-z]/.test(body[start - 1])) start--;
  let end = relPos;
  while (end < body.length && /[A-Za-z]/.test(body[end])) end++;
  if (start === end) return null;
  const token = body.slice(start, end).toUpperCase();
  const prevChar = start > 0 ? body[start - 1] : '';
  const isFunctionContext = start === 0 || /[,(+\-*/&=<>]/.test(prevChar) || prevChar === ' ';
  if (!isFunctionContext || token.length === 0) return null;
  return { token, start: start + 1 };
}
```

**1c.** Add internal `syncAutoComplete(buffer, caretPos, state)` function that computes autocomplete state from session values:
- If state not in ENTER/EDIT → close
- If buffer doesn't start with `=` → close
- Call `findFunctionToken` → if null, close
- Call `searchFunctions(token)` → if empty, close
- Otherwise set open=true, matches, index=0, tokenStart

**1d.** Call `syncAutoComplete` inside `setSession` updater or immediately after every `setSession` call that changes buffer (in `handleKey`, `setBuffer`, `startEnter`, `startEdit`, etc.).

**1e.** Add action functions:
```ts
const acceptAutoComplete = useCallback((index: number) => {
  // Get match, build newBuffer = before + name + '(' + after
  // Call setSession with new buffer + caret
  // Call enterPointMode(newCaret, newBuffer)  // FSM handles POINT detection
  // Close autocomplete
}, [enterPointMode, ...]);

const navigateAutoComplete = useCallback((delta: number) => {
  setAutoCompleteIndex(prev => (prev + delta + matches.length) % matches.length);
}, [autoCompleteMatches.length]);

const dismissAutoComplete = useCallback(() => {
  setAutoCompleteOpen(false);
}, []);
```

**1f.** Expose in return object:
```ts
return {
  // ... existing ...
  autoComplete: { open: autoCompleteOpen, matches: autoCompleteMatches, index: autoCompleteIndex, tokenStart: autoCompleteTokenStart },
  acceptAutoComplete,
  navigateAutoComplete,
  dismissAutoComplete,
};
```

**1g.** Remove debug `console.log` from POINT-state arrow handler and `)` handler.

**Test:** `npm test -- --testPathPattern="useCellEditing"` — all existing FSM tests still pass (autocomplete state changes don't affect existing assertions).

---

### Step 2: Convert `FormulaBar` to pure view (remove internal autocomplete state)

**File:** `src/components/FormulaBar.tsx`

**2a.** Add new props:
```ts
autoComplete: { open: boolean; matches: FunctionInfo[]; index: number; tokenStart: number };
onAcceptAutoComplete: (index: number) => void;
onNavigateAutoComplete: (delta: number) => void;
onDismissAutoComplete: () => void;
```

**2b.** Remove internal state:
```ts
// DELETE these:
const [autoCompleteOpen, setAutoCompleteOpen] = useState(false);
const [autoCompleteMatches, setAutoCompleteMatches] = useState<FunctionInfo[]>([]);
const [autoCompleteIndex, setAutoCompleteIndex] = useState(0);
const [autoCompleteTokenStart, setAutoCompleteTokenStart] = useState(0);
```

**2c.** Remove `findFunctionToken`, `updateAutoComplete`, `acceptAutoComplete` callbacks + the `useEffect([updateAutoComplete])` + the `useEffect` that closes autocomplete on POINT/SELECT.

**2d.** Rewrite `handleKeyDown` autocomplete branch:
```ts
if (autoComplete.open && ['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); onNavigateAutoComplete(1); return;
    case 'ArrowUp':   e.preventDefault(); onNavigateAutoComplete(-1); return;
    case 'Tab':
    case 'Enter':     e.preventDefault(); onAcceptAutoComplete(autoComplete.index); return;
    case 'Escape':    e.preventDefault(); onDismissAutoComplete(); return;
  }
}
```

**2e.** Update `handleClick` to call `updateAutoComplete` equivalent — but since FSM now owns it, simply call `onRawCaretMove(caretPos)` and the FSM sync handles opening.

**2f.** Update JSX:
```tsx
// Replace autoCompleteOpen with autoComplete.open
// Replace autoCompleteMatches with autoComplete.matches
// Replace autoCompleteIndex with autoComplete.index
// Replace acceptAutoComplete(idx) with onAcceptAutoComplete(idx)
```

**Test:** `npm test -- --testPathPattern="FormulaBar.autocomplete|FormulaBar.coverage"` — update test props to pass `autoComplete` object instead of relying on internal state.

---

### Step 3: Clean up `App.tsx` wiring

**File:** `src/App.tsx`

**3a.** Fix `handleFormulaRawKeyDown` — use the result:
```ts
const handleFormulaRawKeyDown = useCallback((e: React.KeyboardEvent) => {
  const result = handleEditingKey(e.key, e.shiftKey, e.ctrlKey, e.altKey);
  // Remove debug console.log
  if (result.navigate && onNavigate) {
    // handled inside FSM commit; nothing extra needed here
  }
  if (result.statusMessage) {
    setStatusMessage(result.statusMessage);
  }
}, [handleEditingKey]);
```
Note: The FSM's `handleKey` already calls `onNavigate` internally when committing. We just need to surface `statusMessage`.

**3b.** Remove `formulaBarValue` state — derive display value from session:
```ts
// Before:
const [formulaBarValue, setFormulaBarValue] = useState('');
value={editingSession.buffer || formulaBarValue}

// After — add a selector/helper:
const displayValue = editingSession.buffer || activeCellRawValue;
value={displayValue}
```
Where `activeCellRawValue` is derived from `sheet.cells[cellKey(activeCell.row, activeCell.col)]?.rawValue ?? ''` (already computed elsewhere).

**3c.** Simplify `handleFormulaRawChange`:
```ts
const handleFormulaRawChange = useCallback((value: string, caretPos: number) => {
  const s = editingSession;
  if (s.state === 'SELECT' && value.length > 0) {
    const firstChar = value[0];
    if (firstChar === '=' || firstChar === '+' || firstChar === '-') {
      startEnter(firstChar);
      if (value.length > 1) setBuffer(value, caretPos);
    } else {
      startEdit();
      setBuffer(value, caretPos);
    }
  } else {
    setBuffer(value, caretPos);
  }
  // Remove: shouldActivatePointMode + enterPointMode call
  // The FSM's setBuffer internally calls syncAutoComplete and detects POINT triggers
}, [setBuffer, enterPointMode, startEnter, startEdit, editingSession]);
```
POINT detection on buffer change moves into `setBuffer` in the FSM (Step 1).

**3d.** Simplify `handleCellEditChange`:
```ts
const handleCellEditChange = useCallback((value: string) => {
  const s = editingSession;
  if (s.state === 'SELECT' && value.length > 0) {
    startEnter(value.slice(-1));
    if (value.length > 1) setBuffer(value, value.length);
  } else {
    setBuffer(value, value.length);
  }
  // Remove: prevEditValueRef diffing, manual POINT detection
}, [editingSession, startEnter, setBuffer]);
```

**3e.** Update FormulaBar props:
```tsx
<FormulaBar
  // ... existing props ...
  autoComplete={editingSession.autoComplete}  // or from hook return
  onAcceptAutoComplete={acceptAutoComplete}
  onNavigateAutoComplete={navigateAutoComplete}
  onDismissAutoComplete={dismissAutoComplete}
  // Remove: setFormulaBarValue-based value prop (now derived internally or passed differently)
/>
```

**3f.** Remove all remaining `console.log('DEBUG ...')` calls.

**3g.** Remove `shouldActivatePointMode` import from App.tsx (no longer needed).

**Test:** `npm test -- --testPathPattern="App.autocomplete"` — all 3 integration tests pass.

---

### Step 4: Move POINT-trigger detection into FSM `setBuffer`

**File:** `src/hooks/useCellEditing.ts`

**4a.** Modify `setBuffer` to detect POINT triggers:
```ts
const setBuffer = useCallback((buffer: string, caretPos: number) => {
  setSession((prev) => {
    if (prev.state !== 'EDIT' && prev.state !== 'ENTER') return prev;
    const clampedCaret = Math.max(0, Math.min(buffer.length, caretPos));
    const newSession = { ...prev, buffer, caretPos: clampedCaret, isFormula: ... };
    sessionRef.current = newSession;
    return newSession;
  });
  // After state update, check POINT trigger
  // Use setTimeout or sync check on latest ref
  if (shouldActivatePointMode(buffer, caretPos)) {
    enterPointMode(caretPos, buffer);
  }
}, [enterPointMode]);
```

**4b.** Similarly, `startEnter` should detect POINT triggers after setting state.

**4c.** Remove `enterPointMode` calls from App.tsx `handleFormulaRawChange` and `handleCellEditChange` (FSM handles it).

**Test:** `npm test -- --testPathPattern="useCellEditing|App.autocomplete"` — verify `=SUM(` typed in formula bar enters POINT mode without App.tsx intervention.

---

### Step 5: Sync autocomplete from FSM state changes

**File:** `src/hooks/useCellEditing.ts`

**5a.** Ensure every buffer-modifying function calls `syncAutoComplete`:
- `handleKey` — after every `setSession` that changes buffer/caret
- `setBuffer` — after state update
- `startEnter`, `startEdit`, `startEditAt` — after setting state
- `commit`, `cancel`, `reset` — close autocomplete

**5b.** Use a `useEffect` on `[session.buffer, session.caretPos, session.state]` inside the hook to call `syncAutoComplete` — this replaces FormulaBar's useEffect approach, but lives in the FSM where it belongs.

```ts
useEffect(() => {
  syncAutoComplete(session.buffer, session.caretPos, session.state);
}, [session.buffer, session.caretPos, session.state]);
```

**Test:** `npm test` — full suite passes. Autocomplete opens/closes correctly from FSM-driven state.

---

### Step 6: Update tests

**Files:** `src/components/FormulaBar.autocomplete.test.tsx`, `src/components/FormulaBar.coverage.test.tsx`, `src/App.autocomplete.test.tsx`

**6a.** Update `FormulaBar.autocomplete.test.tsx`:
- Pass `autoComplete: { open: true, matches: [...], index: 0, tokenStart: 1 }` prop instead of relying on internal useEffect.
- For trigger tests (open/close), they now test the FSM → prop pipeline. Either:
  - Option A: Test `useCellEditing` directly for autocomplete state (unit test).
  - Option B: Keep FormulaBar tests but pass explicit `autoComplete` prop.

**6b.** Update `App.autocomplete.test.tsx`:
- These are integration tests — should work unchanged once the pipeline is correct.
- Remove any workarounds for the stale state bug (the bug should be fixed by FSM-owned state).

**6c.** Update `useCellEditing.test.ts`:
- Add tests for new `autoComplete` return field.
- Add tests for `acceptAutoComplete`, `navigateAutoComplete`, `dismissAutoComplete`.

**Test:** `npm test` — all 1500+ tests pass.

---

### Step 7: Final verification

- [ ] `npm run lint` — 0 warnings
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npm test` — all tests pass
- [ ] Manual: type `=S` in formula bar → dropdown appears → Enter accepts → `=SUM(` + POINT mode
- [ ] Manual: type `=S` in grid cell → dropdown appears → Enter accepts → `=SUM(` + POINT mode
- [ ] Manual: Escape closes dropdown, ArrowUp/Down navigates
- [ ] Manual: no `DEBUG` messages in console

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `syncAutoComplete` via `useEffect` in hook | Keeps autocomplete state consistent with session without manual calls everywhere. React batches the setState. |
| `setBuffer` triggers POINT detection internally | Removes the need for App.tsx to re-check. FSM owns all state transitions. |
| `autoComplete` as separate return field (not inside `session`) | Avoids coupling autocomplete view state with session model. Session is serializable; autocomplete is UI state. |
| `FormulaBar` remains a view (no business logic) | All decisions (open/close/accept/navigate) made by FSM. FormulaBar just renders + forwards events. |
| Keep `formulaBarValue` removal minimal in Step 3 | Derive display value from existing `activeCell` + sheet data rather than adding a new selector, to minimize churn. |

---

## Risk Mitigation

- **Stale closure risk**: The existing bug (POINT→EDIT revert after autocomplete accept) occurs because `handleKey` and the arrow handler update `sessionRef` asynchronously. By routing `acceptAutoComplete` through the FSM (which updates `sessionRef.current` synchronously before calling `enterPointMode`), this bug is fixed.
- **Test count**: Each step must keep all 1500+ tests green. No step lands without `npm test` passing.
- **Incremental**: Steps 1-2 are additive (new state + new props). Steps 3-4 remove old wiring. If any step breaks, revert and fix before proceeding.
