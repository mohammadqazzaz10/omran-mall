-- HR needs the company branch directory to select source and destination
-- branches for authorized employee transfers. This is read-only access; it
-- does not grant branch creation, editing, or operational cross-branch access.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'branches.view.company'
WHERE r.code = 'HR_MANAGER'
ON CONFLICT (role_id, permission_id) DO NOTHING;
