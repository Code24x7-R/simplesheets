# Project/WBS Extension — Normalization Plan

**Date:** 2026-08-27
**Scope:** Functional overlap, duplication, missing data flows in `src/extensions/project-wbs/`
**Baseline:** 734 tests across 31 suites (all passing)

---

## 1. Architecture Summary

### Data Model (Sheet-as-Source)
```
Sheets (Project Plan, Risks, Resources, Materials, Actuals)
  ↓ workbookToProject()
ProjectModel (serializable: TaskRow[], RiskRow[], ResourceRow[], MaterialRow[], ActualRow[])
  ↓ projectModelToProject()
Project (runtime: WBSTask tree, Risk[], Resource[], Material[], ProjectAccounting)
  ↓ Views read from Project
Gantt / Risk Register / Risk Matrix / Resources / Materials / Accounting / EVM
  ↓ CRUD via Modals
  ↓ projectToModel()
ProjectModel → persisted to workbook extensions['project-wbs']
  ↓ projectModelToWorkbook() (on sync)
Sheets updated
```

### Key Files
| File | Role |
|------|------|
| `sheetToProject.ts` | Sheet → ProjectModel → Project conversion; sheet creation |
| `projectConverter.ts` | Project → ProjectModel conversion (shared) |
| `ProjectView.tsx` | Main orchestrator: state, CRUD handlers, modal wiring |
| `treeOps.ts` | Immutable WBS tree manipulation |
| `risks.ts` | Risk scoring, CRUD, matrix generation |
| `dependencies.ts` | CPM, topological sort, critical path |
| `dependencyWorkflows.ts` | Auto-scheduling, status transitions, notifications |
| `projectAccounting.ts` | Earned value, CPI/SPI, variance calculations |
| `evmEngine.ts` | EVM report registry and metrics |
| `materialEngine.ts` | CapEx/OpEx/consumable cost calculations |
| `rollups.ts` | Summary task roll-up (dates, progress, cost, risk) |
| `calendar.ts` | Working day arithmetic |

---

## 2. Issues Found

### 2.1 Bugs (Incorrect Behavior)

#### B1. RiskMatrix uses DIFFERENT risk-level thresholds 🔴
- `risks.ts:33` canonical: `critical ≥ 20, high ≥ 12, medium ≥ 6`
- `RiskMatrix.tsx:259` local duplicate: `critical ≥ 15, high ≥ 10, medium ≥ 5`
- **Impact:** A risk scored 13 shows "high" in RiskRegister but "medium" in RiskMatrix. Inconsistent UX.
- **Fix:** Remove local `getRiskLevel` in RiskMatrix; import from `risks.ts`.

#### B2. EVM report uses SIMULATED actual cost 🔴
- `evmEngine.ts calculateEvmMetrics()`: `const ac = task.progress > 0 ? bac * (task.progress / 100) * 1.1 : 0; // Simulated: 10% over`
- **Impact:** EVM always shows 10% over budget regardless of real spend. Useless for actual tracking.
- **Fix:** Use `project.accounting.spendEntries` filtered by task for real AC.

#### B3. Accounting earned value uses hardcoded 50% placeholder 🟡
- `AccountingDashboard.tsx`: `sum + t.baselineCost * 0.5` ("placeholder since we don't have per-task progress")
- **Impact:** CPI in dashboard header is wrong.
- **Fix:** Use actual `task.progress` from task data.

### 2.2 Duplication (Functional Overlap)

#### D1. `getRiskLevel` defined twice (see B1) 🔴
- Canonical: `risks.ts:33`
- Duplicate: `RiskMatrix.tsx:259` (different thresholds)

#### D2. `TaskStatus` type defined twice 🟡
- Canonical: `types.ts:142`
- Duplicate: `dependencyWorkflows.ts:19`

#### D3. Currency formatting in 3 places 🟡
- `MaterialDashboard.tsx:272` — `formatCurrency()`
- `EvmReport.tsx:209` — `formatCurrency()`
- `projectAccounting.ts:457` — `formatVariance()` + `currencySymbol()`
- Shared util exists: `src/utils/currency.ts:formatCurrency()` — not used by extension.

