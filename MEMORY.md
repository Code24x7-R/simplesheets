<!-- last updated: 2026-08-08 [simplesheets] -->
# SimpleSheet — Project Memory

Spreadsheet web-app: React + TypeScript + Vite + Tailwind.

---

# Phase 33: SheetLink Cross-Tab Data Bridge — COMPLETE ✅

**2026-08-08** — Built a cross-tab data bridge allowing any same-origin app (e.g., SimpleDocs) to read live SimpleSheet cell values, formulas, and ranges via BroadcastChannel.

## Architecture Decision: SheetLink

- **Package**: `@simplesheets/sheetlink` at `packages/sheetlink/`
  - Self-contained, framework-agnostic (no React dependency)
  - Exports: `SheetLinkClient` class, `BroadcastChannelTransport`, typed protocol, error hierarchy
  - Built with Vite lib mode → ESM + CJS + .d.ts
- **Provider**: React component at `src/components/SheetLink/`
  - `SheetLinkProvider.tsx` — Mounts in App.tsx, reads from `workbook` prop
  - `SheetLinkTrustPrompt.tsx` — Authorization dialog for new consumer tabs
  - `SheetLinkRangePicker.tsx` — Modal with text input + sheet tabs
- **Transport**: BroadcastChannel (same-origin only)
  - JSDOM polyfill in `src/setupTests.ts` (inner class with instance registry, no echo to sender)

## Key Files Created

- `packages/sheetlink/src/sheetLinkProtocol.ts` — All message types, operations, error codes
- `packages/sheetlink/src/sheetLinkTransport.ts` — BroadcastChannel wrapper
- `packages/sheetlink/src/SheetLinkClient.ts` — Promise-based client with corrId pairing, timeout, auto-retry
- `packages/sheetlink/src/SheetLinkError.ts` — Typed error hierarchy
- `packages/sheetlink/src/index.ts` — Public API re-exports
- `src/components/SheetLink/SheetLinkProvider.tsx` — Workbook adapter with 7 operations
- `src/components/SheetLink/SheetLinkTrustPrompt.tsx` — Trust dialog
- `src/components/SheetLink/SheetLinkRangePicker.tsx` — Range picker modal
- `src/components/SheetLink/index.ts` — Component re-exports

## Steering Decisions (from user)

1. Same-origin (no cross-origin iframe bridge needed)
2. Separate package (`@simplesheets/sheetlink`)
3. "Allow this prompt" (explicit trust per consumer tab)
4. Modal dialog for range picker
5. Push auto (subscriptions auto-push on workbook change)

## Lessons Learned

- **Temporal dead zone with useCallback**: Can't reference a useCallback before it's defined. Solution: define `executeOperation` BEFORE `handleMessage` (which calls it), or inline the logic.
- **JSDOM lacks BroadcastChannel**: Must polyfill in test setup. Polyfill must NOT echo messages to sender (use instance identity check `inst === this.instance`).
- **SheetLinkRequestArgs union narrowing**: Use `'ref' in args` / `'range' in args` type guards to access union members safely.
- **getByText ambiguity**: When dialog title and button share text (e.g., "Select Range"), use `getAllByText().find(el => el.tagName === 'BUTTON')`.
- **connect() state reset**: On timeout, must reset `this.state = 'disconnected'` so subsequent connect() calls work.
- **Polyfill function placement**: ESLint `no-inner-declarations` forbids function declarations inside `if` blocks — inline the logic instead.

## Operations Exposed

- `getCellValue` → `{ rawValue, computedValue, isFormula }`
- `getRangeValues` → 2D array of CellData
- `getFormula` → raw formula string or null
- `getFormulas` → 2D array of formula strings or null
- `listSheets` → string[]
- `getUsedRange` → A1-range string
- `getDependencies` → CellRef[]

## Verification

- 2800 tests pass (was 2720)
- Lint clean, type-check clean, build clean

---

# Phase 32: Menu & Toolbar Icon Refactor — COMPLETE ✅

**2026-08-08** — Migrated all menu and toolbar icons from emoji strings and inline SVGs to consistent lucide-react icons.
