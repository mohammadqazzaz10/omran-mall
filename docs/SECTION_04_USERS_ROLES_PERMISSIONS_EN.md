# Section 04 — Users, Roles, and Permissions

**Normative reference:** `docs/MASTER_REQUIREMENTS_EN.md` §4.  
**Scope:** Permission catalogue, built-in and custom roles, multi-role assignment, scope enforcement, and privilege-escalation prevention.

## Implemented in this increment

1. Added migration `011_role_management_and_assignment_permission.sql` to insert the missing `users.assign_roles.company` permission and grant it to existing GENERAL_MANAGER and HR_MANAGER system roles. SUPER_ADMIN receives it through the existing company-permission grant.
2. Updated the bootstrap permission-catalogue check so first-admin creation fails safely unless this permission exists; bootstrap remains transactional.
3. Added API support for listing roles and permissions, creating custom roles, and updating custom role metadata and permission grants.
4. Restricted custom-role management to SUPER_ADMIN on the server and prohibited editing built-in system roles.
5. Required the `CUSTOM_` code prefix and validated that every selected permission exists and that all permissions on one custom role share exactly one scope: branch, department, or own.
6. Prohibited custom roles from receiving company-wide permissions and sensitive identity, user, role, session, branch-administration, and cross-branch-transfer capabilities.
7. Extended role assignment to support custom roles within company branches, validating the department when the role uses department scope. Existing elevated built-in roles remain protected by SUPER_ADMIN checks.
8. Added audit records for custom-role creation, custom-role updates, and role assignment.
9. Added a bilingual Flutter interface for SUPER_ADMIN to create custom roles, edit them, and select from the allowed permission catalogue.

## Implementation and acceptance boundary

**Status: Partial — basic custom-role management and assignment are implemented with privilege-escalation controls.** This does not mean the full permission matrix for every module and action is complete.

Still required before this section can be accepted as complete:
- Expand the permission catalogue to every module in the 40-section requirements and all actions: view, create, update, archive/delete, approve, reject, export, print, and settings.
- Model request-type, operation-type, and data-sensitivity scopes where applicable, rather than relying only on the current branch/department/own scopes.
- Define explicit conflicting-role rules and tests; add a safe role-revocation workflow and review session impact.
- Audit every controller, WebSocket event, background job, file, and report for RequirePermission and server-side resource-scope enforcement.
- Run PostgreSQL integration tests across companies, branches, and departments, including privilege-bypass attempts, concurrency, and migrations on an existing database.
- Run UI acceptance tests for all roles and platforms, beyond successful static analysis and builds.

## Invariants

- The server must not trust a client-supplied role or branch identifier without validating company, membership, and scope.
- A custom role cannot grant role/user administration, company settings, or cross-branch transfer permissions.
- Built-in system roles cannot be modified through custom-role management.
- Sensitive changes must be recorded in audit_logs; effective access remains determined by persisted database grants.

## Change log

- 2026-11-14: Added role-assignment permission migration, role-management APIs, scope and escalation controls, privilege-boundary tests, and bilingual Flutter UI.
