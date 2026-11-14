# Database migration policy

- `database/schema.sql` is the immutable baseline migration and is recorded as `001_initial_schema`.
- The migration runner applies the baseline once, then applies sorted `NNN_description.sql` files from this directory.
- Never edit a migration after it has been applied to a shared database. Add a new numbered migration instead.
- Each migration is protected by a PostgreSQL advisory lock and a SHA-256 checksum recorded in `schema_migrations`.
- Development seed data is separate from migrations and requires the explicit `ALLOW_DEVELOPMENT_SEEDS=true` flag. It must never run in production.


## 009_employee_branch_transfers.sql
Adds the company-scoped `employees.transfer.company` permission and grants it to SUPER_ADMIN, GENERAL_MANAGER, and HR_MANAGER. Branch managers do not receive cross-branch transfer authority by default.


## 010_hr_branch_directory_read_permission.sql
Grants HR_MANAGER read-only access to the company branch directory so the transfer workflow can choose source and destination branches. It does not grant branch management permissions.
