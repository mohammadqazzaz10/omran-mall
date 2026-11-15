-- Integration assertions for PostgreSQL schema invariants.
-- Runs only against the disposable CI database after schema.sql and seeds.sql.
DO $$
DECLARE
    v_position_id UUID;
    v_employee_code_1 TEXT;
    v_employee_code_2 TEXT;
    v_user_id UUID;
    v_role_id UUID;
    v_other_company_id UUID;
    v_other_branch_id UUID;
    v_same_company_other_branch UUID;
    v_other_department_id UUID;
    v_other_position_id UUID;
    v_other_employee_id UUID;
    v_break_type_id UUID;
    v_first_branch_employee_id UUID;
    v_qr_challenge_id UUID;
BEGIN

    -- The migration must create a usable least-privilege permission catalogue.
    IF NOT EXISTS (
        SELECT 1
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
          AND r.code = 'SUPER_ADMIN'
          AND p.code = 'employees.view.branch'
    ) THEN
        RAISE EXCEPTION 'SUPER_ADMIN is missing the branch employee-view grant';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
          AND r.code = 'BRANCH_MANAGER'
          AND p.code IN ('users.manage.company', 'roles.manage.company')
    ) THEN
        RAISE EXCEPTION 'BRANCH_MANAGER received an unintended company-wide grant';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
          AND r.code = 'GENERAL_MANAGER'
          AND p.code IN ('users.manage.company', 'roles.manage.company', 'companies.manage.company')
    ) THEN
        RAISE EXCEPTION 'GENERAL_MANAGER received an unintended security-administration grant';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
          AND r.code IN ('CASHIER', 'EMPLOYEE')
          AND p.code NOT IN (
            'employees.view.own',
            'employees.edit.own',
            'breaks.types.view.branch',
            'breaks.request.own',
            'breaks.end.own'
          )
    ) THEN
        RAISE EXCEPTION 'Self-service roles received permissions outside their owner-bound profile endpoints';
    END IF;
    INSERT INTO positions (department_id, code, title_ar)
    VALUES (
        'c0000000-0000-0000-0000-000000000001',
        'CI-EMPLOYEE-TEST',
        'موظف اختبار التكامل'
    )
    RETURNING id INTO v_position_id;

    INSERT INTO employees (
        branch_id, department_id, position_id,
        first_name_ar, second_name_ar, last_name_ar,
        mobile_phone, hire_date
    ) VALUES (
        'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        v_position_id,
        'اختبار', 'قاعدة', 'البيانات',
        '0000000000', CURRENT_DATE
    )
    RETURNING employee_code INTO v_employee_code_1;

    INSERT INTO employees (
        branch_id, department_id, position_id,
        first_name_ar, second_name_ar, last_name_ar,
        mobile_phone, hire_date
    ) VALUES (
        'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        v_position_id,
        'اختبار', 'تسلسل', 'ثان',
        '0000000001', CURRENT_DATE
    )
    RETURNING employee_code INTO v_employee_code_2;

    IF v_employee_code_1 <> 'OM-1001' OR v_employee_code_2 <> 'OM-1002' THEN
        RAISE EXCEPTION 'Employee codes are not sequential: %, %',
            v_employee_code_1, v_employee_code_2;
    END IF;

    -- Composite foreign keys must reject cross-branch and cross-department references.
    INSERT INTO branches (company_id, code, name_ar)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'CI-SECOND-BRANCH', 'فرع ثانٍ للاختبار')
    RETURNING id INTO v_same_company_other_branch;

    INSERT INTO departments (branch_id, code, name_ar)
    VALUES (v_same_company_other_branch, 'CI-SECOND-DEPT', 'قسم الفرع الثاني')
    RETURNING id INTO v_other_department_id;

    INSERT INTO positions (department_id, code, title_ar)
    VALUES (v_other_department_id, 'CI-SECOND-POS', 'مسمى الفرع الثاني')
    RETURNING id INTO v_other_position_id;

    INSERT INTO employees (
        branch_id, department_id, position_id,
        first_name_ar, second_name_ar, last_name_ar, mobile_phone, hire_date
    ) VALUES (
        v_same_company_other_branch, v_other_department_id, v_other_position_id,
        'موظف', 'فرع', 'ثانٍ', '0000000002', CURRENT_DATE
    )
    RETURNING id INTO v_other_employee_id;

    BEGIN
        INSERT INTO employees (
            branch_id, department_id, position_id,
            first_name_ar, second_name_ar, last_name_ar, mobile_phone, hire_date
        ) VALUES (
            'b0000000-0000-0000-0000-000000000001', v_other_department_id, v_other_position_id,
            'تجاوز', 'نطاق', 'الفرع', '0000000003', CURRENT_DATE
        );
        RAISE EXCEPTION 'Employee with another branch department was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO employees (
            branch_id, department_id, position_id,
            first_name_ar, second_name_ar, last_name_ar, mobile_phone, hire_date
        ) VALUES (
            'b0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001', v_other_position_id,
            'تجاوز', 'نطاق', 'المسمى', '0000000004', CURRENT_DATE
        );
        RAISE EXCEPTION 'Employee with a position from another department was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO employees (
            branch_id, department_id, position_id, direct_manager_id,
            first_name_ar, second_name_ar, last_name_ar, mobile_phone, hire_date
        ) VALUES (
            v_same_company_other_branch, v_other_department_id, v_other_position_id,
            (SELECT id FROM employees WHERE employee_code = v_employee_code_1),
            'تجاوز', 'مدير', 'فرع', '0000000005', CURRENT_DATE
        );
        RAISE EXCEPTION 'Cross-branch direct manager was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO departments (branch_id, parent_id, code, name_ar)
        VALUES (
            v_same_company_other_branch,
            'c0000000-0000-0000-0000-000000000001',
            'CI-CROSS-PARENT',
            'قسم بأب من فرع آخر'
        );
        RAISE EXCEPTION 'Cross-branch department parent was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        UPDATE departments
        SET manager_employee_id = v_other_employee_id
        WHERE id = 'c0000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'Cross-branch department manager was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO users (company_id, username, password_hash)
    VALUES (
        'a0000000-0000-0000-0000-000000000001',
        'ci-schema-invariant-user',
        'not-a-real-password-hash'
    )
    RETURNING id INTO v_user_id;

    SELECT id INTO v_role_id
    FROM roles
    WHERE company_id = 'a0000000-0000-0000-0000-000000000001'
      AND code = 'SUPER_ADMIN';

    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id);

    BEGIN
        INSERT INTO user_roles (user_id, role_id)
        VALUES (v_user_id, v_role_id);
        RAISE EXCEPTION 'Duplicate company-wide role assignment was accepted';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
    VALUES (
        v_user_id,
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001'
    );

    BEGIN
        INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
        VALUES (
            v_user_id,
            'b0000000-0000-0000-0000-000000000001',
            'a0000000-0000-0000-0000-000000000001'
        );
        RAISE EXCEPTION 'Duplicate active branch membership was accepted';
    EXCEPTION
        WHEN unique_violation THEN NULL;
    END;

    -- Revoked memberships must be grantable again without reusing an active row.
    UPDATE user_branch_memberships
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = v_user_id
      AND branch_id = 'b0000000-0000-0000-0000-000000000001';

    INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
    VALUES (
        v_user_id,
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001'
    );

    IF (
        SELECT COUNT(*)
        FROM user_branch_memberships
        WHERE user_id = v_user_id
          AND branch_id = 'b0000000-0000-0000-0000-000000000001'
          AND revoked_at IS NULL
    ) <> 1 THEN
        RAISE EXCEPTION 'A revoked branch membership could not be granted again';
    END IF;

    INSERT INTO companies (code, name_ar)
    VALUES ('CI-OTHER-' || gen_random_uuid()::text, 'شركة اختبار أخرى')
    RETURNING id INTO v_other_company_id;

    INSERT INTO branches (company_id, code, name_ar)
    VALUES (v_other_company_id, 'CI-OTHER-BRANCH', 'فرع شركة أخرى')
    RETURNING id INTO v_other_branch_id;

    BEGIN
        INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
        VALUES (
            v_user_id,
            v_other_branch_id,
            'a0000000-0000-0000-0000-000000000001'
        );
        RAISE EXCEPTION 'Cross-company branch membership was accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN NULL;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='must_change_password'
    ) THEN
      RAISE EXCEPTION 'Temporary password rotation column is missing';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM roles r
      JOIN role_permissions rp ON rp.role_id=r.id
      JOIN permissions p ON p.id=rp.permission_id
      WHERE r.company_id='a0000000-0000-0000-0000-000000000001'
        AND r.code='SUPER_ADMIN' AND p.code='users.assign_roles.company'
    ) THEN
      RAISE EXCEPTION 'SUPER_ADMIN is missing user role assignment permission';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM roles r
      JOIN role_permissions rp ON rp.role_id=r.id
      JOIN permissions p ON p.id=rp.permission_id
      WHERE r.company_id='a0000000-0000-0000-0000-000000000001'
        AND r.code='EMPLOYEE' AND p.code='employees.view.own'
    ) THEN
      RAISE EXCEPTION 'EMPLOYEE is missing self-service employee profile permission';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM roles r
      JOIN role_permissions rp ON rp.role_id=r.id
      JOIN permissions p ON p.id=rp.permission_id
      WHERE r.company_id='a0000000-0000-0000-0000-000000000001'
        AND r.code='HR_MANAGER' AND p.code='branches.view.company'
    ) THEN
      RAISE EXCEPTION 'HR_MANAGER is missing read-only branch directory access';
    END IF;

    -- Break policies must preserve employee, department and type branch ownership.
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uq_break_sessions_one_active_per_employee'
    ) THEN
        RAISE EXCEPTION 'One-active-break-per-employee index is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'break_sessions'
          AND column_name = 'pre_end_alert_sent_at'
    ) THEN
        RAISE EXCEPTION 'Pre-end break alert idempotency column is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
          AND r.code = 'BRANCH_MANAGER'
          AND p.code = 'breaks.manage.branch'
    ) THEN
        RAISE EXCEPTION 'BRANCH_MANAGER is missing break policy management permission';
    END IF;

    SELECT id INTO v_first_branch_employee_id
    FROM employees
    WHERE employee_code = v_employee_code_1;

    INSERT INTO break_types (
        branch_id, code, name_ar, default_duration_minutes, max_duration_minutes
    ) VALUES (
        'b0000000-0000-0000-0000-000000000001',
        'ci_break_test',
        'استراحة اختبار',
        10,
        15
    ) RETURNING id INTO v_break_type_id;

    BEGIN
        INSERT INTO break_requests (
            employee_id, branch_id, department_id, break_type_id,
            requested_duration_minutes, status
        ) VALUES (
            v_first_branch_employee_id,
            v_same_company_other_branch,
            v_other_department_id,
            v_break_type_id,
            10,
            'pending'
        );
        RAISE EXCEPTION 'Cross-branch break request was accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN NULL;
    END;

    -- QR replay and branch isolation must be enforced by PostgreSQL constraints.
    IF NOT EXISTS (
        SELECT 1 FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
          AND r.code = 'BRANCH_MANAGER'
          AND p.code = 'attendance.qr.manage.branch'
    ) THEN
        RAISE EXCEPTION 'BRANCH_MANAGER is missing branch QR management permission';
    END IF;

    INSERT INTO attendance_qr_challenges (
        branch_id, nonce_hash, expires_at, created_by_user_id
    ) VALUES (
        'b0000000-0000-0000-0000-000000000001',
        repeat('a', 64),
        CURRENT_TIMESTAMP + INTERVAL '45 seconds',
        v_user_id
    ) RETURNING id INTO v_qr_challenge_id;

    INSERT INTO attendance_qr_uses (challenge_id, employee_id, branch_id)
    VALUES (
        v_qr_challenge_id,
        v_first_branch_employee_id,
        'b0000000-0000-0000-0000-000000000001'
    );

    BEGIN
        INSERT INTO attendance_qr_uses (challenge_id, employee_id, branch_id)
        VALUES (
            v_qr_challenge_id,
            v_first_branch_employee_id,
            'b0000000-0000-0000-0000-000000000001'
        );
        RAISE EXCEPTION 'An employee reused the same QR challenge';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO attendance_qr_uses (challenge_id, employee_id, branch_id)
        VALUES (
            v_qr_challenge_id,
            v_other_employee_id,
            'b0000000-0000-0000-0000-000000000001'
        );
        RAISE EXCEPTION 'A QR challenge was used by an employee from another branch';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END;$$;


