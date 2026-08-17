# Extensions Architecture — WBS/Project Extension

## Overview

SimpleSheets uses an extensions architecture that allows new functionality to be added without modifying core spreadsheet code. The first (and currently only) extension is the **WBS/Project** extension, which adds project management capabilities: Work Breakdown Structure, Gantt charts, risk management, and resource assignment.

### Design Principles

1. **"Simple" positioning** — The first extension is deliberately narrow in scope
2. **Sheet-as-source** — Spreadsheets are the data source; the project view is a visualization layer
3. **Normalized schema** — All extension data is stored in a structured, serializable format
4. **Bidirectional sync** — Edit in sheet → see in view; edit in view → save to sheet
5. **Extension isolation** — Each extension has its own directory, types, and components

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SimpleSheet App                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        App.tsx                                      │ │
│  │  - Workbook state (sheets, activeSheet, extensions)                │ │
│  │  - View switching (sheet view vs project view)                     │ │
│  │  - Extension data persistence                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│              ┌───────────────┼───────────────┐                           │
│              ▼               ▼               ▼                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  SheetTabs   │  │   MenuBar    │  │      ExtensionRegistry        │  │
│  │  [Sheet1]    │  │  Extensions  │  │  - register(extension)        │  │
│  │  [Sheet2]    │  │    └── WBS   │  │  - get(id)                    │  │
│  │  [Project]   │  │       └── New│  │  - getAll()                   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    WBS/Project Extension                            │ │
│  │                                                                      │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────────┐ │ │
│  │  │Project View │  │ Project     │  │  Sheet-to-Project          │ │ │
│  │  │(Gantt/WBS/  │◄─┤ Sheet       │◄─┤  Converter                 │ │ │
│  │  │ Risk views) │  │ (data entry)│  │  - Auto-detect columns     │ │ │
│  │  └─────────────┘  └─────────────┘  │  - Parse tasks/risks/rsrc  │ │ │
│  │         │                           │  - Build tree              │ │ │
│  │         ▼                           └────────────────────────────┘ │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │              Data Model (Normalized Schema)                 │   │ │
│  │  │  ProjectModel { tasks[], risks[], resources[] }             │   │ │
│  │  │  Stored in: workbook.extensions['project-wbs']              │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Normalized Schema (Serializable)

The `ProjectModel` is the canonical serialized representation stored in `workbook.extensions`. It uses flat arrays with references (instead of nested trees) for JSON compatibility.

```
ProjectModel
├── id: string
├── name: string
├── description: string
├── startDate: string (ISO date)
├── endDate: string (ISO date)
├── tasks: TaskRow[]
├── risks: RiskRow[]
└── resources: ResourceRow[]

TaskRow (flat — tree built at runtime)
├── id: string
├── name: string
├── startDate: string
├── endDate: string
├── duration: number (working days)
├── parentId: string | null (reference to another TaskRow)
├── dependencies: string[] (predecessor task IDs)
├── progress: number (0-100)
├── resourceId: string | null
├── isMilestone: boolean
├── color: string (hex)
└── notes: string

RiskRow
├── id: string
├── title: string
├── category: 'technical'|'schedule'|'cost'|'resource'|'external'|'quality'|'scope'|'other'
├── probability: number (1-5)
├── impact: number (1-5)
├── status: 'identified'|'assessing'|'mitigating'|'monitoring'|'occurred'|'closed'
├── ownerId: string | null
├── mitigationPlan: string
└── notes: string

ResourceRow
├── id: string
├── name: string
├── role: string
├── costRate: number (per hour/day)
├── costCurrency: string
├── availability: number (0-100%)
└── color: string (hex)
```

### Runtime Model (In-Memory)

The runtime model converts flat rows into a tree structure for visualization:

