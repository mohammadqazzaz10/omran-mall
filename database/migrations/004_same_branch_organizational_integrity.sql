-- Enforce branch and organizational consistency in PostgreSQL itself.
-- The service layer also validates these relationships; these constraints
-- prevent cross-branch references if another code path bypasses the API.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM departments child
    JOIN departments parent ON parent.id = child.parent_id
    WHERE child.branch_id <> parent.branch_id
  ) THEN
    RAISE EXCEPTION 'Cannot add same-branch parent constraint: cross-branch department parent exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM departments d
    JOIN employees e ON e.id = d.manager_employee_id
    WHERE d.branch_id <> e.branch_id
  ) THEN
    RAISE EXCEPTION 'Cannot add same-branch department manager constraint: cross-branch manager exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM positions p
    JOIN departments d ON d.id = p.department_id
    GROUP BY p.id, p.department_id
    HAVING COUNT(*) <> 1
  ) THEN
    RAISE EXCEPTION 'Invalid position department relation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM employees e
    JOIN departments d ON d.id = e.department_id
    WHERE e.branch_id <> d.branch_id
  ) THEN
    RAISE EXCEPTION 'Cannot add employee department branch constraint: cross-branch department exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM employees e
    JOIN positions p ON p.id = e.position_id
    WHERE e.department_id <> p.department_id
  ) THEN
    RAISE EXCEPTION 'Cannot add employee position department constraint: position belongs to another department';
  END IF;
  IF EXISTS (
    SELECT 1 FROM employees e
    JOIN employees manager ON manager.id = e.direct_manager_id
    WHERE e.branch_id <> manager.branch_id
  ) THEN
    RAISE EXCEPTION 'Cannot add same-branch manager constraint: cross-branch manager exists';
  END IF;
END $$;

ALTER TABLE departments
  ADD CONSTRAINT uq_departments_id_branch UNIQUE (id, branch_id);
ALTER TABLE positions
  ADD CONSTRAINT uq_positions_id_department UNIQUE (id, department_id);
ALTER TABLE employees
  ADD CONSTRAINT uq_employees_id_branch UNIQUE (id, branch_id);

ALTER TABLE departments
  ADD CONSTRAINT fk_department_parent_same_branch
  FOREIGN KEY (parent_id, branch_id)
  REFERENCES departments(id, branch_id)
  ON DELETE RESTRICT;

ALTER TABLE departments
  ADD CONSTRAINT fk_department_manager_same_branch
  FOREIGN KEY (manager_employee_id, branch_id)
  REFERENCES employees(id, branch_id)
  ON DELETE RESTRICT;

ALTER TABLE employees
  ADD CONSTRAINT fk_employee_department_same_branch
  FOREIGN KEY (department_id, branch_id)
  REFERENCES departments(id, branch_id)
  ON DELETE RESTRICT;

ALTER TABLE employees
  ADD CONSTRAINT fk_employee_position_same_department
  FOREIGN KEY (position_id, department_id)
  REFERENCES positions(id, department_id)
  ON DELETE RESTRICT;

ALTER TABLE employees
  ADD CONSTRAINT fk_employee_manager_same_branch
  FOREIGN KEY (direct_manager_id, branch_id)
  REFERENCES employees(id, branch_id)
  ON DELETE RESTRICT;

ALTER TABLE employees
  ADD CONSTRAINT chk_employee_not_own_manager
  CHECK (direct_manager_id IS NULL OR direct_manager_id <> id);

CREATE UNIQUE INDEX uq_positions_active_code_per_department
  ON positions(department_id, code)
  WHERE deleted_at IS NULL;
