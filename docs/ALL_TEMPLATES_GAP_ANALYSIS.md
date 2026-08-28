# All Templates - Comprehensive Gap Analysis & Remediation

**Date:** 2026-08-28
**Scope:** All 13 project templates
**Goal:** Ensure consistent, complete data across all views

---

## Cross-Template Gap Summary

| Gap | Templates Affected | Severity |
|-----|-------------------|----------|
| Spend entries without material allocations | ALL 13 | 🔴 High |
| Leaf tasks missing cost/effort | 9 of 13 | 🔴 High |
| Leaf tasks without dependencies | ALL 13 | 🟡 Medium |
| Tasks without resource assignments | 5 of 13 | 🟡 Medium |
| Risks not linked to specific tasks | 2 of 13 | 🟡 Medium |
| No post-project closure tasks | ALL 13 | 🟡 Medium |
| No revenue/business metrics | ALL 13 | 🟢 Low |

---

## Gap 1: Spend Entries Without Material Allocations (ALL templates)

### Problem
Every template has spend entries that lack corresponding material allocations. This breaks the spend-to-material traceability chain.

### Root Cause
Spend entries track cash outflows, but not all have matching material consumption records.

### Remediation: Add Missing Allocations

#### agile.json (9 missing)
```json
{"id": "alloc-s1-2", "materialId": "mat-1", "taskId": "s1-2", "allocatedQuantity": 1, "consumedQuantity": 1, "allocationDate": "2026-11-07", "expectedReturnDate": null, "actualCost": 50, "notes": "Jira for Sprint 1"},
{"id": "alloc-s2-2", "materialId": "mat-1", "taskId": "s2-2", "allocatedQuantity": 1, "consumedQuantity": 1, "allocationDate": "2026-11-17", "expectedReturnDate": null, "actualCost": 50, "notes": "Jira for Sprint 2"},
{"id": "alloc-s3-2", "materialId": "mat-1", "taskId": "s3-2", "allocatedQuantity": 1, "consumedQuantity": 0, "allocationDate": "2026-11-25", "expectedReturnDate": null, "actualCost": 50, "notes": "Jira for Sprint 3"}
```

#### construction.json (9 missing - no allocations exist)
Add 5 new allocations for:
- Excavator rental for excavation task
- Concrete for foundation task
- Lumber for framing task
- Steel for structure task
- Safety equipment for all phases

#### mining.json (9 missing - no allocations exist)
Add allocations for:
- 3D scanner rental for scanning tasks
- Engineering software for design tasks
- Safety equipment for field work

---

## Gap 2: Leaf Tasks Missing Cost/Effort

### Problem
9 of 13 templates have leaf tasks without cost or effort values, making resource planning impossible.

### Affected Templates
| Template | Missing Cost | Missing Effort |
|----------|-------------|----------------|
| agile.json | 2 | 2 |
| business.json | 3 | 3 |
| construction.json | 1 | 1 |
| event.json | 3 | 3 |
| it-migration.json | 2 | 2 |
| marketing.json | 1 | 1 |
| renovation.json | 4 | 4 |
| simple.json | 1 | 1 |
| software.json | 3 | 3 |

### Remediation
Add realistic cost and effort values to all leaf tasks based on:
- Task duration (effort = duration × 8 hours)
- Resource cost rate (cost = effort × rate)
- Industry benchmarks

---

## Gap 3: Leaf Tasks Without Dependencies

### Problem
All templates have leaf tasks without dependencies, making critical path analysis impossible for those tasks.

### Root Cause
Only sequential tasks within phases got dependencies; cross-phase dependencies missing.

### Remediation
Add cross-phase dependencies:
- Phase N first task depends on Phase N-1 last task
- Milestone tasks depend on phase completion

---

## Gap 4: Tasks Without Resource Assignments

### Problem
5 templates have leaf tasks without resourceId, making resource planning incomplete.

### Affected Templates
| Template | Unassigned Tasks |
|----------|-----------------|
| construction.json | 24 |
| mining.json | 41 |
| business.json | 3 |
| event.json | 3 |
| software.json | 3 |

### Remediation
Assign resources round-robin to unassigned tasks based on:
- Phase type (engineering → engineers, design → designers)
- Task name keywords (electrical → electrician, plumbing → plumber)
- Resource availability