```
Project (runtime)
├── id: string
├── name: string
├── description: string
├── startDate: string
├── endDate: string
├── calendar: WorkingCalendar
├── resources: Resource[]
├── risks: Risk[]
└── wbs: WBSTask[] (root-level, nested children)

WBSTask (tree node)
├── id: string
├── name: string
├── description: string
├── level: number (derived from tree depth)
├── parentId: string | null
├── children: WBSTask[] (nested)
├── startDate: string
├── endDate: string
├── duration: number
├── progress: number
├── effort: number
├── effortUnit: 'hours'|'storyPoints'|'days'
├── cost: number
├── costCurrency: string
├── responsibleResourceId: string | null
├── dependencies: TaskDependency[]
├── isMilestone: boolean
├── isSummary: boolean (has children)
├── collapsed: boolean (UI state)
├── color: string
├── riskIds: string[]
└── customFields: Record<string, unknown>
```

### Extension Persistence

```typescript
interface ExtensionData {
  extensionId: string;       // 'project-wbs'
  schemaVersion: string;     // '1.0.0'
  data: {
    project: ProjectModel | null;
    columnMapping: ColumnMapping | null;
    sourceSheetId: string | null;
  };
}

interface Workbook {
  // ... existing fields ...
  extensions?: Record<string, ExtensionData>;
}
```

---

## Component Structure

### File Organization

```
src/extensions/
├── types.ts                    # All shared type definitions
├── ExtensionRegistry.ts        # Extension lifecycle management
└── project-wbs/                # WBS/Project extension
    ├── treeOps.ts              # Tree CRUD operations
    ├── calendar.ts             # Working day calculations
    ├── dependencies.ts         # Topological sort, CPM, cycle detection
    ├── rollups.ts              # Summary task roll-up calculations
    ├── risks.ts                # Risk CRUD, scoring, matrix
    ├── projectConverter.ts     # Shared Project ↔ Model conversion
    ├── sheetToProject.ts       # Sheet ↔ Project converter
    ├── GanttChart.tsx          # SVG Gantt renderer
    ├── RiskRegister.tsx        # Sortable/filterable risk table
    ├── RiskMatrix.tsx          # 5×5 SVG grid visualization
    ├── ProjectView.tsx         # Main container (Gantt/WBS/Risk views)
    ├── WBSTreePanel.tsx        # Interactive tree sidebar
    ├── TaskEditorModal.tsx     # Task add/edit modal
    ├── RiskEditorModal.tsx     # Risk add/edit modal
    ├── ResourceEditorModal.tsx # Resource add/edit modal
    ├── ColumnMappingDialog.tsx # Column mapping confirmation
    └── templates/              # Pre-built project templates
        ├── index.ts            # Template registry
        ├── simple.ts           # Simple WBS template
        ├── website.ts          # Website project template
        └── software.ts         # Software project template
```

### Component Hierarchy

```
ProjectView (container)
├── Toolbar
│   ├── View mode toggle (Gantt | Risk Register | Risk Matrix)
│   ├── Zoom controls (Day | Week | Month)
│   ├── + Add Task button
│   ├── 👥 Resources button
│   ├── ↑ Convert Sheet button
│   ├── ↓ Save button
│   └── Close button
├── WBSTreePanel (left sidebar, Gantt view only)
│   └── Recursive tree with expand/collapse
├── GanttChart (main content)
│   ├── Timeline header
│   ├── Task bars / Milestone diamonds
│   ├── Dependency arrows
│   ├── Progress overlay
│   ├── Today marker
│   └── Critical path highlighting
├── RiskRegister (table view)
│   └── Sortable/filterable rows
├── RiskMatrix (5×5 grid)
│   └── Color-coded risk bubbles
├── TaskEditorModal
├── RiskEditorModal
├── ResourceEditorModal
└── ColumnMappingDialog
```

---

## Sync Flow

### Sheet → Project View (Convert Sheet)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Sheet Cells │────▶│  Column Mapping  │────▶│  ProjectModel    │
│  (raw data)  │     │  (auto-detect +  │     │  (normalized)    │
│              │     │   user confirm)  │     │                  │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Runtime Project │
                                              │  (tree structure)│
                                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Project View    │
                                              │  (Gantt/WBS/Risk)│
                                              └──────────────────┘
