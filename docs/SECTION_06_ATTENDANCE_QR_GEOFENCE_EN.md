# Section 06 — Attendance, QR and Branch Geofence

## Objective
Record attendance using trusted server time, support branch QR verification and optional geofencing, and preserve correction history. A client device clock must never determine the authoritative attendance timestamp.

## Existing baseline
- Check-in and check-out APIs use PostgreSQL server time.
- Attendance is tied to the employee, branch and published shift.
- Duplicate daily attendance is blocked by a database uniqueness constraint.
- Initial late-minute calculation uses the assigned shift and grace period.
- Employee self-history and permission-scoped branch records exist.
- Employees can request corrections; authorized branch users can approve them with audit history.

## Implemented in this increment
1. **Rotating signed QR:** The backend issues a branch-bound HMAC-SHA256 token with a 45-second lifetime. Signing uses a dedicated `ATTENDANCE_QR_SECRET` environment variable combined with the branch salt stored in PostgreSQL.
2. **Atomic consistency:** QR consumption, attendance insertion, location persistence, and audit logging run in one PostgreSQL transaction; any failure rolls back the complete operation.
3. **No plaintext token storage:** Only a SHA-256 digest of the nonce is stored.
4. **Replay protection and database branch isolation:** A unique key records each employee's use of a challenge, with composite foreign keys ensuring that the challenge and employee belong to the same branch.
5. **Branch binding:** Tokens from another branch, expired tokens, and invalid signatures are rejected.
6. **Optional geofence:** When branch coordinates are configured, QR check-in requires latitude, longitude, and GPS accuracy of at most 100 meters. The backend computes distance from the configured branch center and checks the branch radius.
7. **No geofence bypass:** Direct app check-in is rejected when branch geofencing is enabled; the QR route must be used.
8. **Audit trail:** QR check-ins are recorded with method `qr_code` and verified coordinates, with an additional audit event.
9. **Correction rejection:** A new endpoint rejects pending correction requests only, with optional reviewer notes, reviewer identity, decision timestamp, and audit history in one transaction.

## API routes
All routes are under `/branches/:branchId/attendance` and require an authenticated session, branch membership, and the listed permission.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/qr/geofence` | `attendance.check_in.own` | Check whether location is required before requesting GPS permission |
| POST | `/qr/challenges` | `attendance.qr.manage.branch` | Issue a 45-second QR token for branch display |
| POST | `/check-in/qr` | `attendance.check_in.own` | QR check-in with location when geofence is enabled |
| POST | `/check-in` | `attendance.check_in.own` | App check-in only when geofence is not enabled |
| POST | `/check-out` | `attendance.check_out.own` | Server-timestamped check-out |
| GET | `/me` | `attendance.view.own` | Employee attendance history |
| GET | `/` | `attendance.view.branch` | Authorized branch attendance records |
| POST | `/corrections` | `attendance.correct.own` | Request a correction |
| POST | `/corrections/:correctionId/approve` | `attendance.approve.branch` | Approve a correction |
| POST | `/corrections/:correctionId/reject` | `attendance.approve.branch` | Reject a correction with optional reviewer notes |

## Required configuration
- Generate an independent random value of at least 32 bytes for `ATTENDANCE_QR_SECRET` in each environment.
- Never use the example value in `.env.example`; never commit the secret or embed it in Flutter or QR payloads.
- Configure accurate branch coordinates and radius before enabling geofencing.
- Actual production secret provisioning on Render is intentionally deferred to the final deployment stage.

## Current limitations — Section 06 is not complete
- Flutter supervisor UI now displays a server-issued QR and rotates it every 45 seconds; employee UI scans the QR and queries geofence status first; it requests location permission only when the branch requires it. Android/iOS camera and location permission declarations were added. CI and real-device acceptance are still pending.
- Offline attendance is not supported. Client timestamps must not be accepted; queued operations must remain unconfirmed until server verification, and that workflow is not implemented.
- GPS can be spoofed on some devices. Accuracy and distance checks alone do not prove device integrity; device attestation or another control must be evaluated before production use.
- Correction rejection with optional reviewer notes and audit history is implemented. Overnight check-in is now assigned to the originating shift work date with after-midnight lateness calculation; check-out now calculates early departure against the assigned shift end and grace period, including overnight shifts. Holiday policy handling still requires implementation. An in-app notification is now inserted transactionally when a correction is approved or rejected, including reviewer notes on rejection; push delivery through FCM/APNs and delivery verification while the app is closed remain outstanding. A PostgreSQL integration test for the actual early-departure minute calculation is also still required. A Flutter branch dashboard now polls attendance records every 30 seconds; this is periodic refresh, not a WebSocket live stream.
- Geofencing currently applies to QR check-in and blocks direct app check-in when enabled; geofenced check-out is not implemented.
- Composite PostgreSQL foreign keys and schema-invariant assertions now cover per-employee replay uniqueness and cross-branch use rejection. A parallel PostgreSQL uniqueness-race integration test has now been added and passed the Backend CI job on commit `711f913499a8bcd45a408430caed9dbb1f3f9d82` in [run 43676862335](https://github.com/mohammadqazzaz10/omran-mall/actions/runs/43676862335); real-device field acceptance remains required. Unit tests do not prove resistance to GPS spoofing.

## Acceptance gate
- [x] PostgreSQL server time is authoritative for existing check-in/out.
- [x] Signed, short-lived, branch-bound QR token.
- [x] Nonce digest stored instead of raw token.
- [x] Per-employee challenge replay constraint.
- [x] Geofence enforced when configured; direct app route cannot bypass it.
- [x] Supervisor QR display and automatic 45-second rotation UI (CI and field acceptance pending).
- [x] Employee QR scanner with optional location capture (CI and field acceptance pending).
- [x] Reject a pending correction with optional reviewer notes and audit history.
- [x] Persist an in-app notification for approved/rejected correction decisions, including rejection notes.
- [ ] Integrate FCM/APNs and verify delivery on physical devices while the app is closed.
- [x] Branch attendance dashboard with 30-second polling (not a WebSocket live stream).
- [ ] Safe offline queue and conflict review without trusting client time.
- [x] Pass the PostgreSQL schema-invariant and parallel uniqueness-race integration tests on a clean CI database in the Backend CI job for commit `711f913499a8bcd45a408430caed9dbb1f3f9d82`.
- [ ] Add a PostgreSQL integration test that verifies the actual early-departure minute calculation; the current unit test checks SQL structure only.
- [ ] Real-device field test and independent security review.

**Status: Partial.** This increment adds backend QR/geofence foundations; it is not evidence of production-ready attendance.
