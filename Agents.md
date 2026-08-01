# AGENTS.md — SimpleSheet Development Guide

## 1. Project Summary
- **App:** SimpleSheet — browser-based Excel-compatible spreadsheet app (React + TypeScript + Vite + Tailwind). Fully client-side.
- **Testing:** Jest + React Testing Library (Cypress is removed).
- **Quality Targets:** 
  - Line Coverage: ≥ 95%
  - Branch Coverage: ≥ 85% (Global target)
  - Zero lint/type errors on build.

---

## 2. Agent Rules & Constraints
- **Do NOT add `/* istanbul ignore next */`** to force coverage target compliance without explicit user approval.
- **Do NOT modify stale waterfall tasks in `tasks.json`.** Refer to `PLAN.md` (Features) or `BUGFIX.md` (Bugs).
- Always run static checks before declaring a task complete: `npm run lint && npm run type-check`.

---

## 3. Quick Commands

| Purpose | Command |
| :--- | :--- |
| **All Tests & Coverage** | `npm test` |
| **Single Test File** | `npx jest path/to/file.test.ts` |
| **Pattern Test** | `npx jest --testPathPattern=formulaEngine` |
| **Lint** | `npm run lint` |
| **Type Check** | `npm run type-check` |
| **Production Build** | `npm run build` |
| **Full Verification Pass** | `npm test && npm run lint && npm run type-check && npm run build` |

---

## 4. Development Tracks & Workflows

### 4.1 Feature Work Track (`PLAN.md`)
1. Select active task in `PLAN.md`.
2. Write unit tests *first* targeting uncovered logic/branches.
3. Write implementation code to pass tests.
4. Run full verification pass.
5. Update task status and update coverage stats in `PLAN.md`.
6. Log completion in `PROGRESS_LOG.md` with header prefix `[FEATURE]`.

### 4.2 Bugfix Work Track (`BUGFIX.md`)
1. **Log Open Bug:** Add symptom, suspected file, date, and impact (🔴 High / 🟡 Medium / 🟢 Low).
2. **Reproduce:** Write a failing Jest test reproducing the issue.
3. **Fix & Verify:** Apply root-cause fix and run full verification pass.
4. **Update Logs:** Move bug to "Recently Fixed" in `BUGFIX.md` (documenting root cause and fix) and log in `PROGRESS_LOG.md` with header prefix `[BUGFIX]`.

---

## 5. High-Priority Low-Coverage Files (< 85% Branch Coverage)

Prioritize branch coverage improvements on these core files first:
1. `src/utils/formulaEngine.ts` — Math, trig, string, date, and IS function branches.
2. `src/App.tsx` — Handler branches and event orchestrations.
3. `src/context/HistoryContext.tsx` — Defensive branches.

---

## 6. Architecture Quick Reference

- **Cell State FSM (`src/hooks/useCellEditing.ts`):** `SELECT` → `ENTER` → `EDIT` → `POINT`
- **Formula Engine (`src/utils/`):** AST parsing (`formulaParser.ts`) -> Evaluation & Dependency Tree (`formulaEngine.ts`).
- **State Architecture:** React Context (`HistoryContext`, `FreezeContext`, `PrintSetupContext`) + `useReducer` in `App.tsx`. No Redux/Zustand.
- **Virtualization:** `@tanstack/react-virtual` for windowed rendering (Filter mode uses `visibleRowIndices`).

---

## 7. Common Agent Pitfalls to Avoid
1. **Virtualizer Mocks:** Always include `measure: jest.fn()` when mocking the virtualizer in tests.
2. **Stale Closures:** Use refs (`selectionRef`, `sessionRef`) for state inside event handlers and callbacks.
3. **Modal Shortcuts:** Ensure inputs in modals call `e.stopPropagation()` so global shortcuts don't trigger.
4. **Timing Issues:** `editInputRef.current` is `null` on first render; always null-check before invoking methods.