```

### Project View → Sheet (Save)

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Project View    │────▶│  projectToModel  │────▶│  ProjectModel│
│  (runtime state) │     │  (flatten tree)  │     │  (normalized)│
└──────────────────┘     └──────────────────┘     └──────┬───────┘
                                                         │
                                                         ▼
                                                ┌──────────────────┐
                                                │  projectModelTo  │
                                                │  SheetCells      │
                                                └────────┬─────────┘
                                                         │
                                                         ▼
�──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  workbook.   │◄────│  handleSave      │────▶│  Sheet Cells │
│  extensions  │     │  ProjectData     │     │  (updated)   │
└──────────────┘     └──────────────────┘     └──────────────┘
```

### Sheet Layout

The project sheet contains three distinct sections:

| Section | Start Row | Columns |
|---------|-----------|---------|
| **Tasks** | 0 | Task, Start Date, End Date, Duration, Parent, Dependency, Progress, Resource, Milestone, Color, Notes |
| **Risks** | tasks_end + 2 | Risk, Category, Probability, Impact, Status, Owner, Mitigation Plan, Notes |
| **Resources** | risks_end + 2 | Resource, Role, Cost Rate, Currency, Availability %, Color |

---

## Entity CRUD Matrix

| Entity | Create | Read | Update | Delete | Sheet Edit |
|--------|--------|------|--------|--------|------------|
| **Task** | + Add Task modal | Gantt bar / Tree node | Double-click modal | × button | Edit cells |
| **Parent/Child** | Set parent in modal | Tree indentation | Move in tree | Cascade delete | Parent column |
| **Milestone** | Checkbox in modal | Diamond shape | Toggle flag | — | yes/no cell |
| **Dependency** | Select predecessor | Arrow in Gantt | Change type/lag | Remove dep | Row ref cell |
| **Risk** | + Add Risk modal | Risk Register row | Edit modal | Delete button | Edit cells |
| **Resource** | + Resources modal | Resource dropdown | Edit modal | Delete button | Edit cells |
| **WBS Collapse** | — | +/- button | Toggle state | — | — |

---

## Core Algorithms

### Tree Operations (`treeOps.ts`)

All tree operations are **immutable** — they return new trees, never mutate inputs.

| Function | Purpose |
|----------|---------|
| `findTask(tree, id)` | Find task by ID anywhere in tree |
| `findParent(tree, id)` | Get parent of a task |
| `getAncestors(tree, id)` | Path from root to task |
| `getDescendants(task)` | All tasks below (flat) |
| `addTask(tree, parentId, task)` | Add child under parent |
| `removeTask(tree, id)` | Remove task + descendants |
| `moveTask(tree, id, newParentId, index)` | Reparent and reorder |
| `toggleCollapsed(tree, id)` | Toggle collapse state |
| `flattenToRows(tree)` | Flat list for sheet display |
| `detectCycles(tree)` | Detect circular dependencies |
| `validateTree(tree)` | Detect orphans, cycle errors |
| `getAllTasks(tree)` | All tasks (flat) |
| `updateTask(tree, id, fn)` | Apply update function |
| `addResource(resources, resource)` | Add resource |
| `updateResource(resources, id, changes)` | Modify resource |
| `removeResource(resources, id)` | Remove resource |
| `getTasksForResource(tree, resourceId)` | Tasks assigned to resource |
| `getResourceEffort(tree, resourceId)` | Total effort for resource |
| `getResourceUtilization(tree, resourceId, days)` | Utilization percentage |

### Calendar (`calendar.ts`)

| Function | Purpose |
|----------|---------|
| `createDefaultCalendar()` | Mon-Fri, 8h/day, no holidays |
| `isWorkingDay(calendar, date)` | Check if date is working |
| `addWorkingDays(start, days, calendar)` | Add working days skipping weekends/holidays |
| `getWorkingDaysBetween(start, end, calendar)` | Count working days |
| `getNextWorkingDay(date, calendar)` | Skip to next working day |

