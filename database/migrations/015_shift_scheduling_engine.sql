-- Section 07: secure shift templates, schedule assignments, swaps and coverage.
-- Local schedule timestamps are branch-local wall-clock values (without timezone).
-- Push delivery remains the responsibility of the notification delivery integration.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE shifts
  ADD COLUMN shift_type VARCHAR(30) NOT NULL DEFAULT 'morning',
  ADD COLUMN required_staff_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN description TEXT;

ALTER TABLE shifts
  ADD CONSTRAINT chk_shift_type
    CHECK (shift_type IN ('morning', 'evening', 'night', 'flexible', 'part_time', 'temporary', 'seasonal')),
  ADD CONSTRAINT chk_shift_required_staff
    CHECK (required_staff_count BETWEEN 0 AND 500),
  ADD CONSTRAINT uq_shifts_id_branch UNIQUE (id, branch_id);

UPDATE shifts
SET shift_type = CASE WHEN is_night_shift THEN 'night' ELSE 'morning' END;

ALTER TABLE shift_assignments
  ADD COLUMN department_id UUID,
  ADD COLUMN scheduled_start_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN scheduled_end_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'published',
  ADD COLUMN notes VARCHAR(1000),
  ADD COLUMN published_at TIMESTAMPTZ;

UPDATE shift_assignments a
SET department_id = e.department_id,
    scheduled_start_at = CASE WHEN a.is_day_off THEN NULL ELSE a.work_date + s.start_time END,
    scheduled_end_at = CASE
      WHEN a.is_day_off THEN NULL
      ELSE a.work_date + s.end_time
        + CASE WHEN s.end_time <= s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END
    END,
    status = CASE WHEN a.is_published THEN 'published' ELSE 'draft' END,
    published_at = CASE WHEN a.is_published THEN a.updated_at ELSE NULL END
FROM employees e
LEFT JOIN shifts s ON s.id = a.shift_id
WHERE e.id = a.employee_id;

UPDATE shift_assignments
SET shift_id = NULL
WHERE is_day_off = TRUE;

ALTER TABLE shift_assignments
  ALTER COLUMN department_id SET NOT NULL,
  ALTER COLUMN shift_id DROP NOT NULL,
  ADD CONSTRAINT chk_shift_assignment_status
    CHECK (status IN ('draft', 'published', 'cancelled')),
  ADD CONSTRAINT chk_shift_assignment_times
    CHECK (
      (is_day_off = TRUE AND shift_id IS NULL AND scheduled_start_at IS NULL AND scheduled_end_at IS NULL)
      OR
      (is_day_off = FALSE AND shift_id IS NOT NULL
       AND scheduled_start_at IS NOT NULL AND scheduled_end_at > scheduled_start_at)
    ),
  ADD CONSTRAINT uq_shift_assignments_id_branch_employee
    UNIQUE (id, branch_id, employee_id);

