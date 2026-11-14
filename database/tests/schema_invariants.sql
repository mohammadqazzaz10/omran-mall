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
          AND p.code NOT IN ('employees.view.own', 'employees.edit.own')
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
END;$$;
