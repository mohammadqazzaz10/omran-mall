-- Company-authorized employee transfers across branches.
-- The transfer permission is intentionally company-scoped: branch managers
-- cannot move employees across branch boundaries by virtue of branch access.
INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('employees', 'transfer', 'company', 'employees.transfer.company',
   'نقل موظف بين فروع الشركة مع حفظ السجل الوظيفي')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'employees.transfer.company'
WHERE r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'HR_MANAGER')
ON CONFLICT (role_id, permission_id) DO NOTHING;
