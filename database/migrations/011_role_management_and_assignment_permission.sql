-- Complete the company-scoped role assignment permission for existing tenants.
-- System role creation and permission grants remain deterministic and idempotent.
INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES ('users', 'assign_roles', 'company', 'users.assign_roles.company', 'إسناد الأدوار لحسابات المستخدمين')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'users.assign_roles.company'
WHERE r.code IN ('GENERAL_MANAGER', 'HR_MANAGER')
  AND r.is_system_role = TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SUPER_ADMIN already receives all company/branch permissions through migration 003.
