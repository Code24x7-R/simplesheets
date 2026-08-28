# Event Planning Template - Gap Analysis & Remediation Plan

**Date:** 2026-08-28
**Source:** External Review
**Status:** Gap analysis complete, remediation steps identified

---

## Executive Summary

The external review identified **4 major gap categories** in the event planning template:

1. **WBS Gaps** - Missing venue execution and post-event tasks
2. **Resource Management Gaps** - External vendors not actionable, no time-phased allocation
3. **Financial Gaps** - Unmapped actual spend
4. **Revenue/Attendee Tracking Gaps** - No revenue projections or RSVP targets

---

## Gap 1: Venue Execution Details

### Problem
No explicitly scheduled tasks for venue setup/teardown, AV rehearsal, or caterer arrival on event day.

### Missing Tasks
- Venue setup (tables, chairs, signage placement)
- AV rehearsal (sound check, lighting test, presentation run-through)
- Caterer arrival and setup
- Event day coordination (hosting, troubleshooting)
- Post-event teardown and cleanup

### Remediation Steps

#### Step 1: Add "Venue Execution" sub-phase under Logistics

```json
{
  "id": "venue-exec",
  "name": "Venue Execution",
  "startDate": "2026-06-25",
  "endDate": "2026-06-27",
  "description": "On-site venue management during event",
  "progress": 0,
  "status": "not_started",
  "cost": 5000,
  "children": [
    {
      "id": "venue-1",
      "name": "Venue setup (tables, chairs, signage)",
      "startDate": "2026-06-25",
      "endDate": "2026-06-25",
      "description": "Set up tables, chairs, signage, registration desk",
      "progress": 0,
      "status": "not_started",
      "resourceId": "coord",
      "cost": 1500,
      "effort": 4,
      "effortUnit": "hours",
      "dependencies": ["log-1"]
    },
    {
      "id": "venue-2",
      "name": "AV rehearsal (sound check, lighting)",
      "startDate": "2026-06-25",
      "endDate": "2026-06-25",
      "description": "Test all AV equipment and run presentation",
      "progress": 0,
      "status": "not_started",
      "resourceId": "coord",
      "cost": 1000,
      "effort": 2,
      "effortUnit": "hours",
      "dependencies": ["venue-1"]
    },
    {
      "id": "venue-3",
      "name": "Caterer arrival and setup",
      "startDate": "2026-06-26",
      "endDate": "2026-06-26",
      "description": "Coordinate caterer arrival, kitchen setup, service timing",
      "progress": 0,
      "status": "not_started",
      "resourceId": "coord",
      "cost": 1000,
      "effort": 2,
      "effortUnit": "hours",
      "dependencies": ["venue-2"]
    },
    {
      "id": "venue-4",
      "name": "Post-event teardown and cleanup",
      "startDate": "2026-06-27",
      "endDate": "2026-06-27",
      "description": "Dismantle setup, clean venue, return rentals",
      "progress": 0,
      "status": "not_started",
      "resourceId": "coord",
      "cost": 1500,
      "effort": 4,
      "effortUnit": "hours",
      "dependencies": ["log-3"]
    }
  ]
}
```

#### Step 2: Update dependencies
- `venue-1` depends on `log-1` (AV equipment setup)
- `venue-4` depends on `log-3` (day-of coordination)

#### Step 3: Add spend entries for new tasks
```json
{"id": "spend-10", "taskId": "venue-1", "date": "2026-06-25", "amount": 1500, "currency": "USD", "source": "Venue Staff", "notes": "Setup labor"},
{"id": "spend-11", "taskId": "venue-2", "date": "2026-06-25", "amount": 1000, "currency": "USD", "source": "AV Technician", "notes": "Rehearsal support"},
{"id": "spend-12", "taskId": "venue-3", "date": "2026-06-26", "amount": 1000, "currency": "USD", "source": "Caterer", "notes": "Setup coordination"},
{"id": "spend-13", "taskId": "venue-4", "date": "2026-06-27", "amount": 1500, "currency": "USD", "source": "Venue Staff", "notes": "Teardown labor"}
```

---

## Gap 2: Post-Event Marketing Analysis

### Problem
Lacks post-event marketing analysis or attendee survey collation tasks.

### Missing Tasks
- Post-event survey distribution and collection
- Social media performance analysis
- Email campaign performance review
- Marketing ROI calculation

### Remediation Steps

#### Step 1: Enhance "Post-event follow-up" task

```json
{
  "id": "log-4",
  "name": "Post-event follow-up",
  "startDate": "2026-06-27",
  "endDate": "2026-06-30",
  "description": "Thank you emails, surveys, and marketing analysis",
  "progress": 0,
  "status": "not_started",
  "cost": 3000,
  "children": [
    {
      "id": "post-1",
      "name": "Thank you emails and survey distribution",
      "startDate": "2026-06-27",
      "endDate": "2026-06-28",
      "description": "Send thank you emails and distribute attendee survey",
      "progress": 0,
      "status": "not_started",
      "resourceId": "coord",
      "cost": 500,
      "effort": 4,
      "effortUnit": "hours",
      "dependencies": ["log-3"]
    },
    {
      "id": "post-2",
      "name": "Social media performance analysis",
      "startDate": "2026-06-28",
      "endDate": "2026-06-29",
      "description": "Analyze social media engagement and reach",
      "progress": 0,
      "status": "not_started",
      "resourceId": "coord",
      "cost": 500,
      "effort": 4,
      "effortUnit": "hours",
      "dependencies": ["post-1"]
    },
    {
      "id": "post-3",
      "name": "Marketing ROI calculation",
      "startDate": "2026-06-29",
      "endDate": "2026-06-30",
      "description": "Calculate marketing ROI and compile final report",
      "progress": 0,
      "status": "not_started",
      "resourceId": "pm",
      "cost": 1000,
      "effort": 8,
      "effortUnit": "hours",
      "dependencies": ["post-2"]
    }
  ]
}
```

