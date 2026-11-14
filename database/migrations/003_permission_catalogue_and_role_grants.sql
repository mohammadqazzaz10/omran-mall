-- Permission catalogue and deterministic role grants for Phase 1.
-- This migration is safe on an existing database and contains no user credentials.

INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('companies', 'view', 'company', 'companies.view.company', 'عرض بيانات الشركة'),
  ('companies', 'manage', 'company', 'companies.manage.company', 'إدارة بيانات الشركة'),
  ('branches', 'view', 'company', 'branches.view.company', 'عرض الفروع التابعة للشركة'),
  ('branches', 'manage', 'company', 'branches.manage.company', 'إدارة الفروع التابعة للشركة'),
  ('departments', 'view', 'branch', 'departments.view.branch', 'عرض أقسام الفرع'),
  ('departments', 'manage', 'branch', 'departments.manage.branch', 'إدارة أقسام الفرع'),
  ('positions', 'view', 'branch', 'positions.view.branch', 'عرض المسميات الوظيفية في الفرع'),
  ('positions', 'manage', 'branch', 'positions.manage.branch', 'إدارة المسميات الوظيفية في الفرع'),
  ('users', 'view', 'company', 'users.view.company', 'عرض حسابات المستخدمين'),
  ('users', 'manage', 'company', 'users.manage.company', 'إدارة حسابات المستخدمين'),
  ('roles', 'view', 'company', 'roles.view.company', 'عرض الأدوار والصلاحيات'),
  ('roles', 'manage', 'company', 'roles.manage.company', 'إدارة الأدوار والصلاحيات'),
  ('employees', 'view', 'branch', 'employees.view.branch', 'عرض موظفي الفرع'),
  ('employees', 'create', 'branch', 'employees.create.branch', 'إضافة موظفين إلى الفرع'),
  ('employees', 'edit', 'branch', 'employees.edit.branch', 'تعديل ملفات موظفي الفرع'),
  ('employees', 'archive', 'branch', 'employees.archive.branch', 'أرشفة موظفي الفرع'),
  ('employees', 'view', 'department', 'employees.view.department', 'عرض موظفي القسم'),
  ('employees', 'edit', 'department', 'employees.edit.department', 'تعديل ملفات موظفي القسم'),
  ('employees', 'view', 'own', 'employees.view.own', 'عرض الملف الوظيفي الشخصي'),
  ('employees', 'edit', 'own', 'employees.edit.own', 'تعديل البيانات الشخصية المسموح بها'),
  ('sessions', 'view', 'own', 'sessions.view.own', 'عرض جلسات الدخول الشخصية'),
  ('sessions', 'revoke', 'own', 'sessions.revoke.own', 'إبطال جلسة دخول شخصية')
ON CONFLICT (code) DO NOTHING;

-- The company-wide administrator roles receive company permissions and
-- explicit branch grants for branch-scoped permissions on every active branch.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON
  (p.scope = 'company' AND r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER'))
  OR (p.scope = 'branch' AND r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch managers receive operational branch permissions, but cannot manage
-- company-wide users, roles, or company settings.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.scope = 'branch'
WHERE r.code = 'BRANCH_MANAGER'
  AND p.module IN ('departments', 'positions', 'employees')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR managers receive company-level user/employee administration and
-- branch-level employee visibility/editing through explicit branch grants.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON
  (p.scope = 'company' AND p.module IN ('users'))
  OR (p.scope = 'branch' AND p.module IN ('employees', 'departments', 'positions'))
WHERE r.code = 'HR_MANAGER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Supervisors are restricted to department-scoped employee access.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.scope = 'department' AND p.module = 'employees'
WHERE r.code = 'SUPERVISOR'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- No permissions are assigned to cashier/employee roles here until own-record
-- enforcement is implemented in the corresponding service layer.
