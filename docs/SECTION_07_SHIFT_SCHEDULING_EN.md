# Section 07 — Shift Scheduling, Rosters and Swaps

**Status:** Initial implementation on PR #29. Not accepted until CI, PostgreSQL integration checks, and user acceptance pass.

## Implemented scope

- Shift templates with start/end times, shift type, grace periods, and staffing metadata.
- Employee assignments to a shift or a day off, scoped to the same branch and department.
- Overnight shifts using local wall-clock timestamps without a timezone.
- A deferred PostgreSQL exclusion constraint preventing overlapping time ranges for one employee.
- Publishing draft assignments for a date range and creating in-app notifications for affected employees.
- Employee swap requests with a colleague response followed by an authorized manager decision.
- On approval, the two shift templates/times are exchanged while assignment ownership and work dates remain unchanged; times are recalculated on each assignment's own date.
- Weekly coverage requirements by department and shift, with shortage calculation against published assignments.
- Audit entries for core scheduling mutations.

## Schedule lifecycle

1. A manager creates shift templates.
2. The manager creates employee/date assignments as drafts.
3. Department and shift coverage is reviewed.
4. The manager publishes a date range; published assignments appear in the employee's personal schedule.
5. An employee requests a swap with another employee's published assignment.
6. The target employee accepts or rejects.
7. Acceptance moves the request to the manager decision stage.
8. Manager approval exchanges the shift/time values in one database transaction; overlap constraints are checked before commit.

## API

All routes are under `/branches/:branchId/shifts`:

| Method | Path | Permission |
|---|---|---|
| GET | `/templates` | `shifts.view.branch` |
| POST | `/templates` | `shifts.manage.branch` |
| GET | `/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` | `shifts.view.branch` |
| GET | `/me?from=YYYY-MM-DD&to=YYYY-MM-DD` | `shifts.view.own` |
| POST | `/assignments` | `shifts.manage.branch` |
| POST | `/publish` | `shifts.publish.branch` |
| GET | `/swaps` | `shifts.view.branch` |
| POST | `/swaps` | `shifts.swap.own` |
| POST | `/swaps/:swapId/respond` | `shifts.swap.own` |
| POST | `/swaps/:swapId/decision` | `shifts.swap.manage.branch` |
| GET | `/coverage?from=...&to=...` | `shifts.coverage.view.branch` |
| POST | `/coverage` | `shifts.coverage.manage.branch` |

Schedule reads are limited to 63 days per request. Branch ownership is checked against the authenticated user's company.

## Data and security controls

- Employee IDs supplied by clients are checked against active employees in the requested branch.
- Shift and department references must belong to the same branch.
- Swaps are rejected for unpublished assignments, days off, or the same employee.
- Only the employee assigned to the target assignment may respond.
- A manager cannot approve until the target employee has accepted.
- PostgreSQL overlap constraints provide the final concurrency-safe enforcement.
- Coverage weekday numbering follows PostgreSQL DOW: Sunday = 0, Saturday = 6.
- Notifications are persisted in the in-app inbox only; delivery while the app is closed is not implemented.

## Outstanding work

- Shift template edit/deactivation.
- Recurring weekly/monthly roster generation and copy-from-previous-period.
- Complete employee/manager swap history and decision UI.
- Coverage shortage remediation and assisted staffing.
- Dedicated PostgreSQL integration tests for concurrent swap decisions and branch isolation, plus migration upgrade testing against an existing database.
- Passing Backend format/build/tests, Flutter analyze/tests, Android Debug, and Web Release on PR #29's head.
- FCM/APNs integration.
- Owner/HR approval of holidays, overtime, and legal working-time policies.

**This module is not production-ready. Do not merge PR #29 or deploy to Render before the acceptance items above are closed.**