-- Section 07 scheduling schema: verify branch-scoped constraints and permissions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_assignments'
      AND column_name = 'scheduled_start_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_assignments'
      AND column_name = 'department_id'
  ) THEN
    RAISE EXCEPTION 'Section 07 schedule assignment columns are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_swap_requests'
      AND column_name = 'target_response_notes'
  ) THEN
    RAISE EXCEPTION 'Colleague swap response notes column is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ex_shift_assignment_employee_time'
      AND contype = 'x' AND condeferrable = TRUE
  ) THEN
    RAISE EXCEPTION 'Employee shift overlap exclusion constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_shift_assignment_employee_branch'
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'Shift assignment employee branch foreign key is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_shift_assignment_department_branch'
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'Shift assignment department branch foreign key is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
      AND r.code = 'BRANCH_MANAGER'
      AND p.code = 'shifts.manage.branch'
  ) THEN
    RAISE EXCEPTION 'BRANCH_MANAGER is missing shift scheduling management permission';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.company_id = 'a0000000-0000-0000-0000-000000000001'
      AND r.code = 'EMPLOYEE'
      AND p.code = 'shifts.view.own'
  ) THEN
    RAISE EXCEPTION 'EMPLOYEE is missing personal shift schedule permission';
  END IF;
END;
$$;


