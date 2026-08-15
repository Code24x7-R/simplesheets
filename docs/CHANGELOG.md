# Changelog

> Concise version history. For detailed phase records, see [HISTORY.md](./HISTORY.md). For current work, see [PLAN.md](./PLAN.md).

---

## 2026-08-15 — Phase 38: Normalized Schema & Complete Sync
- Added `ResourceRow` type and `resources[]` to `ProjectModel`
- Added conversion functions: `resourceToRow`, `rowToResource`, `riskToRow`, `rowToRisk`
- Updated `projectModelToSheetCells` to write risk and resource sections
- Updated `sheetToProject` to parse risks and resources from sheet
- Updated `createProjectSheet` to include sample risks and resources
- Project sheet now has three sections: Tasks, Risks, Resources
- **Tests:** 3233 passing (135 suites)

## 2026-08-15 — Phase 37: Enhanced Project Functions
- Resource CRUD: `addResource`, `updateResource`, `removeResource`
- `ResourceEditorModal` for add/edit/delete resources
- Dependency lines (FS/SS/FF/SF arrows) in Gantt chart
- Collapse/expand buttons for summary tasks
- Resource management UI in ProjectView toolbar
- **Tests:** 3227 passing (135 suites)

## 2026-08-14 — Phase 34-36: Extensions Architecture & Sheet-to-Project Converter
- WBS tree data model, working calendar, CPM, roll-up calculations
- Risk scoring (1-25 scale), pure-SVG Gantt renderer
- Sheet-to-project converter with auto column detection
- Tab-based Project view ("📊 Project" tab)
- Bidirectional sync: sheet ↔ project view
- **Tests:** 3193 passing (134 suites)

## 2026-08-11 — Phase 33: Formula Error Prevention Suite
- SUBTOTAL function (codes 1-11 and 101-111)
- CLEAN function + number-as-text indicator
- Delete guard with reverse dependency index
- F4 anchor cycling verification
- **Tests:** 2851 passing (115 suites)

## 2026-08-08 — Phase 32: Menu & Toolbar Icon Refactor
- Migrated all icons to lucide-react
- Consistent `w-4 h-4` sizing with color inheritance
- **Tests:** 2720 passing

## 2026-08-05 — Phase 30: Mobile Support
- Column/row size selector for mobile devices

## 2026-07-31 — Phase 21g & 28-30: Charts & Enhancements
- Chart enhancements: range picker, settings, resize handles
- Mobility platforms, date/time formatting
- **Tests:** 2647 passing (105 suites)

## 2026-07-29 — Phase 20, 24-25: Number Formatting & Formula Wizard
- Number formatting enhancements
- Formula wizard import with smart open
- **Tests:** 2589 passing

## 2026-07-28 — Phase 18-19: Sort & Filter, Unified Editing
- Sort and filter with hidden row tracking
- Unified editing architecture

## 2026-07-27 — Phase 13-17: Paste, Shortcuts, Editing Workflows
- Paste experience improvements
- Keyboard shortcut audit and fixes
- Cell editing workflows

## 2026-07-26 — Phase 12: Search & Replace

## 2026-07-25 — Phase 9-10: UI Overhaul & Nested Formula Wizard
- Menu system, dropdowns, standardized UI
- Nested formula wizard with parameter editing

## 2026-07-24 and earlier — Phase 1-8: Foundation
- Quick wins (test coverage)
- FSM hook completion
- FormulaBar, Grid, App, pdfExport, formulaEngine

---

## Cross-References

| Document | Description |
|----------|-------------|
| [PLAN.md](./PLAN.md) | Current state, planned phases, active work |
| [HISTORY.md](./HISTORY.md) | Detailed records of Phases 1-33 |
| [PROGRESS_LOG.md](./PROGRESS_LOG.md) | Chronological progress entries |
| [EXTENSIONS_ARCHITECTURE.md](./EXTENSIONS_ARCHITECTURE.md) | WBS/Project extension technical architecture |
