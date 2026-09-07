# Creator Canvas Extension Architecture

## Status

**Phase 45.1 — Scope and extension boundary defined**

This document is the design contract for the `creator-canvas` extension. Later implementation phases must preserve these boundaries unless a documented schema migration or architecture decision changes them.

## Purpose

Creator Canvas gives creative users a visual workspace for collecting inspiration, developing ideas, and organizing delivery work while retaining SimpleSheets as the structured planning and reporting surface.

A canvas project can combine:

- Notes and creative briefs
- Web links and references
- Images and video references
- Sketches and drawings
- Moodboards and storyboards
- Brainstorming and research
- Project tasks and production information

The canvas is a visualization and editing layer over normalized, workbook-persisted data. The same project information is exposed in ordinary sheets so users can use SimpleSheets formulas, sorting, filtering, planning, tracking, and accounting workflows.

## Stable Extension Identity

| Property | Value |
|---|---|
| Extension ID | `creator-canvas` |
| Display name | Creator Canvas |
| Initial schema version | `1.0.0` |
| Category | `project` |
| Persistence key | `workbook.extensions['creator-canvas']` |
| Source directory | `src/extensions/creator-canvas/` |

The extension ID and persistence key are stable public identifiers. They must not be renamed when labels or navigation wording change.

## Design Principles

1. **Sheet-backed, not sheet-hidden** — Creative data must remain available as understandable spreadsheet tables.
2. **One normalized project model** — Canvas and sheet views are projections of the same flat, serializable model.
3. **Visual freedom with structured links** — Position and style are canvas concerns; project, task, tag, and relationship data remain structured.
4. **Offline-first and client-side** — Core workflows cannot require accounts, cloud storage, or external services.
5. **References before binaries** — Store media URLs and metadata by default; large binary assets are outside the initial workbook schema.
6. **Immutable updates** — Domain operations return new state to remain compatible with history, undo/redo, and React.
7. **Extension isolation** — Canvas-specific behavior lives under `src/extensions/creator-canvas/`; core changes are limited to generic hosting, navigation, persistence, and workbook integration.
8. **Progressive capability** — The blank canvas foundation ships before domain template seed data.
9. **Accessible alternatives** — Information represented visually must also be available through sheets or list-based controls.

## Supported Project Domains

The schema will use stable machine values and user-facing labels. A project has one primary type and may use tags for cross-domain work.

| Stable value | Display label |
|---|---|
| `film-video` | Filmmaking & Video |
| `writing` | Writing |
| `design-graphic` | Graphic Design |
| `design-app` | App Design |
| `design-web` | Web Design |
| `design-motion` | Motion Design |
| `photography` | Photography |
| `marketing` | Marketing |
| `game-development` | Game Development |
| `architecture` | Architecture |
| `interiors` | Interior Design |
| `home-renovation` | Home Renovation |
| `diy` | DIY |
| `art` | Art |
| `craft` | Craft |
| `fashion-design` | Fashion Design |
| `music-production` | Music Production |
| `content-creation` | Content Creation |
| `other` | Other |

Project types describe a project's domain; they do not determine its storage shape. Domain-specific fields belong in typed node payloads or namespaced custom metadata rather than new top-level schemas.

## Supported Creative Techniques

Projects may select multiple techniques:

- Moodboarding
- Note taking
- Brainstorming
- Storyboarding
- Creative writing
- Creative briefs
- Research
- Reference collection
- Shot lists
- Character development
- Concept mapping
- Project planning

Techniques affect suggested tools, starter collections, and future template discovery. They do not fork the canonical data model.

## Phase Boundary

### Included in the core extension foundation

The initial implementation phases include:

- A blank Creator Canvas project
- Project metadata and creative direction
- A pan-and-zoom visual canvas
- Common nodes for notes, links, images, videos, sketches, and references
- Positioning, sizing, ordering, tagging, grouping, and connecting nodes
- Collections/frames for moodboards, storyboards, research, ideas, and production groupings
- Lightweight project tasks linked to canvas nodes
- Normalized workbook persistence
- Bidirectional model-to-sheet conversion
- Creator Canvas tab/view and Extensions menu integration
- Defensive validation and schema migration entry points
- Unit and React integration tests

### Explicitly deferred to the template-library phase

The following are not part of the core scaffold:

- Domain-specific seeded projects
- Template thumbnails and template gallery browsing
- Filmmaking, writing, design, photography, interior design, game development, art, fashion, craft, and content-creation seed data
- Template marketplace, import, publishing, or sharing
- AI-generated boards, briefs, images, or task plans

The later template library consumes the public model factory and validation APIs. It must not introduce a second canvas schema.

### Out of scope for version 1.0 foundation

