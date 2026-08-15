# PLAN — SimpleSheet Development

## Goal
Achieve a clean, clutter-free UI with standardized dropdown menus, formula wizard, formula bar, R1C1 reference format, and extensible project management capabilities.

## Current State
- **3233 tests** across **135 suites**, All passing
- Lint clean (0 warnings), Type-check clean, Build clean
- Phases 1-33 complete ✅ (see [HISTORY.md](./HISTORY.md))
- Phases 34-38 complete ✅ (Extensions Architecture — see below)
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
| 39 | Template Library Expansion — all 12 templates implemented | ✅ Complete |

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

**Templates (12 of 12):**
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
| Mining | Mining Consulting |

---

## Planned Phases

### Phase 22: Conditional Formatting — PLANNED 📋
*Format cells based on their values or formulas.*

**Scope:**
- Highlight cells greater than/less than/equal to a value
- Color scales (gradient based on value)
- Data bars (in-cell bar charts)
- Icon sets (arrows, flags, traffic lights)
- Formula-based conditions (e.g., `=A1>B1`)
- Rule management UI (add, edit, reorder, delete rules)

### Phase 23: Data Validation — PLANNED 📋
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
| Resource Heatmap | Calendar view of resource allocation | High |
| Budget Tracker | Cost tracking with variance analysis | Medium |

---

## Documentation

| Document | Description |
|----------|-------------|
| [PLAN.md](./PLAN.md) | This file — current state, planned phases, active work |
| [HISTORY.md](./HISTORY.md) | Detailed records of completed Phases 1-33 |
| [CHANGELOG.md](./CHANGELOG.md) | Concise version history |
| [PROGRESS_LOG.md](./PROGRESS_LOG.md) | Chronological progress entries |
| [EXTENSIONS_ARCHITECTURE.md](./EXTENSIONS_ARCHITECTURE.md) | WBS/Project extension technical architecture |
| [BUGFIX.md](./BUGFIX.md) | Bug tracking and fixes |
| [AGENTS.md](../AGENTS.md) | Development guide for agents |

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