ALTER TABLE shift_assignments
  DROP CONSTRAINT uq_emp_shift_date,
  ADD CONSTRAINT uq_emp_shift_date
    UNIQUE (employee_id, work_date) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT fk_shift_assignment_employee_branch
    FOREIGN KEY (employee_id, branch_id)
    REFERENCES employees(id, branch_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_shift_assignment_department_branch
    FOREIGN KEY (department_id, branch_id)
    REFERENCES departments(id, branch_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_shift_assignment_shift_branch
    FOREIGN KEY (shift_id, branch_id)
    REFERENCES shifts(id, branch_id) ON DELETE RESTRICT;

ALTER TABLE shift_assignments
  ADD CONSTRAINT ex_shift_assignment_employee_time
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(scheduled_start_at, scheduled_end_at, '[)') WITH &&
  )
  WHERE (status <> 'cancelled' AND is_day_off = FALSE)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_shift_assignments_branch_date
  ON shift_assignments(branch_id, work_date, status);
CREATE INDEX idx_shift_assignments_department_date
  ON shift_assignments(branch_id, department_id, work_date, status);
CREATE INDEX idx_shift_assignments_employee_date
  ON shift_assignments(employee_id, work_date DESC);

ALTER TABLE shift_swap_requests
  ADD COLUMN target_responded_at TIMESTAMPTZ,
  ADD COLUMN manager_decided_at TIMESTAMPTZ,
  ADD COLUMN manager_notes VARCHAR(1000);

ALTER TABLE shift_swap_requests
  ADD CONSTRAINT chk_shift_swap_status
    CHECK (status IN ('pending_colleague', 'pending_manager', 'approved', 'rejected')),
  ADD CONSTRAINT chk_shift_swap_distinct_employees
    CHECK (requester_employee_id <> target_employee_id),
  ADD CONSTRAINT chk_shift_swap_distinct_assignments
    CHECK (requester_assignment_id <> target_assignment_id),
  ADD CONSTRAINT fk_shift_swap_requester_employee_branch
    FOREIGN KEY (requester_employee_id, branch_id)
    REFERENCES employees(id, branch_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_shift_swap_target_employee_branch
    FOREIGN KEY (target_employee_id, branch_id)
    REFERENCES employees(id, branch_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_shift_swap_requester_assignment_scope
    FOREIGN KEY (requester_assignment_id, branch_id, requester_employee_id)
    REFERENCES shift_assignments(id, branch_id, employee_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_shift_swap_target_assignment_scope
    FOREIGN KEY (target_assignment_id, branch_id, target_employee_id)
    REFERENCES shift_assignments(id, branch_id, employee_id) ON DELETE CASCADE;

CREATE INDEX idx_shift_swap_branch_status
  ON shift_swap_requests(branch_id, status, created_at DESC);

CREATE TABLE shift_coverage_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  department_id UUID NOT NULL,
  shift_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL,
  minimum_staff INTEGER NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_shift_coverage_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_shift_coverage_minimum CHECK (minimum_staff BETWEEN 1 AND 500),
  CONSTRAINT chk_shift_coverage_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT fk_shift_coverage_department_branch
    FOREIGN KEY (department_id, branch_id)
    REFERENCES departments(id, branch_id) ON DELETE CASCADE,
  CONSTRAINT fk_shift_coverage_shift_branch
    FOREIGN KEY (shift_id, branch_id)
    REFERENCES shifts(id, branch_id) ON DELETE CASCADE,
  CONSTRAINT uq_shift_coverage_requirement
    UNIQUE (branch_id, department_id, shift_id, day_of_week, valid_from)
);

CREATE INDEX idx_shift_coverage_lookup
  ON shift_coverage_requirements(branch_id, valid_from, valid_to, day_of_week);

INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('shifts', 'view', 'branch', 'shifts.view.branch', 'عرض الورديات والجداول في الفرع'),
  ('shifts', 'view', 'own', 'shifts.view.own', 'عرض جدول الموظف الشخصي'),
  ('shifts', 'manage', 'branch', 'shifts.manage.branch', 'إدارة قوالب الورديات والجداول'),
  ('shifts', 'publish', 'branch', 'shifts.publish.branch', 'نشر جداول الورديات وإشعار الموظفين'),
  ('shifts', 'swap', 'own', 'shifts.swap.own', 'طلب تبديل الوردية والرد على طلب التبديل'),
  ('shifts', 'swap_manage', 'branch', 'shifts.swap.manage.branch', 'اعتماد أو رفض تبديل الورديات'),
  ('shifts', 'coverage_view', 'branch', 'shifts.coverage.view.branch', 'عرض عجز تغطية الورديات'),
  ('shifts', 'coverage_manage', 'branch', 'shifts.coverage.manage.branch', 'إدارة الحد الأدنى لتغطية الورديات')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'shifts.view.branch', 'shifts.manage.branch', 'shifts.publish.branch',
  'shifts.swap.manage.branch', 'shifts.coverage.view.branch', 'shifts.coverage.manage.branch'
)
WHERE r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'BRANCH_MANAGER', 'ASSISTANT_MANAGER', 'SUPERVISOR', 'HR_MANAGER', 'HR_OFFICER', 'PERSONNEL_OFFICER')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('shifts.view.own', 'shifts.swap.own')
WHERE r.code IN ('EMPLOYEE', 'CASHIER', 'CASHIER_SUPERVISOR')
ON CONFLICT (role_id, permission_id) DO NOTHING;
