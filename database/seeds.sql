-- ============================================================================
-- OMRAN MALL MANAGEMENT SYSTEM (مشروع عمران مول)
-- DEVELOPMENT ONLY: synthetic bootstrap data for a disposable local database.
-- NEVER run this file in staging or production. It contains illustrative policy values.
-- Do not add real employee, personal, financial, contact, or location data here.
-- Initial Database Seeds & Default Enterprise Configurations
-- Currency: JOD | Timezone: Asia/Amman
-- ============================================================================

-- 1. Insert Omran Mall Company
INSERT INTO companies (
    id, code, name_ar, name_en, tax_number, headquarters_address, phone, email, currency, timezone
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'OMRAN-CORP',
    'شركة عمران مول للمجمعات التجارية ذ.م.م',
    'Omran Mall Commercial Complexes LLC',
    '100234567',
    'عمان - شارع وصفي التل (الجاردنز)',
    '+96265000000',
    'management@omranmall.com',
    'JOD',
    'Asia/Amman'
) ON CONFLICT (code) DO NOTHING;

-- 2. Insert Main Branches (Multi-Branch Readiness)
INSERT INTO branches (
    id, company_id, code, name_ar, name_en, address, phone, email, latitude, longitude, geofence_radius_meters
) VALUES 
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'BR-MAIN',
    'عمران مول - فرع عمان الرئيسي',
    'Omran Mall - Main Amman Branch',
    'عمان - شارع المدينة المنورة',
    '+96265000001',
    'amman-main@omranmall.com',
    31.985600,
    35.859200,
    150
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'BR-WEST',
    'عمران مول - فرع غرب عمان',
    'Omran Mall - West Amman Branch',
    'عمان - دابوق',
    '+96265000002',
    'west-amman@omranmall.com',
    31.998000,
    35.820000,
    200
) ON CONFLICT (company_id, code) DO NOTHING;

-- 3. Insert Core Departments for Main Branch
INSERT INTO departments (
    id, branch_id, code, name_ar, name_en, max_simultaneous_break_percentage
) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'MGMT', 'الإدارة العامة والعمليات', 'General Management & Operations', 10),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'CASH', 'قسم الكاشات وأمناء الصندوق', 'Cashiers & Pos Operations', 15),
('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'CS', 'خدمة العملاء والاستقبال', 'Customer Service & Reception', 20),
('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'LOG', 'المستودعات والتوريد', 'Warehouse & Logistics', 25),
('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'SEC', 'الأمن والسلامة العامة', 'Security & Safety', 10)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 4. Insert Break Types (Fully Configurable per Requirements)
INSERT INTO break_types (
    id, branch_id, code, name_ar, name_en, default_duration_minutes, max_duration_minutes, daily_quota_times, cooldown_between_breaks_minutes, requires_approval, deduct_from_work_hours
) VALUES
('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'LUNCH', 'استراحة غداء', 'Lunch Break', 30, 45, 1, 120, TRUE, FALSE),
('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'SMOKE', 'فجوة تدخين', 'Smoking Gap', 10, 15, 2, 90, TRUE, FALSE),
('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'COFFEE', 'استراحة قهوة وشاي', 'Coffee Break', 15, 20, 1, 60, TRUE, FALSE),
('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'EMERGENCY', 'استراحة طارئة', 'Emergency Break', 20, 30, 1, 0, TRUE, FALSE)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 5. Insert Jordanian Labor Law Leave Types
INSERT INTO leave_types (
    id, company_id, code, name_ar, name_en, default_days_per_year, is_paid, requires_attachment, can_carry_over, max_carry_over_days
) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ANNUAL', 'إجازة سنوية اعتيادية', 'Annual Leave', 14, TRUE, FALSE, TRUE, 7),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'SICK', 'إجازة مرضية معتمدة', 'Sick Leave', 14, TRUE, TRUE, FALSE, 0),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'MATERNITY', 'إجازة أمومة قانونية', 'Maternity Leave', 70, TRUE, TRUE, FALSE, 0),
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'PATERNITY', 'إجازة أبوة', 'Paternity Leave', 3, TRUE, TRUE, FALSE, 0),
('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'UNPAID', 'إجازة بدون راتب', 'Unpaid Leave', 0, FALSE, FALSE, FALSE, 0)
ON CONFLICT (company_id, code) DO NOTHING;

-- 6. Insert Roles
INSERT INTO roles (
    id, company_id, code, name_ar, name_en, description, is_system_role
) VALUES
('r0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'مدير النظام الأعلى', 'Super Administrator', TRUE),
('r0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'GENERAL_MANAGER', 'المدير العام / الإدارة العليا', 'General Manager', TRUE),
('r0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'BRANCH_MANAGER', 'مدير فرع', 'Branch Manager', TRUE),
('r0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'HR_MANAGER', 'مسؤول الموارد البشرية وشؤون الموظفين', 'HR Manager', TRUE),
('r0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'SUPERVISOR', 'مشرف قسم / مشرف وردية', 'Department / Shift Supervisor', TRUE),
('r0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'CASHIER', 'أمين صندوق / كاشير', 'Cashier', TRUE),
('r0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'EMPLOYEE', 'موظف تشغيلي', 'Employee', TRUE)
ON CONFLICT (company_id, code) DO NOTHING;

-- 7. Insert Default Standard Shifts for Retail Operation
INSERT INTO shifts (
    id, branch_id, code, name_ar, name_en, start_time, end_time, grace_period_late_minutes, grace_period_early_leave_minutes, color_hex
) VALUES
('s0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'MORNING', 'الوردية الصباحية', 'Morning Shift', '08:00:00', '16:00:00', 15, 10, '#2E7D32'),
('s0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'EVENING', 'الوردية المسائية', 'Evening Shift', '16:00:00', '00:00:00', 15, 10, '#E65100'),
('s0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'NIGHT', 'وردية الجرد الليلي', 'Inventory Night Shift', '00:00:00', '08:00:00', 15, 10, '#4A148C')
ON CONFLICT (branch_id, code) DO NOTHING;

-- 8. Default System Settings
INSERT INTO system_settings (company_id, setting_key, setting_value, description)
VALUES 
(
    'a0000000-0000-0000-0000-000000000001',
    'employee_id_format',
    '{"prefix": "OM-", "padding_digits": 4, "include_branch_code": false}'::jsonb,
    'صيغة الرقم الوظيفي التلقائي غير المكرر للموظفين'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'attendance_policy',
    '{"require_geofence": true, "require_qr": true, "allow_manual_override": true, "max_daily_overtime_hours": 3}'::jsonb,
    'إعدادات سياسات وضوابط الحضور والانصراف المعتمدة'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'break_concurrency_policy',
    '{"enforce_max_simultaneous": true, "default_max_absent_percentage": 20}'::jsonb,
    'سياسة منع تعارض خروج الموظفين في الاستراحات في الوقت نفسه'
)
ON CONFLICT (company_id, branch_id, setting_key) DO NOTHING;