-- Exercise day-off nullability and overnight overlap rejection on PostgreSQL.
DO $$
DECLARE
  v_employee_id UUID;
  v_department_id UUID;
  v_shift_night_id UUID;
  v_shift_early_id UUID;
  v_work_date DATE := CURRENT_DATE + 1000;
  v_overlap_rejected BOOLEAN := FALSE;
BEGIN
  SELECT id, department_id
  INTO v_employee_id, v_department_id
  FROM employees
  WHERE branch_id = 'b0000000-0000-0000-0000-000000000001'
    AND status = 'active' AND deleted_at IS NULL
  ORDER BY employee_code
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Section 07 invariant test requires an active seeded employee';
  END IF;

  DELETE FROM shift_assignments
  WHERE employee_id = v_employee_id
    AND work_date BETWEEN v_work_date AND v_work_date + 2;

  INSERT INTO shifts (
    branch_id, code, name_ar, start_time, end_time, is_night_shift,
    shift_type, required_staff_count
  ) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'ci_s07_night', 'وردية ليلية اختبار', '22:00', '06:00', TRUE, 'night', 1
  )
  ON CONFLICT (branch_id, code) DO UPDATE
    SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time
  RETURNING id INTO v_shift_night_id;

  INSERT INTO shifts (
    branch_id, code, name_ar, start_time, end_time, is_night_shift,
    shift_type, required_staff_count
  ) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'ci_s07_early', 'وردية صباحية اختبار', '05:30', '13:30', FALSE, 'morning', 1
  )
  ON CONFLICT (branch_id, code) DO UPDATE
    SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time
  RETURNING id INTO v_shift_early_id;

  -- A day off must not require a shift template.
  INSERT INTO shift_assignments (
    employee_id, shift_id, branch_id, work_date, is_day_off,
    is_published, department_id, status
  ) VALUES (
    v_employee_id, NULL, 'b0000000-0000-0000-0000-000000000001',
    v_work_date + 2, TRUE, FALSE, v_department_id, 'draft'
  );

  INSERT INTO shift_assignments (
    employee_id, shift_id, branch_id, work_date, is_day_off,
    is_published, department_id, scheduled_start_at, scheduled_end_at, status
  ) VALUES (
    v_employee_id, v_shift_night_id, 'b0000000-0000-0000-0000-000000000001',
    v_work_date, FALSE, FALSE, v_department_id,
    v_work_date + TIME '22:00', (v_work_date + 1) + TIME '06:00', 'draft'
  );

  BEGIN
    INSERT INTO shift_assignments (
      employee_id, shift_id, branch_id, work_date, is_day_off,
      is_published, department_id, scheduled_start_at, scheduled_end_at, status
    ) VALUES (
      v_employee_id, v_shift_early_id, 'b0000000-0000-0000-0000-000000000001',
      v_work_date + 1, FALSE, FALSE, v_department_id,
      (v_work_date + 1) + TIME '05:30',
      (v_work_date + 1) + TIME '13:30', 'draft'
    );
    SET CONSTRAINTS ex_shift_assignment_employee_time IMMEDIATE;
    RAISE EXCEPTION 'Overlapping overnight employee assignments were accepted';
  EXCEPTION
    WHEN exclusion_violation THEN
      v_overlap_rejected := TRUE;
  END;

  IF NOT v_overlap_rejected THEN
    RAISE EXCEPTION 'Overlapping overnight employee assignments were not rejected';
  END IF;

  DELETE FROM shift_assignments
  WHERE employee_id = v_employee_id
    AND work_date BETWEEN v_work_date AND v_work_date + 2;
END;
$$;