---

## Gap 3: Resource Management (External Vendors)

### Problem
Vendors listed under materials but not represented as actionable resources.

### Solution Approach
The current schema supports resources as team members. To represent external vendors as actionable resources:

#### Step 1: Add vendor resources

```json
{
  "id": "venue-vendor",
  "name": "Grand Ballroom",
  "role": "Venue Provider",
  "costRate": 0,
  "costCurrency": "USD",
  "availability": 100,
  "color": "#DC2626"
},
{
  "id": "av-vendor",
  "name": "AV Pros",
  "role": "AV Provider",
  "costRate": 0,
  "costCurrency": "USD",
  "availability": 100,
  "color": "#7C3AED"
},
{
  "id": "print-vendor",
  "name": "Print Shop",
  "role": "Print Provider",
  "costRate": 0,
  "costCurrency": "USD",
  "availability": 100,
  "color": "#059669"
}
```

#### Step 2: Assign vendor resources to relevant tasks

```json
{"id": "setup-3", "resourceId": "venue-vendor", "..."}
{"id": "log-1", "resourceId": "av-vendor", "..."}
{"id": "mkt-1", "resourceId": "print-vendor", "..."}
```

---

## Gap 4: Revenue & Attendee Tracking

### Problem
Schema omits revenue projections, ticket prices, RSVP targets/actual counts.

### Solution Approach
Add revenue tracking to accounting block:

#### Step 1: Add revenue section to accounting

```json
"accounting": {
  "...",
  "revenue": {
    "projectedRevenue": 60000,
    "actualRevenue": 0,
    "ticketPrice": 250,
    "projectedAttendees": 200,
    "actualAttendees": 0,
    "rsvpTarget": 180,
    "rsvpActual": 0,
    "sponsorshipRevenue": 10000,
    "currency": "USD"
  }
}
```

#### Step 2: Add RSVP tracking to change log

```json
{"id": "cl-3", "date": "2026-06-20", "taskId": null, "changeType": "scope", "description": "RSVP count reached 150 (83% of target)", "costImpact": 0, "scheduleImpactDays": 0, "approvedBy": "Event Manager"}
```

---

## Gap 5: Unmapped Actual Spend

### Problem
Some spendEntries lack corresponding material allocation records.

### Solution Approach
#### Step 1: Ensure all spend entries have matching allocations

| Spend Entry | Material Allocation |
|-------------|---------------------|
| spend-3 (Venue deposit) | alloc-1 (Venue Deposit) |
| spend-4 (Menu planning) | None (service, not material) |
| spend-5 (Tasting session) | None (service, not material) |
| spend-6 (Catering deposit) | None (service, not material) |
| spend-7 (Invitation design) | None (service, not material) |
| spend-8 (Registration setup) | None (service, not material) |
| spend-9 (Email campaign) | alloc-3 (Printed Materials) - **MISMATCH** |
| spend-10-13 (Venue exec) | New allocations needed |

#### Step 2: Fix spend-9 allocation

The spend-9 entry ($1,500 for email campaign) was incorrectly mapped to alloc-3 (Printed Materials). Create a proper allocation:

```json
{
  "id": "alloc-email",
  "materialId": "mat-email",
  "taskId": "mkt-3",
  "allocatedQuantity": 1,
  "consumedQuantity": 1,
  "allocationDate": "2026-06-14",
  "expectedReturnDate": null,
  "actualCost": 1500,
  "notes": "Email platform campaign"
}
```

---

## Implementation Priority

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | Venue Execution Details | Medium | Critical for event-day success |
| **P0** | Unmapped Actual Spend | Low | Financial accuracy |
| **P1** | Post-Event Marketing | Medium | Complete lifecycle |
| **P1** | External Vendors as Resources | Low | Better tracking |
| **P2** | Revenue/Attendee Tracking | Medium | Business metrics |
| **P2** | Time-phased Resource Allocation | High | Over-allocation detection |

---

## Verification Steps

After implementing changes:

1. **Validate template parses correctly**
   ```bash
   npx jest --testPathPattern="template" -t "Event Planning"
   ```

2. **Verify all tasks have dependencies**
   ```bash
   npx jest --testPathPattern="template" -t "dependency cycles"
   ```

3. **Check financial totals reconcile**
   - Sum of spendEntries should equal accounting.actualSpendTotal
   - Sum of task costs should approximate accounting.baselineTotal

4. **Verify resource assignments**
   - All tasks should have valid resourceId
   - No resource over-allocation (same resource assigned to overlapping tasks)

---

## Files to Modify

1. `src/extensions/project-wbs/templates/json/event.json` - Main template
2. `src/extensions/project-wbs/templates/types.ts` - Add revenue type (if needed)
3. `src/extensions/project-wbs/templates/handler.ts` - Add revenue conversion (if needed)
4. `src/extensions/project-wbs/templates/index.test.ts` - Update tests if structure changes

---

## Estimated Effort

- **P0 items:** 2-3 hours
- **P1 items:** 1-2 hours
- **P2 items:** 2-3 hours
- **Total:** 5-8 hours

---
