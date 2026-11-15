-- Section 06: authenticated users may list and mark only their own notifications.
-- Ownership is enforced in every service query using the verified user ID.
INSERT INTO permissions (module, action, scope, code, description_ar)
VALUES
  ('notifications', 'view', 'own', 'notifications.view.own', 'عرض إشعارات المستخدم الخاصة به'),
  ('notifications', 'read', 'own', 'notifications.read.own', 'تحديث حالة قراءة إشعارات المستخدم الخاصة به')
ON CONFLICT (code) DO NOTHING;

-- Notification self-service is safe for all role types because API queries are
-- strictly constrained by the authenticated user ID, never a client-supplied ID.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.code IN ('notifications.view.own', 'notifications.read.own')
ON CONFLICT (role_id, permission_id) DO NOTHING;
