# Project Template Data Enhancement Plan

**Date:** 2026-08-27
**Goal:** Make templates demonstrate a fully completed project with all data flows working

---

## Current State Analysis

### Schema Status (types.ts) ✅ COMPLETE
The runtime data model is comprehensive:
- WBSTask: dependencies, status, approval gates, cost, effort, riskIds
- Resource: full fields
- Risk: taskId linking, mitigation, contingency, residual scores
- Material: CapEx/OpEx/Consumable with all fields
- MaterialAllocation/Consumption: full tracking
- ProjectAccounting: TaskAccounting, ActualSpendEntry, ChangeLogEntry
- CapitalizationConfig: threshold, depreciation, salvage

### Template Schema Status (templates/types.ts) ❌ INCOMPLETE
Missing fields that prevent rich template data:

| Entity | Missing Fields |
|--------|----------------|
| TaskJSON | status, cost, effort, effortUnit, approvalGates |
| RiskJSON | taskId, contingencyPlan, mitigationCost, triggerCondition, residualProbability, residualImpact |
| ProjectTemplateJSON | accounting, allocations, consumptions, capitalizationConfig, changeLog |

### Current Template Data Gaps

1. **No task dependencies** - Can't demo critical path
2. **No task status** - Can't show progress tracking
3. **No actual spend** - Accounting views are empty
4. **No material allocations** - Materials dashboard shows no consumption
5. **No change log** - Change Log tab is empty
6. **No approval gates** - Can't demo approval workflow
7. **No risk-task linking** - Risks show as project-level only
8. **No task costs** - Can't show budget vs actual
9. **No capitalization config** - Can't demo CapEx/OpEx split

---

## Implementation Plan

### Phase 1: Schema Updates
1. Update `templates/types.ts` to add missing fields
2. Update `templates/handler.ts` to convert new fields
3. Add validation for new fields

### Phase 2: Template Data Generation
Update all 13 JSON templates with:
- Task dependencies (FS relationships)
- Task status (not_started → done)
- Task costs (realistic budgets)
- Risk-task linking (taskId references)
- Risk contingency plans and residual scores
- Actual spend entries (matching task costs)
- Material allocations (linking materials to tasks)
- Material consumption records
- Change log entries (scope changes, etc.)
- Capitalization config
- Approval gates on key milestones

### Phase 3: Tests
- Add tests for new template fields
- Verify all templates parse correctly
- Verify data flows through all views

---

## Template Data Model (Enhanced)

### TaskJSON (Enhanced)
```typescript
{
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  progress?: number;        // 0-100
  resourceId?: string;      // Resource assignment
  isMilestone?: boolean;
  color?: string;
  dependencies?: string[];  // Predecessor task IDs
  status?: TaskStatus;      // not_started|waiting|ready|in_progress|done|on_hold
  cost?: number;            // Allocated cost
  effort?: number;          // Estimated effort
  effortUnit?: EffortUnit;  // hours|days|storyPoints
  approvalGates?: ApprovalGateJSON[];
  children?: TaskJSON[];
}
```

### RiskJSON (Enhanced)
```typescript
{
  id: string;
  title: string;
  category: RiskCategory;
  probability: number;      // 1-5
  impact: number;           // 1-5
  status?: RiskStatus;
  ownerId?: string;         // Resource ID
  taskId?: string;          // Linked task ID
  mitigationPlan?: string;
  contingencyPlan?: string;
  mitigationCost?: number;
  triggerCondition?: string;
  residualProbability?: number;  // 1-5 after mitigation
  residualImpact?: number;       // 1-5 after mitigation
  notes?: string;
  identifiedDate?: string;
  reviewDate?: string;
}
```

### ProjectTemplateJSON (Enhanced)
```typescript
{
  id: string;
  name: string;
  description: string;
  category: string;
  startDate: string;
  endDate?: string;
  calendar?: CalendarJSON;
  tasks: TaskJSON[];
  risks?: RiskJSON[];
  resources?: ResourceJSON[];
  materials?: MaterialJSON[];
  accounting?: AccountingJSON;           // NEW
  allocations?: AllocationJSON[];        // NEW
  consumptions?: ConsumptionJSON[];      // NEW
  capitalizationConfig?: CapConfigJSON;  // NEW
  changeLog?: ChangeLogJSON[];           // NEW
}
```

---

## Template Categories (13 templates)

| Template | Category | Complexity | Key Demo |
|----------|----------|------------|----------|
| simple-wbs | Generic | Low | Basic WBS, dependencies |
| website | Web/Dev | Low | Agile-like, fast delivery |
| software | Software | Medium | Full SDLC, approvals |
| realestate-photo | Real Estate | Medium | Equipment, scheduling |
| mining | Mining | High | Multi-phase, brownfield |
| renovation | Construction | Medium | Home improvement |
| event | Events | Medium | Venue, catering |
| marketing | Marketing | Medium | Campaign tracking |
| business | Business | Medium | Feasibility, planning |
| product | Business | Medium | Launch, go-to-market |
| it-migration | IT | Medium | Infrastructure |
| agile | Software | Medium | Sprints, backlog |
| construction | Construction | High | Full build, permits |

---
