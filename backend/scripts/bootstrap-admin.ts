import "dotenv/config";
import { hash } from "bcrypt";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const required = [
  "DATABASE_URL",
  "BOOTSTRAP_COMPANY_CODE",
  "BOOTSTRAP_COMPANY_NAME_AR",
  "BOOTSTRAP_BRANCH_CODE",
  "BOOTSTRAP_BRANCH_NAME_AR",
  "BOOTSTRAP_ADMIN_USERNAME",
  "BOOTSTRAP_ADMIN_PASSWORD",
] as const;

async function main(): Promise<void> {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD as string;
  if (
    password.length < 14 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be 14-128 characters and include upper/lowercase letters, a number, and a symbol");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('omran_mall_first_admin_bootstrap'))");

      const companyCode = (process.env.BOOTSTRAP_COMPANY_CODE as string).trim();
      const companyNameAr = (process.env.BOOTSTRAP_COMPANY_NAME_AR as string).trim();
      const branchCode = (process.env.BOOTSTRAP_BRANCH_CODE as string).trim();
      const branchNameAr = (process.env.BOOTSTRAP_BRANCH_NAME_AR as string).trim();
      const username = (process.env.BOOTSTRAP_ADMIN_USERNAME as string).trim();
      const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;
      const nameEn = process.env.BOOTSTRAP_COMPANY_NAME_EN?.trim() || null;
      const branchNameEn = process.env.BOOTSTRAP_BRANCH_NAME_EN?.trim() || null;

      if (!/^[A-Z0-9][A-Z0-9_-]{1,49}$/.test(companyCode) ||
          !/^[A-Z0-9][A-Z0-9_-]{1,49}$/.test(branchCode)) {
        throw new Error("Company and branch codes must be 2-50 uppercase letters, numbers, hyphens, or underscores");
      }
      if (username.length < 3 || username.length > 100) {
        throw new Error("BOOTSTRAP_ADMIN_USERNAME must be 3-100 characters");
      }
      if (companyNameAr.length > 255 || branchNameAr.length > 255) {
        throw new Error("Arabic company and branch names must not exceed 255 characters");
      }
      if (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        throw new Error("BOOTSTRAP_ADMIN_EMAIL is not a valid email address");
      }

      await client.query(
        `INSERT INTO companies (id, code, name_ar, name_en, currency, timezone)
         VALUES ($1, $2, $3, $4, 'JOD', 'Asia/Amman')
         ON CONFLICT (code) DO NOTHING`,
        [randomUUID(), companyCode, companyNameAr, nameEn],
      );
      const company = await client.query<{ id: string }>(
        "SELECT id FROM companies WHERE code = $1 AND deleted_at IS NULL",
        [companyCode],
      );
      if (company.rowCount !== 1) throw new Error("Configured company code already exists in a deleted state");
      const companyId = company.rows[0].id;

      await client.query(
        `INSERT INTO roles (company_id, code, name_ar, name_en, description, is_system_role)
         VALUES
           ($1, 'SUPER_ADMIN', 'مدير النظام الأعلى', 'Super Administrator', 'صلاحيات إدارة النظام والشركة والفروع', TRUE),
           ($1, 'GENERAL_MANAGER', 'المدير العام', 'General Manager', 'إدارة ومتابعة الشركة والفروع', TRUE),
           ($1, 'BRANCH_MANAGER', 'مدير فرع', 'Branch Manager', 'إدارة العمليات ضمن الفرع المحدد', TRUE),
           ($1, 'HR_MANAGER', 'مسؤول الموارد البشرية', 'HR Manager', 'إدارة شؤون الموظفين ضمن النطاق الممنوح', TRUE),
           ($1, 'SUPERVISOR', 'مشرف قسم', 'Department Supervisor', 'إدارة العمل ضمن القسم المحدد', TRUE),
           ($1, 'CASHIER', 'أمين صندوق', 'Cashier', 'صلاحيات أمين الصندوق', TRUE),
           ($1, 'EMPLOYEE', 'موظف', 'Employee', 'صلاحيات الموظف الذاتية', TRUE)
         ON CONFLICT (company_id, code) DO NOTHING`,
        [companyId],
      );
      const permissionCatalog = await client.query(
        "SELECT code FROM permissions WHERE code IN ('employees.view.branch', 'branches.view.company', 'users.manage.company')",
      );
      if (permissionCatalog.rowCount !== 3) {
        throw new Error("Permission catalogue is incomplete. Apply the latest database migrations first.");
      }

      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         JOIN permissions p ON
           (p.scope = 'company' AND r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER'))
           OR (p.scope = 'branch' AND r.code IN ('SUPER_ADMIN', 'GENERAL_MANAGER'))
         WHERE r.company_id = $1
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [companyId],
      );
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r
         JOIN permissions p ON p.scope = 'branch'
         WHERE r.company_id = $1 AND r.code = 'BRANCH_MANAGER'
           AND p.module IN ('departments', 'positions', 'employees')
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [companyId],
      );
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r
         JOIN permissions p ON
           (p.scope = 'company' AND p.module = 'users')
           OR (p.scope = 'branch' AND p.module IN ('employees', 'departments', 'positions'))
         WHERE r.company_id = $1 AND r.code = 'HR_MANAGER'
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [companyId],
      );
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r
         JOIN permissions p ON p.scope = 'department' AND p.module = 'employees'
         WHERE r.company_id = $1 AND r.code = 'SUPERVISOR'
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [companyId],
      );

      await client.query(
        `INSERT INTO branches (id, company_id, code, name_ar, name_en, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (company_id, code) DO NOTHING`,
        [randomUUID(), companyId, branchCode, branchNameAr, branchNameEn],
      );
      const branch = await client.query<{ id: string }>(
        "SELECT id FROM branches WHERE company_id = $1 AND code = $2 AND is_active = TRUE AND deleted_at IS NULL",
        [companyId, branchCode],
      );
      if (branch.rowCount !== 1) throw new Error("Configured primary branch already exists but is inactive or deleted");
      const branchId = branch.rows[0].id;

      const existing = await client.query(
        "SELECT 1 FROM users WHERE company_id = $1 AND deleted_at IS NULL LIMIT 1",
        [companyId],
      );
      if (existing.rowCount) {
        throw new Error("Bootstrap refused: this company already has a user. Use the authenticated admin workflow instead.");
      }

      const role = await client.query(
        "SELECT id FROM roles WHERE company_id = $1 AND code = 'SUPER_ADMIN' AND is_active = TRUE",
        [companyId],
      );
      if (role.rowCount !== 1) throw new Error("SUPER_ADMIN role is missing. Apply all migrations first.");

      const passwordHash = await hash(password, 12);
      const userId = randomUUID();
      await client.query(
        `INSERT INTO users (id, company_id, primary_branch_id, username, email, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, companyId, branchId, username, email, passwordHash],
      );

      const branches = await client.query(
        "SELECT id FROM branches WHERE company_id = $1 AND is_active = TRUE AND deleted_at IS NULL ORDER BY id",
        [companyId],
      );
      for (const item of branches.rows as Array<{ id: string }>) {
        await client.query(
          `INSERT INTO user_branch_memberships (user_id, branch_id, company_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, branch_id) WHERE revoked_at IS NULL DO NOTHING`,
          [userId, item.id, companyId],
        );
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, branch_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [userId, role.rows[0].id, item.id],
        );
      }
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, role.rows[0].id],
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1, $2, 'users', $1, 'BOOTSTRAP_SUPER_ADMIN', jsonb_build_object('username', $3))`,
        [userId, branchId, username],
      );

      await client.query("COMMIT");
      process.stdout.write(`Created first SUPER_ADMIN account: ${username}\n`);
      process.stdout.write("Remove BOOTSTRAP_ADMIN_PASSWORD from the environment immediately.\n");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Admin bootstrap failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
