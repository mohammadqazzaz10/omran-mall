-- Attendance API permissions and same-branch relational integrity.
-- Existing schema.sql remains immutable; this is an additive migration.

ALTER TABLE attendance_records
  ADD CONSTRAINT uq_attendance_record_scope UNIQUE (id, branch_id, employee_id);

ALTER TABLE attendance_records
  ADD CONSTRAINT fk_attendance_employee_branch
    FOREIGN KEY (employee_id, branch_id)
    REFERENCES employees(id, branch_id) ON DELETE CASCADE;

ALTER TABLE attendance_corrections
  ADD CONSTRAINT fk_attendance_correction_employee_branch
    FOREIGN KEY (employee_id, branch_id)
    REFERENCES employees(id, branch_id) ON DELETE CASCADE;

ALTER TABLE attendance_corrections
  ADD CONSTRAINT fk_attendance_correction_record_scope
    FOREIGN KEY (attendance_record_id, branch_id, employee_id)
    REFERENCES attendance_records(id, branch_id, employee_id)
    ON DELETE CASCADE;

ALTER TABLE attendance_corrections
  ADD CONSTRAINT chk_attendance_correction_time_requested
    CHECK (requested_check_in IS NOT NULL OR requested_check_out IS NOT NULL);

CREATE INDEX idx_attendance_branch_work_date
  ON attendance_records(branch_id, work_date DESC);

CREATE INDEX idx_attendance_corrections_branch_status
  ON attendance_corrections(branch_id, status, created_at DESC);

INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('attendance', 'view', 'own', 'attendance.view.own', 'عرض سجل الحضور الشخصي'),
  ('attendance', 'check_in', 'own', 'attendance.check_in.own', 'تسجيل الحضور الشخصي'),
  ('attendance', 'check_out', 'own', 'attendance.check_out.own', 'تسجيل الانصراف الشخصي'),
  ('attendance', 'correct', 'own', 'attendance.correct.own', 'طلب تصحيح سجل الحضور الشخصي'),
  ('attendance', 'view', 'branch', 'attendance.view.branch', 'عرض سجلات الحضور في الفرع'),
  ('attendance', 'approve', 'branch', 'attendance.approve.branch', 'اعتماد تصحيحات الحضور في الفرع')
ON CONFLICT (code) DO NOTHING;

-- Employee self-service grants remain own-scoped; managers receive branch review access.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'attendance.view.own',
  'attendance.check_in.own',
  'attendance.check_out.own',
  'attendance.correct.own'
)
WHERE r.code IN ('EMPLOYEE', 'CASHIER', 'CASHIER_SUPERVISOR')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'attendance.view.branch',
  'attendance.approve.branch'
)
WHERE r.code IN (
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'BRANCH_MANAGER',
  'ASSISTANT_MANAGER',
  'SUPERVISOR',
  'HR_OFFICER',
  'PERSONNEL_OFFICER'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
