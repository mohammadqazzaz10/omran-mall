-- HR needs company-scoped branch visibility to provision users into the right branch.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code='branches.view.company'
WHERE r.code='HR_MANAGER'
ON CONFLICT (role_id, permission_id) DO NOTHING;