- Real-time multi-user collaboration
- User accounts or permissions
- Built-in cloud asset hosting
- Video or audio editing
- Full vector/raster illustration tools
- Arbitrary executable embeds
- Automatic downloading or archiving of linked web content
- Large binary attachment storage inside workbook JSON
- Replacing the Project/WBS extension's scheduling, critical-path, resource, risk, EVM, or accounting engines
- Transparent two-way synchronization with third-party creative applications

## Ownership and Integration Boundary

### Creator Canvas owns

- Canvas project schema and migrations
- Node, connection, collection, tag, and creator-task operations
- Canvas layout and interaction state
- Canvas-specific editors and visualization
- Creator Canvas sheet definitions and converters
- Validation of its own extension payload
- Future Creator Canvas template registry

### SimpleSheets core owns

- Workbook lifecycle and serialization
- Sheet storage and formula evaluation
- Undo/redo history
- File import/export
- Generic extension registry and view hosting
- Application-level tabs, menus, and view switching
- Shared accessibility and shortcut conventions

### Project/WBS owns

- Detailed work breakdown structures
- Scheduling and dependency calculations
- Working calendars and critical path
- Resources and utilization
- Risks, accounting, earned value, and materials accounting

Creator Canvas may link to or convert creator tasks into Project/WBS tasks in a later interoperability phase. It must not import Project/WBS React components or mutate `workbook.extensions['project-wbs']` as part of normal canvas editing.

## Source-of-Truth Rule

The canonical persisted representation is the normalized Creator Canvas model under `workbook.extensions['creator-canvas']`. Generated Creator Canvas sheets are structured, editable projections of that model.

Synchronization follows these rules:

1. A canvas edit updates the canonical model and regenerates or patches its managed sheets in one history operation.
2. Opening/refreshing the canvas reads managed sheet edits and reconstructs the normalized model.
3. Stable IDs are written to sheets and preserved during round trips.
4. Unknown extension fields are preserved where possible during migration.
5. View-only selection and transient drag state are never written to data sheets.
6. Device-specific preferences may use local storage; workbook-relevant layout travels with the workbook.

Conflict handling and exact sheet precedence will be specified with the converter. The implementation must not maintain independent, silently diverging canvas and table models.

## Planned Managed Sheets

The foundation will reserve these names:

| Sheet | Responsibility |
|---|---|
| `Creator Project` | Project identity, domain, techniques, status, dates, and creative direction |
| `Canvas Items` | One row per node, including content metadata and layout |
| `Canvas Links` | One row per relationship/connector |
| `Creator Tasks` | Planning and delivery tasks linked to nodes |
| `Creator Collections` | Frames, boards, sequences, and visual groupings |
| `Creator Tags` | Reusable classification and color metadata |

Sheet names are centralized constants. Converters must prevent accidental duplicate managed sheets and preserve unrelated user sheets.

## Media Boundary and Safety

The initial model supports media as references and small user-authored payloads:

- Images and videos: source URL, caption, attribution, dimensions, and optional thumbnail URL
- Web links: URL, title, description, and optional preview metadata
- Sketches: compact stroke/path data with a documented size guard
- Files: filename, media type, size, and external/local reference metadata where available

The extension will not fetch remote URLs merely by loading a workbook. URL rendering must use safe browser behavior, and executable HTML/script embeds are prohibited. Blob URLs are session-local and cannot be treated as durable workbook references.

## Relationship to SimpleSheets Functions

Managed sheets are first-class SimpleSheets sheets. Users can apply formulas, named ranges, sorting, filtering, validation, and formatting to project data. The extension may provide formulas for derived values, but canonical IDs and source fields must remain plain, portable cell values.

Examples of suitable derived sheet data include:

- Task completion percentages
- Counts by status, tag, collection, or item type
- Due-date and overdue indicators
- Estimated versus actual cost totals
- Collection and storyboard sequence summaries

Formula results are projections; they do not replace stable source fields in the normalized model.

## Delivery Phases

| Phase | Deliverable | Status |
|---|---|---|
| 45.1 | Scope, ownership, identity, and extension boundary | Complete |
| 45.2 | Normalized schema, validators, defaults, and migrations | Planned |
| 45.3 | Domain operations and sheet round-trip converters | Planned |
| 45.4 | Blank canvas UI and content editors | Planned |
| 45.5 | App shell, menu, tab, history, and persistence integration | Planned |
| 45.6 | Accessibility, documentation, and verification | Planned |
| 46 | Domain template library and seed data | Deferred |

## Acceptance Criteria for This Scope Phase

- The extension has a stable ID, persistence key, directory, category, and schema version.
- Supported domains and techniques are named without creating domain-specific schemas.
- Core foundation, deferred template work, and non-goals are explicit.
- Ownership boundaries between core, Creator Canvas, and Project/WBS are explicit.
- Sheet-backed source-of-truth and media-storage policies are documented.
- Subsequent schema and UI work can proceed without unresolved extension-boundary decisions.
