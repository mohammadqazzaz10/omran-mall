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


## Update — 2026-11-14: merged identity baseline and authorization follow-up

### Merged to main
- PR #3 was squash-merged after CI succeeded on exact head `9b38aa6145e2b73f19ab0adac6b7d31d10e2873d`.
- Reference CI run #164 passed backend build/format/Jest/PostgreSQL migrations and invariants/Docker image, Flutter analyze/tests, Flutter Web Release, and Android Debug.
- Merge commit: `efeea4a0188d7ed6f4fad343df38ac7ff124c8f9`.

### Follow-up branch: `phase-1/authorization-admin-foundation`
- Adds migration 003 for built-in company roles, a permission catalogue, and least-privilege role grants.
- Company administrators receive explicit branch memberships and branch-scoped role grants; authorization does not rely on a role name alone.
- Cashier/employee roles receive no generic `own` permissions until record ownership is enforced in the service layer.
- Adds a one-time CLI bootstrap that atomically creates the initial company, primary branch, and SUPER_ADMIN, hashes a strong password with bcrypt, refuses to run if the company already has a user, and writes an audit event.
- CI type-checks the bootstrap utility and PostgreSQL invariants assert that branch managers do not receive company-wide user/role administration grants.

### Still incomplete / release blockers
- Protected API workflows for managing users, roles, permissions, and branch memberships.
- Password change/recovery, forced password change after bootstrap, device/session management, MFA, and edge-level login rate limiting.
- PostgreSQL RLS or equivalent transaction-scoped isolation, runtime DB role without BYPASSRLS, and cross-branch leakage tests.
- Authenticated WebSocket handshake, room membership, and per-event authorization.
- All employee and operational modules and connected Flutter workflows.
- Render remains deferred to the final release stage. No production deployment is authorized by these development checks.

A successful CI run validates only its exact commit and completed jobs; it does not establish that the full product is complete.



## Organization and employee API work — 2026-11-14

A new work branch, `phase-1/organization-employee-apis`, adds protected branch-scoped APIs for departments, positions, and employee records. Employee list endpoints support search, status filtering, and pagination; employee records support create, update, detail, and soft archive. Employee identifiers are generated by the PostgreSQL trigger/sequence, never accepted from the client. Employee history and audit events are written in the same transaction as the corresponding changes.

The branch also adds migration 004 with composite PostgreSQL constraints that enforce same-branch department, position, and manager references. Service validation rejects invalid references and circular department/manager hierarchies. Initial unit tests cover cross-branch reference rejection.

This work is not merged until the exact branch head passes CI. Branch/user/role/session administration, database row-level isolation, authenticated WebSocket authorization, Flutter API workflows, and all operational modules remain outstanding. Render integration remains deferred to the final release stage.


## Administration, Account Lifecycle, and Self-Service Update — 2026-11-14

### Implemented on `phase-1/admin-user-session-management`
- Protected company-scoped branch listing, creation, update, activation, and deactivation. Company identity is derived from the authenticated principal, never from a client-supplied company ID.
- Newly created or reactivated branches materialize memberships and branch grants only for the explicitly approved company-wide administrator roles.
- Paginated and searchable user listing with active-state filtering and scoped role summaries.
- User provisioning with a random temporary password returned only in the creation response and stored only as a bcrypt hash.
- Optional linking to an existing employee record, guarded by company/branch ownership and the one-user-per-employee constraint.
- Role assignment rules: elevated administrative roles require a company-level SUPER_ADMIN actor; non-super-admin operators cannot provision elevated roles.
- Account deactivation revokes active sessions. Self-deactivation and disabling the last active SUPER_ADMIN are rejected; HR/general management cannot disable a SUPER_ADMIN account.
- Temporary-password accounts are blocked from all protected routes until password rotation, except the password-change and logout routes.
- Strong password change verifies the current password, enforces bcrypt's 72-byte input ceiling, and revokes other active sessions.
- Self-service session listing and revocation, with protection against revoking the current session through the device-management route.
- Restricted employee self-profile reads/updates are bound to the authenticated `user_id`; employees cannot edit employment, payroll, role, or branch scope fields.
- Own-scope permission grants for EMPLOYEE/CASHIER roles are paired with service-level record ownership checks.

### Remaining gates
- This is still an open pull request until CI passes on the final head SHA and the diff is reviewed and merged.
- Role/membership removal, account recovery, verified email/phone workflows, MFA, and robust login rate limiting remain open.
- PostgreSQL RLS and transaction-scoped branch isolation are not implemented; the HTTP permission guard alone is not database isolation.
- Full PostgreSQL integration coverage is still required for provisioning, employee linking, password rotation, and session lifecycle.
- Flutter login, forced-password-change, administration, and employee self-service screens are not yet connected to these APIs.
- Daily operations, real push delivery, reporting, HR/finance modules, and the remaining master requirements are still open.
- Render integration and production deployment remain deferred until the final acceptance and security gates pass.

**Status:** implementation and CI validation in progress; not production-ready.


## Flutter Authentication and Administration Client — 2026-11-14

### Implemented on `phase-1/flutter-auth-admin-ui-v2`
- Configurable Dio API client using `API_BASE_URL`, with automatic Bearer-token attachment.
- Secure access/refresh token storage and serialized refresh-token rotation.
- Session restoration on app startup and local credential clearing when a session expires or is revoked.
- Arabic/English login and mandatory temporary-password rotation screens.
- Role-aware route selection using scoped roles returned by `/auth/me`.
- Employee self-profile screen backed by `/me/employee`.
- Active device-session list and revocation of other sessions.
- Initial branch/user/role administration dashboard, including one-time display and copy support for temporary credentials.
- HR receives read-only company branch-directory access, not branch write permission; company administrators can reach inactive branches to reactivate them.
- Arabic and English UI strings have been added.

### Remaining client and platform scope
- The PR is not merged until CI passes on its final head SHA.
- Supervisor, branch manager, HR, and executive dashboards are still foundational landing pages, not complete operational workspaces.
- Employee lifecycle/profile creation UI is incomplete; account provisioning currently links an existing employee record.
- Role/membership removal, branch editing, account recovery, and full employee administration UI remain open.
- Push/Web Push, attendance, shifts, breaks, requests, payroll, reporting, and the remaining operations modules are not complete.
- PostgreSQL RLS and transaction-scoped tenant isolation remain open.
- Render integration and production deployment are deferred to the final release stage.

**Status:** authentication and initial administration client integration is under CI validation; this is not a production-ready complete client.
