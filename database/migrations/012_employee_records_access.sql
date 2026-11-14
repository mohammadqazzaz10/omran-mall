-- Section 05: employee profile extensions, documents, contracts and history access.
-- Sensitive employee records are granted only to HR_MANAGER and SUPER_ADMIN.
INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('employee_profiles', 'view', 'branch', 'employee_profiles.view.branch', 'عرض البيانات الإضافية للملف الوظيفي'),
  ('employee_profiles', 'manage', 'branch', 'employee_profiles.manage.branch', 'إدارة البيانات الإضافية للملف الوظيفي'),
  ('employee_documents', 'view', 'branch', 'employee_documents.view.branch', 'عرض وثائق الموظفين'),
  ('employee_documents', 'manage', 'branch', 'employee_documents.manage.branch', 'إدارة بيانات وثائق الموظفين'),
  ('employee_contracts', 'view', 'branch', 'employee_contracts.view.branch', 'عرض العقود والرواتب التعاقدية'),
  ('employee_contracts', 'manage', 'branch', 'employee_contracts.manage.branch', 'إدارة العقود والرواتب التعاقدية'),
  ('employee_history', 'view', 'branch', 'employee_history.view.branch', 'عرض السجل الوظيفي التفصيلي')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'employee_profiles.view.branch',
  'employee_profiles.manage.branch',
  'employee_documents.view.branch',
  'employee_documents.manage.branch',
  'employee_contracts.view.branch',
  'employee_contracts.manage.branch',
  'employee_history.view.branch'
)
WHERE r.code IN ('SUPER_ADMIN', 'HR_MANAGER')
  AND r.is_system_role = TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_employee_documents_branch_employee_active
  ON employee_documents(branch_id, employee_id, expiry_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_contracts_branch_employee_current
  ON employee_contracts(branch_id, employee_id, is_current);

CREATE INDEX IF NOT EXISTS idx_employee_history_employee_effective
  ON employee_history(employee_id, effective_date DESC, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM employee_contracts
    WHERE is_current = TRUE
    GROUP BY employee_id, branch_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one current contract per employee and branch: duplicate current contracts exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_contracts_one_current
  ON employee_contracts(employee_id, branch_id)
  WHERE is_current = TRUE;