### Dependencies (`dependencies.ts`)

| Function | Purpose |
|----------|---------|
| `topologicalSort(tasks)` | Order tasks by dependencies |
| `criticalPathMethod(tasks, calendar)` | Calculate earliest/latest start/finish |
| `detectDependencyCycles(tasks)` | Find circular dependencies |
| `getCriticalPath(tasks)` | Tasks with zero total float |

### Rollups (`rollups.ts`)

| Function | Purpose |
|----------|---------|
| `rollUpDates(task)` | Compute parent dates from children |
| `rollUpProgress(task)` | Weighted average progress |
| `rollUpCost(task)` | Sum of descendant costs |
| `rollUpEffort(task)` | Sum of descendant effort |
| `rollUpRiskExposure(task)` | Aggregate risk score |

### Risks (`risks.ts`)

| Function | Purpose |
|----------|---------|
| `createRisk(params)` | Create risk with defaults |
| `updateRisk(project, id, changes)` | Modify risk |
| `addRisk(project, risk)` | Add risk to project |
| `removeRisk(project, id)` | Remove risk |
| `closeRisk(project, id)` | Mark as closed |
| `getRiskScore(probability, impact)` | Calculate score (1-25) |
| `getRiskLevel(score)` | critical/high/medium/low |
| `getRiskSummary(project)` | Summary stats |
| `getRiskMatrix(project)` | Generate matrix data |
| `getTopRisks(project, n)` | Top N risks by score |

---

## Templates

Templates seed a project with pre-built tasks, risks, and resources. All 12 planned templates are implemented.

| # | Template | File | Category | Phases | Tasks |
|---|----------|------|----------|--------|-------|
| 1 | Simple WBS | `templates/simple.ts` | Generic | Planning → Execution → Closure | 7 |
| 2 | Website Project | `templates/website.ts` | Web/Dev | Discovery → Design → Dev → QA → Launch | 15 |
| 3 | Software Development | `templates/software.ts` | Software | Requirements → Design → Dev → QA → Deploy | 17 |
| 4 | Home Renovation | `templates/renovation.ts` | Construction | Planning → Demo → Structure → MEP → Finishing | 22 |
| 5 | Event Planning | `templates/event.ts` | Events | Setup → Catering → Marketing → Logistics → Day-of | 16 |
| 6 | Marketing Campaign | `templates/marketing.ts` | Marketing | Research → Content → Distribution → Launch → Analysis | 15 |
| 7 | Business Project | `templates/business.ts` | Business | Feasibility → Planning → Execution → Review | 12 |
| 8 | Product Launch | `templates/product.ts` | Business | Development → Marketing → Readiness → Launch → Post | 17 |
| 9 | IT Migration | `templates/it-migration.ts` | IT | Audit → Planning → Migration → Validation → Cutover | 18 |
| 10 | Agile/Sprint Planning | `templates/agile.ts` | Software | Backlog → Sprint 1-3 → Release | 18 |
| 11 | Construction Project | `templates/construction.ts` | Construction | Pre-con → Foundation → Structure → MEP → Finishing | 25 |
| 12 | Mining Consulting | `templates/mining.ts` | Mining | Scoping → Assessment → Analysis → Report → Presentation | 14 |

### Template Structure

```typescript
function createSimpleWBS(): Project {
  return {
    id: 'simple-wbs',
    name: 'Simple WBS',
    description: '...',
    startDate: '2026-01-05',
    endDate: '2026-01-28',
    calendar: createDefaultCalendar(),
    resources: [
      { id: 'res-1', name: 'Project Manager', role: 'PM', ... },
      { id: 'res-2', name: 'Developer', role: 'Dev', ... },
    ],
    risks: [
      createRisk({ id: 'risk-1', title: 'Scope creep', ... }),
    ],
    wbs: [
      // Tree-structured tasks with children
    ],
  };
}
```

---

## Adding a New Extension

