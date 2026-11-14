-- Explicit branch membership and revocable rotating authentication sessions.
-- All memberships are constrained to the user's company at the database layer.

ALTER TABLE users
  ADD CONSTRAINT uq_users_id_company UNIQUE (id, company_id);

ALTER TABLE branches
  ADD CONSTRAINT uq_branches_id_company UNIQUE (id, company_id);

CREATE TABLE user_branch_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  company_id UUID NOT NULL,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT fk_membership_user_company
    FOREIGN KEY (user_id, company_id) REFERENCES users(id, company_id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_branch_company
    FOREIGN KEY (branch_id, company_id) REFERENCES branches(id, company_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_user_branch_memberships_active
  ON user_branch_memberships(user_id, branch_id)
  WHERE revoked_at IS NULL;

-- Preserve access already explicitly represented by primary_branch_id and
-- branch-scoped user_roles. Company-wide role assignments do not silently
-- become all-branch access.
INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
SELECT u.id, u.primary_branch_id, u.company_id
FROM users u
JOIN branches b ON b.id = u.primary_branch_id AND b.company_id = u.company_id
WHERE u.primary_branch_id IS NOT NULL
ON CONFLICT (user_id, branch_id) WHERE revoked_at IS NULL DO NOTHING;

INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
SELECT DISTINCT u.id, ur.branch_id, u.company_id
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id AND r.company_id = u.company_id
JOIN branches b ON b.id = ur.branch_id AND b.company_id = u.company_id
WHERE ur.branch_id IS NOT NULL
ON CONFLICT (user_id, branch_id) DO NOTHING;

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash CHAR(64) NOT NULL,
  device_id VARCHAR(160),
  device_name VARCHAR(160),
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(80),
  CONSTRAINT chk_auth_session_expiry CHECK (refresh_expires_at > created_at)
);

CREATE INDEX idx_auth_sessions_user_active
  ON auth_sessions(user_id, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_sessions_expiry
  ON auth_sessions(refresh_expires_at);
