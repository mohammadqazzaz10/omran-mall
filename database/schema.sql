-- ============================================================================
-- OMRAN MALL MANAGEMENT SYSTEM (مشروع عمران مول)
-- PostgreSQL Enterprise Database Schema - DDL Specification
-- Currency: JOD (Jordanian Dinar) | Timezone: Asia/Amman
-- Multi-Branch Strict Isolation with Audit Logging & Role-Based Access Control
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. COMPANIES & BRANCHES (الشركة والفروع)
-- ============================================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    tax_number VARCHAR(100),
    commercial_register VARCHAR(100),
    logo_url TEXT,
    headquarters_address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'JOD',
    timezone VARCHAR(50) DEFAULT 'Asia/Amman',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    geofence_radius_meters INT DEFAULT 150,
    qr_secret_salt VARCHAR(255) DEFAULT encode(gen_random_bytes(32), 'hex'),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_branch_code UNIQUE (company_id, code)
);

CREATE TABLE geo_fences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    polygon_coordinates JSONB, -- GeoJSON polygon or circle definition
    center_latitude NUMERIC(10, 8) NOT NULL,
    center_longitude NUMERIC(11, 8) NOT NULL,
    radius_meters INT NOT NULL DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. DEPARTMENTS & POSITIONS (الأقسام والمسميات الوظيفية)
-- ============================================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    parent_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    manager_employee_id UUID,
    max_simultaneous_break_percentage INT DEFAULT 20, -- Anti-conflict break rule
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_dept_code UNIQUE (branch_id, code)
);

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    job_level VARCHAR(50),
    basic_salary_min NUMERIC(12, 3),
    basic_salary_max NUMERIC(12, 3),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 3. USERS, ROLES & PERMISSIONS (المستخدمون والأدوار والصلاحيات)
-- ============================================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_role_code UNIQUE (company_id, code)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,      -- employees, attendance, shifts, breaks, payroll, etc.
    action VARCHAR(50) NOT NULL,      -- view, create, edit, delete, approve, reject, export
    scope VARCHAR(50) NOT NULL,       -- own, department, branch, company
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g. attendance.view.branch
    description_ar VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    primary_branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INT DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- specific branch scope if compound
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id, branch_id)
);

-- ============================================================================
-- 4. EMPLOYEES & PROFILES (الموظفون والملفات الوظيفية)
-- ============================================================================

CREATE SEQUENCE employee_seq START 1001;

CREATE TYPE employee_status_enum AS ENUM (
    'active',
    'on_leave',
    'on_break',
    'departed',
    'absent',
    'late',
    'suspended',
    'transferred',
    'resigned',
    'terminated',
    'archived'
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    direct_manager_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name_ar VARCHAR(100) NOT NULL,
    second_name_ar VARCHAR(100) NOT NULL,
    third_name_ar VARCHAR(100),
    last_name_ar VARCHAR(100) NOT NULL,
    full_name_en VARCHAR(255),
    national_id VARCHAR(50),
    passport_number VARCHAR(50),
    nationality VARCHAR(100) DEFAULT 'الأردنية',
    gender VARCHAR(10),
    date_of_birth DATE,
    personal_email VARCHAR(255),
    mobile_phone VARCHAR(50) NOT NULL,
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relation VARCHAR(50),
    marital_status VARCHAR(50),
    avatar_url TEXT,
    hire_date DATE NOT NULL,
    probation_end_date DATE,
    contract_end_date DATE,
    status employee_status_enum DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE employee_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    bank_name VARCHAR(100),
    bank_iban VARCHAR(100),
    social_security_number VARCHAR(100),
    tax_identification_number VARCHAR(100),
    education_level VARCHAR(100),
    specialization VARCHAR(150),
    graduation_year INT,
    address_city VARCHAR(100) DEFAULT 'Amman',
    address_area VARCHAR(100),
    address_street TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    contract_type VARCHAR(50) NOT NULL, -- full_time, part_time, seasonal
    start_date DATE NOT NULL,
    end_date DATE,
    basic_salary NUMERIC(12, 3) NOT NULL,
    working_hours_per_day NUMERIC(4, 2) DEFAULT 8.0,
    working_days_per_week INT DEFAULT 6,
    has_social_security BOOLEAN DEFAULT TRUE,
    has_health_insurance BOOLEAN DEFAULT TRUE,
    document_url TEXT,
    is_current BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    document_type VARCHAR(100) NOT NULL, -- national_id, contract, certificate, criminal_record, etc.
    title VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    alert_before_days INT DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE employee_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- hire, transfer, promotion, salary_change, warning, reward, etc.
    old_data JSONB,
    new_data JSONB,
    effective_date DATE NOT NULL,
    reason TEXT,
    action_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. SHIFTS & ROSTER SCHEDULING (الورديات والجدولة)
-- ============================================================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_late_minutes INT DEFAULT 15,
    grace_period_early_leave_minutes INT DEFAULT 10,
    is_night_shift BOOLEAN DEFAULT FALSE,
    color_hex VARCHAR(20) DEFAULT '#1976D2',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_shift_code UNIQUE (branch_id, code)
);

