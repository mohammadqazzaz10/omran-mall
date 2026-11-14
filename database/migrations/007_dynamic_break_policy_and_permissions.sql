-- Dynamic, branch-scoped break policies and operational permissions.
ALTER TABLE break_types
  ADD COLUMN allowed_start_time TIME,
  ADD COLUMN allowed_end_time TIME,
  ADD COLUMN max_simultaneous_per_department INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN blackout_periods JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN notify_before_end_minutes INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN allow_early_return BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE break_types
  ADD CONSTRAINT chk_break_type_allowed_window
    CHECK (
      (allowed_start_time IS NULL AND allowed_end_time IS NULL)
      OR
      (allowed_start_time IS NOT NULL AND allowed_end_time IS NOT NULL)
    ),
  ADD CONSTRAINT chk_break_type_max_simultaneous
    CHECK (max_simultaneous_per_department > 0),
  ADD CONSTRAINT chk_break_type_blackout_periods_array
    CHECK (jsonb_typeof(blackout_periods) = 'array'),
  ADD CONSTRAINT chk_break_type_notify_before_end
    CHECK (notify_before_end_minutes BETWEEN 0 AND 60);

ALTER TABLE break_requests
  ADD COLUMN decided_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ;

ALTER TABLE break_sessions
  ADD COLUMN department_id UUID;

UPDATE break_sessions s
SET department_id = e.department_id
FROM employees e
WHERE e.id = s.employee_id
  AND s.department_id IS NULL;

ALTER TABLE break_sessions
  ALTER COLUMN department_id SET NOT NULL,
  ADD CONSTRAINT fk_break_session_department_branch
    FOREIGN KEY (department_id, branch_id)
    REFERENCES departments(id, branch_id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_break_sessions_one_active_per_employee
  ON break_sessions(employee_id)
  WHERE actual_end_time IS NULL;

CREATE INDEX idx_break_sessions_branch_active
  ON break_sessions(branch_id, department_id, expected_end_time)
  WHERE actual_end_time IS NULL;

CREATE INDEX idx_break_requests_branch_status_created
  ON break_requests(branch_id, status, created_at DESC);

INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('breaks', 'view', 'branch', 'breaks.view.branch', 'عرض الاستراحات والطلبات في الفرع'),
  ('breaks', 'manage', 'branch', 'breaks.manage.branch', 'إدارة أنواع وسياسات الاستراحات'),
  ('breaks', 'request', 'own', 'breaks.request.own', 'طلب استراحة شخصية'),
  ('breaks', 'approve', 'branch', 'breaks.approve.branch', 'الموافقة على طلبات الاستراحة'),
  ('breaks', 'end', 'own', 'breaks.end.own', 'إنهاء الاستراحة الشخصية')
ON CONFLICT (code) DO NOTHING;

-- Company-wide administrators inherit the new branch-scoped permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'breaks.view.branch',
  'breaks.manage.branch',
  'breaks.approve.branch'
)
WHERE r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch managers configure policies; supervisors monitor and approve.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON
  (r.code = 'BRANCH_MANAGER' AND p.code IN (
    'breaks.view.branch', 'breaks.manage.branch', 'breaks.approve.branch'
  ))
  OR
  (r.code = 'SUPERVISOR' AND p.code IN (
    'breaks.view.branch', 'breaks.approve.branch'
  ))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Employee self-service permissions are explicit and scoped to the employee.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('breaks.request.own', 'breaks.end.own')
WHERE r.code IN ('EMPLOYEE', 'CASHIER')
ON CONFLICT (role_id, permission_id) DO NOTHING;