#### D4. Date helpers duplicated 🟡
- `ResourceHeatmap.tsx`: `isoToDate()`, `dateToIso()`, `getDayOfWeek()`, `isWeekend()`
- `GanttChart.tsx`: `toISODate()`, `getDaysBetween()`, `computeTodayPosition()`
- Canonical: `calendar.ts` has `toISO()`, `addWorkingDays()`, `workingDaysBetween()`, etc.

#### D5. `rowToResource`/`rowToRisk` local + re-export confusion 🟢
- `sheetToProject.ts` defines `rowToResource`/`rowToRisk` (sheet→runtime)
- Also re-exports `resourceToRow`/`riskToRow` from `projectConverter.ts` (runtime→sheet)
- Re-export is unused dead code; inverse functions exist in projectConverter already.

### 2.3 Missing Data Flows

#### M1. Resource cost rate → Task cost not connected 🔴
- When a resource is assigned to a task, `task.cost` stays 0 unless manually entered.
- **Impact:** Accounting baseline, EVM BAC, CPI/SPI all show 0 for resource-driven tasks.
- **Fix:** Auto-compute `task.cost = resource.costRate * task.duration` on resource assignment.

#### M2. Risk→Task link not persisted 🟡
- `Risk` runtime type has `taskId`, but `RiskRow` serializable type does not.
- `RiskEditorModal` has no task-linking field.
- **Impact:** Risk-task associations lost on save/reload; `task.riskIds` never populated.

#### M3. Material costs not integrated into task accounting 🟡
- `MaterialDashboard` computes material costs via `materialEngine.ts`.
- `AccountingDashboard` shows `materialCostTotal` separately but per-task material costs don't flow into `TaskAccounting`.
- **Impact:** Task-level cost reports exclude material costs.

#### M4. Actuals→EVM flow broken (see B2) 🔴

---

## 3. Normalization Plan

### Phase 1: Bug Fixes (correctness)
| # | Issue | File | Change |
|---|-------|------|--------|
| 1 | B1/D1 RiskMatrix thresholds | `RiskMatrix.tsx` | Remove local `getRiskLevel`, import from `risks.ts` |
| 2 | B2 EVM simulated AC | `evmEngine.ts` | Use real `spendEntries` for AC |
| 3 | B3 Accounting EV placeholder | `AccountingDashboard.tsx` | Use `task.progress` for EV |

### Phase 2: Deduplication
| # | Issue | File | Change |
|---|-------|------|--------|
| 4 | D2 TaskStatus duplicate | `dependencyWorkflows.ts` | Import from `types.ts`, remove local |
| 5 | D3 Currency formatting | `MaterialDashboard.tsx`, `EvmReport.tsx` | Use `src/utils/currency.ts` |
| 6 | D4 Date helpers | `ResourceHeatmap.tsx`, `GanttChart.tsx` | Use `calendar.ts` utilities |
| 7 | D5 Dead re-export | `sheetToProject.ts` | Remove unused re-export |

### Phase 3: Missing Data Flows
| # | Issue | File | Change |
|---|-------|------|--------|
| 8 | M1 Resource→Task cost | `ProjectView.tsx`, `sheetToProject.ts` | Auto-compute task.cost from resource rate |
| 9 | M2 Risk→Task persistence | `types.ts`, `risks.ts`, `RiskEditorModal.tsx` | Add `taskId` to RiskRow, wire modal |
| 10 | M3 Material→Task accounting | `projectAccounting.ts` | Include per-task material costs |

### Phase 4: Tests & Documentation
| # | Task |
|---|------|
| 11 | Add tests for all fixes |
| 12 | Full verification pass |
| 13 | Update PROGRESS_LOG.md |

---

## 4. Risk Assessment

- **Phase 1:** Medium — changes to EVM/accounting math may shift test expectations.
- **Phase 2:** Low — pure dedup, behavior-preserving.
- **Phase 3:** Medium — new data flows need careful testing, especially resource→cost.
- **Mitigation:** Run full test suite after each phase; TDD for new logic.
