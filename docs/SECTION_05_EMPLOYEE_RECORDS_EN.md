# Section 05 — Comprehensive Employee Record

## Objective
Extend the employee record beyond core identity and hiring data into a structured HR record while protecting personal, financial, contract, and document information and preserving the employee's history.

## Implemented in this increment
- Added separate permissions for employee profile extensions, documents, contracts, and employment history.
- Granted these permissions only to the built-in SUPER_ADMIN and HR_MANAGER roles; branch managers and supervisors do not receive them automatically.
- Added an upsert API for `employee_profiles`, with audit logging that masks IBAN, social-security, and tax identifiers in audit snapshots.
- Added APIs to list document metadata, register document metadata, and soft-archive documents. The document list does not return a file URL or storage key.
- Validated that a storage key belongs to the exact company/branch/employee namespace and rejected traversal paths. Allowed MIME types are PDF, JPEG, PNG, and WebP; recorded file size is capped at 25 MiB.
- Added contract listing and creation APIs. Only one current contract is allowed; creating another current contract is rejected while one exists.
- Added paginated employee history and records contract creation as a history event.
- Verified employee company and branch ownership in the service before reads and writes.
- Added migration 012 and indexes for document, contract, and history access.

## Routes
All routes are under:
`/branches/:branchId/employees/:employeeId/records`

| Method | Path | Permission |
|---|---|---|
| GET | `/profile` | `employee_profiles.view.branch` |
| POST | `/profile` | `employee_profiles.manage.branch` |
| GET | `/documents` | `employee_documents.view.branch` |
| POST | `/documents` | `employee_documents.manage.branch` |
| DELETE | `/documents/:documentId` | `employee_documents.manage.branch` |
| GET | `/contracts` | `employee_contracts.view.branch` |
| POST | `/contracts` | `employee_contracts.manage.branch` |
| GET | `/history?page=&limit=` | `employee_history.view.branch` |

## Security and operational boundaries
- This increment does not upload binary files and does not issue signed download URLs. `storageKey` is an opaque reference intended for a future private S3-compatible storage integration; it is not proof that a file has been uploaded or is downloadable.
- Document listing does not return storage keys, and there is no public download route.
- Public URLs and direct provider URLs must not be supplied as `storageKey`.
- Contract permissions are limited to HR_MANAGER and SUPER_ADMIN because contract records expose salary.
- History access is limited to HR_MANAGER and SUPER_ADMIN because historical snapshots may contain personal or financial data.
- A second current contract is rejected until an explicit contract close/termination workflow exists. Existing contracts are never silently closed or rewritten.
- Documents and contracts retain their original branch attribution, while HR authorized for the employee's current branch can still retrieve the employee's historical records after a transfer.
- A bilingual Flutter HR screen is now available for profile extensions, document metadata, contracts, and employment history; HR can edit profile extensions and create a contract.
- An employee-submitted change request/approval workflow, binary document upload/download, and photo management are still missing.

## Remaining work before this section can be considered complete
1. Private S3-compatible uploads, content-type and size verification, short-lived signed upload/download URLs, and secure retention/deletion.
2. Bilingual Flutter screens for employee records, profile extensions, documents, contracts, and history.
3. Approval workflow for sensitive employee-data changes, separating self-service changes from HR changes.
4. Contract lifecycle actions for close/terminate/renew/amend with effective dates and overlap prevention.
5. Private profile-photo upload, preview, crop, and authorization.
6. Scheduled document/contract expiry notifications with delivery evidence.
7. PostgreSQL integration tests for branch/employee isolation and authorization tests preventing managers/supervisors from reading IBAN, salary, and sensitive documents.
8. Widget/E2E tests and pilot-branch acceptance.

## Status
**Partial — Backend foundations, scoped permissions, migration, and initial unit tests are present. Binary upload, Flutter UI, approval workflows, and full contract lifecycle are not complete.**
