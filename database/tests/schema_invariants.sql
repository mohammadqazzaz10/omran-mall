-- Integration assertions for PostgreSQL schema invariants.
-- Runs only against the disposable CI database after schema.sql and seeds.sql.
DO $$
DECLARE
    v_position_id UUID;
    v_employee_code_1 TEXT;
    v_employee_code_2 TEXT;
    v_user_id UUID;
    v_role_id UUID;\n    v_other_company_id UUID;\n    v_other_branch_id UUID;
BEGIN
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
END;
$$;
