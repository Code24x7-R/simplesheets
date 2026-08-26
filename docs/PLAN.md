# PLAN — SimpleSheet Development

## Goal
Achieve a clean, clutter-free UI with standardized dropdown menus, formula wizard, formula bar, R1C1 reference format, and extensible project management capabilities.

## Current State
- **3952 tests** across **164 suites**, All passing
- Lint clean (0 warnings), Type-check clean, Build clean
- Phases 1-33 complete ✅ (see [HISTORY.md](./HISTORY.md))
- Phases 34-39 complete ✅ (Extensions Architecture — see below)
- Phases 40-42 complete ✅ (Accounting, Dependency Workflow, EVM Reporting)
- **Phase 43 complete ✅ (Material Management — CapEx/OpEx/Consumption)**
- **Named Ranges complete ✅ (single cell to matrix, full CRUD)**
- **Save to Cloud complete ✅ (Copy Link, Share File, Save/Open File, cloud provider scaffolding)**
- **MRU File List complete ✅ (recent files with .ssjson + cloud source tracking)**
- **Menu simplification complete ✅ (removed redundant Save/Open, unified around cloud modal)**
- Phases 22-23 planned 📋 (Conditional Formatting, Data Validation)

---

## Active Work

### Extensions Architecture (Phases 34-39) — IN PROGRESS 🔄

The WBS/Project extension is actively being expanded. See [EXTENSIONS_ARCHITECTURE.md](./EXTENSIONS_ARCHITECTURE.md) for technical details.

| Phase | Description | Status |
|-------|-------------|--------|
| 34 | Extensions Architecture — WBS data model, Gantt renderer | ✅ Complete |
| 35 | Sheet-to-Project Converter — auto column detection, bidirectional sync | ✅ Complete |
| 36 | Tab-Based Project View — "📊 Project" tab as peer to sheet tabs | ✅ Complete |
| 37 | Enhanced Project Functions — resource CRUD, dependency lines, collapse/expand | ✅ Complete |
| 38 | Normalized Schema & Complete Sync — all data persisted and synced | ✅ Complete |
| 39 | Template Library Expansion — all 16 templates implemented | ✅ Complete |
| 40 | Project Accounting Dashboard — baseline, allocation, estimate, actual spend | ✅ Complete |
| 41 | Dependency Workflow Drawer — tree + right panel with impact preview | ✅ Complete |
| 42 | EVM Cost Performance Reporting — CV, VAC, CPI, SPI, EAC, ETC | ✅ Complete |
| 43 | Material Management — CapEx/OpEx, allocation, consumption | ✅ Complete |
| 44 | Change Log & Material Cost Integration — dependency tracking, capitalization config | ✅ Complete |

**Extension Features:**
- WBS hierarchy (tree structure with parent-child relationships)
- Gantt chart rendering (pure SVG, day/week/month zoom)
- Task dependencies (FS/SS/FF/SF) with critical path
- Risk management (probability × impact scoring, 5×5 matrix)
- Resource assignment and utilization tracking
- Working calendar with holidays
- Roll-up calculations for summary tasks
- Sheet-as-source with bidirectional sync
- 12 pre-built templates across 8 categories

**Templates (16 of 16):**
| Category | Templates |
|----------|----------|
| Generic | Simple WBS |
| Web/Dev | Website Project |
| Software | Software Development, Agile/Sprint Planning |
| Construction | Home Renovation, Construction Project |
| Events | Event Planning |
| Marketing | Marketing Campaign |
| Business | Business Project, Product Launch |
| IT | IT Migration |
| Real Estate | Real Estate Photography |
| Mining | Mining Consulting |

### Phase 40: Project Accounting Dashboard — IN PROGRESS 🔄
*Four-table cost tracking with variance analysis.*

**Tables:**
| Table | Purpose | Key Fields |
|-------|---------|------------|
| Baseline | Original approved plan | Task, Start, End, Duration, Cost, Resource |
| Approved Allocation | Budget approved per task | Task, Allocated Budget, Approved Date, Approver |
| Current Estimate | Rolling forecast (baseline + changes) | Task, Estimated Cost, EAC, ETC, Variance |
| Actual Spend | Real costs incurred | Task, Date, Amount, Vendor/Source, Notes |

**Features:**
- Variance columns (Estimate vs Baseline, Actual vs Allocated)
- EAC (Estimate at Completion) = ETC + Actual Spend
- CPI (Cost Performance Index) = Earned Value / Actual Cost
- SPI (Schedule Performance Index) = Earned Value / Planned Value
- Change log for dependency-driven cost/timeline shifts

### Phase 43: Material Management — IN PROGRESS 🔄
*CapEx/OpEx classification, material allocation, consumption tracking.*