---

## Gap 5: Risks Not Linked to Tasks

### Problem
- **construction.json**: 0 of 5 risks linked to tasks
- **mining.json**: 0 of 10 risks linked to tasks

### Remediation
Map risks to specific tasks based on risk category and description:

#### construction.json
| Risk | Task |
|------|------|
| Weather delays | found-1 (Excavation) |
| Material delivery delays | struct-1 (Framing) |
| Safety incidents | demo-2 (Interior demolition) |
| Budget overrun | foundation (phase) |
| Regulatory changes | pre-3 (Permits & approvals) |

#### mining.json
| Risk | Task |
|------|------|
| Site access restrictions | fel1-1 (Project kickoff) |
| Data quality issues | fel1-2 (BFDs) |
| Regulatory compliance gaps | feed-6 (HAZOP) |
| Client scope changes | fel2-1 (PFS kickoff) |
| Vendor delivery delays | epc-5 (Mechanical procurement) |
| Brownfield fitment clashes | bf-4 (3D laser scanning) |
| Shutdown critical path overrun | bf-7 (Shutdown execution) |
| Repeated mechanical failures | bf-2 (RCFA) |
| Lifting plan failures | com-2 (Cold commissioning) |
| Slurry pipeline erosion | fel2-5 (Equipment trade-off) |

---

## Gap 6: No Post-Project Closure Tasks

### Problem
All templates end with a milestone but lack formal closure tasks (retrospective, lessons learned, final report).

### Remediation
Add "Project Closure" task to each template:

```json
{
  "id": "closure",
  "name": "Project Closure",
  "startDate": "<end_date>",
  "endDate": "<end_date_plus_3_days>",
  "description": "Final report, lessons learned, and administrative closure",
  "progress": 0,
  "status": "not_started",
  "cost": 2000,
  "children": [
    {
      "id": "closure-1",
      "name": "Lessons learned workshop",
      "startDate": "<end_date>",
      "endDate": "<end_date_plus_1>",
      "description": "Document what went well and what to improve",
      "progress": 0,
      "status": "not_started",
      "resourceId": "<pm_resource>",
      "cost": 1000,
      "effort": 8,
      "effortUnit": "hours",
      "dependencies": ["<last_milestone>"]
    },
    {
      "id": "closure-2",
      "name": "Final project report",
      "startDate": "<end_date_plus_1>",
      "endDate": "<end_date_plus_3>",
      "description": "Compile final project report and metrics",
      "progress": 0,
      "status": "not_started",
      "resourceId": "<pm_resource>",
      "cost": 1000,
      "effort": 8,
      "effortUnit": "hours",
      "dependencies": ["closure-1"]
    }
  ]
}
```

---

## Gap 7: No Revenue/Business Metrics

### Problem
No template tracks revenue, ROI, or business outcomes.

### Remediation
Add optional `revenue` block to accounting:

```json
"accounting": {
  "...",
  "revenue": {
    "projectedRevenue": 0,
    "actualRevenue": 0,
    "projectedROI": 0,
    "actualROI": 0,
    "currency": "USD"
  }
}
```

---

## Implementation Priority

| Phase | Gaps | Templates | Effort |
|-------|------|-----------|--------|
| **Phase 1** | Missing cost/effort on leaf tasks | 9 templates | 2 hours |
| **Phase 2** | Risk-task linking | 2 templates | 1 hour |
| **Phase 3** | Resource assignments | 5 templates | 2 hours |
| **Phase 4** | Spend-to-allocation mapping | 13 templates | 3 hours |
| **Phase 5** | Cross-phase dependencies | 13 templates | 2 hours |
| **Phase 6** | Post-project closure tasks | 13 templates | 2 hours |
| **Phase 7** | Revenue/business metrics | 13 templates | 1 hour |
| **Total** | | | **13 hours** |

---

## Automated Remediation Script

Create a Python script to apply bulk fixes across all templates:

```python
# scripts/enhance_templates.py
# Applies consistent enhancements to all templates
```

---

## Verification

After remediation:
1. All leaf tasks should have: status, cost, effort, dependencies, resourceId
2. All risks should have taskId linkage
3. All spend entries should have matching allocations (or be marked as service)
4. All templates should have closure phase
5. Run full test suite: `npm test`

---