CREATE TABLE shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    is_day_off BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT TRUE,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_shift_date UNIQUE (employee_id, work_date)
);

CREATE TABLE shift_swap_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    requester_assignment_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    target_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    target_assignment_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'pending_colleague', -- pending_colleague, pending_manager, approved, rejected
    reason TEXT,
    rejection_reason TEXT,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. ATTENDANCE & BIOMETRIC VERIFICATION (الحضور والانصراف)
-- ============================================================================

CREATE TYPE attendance_status_enum AS ENUM (
    'present',
    'late',
    'absent',
    'on_leave',
    'on_departure',
    'incomplete',
    'holiday',
    'needs_review',
    'overtime'
);

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    work_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_method VARCHAR(50) DEFAULT 'mobile_app', -- mobile_app, qr_code, biometric, manual
    check_out_method VARCHAR(50),
    check_in_lat NUMERIC(10, 8),
    check_in_lng NUMERIC(11, 8),
    check_out_lat NUMERIC(10, 8),
    check_out_lng NUMERIC(11, 8),
    device_id VARCHAR(100),
    late_minutes INT DEFAULT 0,
    early_departure_minutes INT DEFAULT 0,
    total_work_minutes INT DEFAULT 0,
    total_break_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    status attendance_status_enum DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_attendance_date UNIQUE (employee_id, work_date)
);

CREATE TABLE attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    original_check_in TIMESTAMP WITH TIME ZONE,
    original_check_out TIMESTAMP WITH TIME ZONE,
    requested_check_in TIMESTAMP WITH TIME ZONE,
    requested_check_out TIMESTAMP WITH TIME ZONE,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. BREAKS, LUNCH & SMOKING ENGINE (نظام الاستراحات والغداء والتدخين)
-- ============================================================================

CREATE TABLE break_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL, -- lunch, coffee, smoking, emergency, special
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    default_duration_minutes INT NOT NULL,
    max_duration_minutes INT NOT NULL,
    daily_quota_times INT DEFAULT 1,
    cooldown_between_breaks_minutes INT DEFAULT 60,
    requires_approval BOOLEAN DEFAULT TRUE,
    deduct_from_work_hours BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_break_code UNIQUE (branch_id, code)
);

CREATE TABLE break_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    break_type_id UUID NOT NULL REFERENCES break_types(id) ON DELETE RESTRICT,
    requested_duration_minutes INT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, expired, cancelled
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE break_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    break_request_id UUID REFERENCES break_requests(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    break_type_id UUID NOT NULL REFERENCES break_types(id) ON DELETE RESTRICT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INT,
    overstay_minutes INT DEFAULT 0,
    is_auto_terminated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. DEPARTURES & PERMISSIONS (المغادرات والاستئذانات)
-- ============================================================================

CREATE TABLE departure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    departure_type VARCHAR(50) NOT NULL, -- personal, official_mission, medical, emergency, unpaid
    departure_date DATE NOT NULL,
    start_time TIME NOT NULL,
    expected_return_time TIME NOT NULL,
    actual_departure_time TIMESTAMP WITH TIME ZONE,
    actual_return_time TIMESTAMP WITH TIME ZONE,
    is_paid BOOLEAN DEFAULT TRUE,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, completed
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. LEAVES & HOLIDAYS (الإجازات والعطل)
-- ============================================================================

CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- annual, sick, casual, maternity, paternity, unpaid
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    default_days_per_year INT NOT NULL,
    is_paid BOOLEAN DEFAULT TRUE,
    requires_attachment BOOLEAN DEFAULT FALSE,
    can_carry_over BOOLEAN DEFAULT FALSE,
    max_carry_over_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_leave_code UNIQUE (company_id, code)
);

CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    year INT NOT NULL,
    total_entitlement_days NUMERIC(5, 2) NOT NULL,
    carried_over_days NUMERIC(5, 2) DEFAULT 0,
    used_days NUMERIC(5, 2) DEFAULT 0,
    remaining_days NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_leave_year UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(5, 2) NOT NULL,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. PAYROLL, ADVANCES & DEDUCTIONS (الرواتب والسلف والاقتطاعات)
-- ============================================================================

CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    period_name VARCHAR(100) NOT NULL, -- e.g. "رواتب تشرين الثاني 2026"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    basic_salary NUMERIC(12, 3) NOT NULL,
    allowances_total NUMERIC(12, 3) DEFAULT 0,
    overtime_pay NUMERIC(12, 3) DEFAULT 0,
    bonus_amount NUMERIC(12, 3) DEFAULT 0,
    gross_salary NUMERIC(12, 3) NOT NULL,
    social_security_deduction NUMERIC(12, 3) DEFAULT 0,
    tax_deduction NUMERIC(12, 3) DEFAULT 0,
    absence_deduction NUMERIC(12, 3) DEFAULT 0,
    late_deduction NUMERIC(12, 3) DEFAULT 0,
    loan_installment_deduction NUMERIC(12, 3) DEFAULT 0,
    other_deductions NUMERIC(12, 3) DEFAULT 0,
    total_deductions NUMERIC(12, 3) NOT NULL,
    net_salary NUMERIC(12, 3) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, reviewed, approved, paid
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_payroll_period UNIQUE (payroll_period_id, employee_id)
);

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 3) NOT NULL,
    number_of_installments INT NOT NULL,
    monthly_installment NUMERIC(12, 3) NOT NULL,
    remaining_balance NUMERIC(12, 3) NOT NULL,
    start_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, completed, rejected
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loan_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    payroll_record_id UUID REFERENCES payroll_records(id) ON DELETE SET NULL,
    installment_number INT NOT NULL,
    amount NUMERIC(12, 3) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 11. TASKS, ANNOUNCEMENTS & MESSAGES (المهام والإعلانات والرسائل)
-- ============================================================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, urgent
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'new', -- new, received, in_progress, on_hold, completed, overdue, cancelled
    completion_proof_url TEXT,
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_task_employee_assignment UNIQUE (task_id, employee_id)
);

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- null for company-wide
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    attachment_url TEXT,
    priority VARCHAR(50) DEFAULT 'normal', -- normal, important, urgent
    requires_acknowledgement BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE announcement_reads (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (announcement_id, employee_id)
);

CREATE TABLE internal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 12. NOTIFICATIONS & PREFERENCES (الإشعارات الفورية)
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(100) NOT NULL, -- break_alert, shift_change, request_update, announcement, etc.
    payload JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    fcm_device_tokens TEXT[],
    apns_device_tokens TEXT[],
    enable_break_alerts BOOLEAN DEFAULT TRUE,
    enable_shift_reminders BOOLEAN DEFAULT TRUE,
    enable_announcements BOOLEAN DEFAULT TRUE,
    custom_sound_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 13. ASSETS, EVALUATIONS, VIOLATIONS & REWARDS (العهد، التقييم، المخالفات والمكافآت)
-- ============================================================================

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- uniform, badge, pos_device, keys, equipment
    serial_number VARCHAR(100),
    condition VARCHAR(50) DEFAULT 'good',
    is_assigned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    handed_condition TEXT,
    return_date TIMESTAMP WITH TIME ZONE,
    returned_condition TEXT,
    signed_document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    evaluator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    evaluation_cycle VARCHAR(50) NOT NULL, -- probation, monthly, quarterly, annual
    attendance_score NUMERIC(5, 2),
    productivity_score NUMERIC(5, 2),
    teamwork_score NUMERIC(5, 2),
    instructions_score NUMERIC(5, 2),
    total_score NUMERIC(5, 2) NOT NULL,
    evaluator_comments TEXT,
    employee_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    reported_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    violation_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    evidence_url TEXT,
    employee_response TEXT,
    penalty_action TEXT,
    status VARCHAR(50) DEFAULT 'pending_review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    awarded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reward_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    financial_amount NUMERIC(12, 3) DEFAULT 0,
    awarded_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 14. AUDIT LOGGING & SYSTEM SETTINGS (سجل التدقيق والإعدادات)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    client_ip VARCHAR(50),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- null for global company setting
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_setting_key UNIQUE (company_id, branch_id, setting_key)
);

-- ============================================================================
-- 15. PERFORMANCE INDEXES (فهارس الأداء وتعدد الفروع)
-- ============================================================================

CREATE INDEX idx_branches_company ON branches(company_id);
CREATE INDEX idx_departments_branch ON departments(branch_id);
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_attendance_branch_date ON attendance_records(branch_id, work_date);
CREATE INDEX idx_attendance_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX idx_shifts_branch ON shifts(branch_id);
CREATE INDEX idx_shift_assignments_date ON shift_assignments(branch_id, work_date);
CREATE INDEX idx_break_sessions_active ON break_sessions(employee_id, actual_end_time);
CREATE INDEX idx_leave_requests_branch ON leave_requests(branch_id, start_date, end_date);
CREATE INDEX idx_payroll_records_branch ON payroll_records(branch_id, payroll_period_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- ============================================================================
-- 16. AUDIT TRIGGER FUNCTION (دالة سجل التدقيق التلقائي)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical operational tables
CREATE TRIGGER audit_attendance_trigger
AFTER INSERT OR UPDATE OR DELETE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER audit_payroll_trigger
AFTER INSERT OR UPDATE OR DELETE ON payroll_records
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER audit_employees_trigger
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION process_audit_log();