To add a new extension (e.g., Kanban, Mind Map, PERT):

1. **Create directory**: `src/extensions/<extension-name>/`
2. **Define types**: Add to `src/extensions/types.ts` or create local types
3. **Create components**: Build React components following the pattern
4. **Register**: Add to `ExtensionRegistry`
5. **Add menu item**: Update `MenuBar.tsx` with `on<Extension>` handler
6. **Wire persistence**: Use `workbook.extensions['<extension-id>']`

### Extension Interface

```typescript
interface SheetExtension {
  id: string;
  name: string;
  icon: string;
  description: string;
  component: React.ComponentType<ExtensionProps>;
  onNew?: () => void;
  onOpen?: (sheetId: string) => void;
}

interface ExtensionProps {
  activeSheet: Sheet | null;
  onClose: () => void;
}
```

---

## Testing Strategy

Each module has co-located tests (`*.test.ts` / `*.test.tsx`).

| Test File | Coverage |
|-----------|----------|
| `treeOps.test.ts` | 62 tests — tree CRUD, resource CRUD, cycles |
| `calendar.test.ts` | 42 tests — working day calculations |
| `dependencies.test.ts` | 19 tests — CPM, topological sort |
| `rollups.test.ts` | 22 tests — summary roll-ups |
| `risks.test.ts` | 23 tests — risk scoring, matrix |
| `sheetToProject.test.ts` | 33 tests — converter, sheet sync |
| `GanttChart.test.tsx` | 15 tests — SVG rendering |
| `RiskRegister.test.tsx` | 15 tests — risk table |
| `RiskMatrix.test.tsx` | 8 tests — risk grid |
| `TaskEditorModal.test.tsx` | 11 tests — task modal |
| `RiskEditorModal.test.tsx` | 11 tests — risk modal |
| `ResourceEditorModal.test.tsx` | 12 tests — resource modal |
| `WBSTreePanel.test.tsx` | 8 tests — tree sidebar |
| `ProjectView.test.tsx` | 9 tests — main container |
| `ExtensionRegistry.test.ts` | 16 tests — extension lifecycle |
| `templates/index.test.ts` | 20 tests — template validation |

---

## Key Design Decisions

### 1. Flat vs. Tree Storage

**Decision**: Store flat rows with `parentId` references in `ProjectModel`, build tree at runtime.

**Rationale**:
- JSON serialization is simpler with flat arrays
- Sheet data is inherently flat (rows)
- Tree structure can be rebuilt deterministically from flat data
- Avoids circular reference issues in JSON

### 2. Column Mapping

**Decision**: Auto-detect columns from header keywords, allow user confirmation.

**Rationale**:
- Reduces friction for new users
- Supports arbitrary column ordering
- Works with existing spreadsheets

### 3. Bidirectional Sync

**Decision**: Sheet is source of truth; project view is visualization layer.

**Rationale**:
- Users can edit data in familiar spreadsheet format
- Changes persist in standard sheet cells
- Project view provides visualization without data lock-in

### 4. Pure SVG Rendering

**Decision**: Gantt chart uses pure SVG, no external chart library.

**Rationale**:
- Keeps bundle size small
- Full control over styling and interaction
- No dependency on heavy chart libraries

### 5. Immutable Tree Operations

**Decision**: All tree operations return new trees, never mutate inputs.

**Rationale**:
- Compatible with React's state model
- Simplifies undo/redo implementation
- Prevents accidental side effects

---

## Future Extensions

The architecture supports adding new extensions:

- **Kanban Board**: Task cards on a board with columns (To Do, In Progress, Done)
- **Mind Map**: Radiative tree visualization of project scope
- **PERT Chart**: Probabilistic task duration with three-point estimates
- **Resource Heatmap**: Calendar view of resource allocation
- **Budget Tracker**: Cost tracking with variance analysis

Each new extension follows the same pattern:
1. Define serializable data model
2. Store in `workbook.extensions['<id>']`
3. Create React components for visualization
4. Add menu items and handlers
