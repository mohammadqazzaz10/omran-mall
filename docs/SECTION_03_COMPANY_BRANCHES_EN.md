# Section 03 — Company, Branches, and Organization

## Objective
Implement the company/branch/department/position hierarchy with server-side access boundaries and employee transfers that preserve employment history.

## Implemented in this increment
- A dedicated company-scoped permission for cross-branch employee transfers: `employees.transfer.company`.
- The permission is granted by default only to senior company administration and HR roles; branch-level access alone does not authorize cross-branch transfers.
- An API operation to transfer an employee from a source branch to another branch belonging to the same company.
- Apply `BranchIsolationGuard` to branch-scoped organization, attendance, and break controllers, in addition to permission/membership checks in PermissionGuard.
- Validation of the target branch, department, position, and optional direct manager before changing the employee.
- Preservation of source and destination branch/department/position, reason, and effective date in `employee_history`.
- Movement of the linked account's branch membership, removal of source-branch role grants, and no automatic copying of privileges into the destination branch.
- Historical attendance remains associated with its original branch.

## Safety guards
A transfer is rejected while the employee has an open attendance record, an open break, future published shifts, direct reports, or a department-manager assignment. These relationships must be resolved first to avoid orphaned operational data or cross-branch management links.

## Completion boundary
This is an implementation increment for employee transfer and its controls, not a claim that every organization requirement is complete. Branch lifecycle management, department transfers, advanced role policies, and comprehensive PostgreSQL isolation tests remain separate work.