**Material Categories:**
| Category | Financial Treatment | Key Metrics |
|----------|-------------------|-------------|
| Purchased Assets (CapEx) | Capitalized & depreciated | TCO, Depreciation Rate, Salvage Value |
| Rented/Leased (OpEx) | Expensed in period | Burn Rate, Rental Rate, Idle Time |
| Raw Materials (COGS) | Expensed as consumed | Unit Rate, Wastage %, Carrying Cost |

**Features:**
- Material registry with classification (CapEx/OpEx/Consumption)
- Allocation of materials to tasks/projects
- Consumption tracking with wastage calculation
- CapEx depreciation (straight-line) over useful life
- OpEx recurring expense tracking (daily/weekly/monthly rates)
- Capitalization threshold configuration
- Total Cost of Ownership (TCO) calculations
- Carrying/holding cost tracking (storage, insurance)
- Integration with project accounting dashboard

**UI Layout:**
- WBS Tree on left (existing)
- Slide-out dependency panel on right when task selected
- Dependency cards showing predecessor, type, lag with inline edit
- Impact preview at bottom: schedule delta + cost delta

**Integration:**
- Dependency changes trigger `autoScheduleSuccessors()` for date recalculation
- Cost impact computed from resource rates × duration changes
- Impact preview feeds directly into accounting dashboard tables
- Full audit trail of why costs/schedule shifted

---

## Planned Phases

### Phase 22: Conditional Formatting — ✅ Complete
*Format cells based on their values or formulas.*

**Scope:**
- Highlight cells greater than/less than/equal to a value
- Color scales (gradient based on value)
- Data bars (in-cell bar charts)
- Icon sets (arrows, flags, traffic lights)
- Formula-based conditions (e.g., `=A1>B1`)
- Rule management UI (add, edit, reorder, delete rules)

### Phase 23: Data Validation — ✅ Complete
*Restrict what can be entered in cells.*

**Scope:**
- Whole number validation (min, max)
- Decimal validation
- List validation (dropdown from range)
- Date validation
- Text length validation
- Custom formula validation
- Input messages and error alerts

---

## Future Extensions

The extensions architecture supports adding new extensions without modifying core:

| Extension | Description | Priority |
|-----------|-------------|----------|
| Kanban Board | Task cards on a board with columns (To Do, In Progress, Done) | Medium |
| Mind Map | Radiative tree visualization of project scope | Low |
| PERT Chart | Probabilistic task duration with three-point estimates | Medium |
| Resource Heatmap | Calendar view of resource allocation | ✅ Complete |
| Budget Tracker | Cost tracking with variance analysis | 🔄 In Progress (Phase 40) |
| Earned Value Chart | S-curve visualization of PV, EV, AC over time | Medium |
| What-If Scenarios | Save/compare multiple schedule scenarios | Low |

---

## Documentation

| Document | Description |
|----------|-------------|
| [PLAN.md](./PLAN.md) | This file — current state, planned phases, active work |
| [HISTORY.md](./HISTORY.md) | Detailed records of completed Phases 1-33 |
| [CHANGELOG.md](./CHANGELOG.md) | Concise version history |
| [PROGRESS_LOG.md](./PROGRESS_LOG.md) | Chronological progress entries |
| [EXTENSIONS_ARCHITECTURE.md](./EXTENSIONS_ARCHITECTURE.md) | WBS/Project extension technical architecture |
| [DependencyManagement.md](./DependencyManagement.md) | Dependency rules, relationship types, automation workflows |
| [BUGFIX.md](./BUGFIX.md) | Bug tracking and fixes |
| [AGENTS.md](../AGENTS.md) | Development guide for agents |
| [MANUAL.md](../MANUAL.md) | End-user documentation |
| [README.md](../README.md) | Project overview and developer guide |

---

## Quick Commands

| Purpose | Command |
| :--- | :--- |
| **All Tests & Coverage** | `npm test` |
| **Single Test File** | `npx jest path/to/file.test.ts` |
| **Lint** | `npm run lint` |
| **Type Check** | `npm run type-check` |
| **Production Build** | `npm run build` |
| **Full Verification Pass** | `npm test && npm run lint && npm run type-check && npm run build` |

---

## Architecture Quick Reference

- **Cell State FSM** (`src/hooks/useCellEditing.ts`): `SELECT` → `ENTER` → `EDIT` → `POINT`
- **Formula Engine** (`src/utils/`): AST parsing (`formulaParser.ts`) → Evaluation & Dependency Tree (`formulaEngine.ts`)
- **State Architecture**: React Context (`HistoryContext`, `FreezeContext`, `PrintSetupContext`) + `useReducer` in `App.tsx`
- **Virtualization**: `@tanstack/react-virtual` for windowed rendering
- **Extensions**: `ExtensionRegistry` singleton with `workbook.extensions` JSON persistence
