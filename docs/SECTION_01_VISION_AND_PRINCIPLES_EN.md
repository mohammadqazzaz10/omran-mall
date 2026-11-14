# Section 01 — Vision, Objectives, and Mandatory Principles

**Authoritative references:** Section 1 of `docs/MASTER_REQUIREMENTS_AR.md` and `docs/MASTER_REQUIREMENTS_EN.md`.  
**Scope:** Product governance and acceptance standards applicable to all forty project sections.  
**Rule:** This section establishes design, implementation, and acceptance rules. It does not by itself mean that the operational features in other sections have been implemented.

## 1. Vision and Objectives

Build one integrated enterprise platform to manage the full employee lifecycle and Omran Mall's daily, administrative, financial, communication, and oversight operations across branches, from employee-record creation through separation. All domains must work as connected modules over a trusted data source, unified authorization, and auditable history.

This is not merely an attendance application or a collection of demo screens. Every claimed feature must have a real workflow, persistent data, protected APIs, an appropriate user interface, and tests that prove its behavior.

### Functional scope the vision must deliver

1. Employee and personnel records.
2. Attendance and departure.
3. Shifts and schedules.
4. Breaks, lunch, and smoking breaks.
5. Short leave and permission requests.
6. Leave and holidays.
7. Lateness, absence, and violations.
8. Payroll, entitlements, and deductions.
9. Daily tasks and instructions.
10. Announcements and internal communication.
11. Real-time notifications and alerts.
12. Performance and productivity evaluation.
13. Documents, contracts, and records.
14. Training and development.
15. Employee self-service and requests.
16. Branches, departments, and positions.
17. Reports and analytics.
18. Permissions, monitoring, and audit.
19. Archiving and employment history.
20. Assets, custody items, and equipment.

## 2. Mandatory Principles and Verification Controls

| ID | Mandatory principle | Required implementation control | Acceptance evidence |
|---|---|---|---|
| VSN-01 | A real operational product, not a demo | A screen or database table alone never completes a feature; relevant data, backend, UI, authorization, and documentation layers must be implemented. | An end-to-end acceptance scenario, automated test, and recorded result. |
| VSN-02 | Scale and multi-branch support from day one | Every entity, request, query, event, and file must carry the appropriate company/branch/department scope. Do not assume a permanent single-branch deployment. | Positive and negative cross-branch tests for APIs, WebSockets, files, and reports where applicable. |
| VSN-03 | Server- and database-enforced data isolation and authorization | Deny by default; verify identity, permission, and resource scope on every path; never trust a client-supplied branch ID; implement RLS or a documented and tested defensive equivalent. | A permission matrix, allow/deny tests, and data-leakage tests covering queries and background jobs. |
| VSN-04 | Auditable records | Record actor, time, entity, changed values, reason, and outcome for sensitive operations; prohibit silent changes. | Tests proving audit writes occur in the correct transaction and are not lost on failure. |
| VSN-05 | Phone, tablet, and browser support | Responsive Flutter interfaces that respect platform differences; never claim an untested platform or capability. | Analyze/build and UI tests, with Android, iOS, and Web validation for the release scope. |
| VSN-06 | Simple employee experience and complete management dashboards | Employee workflows must be clear and short; management dashboards must expose only authorized data and identify the source of metrics. | Widget/UX tests and role-based acceptance, including loading, empty, and error states. |
| VSN-07 | Offline operation within safe, declared limits | Offline operations remain pending and non-final; each queued operation needs an idempotency key, conflict policy, and synchronization behavior. | Disconnect/reconnect, duplicate, and conflict tests, plus documentation of permitted offline operations. |
| VSN-08 | No data loss during updates or restarts | PostgreSQL or an approved store is the persistent source of truth; schema changes use safe migrations; backup and restore are part of readiness. | Existing-database upgrade, clean-database migration, backup/restore, and persistence-after-restart tests. |
| VSN-09 | Live updates without manual refresh | Use realtime delivery while connected and real Push when notifications must arrive while the app is closed; WebSocket alone is not Push. | Event authorization, deduplication, reconnect tests, and real-device/browser Push tests. |
| VSN-10 | Security, attendance accuracy, and record integrity | Least privilege, sensitive-data protection, server time for sensitive operations, no silent mutation, and no secrets or real employee data in Git or logs. | Security checks, authorization/time/tampering tests, secret/dependency scanning, and log/file review. |

## 3. Global Product Invariants

1. Arabic is the default language with full RTL; English is supported with LTR.
2. Currency is JOD; monetary values use three decimal places. Floating-point arithmetic is prohibited for financial calculations.
3. The operational time zone is `Asia/Amman`; sensitive operations use server time.
4. PostgreSQL is the source of truth for persistent data; Redis must not replace durable records.
5. Every API, WebSocket event, attachment, and report is subject to authentication, authorization, and data scope.
6. Bulk messaging, deductions, financial effects, or production deployment must not be activated before required testing and approval.
7. Real employee data must not be used in development or tests.
8. Offline, Push, platform, or integration support must not be claimed without matching test evidence.
9. Updating current data must not erase employment history or audit records.
10. Cross-branch access is never granted by default; multi-branch access requires explicit permission.

## 4. Mandatory Pull Request Review Gate

Every pull request must answer the following, marking an item not applicable only with a reason:

- Which of the forty sections and requirements does this change implement?
- How does it relate to prior and future sections, and which shared contracts does it depend on?
- Are the relevant database, backend, UI, authorization, and documentation layers complete?
- What identity, permission, and branch scope are required, and are they enforced server-side?
- Does the change involve personal or financial data, files, or notifications? How are they protected and audited?
- What are the success, failure, concurrency, offline, and duplicate-request scenarios?
- Which tests actually ran, and what was the CI result for the exact commit?
- Are migrations, backup/restore, or rollback procedures required?
- Have traceability, OpenAPI/ERD, and documentation been updated where needed?
- Does the change alter operational, financial, or legal behavior requiring owner approval?
- Have affected existing features been regression-tested?

## 5. Definition of Done for Section 01

The governance framework for this section is accepted when:
- The vision, functional scope, and product invariants are documented in Arabic and English.
- Every principle has a stable identifier, implementation control, and defined acceptance evidence.
- The review gate is part of the pull request template.
- Section 01 is linked to the forty-section traceability matrix.
- Compatibility and regression-protection rules for prior sections are explicit in the development workflow.
- Implementation gaps remain visible and classified rather than being represented as completed.

**Completion boundary:** Completing this section establishes governance and engineering/review standards. It does not prove that all product features have been implemented or accepted. The principles must be proven through implementation and testing of the operational sections. Therefore, final product-vision verification remains dependent on sections 2–40.

## 6. Change Log

- 2026-11-14: Converted the ten mandatory principles into stable identifiers, controls, and acceptance evidence; connected them to the pull request review template and traceability matrix.
- 2026-11-14: Added the complete twenty-domain functional scope and explicit integration/regression safeguards.
