-- Section 06: rotating branch QR challenges and per-employee replay protection.
-- Tokens are never stored in plaintext; only a SHA-256 nonce digest is persisted.

ALTER TABLE employees
  ADD CONSTRAINT uq_employees_id_branch UNIQUE (id, branch_id);

CREATE TABLE attendance_qr_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  nonce_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_attendance_qr_expiry CHECK (expires_at > created_at),
  CONSTRAINT uq_attendance_qr_challenge_branch UNIQUE (id, branch_id)
);

CREATE INDEX idx_attendance_qr_challenges_active
  ON attendance_qr_challenges(branch_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE attendance_qr_uses (
  challenge_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (challenge_id, employee_id),
  CONSTRAINT fk_attendance_qr_use_challenge_branch
    FOREIGN KEY (challenge_id, branch_id)
    REFERENCES attendance_qr_challenges(id, branch_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_qr_use_employee_branch
    FOREIGN KEY (employee_id, branch_id)
    REFERENCES employees(id, branch_id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_qr_uses_employee
  ON attendance_qr_uses(employee_id, used_at DESC);

INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('attendance', 'manage_qr', 'branch', 'attendance.qr.manage.branch', 'إنشاء رمز QR دوار للحضور في الفرع')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'attendance.qr.manage.branch'
WHERE r.code IN (
  'SUPER_ADMIN', 'GENERAL_MANAGER', 'BRANCH_MANAGER',
  'ASSISTANT_MANAGER', 'SUPERVISOR', 'HR_MANAGER',
  'HR_OFFICER', 'PERSONNEL_OFFICER'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
