# Dependency Management

## Overview

SimpleSheet's project management extension uses a workflow-driven dependency system with four relationship types, lead/lag timing, critical path analysis, and approval gating.

---

## Core Task Dependency Workflow

When establishing dependencies manually or setting up a template, follow this step-by-step logic:

### 1. Work Breakdown Structure (WBS)
Break the project down into granular, actionable tasks. **Avoid setting dependencies on high-level summary tasks** — only leaf tasks should have dependencies.

### 2. Define Relationship Types
Assign one of the four core logic relationships to linked tasks:

| Relationship | Abbreviation | Description | Example |
|-------------|--------------|-------------|---------|
| **Finish-to-Start** | FS | Task B cannot start until Task A finishes | Design Approved → Build Code |
| **Start-to-Start** | SS | Task B cannot start until Task A starts | Testing Starts → Documentation Starts |
| **Finish-to-Finish** | FF | Task B cannot finish until Task A finishes | Writing Code Ends → Code Review Ends |
| **Start-to-Finish** | SF | Task B cannot finish until Task A starts | New Shift Starts before Old Shift Ends |

### 3. Incorporate Lead & Lag

- **Lag Time**: Required delay after a predecessor ends (e.g., 2 days for concrete to dry before building).
- **Lead Time**: Acceleration allowing a successor to overlap with a predecessor (e.g., start writing user docs 3 days before software build finishes).

Formula: `Successor Start = Predecessor Date + Lag Days - Lead Days`

### 4. Identify the Critical Path
Sequence tasks to find the longest path of dependent activities. This dictates the minimum project duration and highlights tasks with **zero float (slack)**.

---

## Automation Workflows

### Workflow 1: Dynamic Auto-Scheduling
**Trigger**: Predecessor's end date shifts
**Action**: All dependent downstream tasks automatically shift their start/end dates

*Example*: A 3-day delay in UI Design automatically moves the start dates of Frontend Dev and QA Testing.

### Workflow 2: Status-Driven Triggers
**Trigger**: Predecessor status changes to "Done"
**Action**: Downstream tasks transition from "Waiting" to "Ready"

*Example*: Deploy to Staging automatically changes from Blocked to To-Do the moment Build Code is marked Complete.

### Workflow 3: Assignee Notification
**Trigger**: Task becomes unblocked (all predecessors complete)
**Action**: Assignee receives notification that task is now actionable

*Example*: QA Lead receives alert the exact minute Staging Deployment finishes.

### Workflow 4: Approval & Gate Automation
**Trigger**: External approval (form submission, sign-off, pull request)
**Action**: Next phase tasks are unblocked

*Example*: Client approving a proof marks the Approval task complete, instantly unlocking the Printing phase.

### Workflow 5: Template Cascading
**Trigger**: Project created from template
**Action**: Pre-configured dependency network is instantiated automatically

*Example*: Launching a "New Product Onboarding" template pre-links 40 tasks with relative start dates (D+0, D+3, D+5).

---

## Implementation Status

| Workflow | Status | Phase |
|----------|--------|-------|
| Manual dependency setup (FS/SS/FF/SF + lead/lag) | ✅ Complete | 37 |
| Critical path calculation | ✅ Complete | 34 |
| Dependency lines in Gantt | ✅ Complete | 37 |
| **Dynamic auto-scheduling** | 🔄 In Progress | 40 |
| **Status-driven triggers** | 📋 Planned | 40 |
| **Assignee notifications** | 📋 Planned | 41 |
| **Approval/gate automation** | 📋 Planned | 41 |
| **Template cascading** | 📋 Planned | 41 |

---

## Task Status States

| State | Description | Color |
|-------|-------------|-------|
| `not_started` | Task has not begun | Gray |
| `waiting` | Blocked by incomplete predecessor | Yellow (with ⚠ icon) |
| `ready` | All predecessors complete, ready to start | Blue |
| `in_progress` | Currently being worked on | Green |
| `done` | Completed | Dark Green |
| `on_hold` | Paused or blocked externally | Orange |

---

## Data Model

```typescript
interface TaskDependency {
  predecessorId: string;    // ID of the predecessor task
  type: DependencyType;     // 'FS' | 'SS' | 'FF' | 'SF'
  lag: number;              // Working days (can be negative for lead)
}

interface WBSTask {
  // ... other fields ...
  dependencies: TaskDependency[];
  status: TaskStatus;       // Current task state
  float: number;            // Slack time in days (0 = critical)
  isCritical: boolean;      // Part of critical path
}
```

---

## Formula Reference

When writing dependencies in cells (for sheet-as-source workflow):

| Column | Formula/Value | Description |
|--------|---------------|-------------|
| Dependency | `FS:2` or `SS:-1` | Type prefix + lag days (negative = lead) |
| Predecessor | Task ID or row number | Which task this depends on |

Examples:
- `FS:0` — Finish-to-Start with no lag (default)
- `FS:2` — Finish-to-Start with 2-day lag (wait 2 days after predecessor)
- `SS:-3` — Start-to-Start with 3-day lead (start 3 days before predecessor starts)
