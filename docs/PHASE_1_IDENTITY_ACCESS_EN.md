# Phase 1 — Identity and Access: Implementation Status

**Repository:** `mohammadqazzaz10/omran-mall`  
**Branch:** `phase-1/identity-access`  
**Status:** In progress; not production-ready.

## Implemented on the branch
- Explicit user-to-branch memberships with composite foreign keys that prevent cross-company membership.
- Active-membership partial uniqueness, allowing a revoked membership to be granted again.
- Password login, short-lived JWT access tokens, opaque rotating refresh tokens, hashed refresh-token storage, session revocation, logout, and current-user endpoint.
- Session and active branch-membership validation against PostgreSQL on authenticated requests.
- Temporary lockout after repeated failed password attempts.
- Global deny-by-default authentication and permission guards.
- Explicit public-route metadata and explicit permission metadata.
- Company-scoped administrator sign-in without a branch membership; company permissions can be evaluated without a selected branch. Branch and department permissions still require active membership.
- Generic `own` permissions remain denied until resource ownership is enforced by a dedicated service/guard.
- Unit tests for missing/revoked sessions, live branch membership, refresh rotation/replay rejection, deny-by-default permission checks, and company-only administrator access.

## CI and security verification
- A PostgreSQL integration run exposed a partial-index conflict-target issue in the membership backfill. Both backfill statements were corrected to match the active-membership partial unique index.
- The latest completed backend checks on the previous head passed build, formatting, migrations, seed idempotency, PostgreSQL invariants, Jest tests, Compose validation, and production Docker image build.
- Flutter analyze/tests and Flutter Web Release also passed on that previous head; Android Debug was still running at the time of the status update.
- The dependency audit reported zero High and zero Critical findings, with 16 Moderate and 4 Low findings in the full dependency tree. The reported packages were development/test tooling such as Jest and ts-jest.
- CI is being made deterministic: it installs the committed lockfile with `npm ci`, does not mutate dependencies or push commits from the workflow, and separately audits runtime dependencies with `npm audit --omit=dev`.

## Remaining security and product work
- PostgreSQL RLS or equivalent transaction-scoped branch isolation, with a non-superuser runtime database role and cross-branch leakage tests.
- Secure first-administrator provisioning and administrative management of users, roles, permissions, branches, and memberships.
- Device/session management, password change and recovery, MFA, and edge-level login rate limiting.
- Authenticated WebSocket handshakes and branch-room authorization.
- Endpoint-by-endpoint permission coverage and resource-ownership enforcement.
- Employee, attendance, shifts, breaks, requests, notifications, payroll, reporting, and all other business modules from the master requirements.
- Production secrets, staging/UAT, backup/restore tests, penetration review, and final Render integration remain deferred until the last release stage.

A green CI run validates only the exact commit and jobs that completed; it does not mean the full platform is complete.
