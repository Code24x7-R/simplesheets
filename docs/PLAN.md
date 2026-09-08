# PLAN — SimpleSheet Development

## Goal
Achieve a clean, clutter-free UI with standardized dropdown menus, formula wizard, formula bar, R1C1 reference format, and extensible project management capabilities.

## Current State
- **4205 tests** across **180 suites**, All passing
- Lint clean (0 warnings), Type-check clean, Build clean
- Phases 1-33 complete ✅ (see [HISTORY.md](./HISTORY.md))
- Phases 34-39 complete ✅ (Extensions Architecture — see below)
- Phases 40-42 complete ✅ (Accounting, Dependency Workflow, EVM Reporting)
- **Phase 43 complete ✅ (Material Management — CapEx/OpEx/Consumption)**
- **Named Ranges complete ✅ (single cell to matrix, full CRUD, range picker + delete in edit form)**
- **Save to Cloud complete ✅ (Copy Link, Share File, Save/Open File, cloud provider scaffolding)**
- **MRU File List complete ✅ (recent files with .ssjson + cloud source tracking)**
- **Menu simplification complete ✅ (removed redundant Save/Open, unified around cloud modal)**
- **Phases 22-23 complete ✅ (Conditional Formatting, Data Validation)**
- **Review Plan v2 Stages 1-5 complete ✅ (Formula Engine, CPM Scheduling, PDF Export, Data Validation Integration, Verification)**

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

## Creator Canvas Extension — Phase 45.1 Complete ✅

Defined the scope and extension boundary for the new `creator-canvas` extension. See [CREATOR_CANVAS_ARCHITECTURE.md](./CREATOR_CANVAS_ARCHITECTURE.md).

**Boundary decisions:**
- Stable extension ID: `creator-canvas`, schema version `1.0.0`.
- Visual canvas is a structured projection of workbook-persisted normalized data.
- Core foundation includes notes, links, images, videos, sketches, references, collections, connections, and linked creator tasks.
- Creator Canvas owns its model, canvas operations, editors, sheet converters, and future templates.
- Project/WBS remains responsible for detailed scheduling, dependencies, resources, risks, EVM, accounting, and materials.
- Domain-specific template seed data is deferred to a separate Phase 46 template-library effort.
- Large binary media, collaboration, accounts, and third-party editing are out of scope for the foundation.

### Creator Canvas Extension — Phases 45.2–45.3 Complete ✅

Implemented the normalized Creator Canvas schema foundation and immutable domain operations under `src/extensions/creator-canvas/`.

- Added typed project, technique, node, payload, connection, task, collection, tag, settings, and extension-persistence contracts.
- Added default factories for blank projects and all core canvas entities.
- Added model validation with dangling relationship detection.
- Added sanitization for partial/malformed persisted data.
- Added schema migration entry point for legacy/unversioned payloads.
- Added 14 focused schema tests.
- Added immutable canvas operations for nodes, connections, tasks, collections, tags, viewport settings, and project metadata.
- Node removal cascades to connections and task links; collection/tag removal cleans up references.
- Added 9 focused domain-operation tests.
- Added six managed-sheet definitions with stable centralized names: Creator Project, Canvas Items, Canvas Links, Creator Tasks, Creator Collections, and Creator Tags.
- Added bidirectional model/sheet conversion with JSON payload preservation and workbook sync/load helpers.
- Managed-sheet sync deduplicates extension sheets while preserving unrelated user sheets.
- Added 4 round-trip, sync, and fallback-loading tests.
- Added the initial `CreatorCanvasView` with a blank grid canvas, node rendering, add-note/link/image/task actions, selection, deletion, lock toggling, zoom controls, and reset-view behavior.
- Added 5 component tests for the blank state, node creation, rendering, deletion, and zoom.
- Added `NodeEditorPanel` with controlled editing for title, description, tags, and type-specific link/image/video/quote payload fields.
- Integrated the editor panel into `CreatorCanvasView` for selected-node editing and immutable save/cancel behavior.
- Added 4 node-editor tests. Creator Canvas tests now total 36 passing.
- Registered Creator Canvas in the application shell with a Creator Canvas menu action, Canvas tab, workbook-backed model loading, save/history integration, and view switching alongside Project/WBS.
- Added shell integration without replacing or mutating unrelated workbook sheets.
- Added a standard `SheetExtension` implementation and registered Creator Canvas with `ExtensionRegistry`, including its tab view and Creator Task model.

### Creator Canvas Extension — Phase 45.4 Complete ✅

Added the first Creator Canvas starter seed for the New Creator Canvas workflow. The seed includes a welcome note, reference link, linked starter task, collection frame, tags, and a relationship connection. It is validated through the same schema integrity checks as imported workbook data, while the extension's generic view fallback remains blank for externally supplied models.

### Creator Canvas Extension — Phase 45.5 Complete ✅ (Interaction, Presets & Workflow Bubble)

- **Drag & Drop + Viewport Navigation**: Added node drag-and-drop with grid snapping, viewport zooming, and empty-background panning.
- **Visual Connections & Collections**: Rendered SVG connection paths with directional arrowheads, hover transitions, and collection boundary boxes.
- **Template Library Presets (Phase 46 Complete ✅)**: Added five starter presets (`film-video-shot-list`, `moodboard`, `novel-outline`, `web-design`, `marketing-campaign`) integrated into `MenuBar` and registered under `SheetExtension.getTemplates()`.
- **Context Bubble Menu & Common Workflows**: Added a floating action bubble for nodes and connectors supporting Copy, Paste, Duplicate, Edit, Delete, and keyboard shortcuts (`Ctrl+C`, `Ctrl+V`, `Del/Backspace`).
- **Connector Editing**: Added a connector inspector for relationship, label, color, line width/style, and arrow-end attributes, with immutable updates and connector removal.

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
| Creator Canvas | Visual creative projects backed by normalized sheets | ✅ Phase 45 complete |

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
