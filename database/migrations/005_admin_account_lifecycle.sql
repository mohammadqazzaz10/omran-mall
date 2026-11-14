ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_company_active
  ON users(company_id, is_active, created_at DESC)
  WHERE deleted_at IS NULL;

INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES ('users', 'assign_roles', 'company', 'users.assign_roles.company', 'إسناد الأدوار لحسابات المستخدمين')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code='users.assign_roles.company'
WHERE r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'HR_MANAGER')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Self-service permissions are safe only through endpoints that bind records to
-- the authenticated user ID. Cashier and employee roles receive no branch-wide access.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('employees.view.own', 'employees.edit.own')
WHERE r.code IN ('CASHIER', 'EMPLOYEE')
ON CONFLICT (role_id, permission_id) DO NOTHING;
