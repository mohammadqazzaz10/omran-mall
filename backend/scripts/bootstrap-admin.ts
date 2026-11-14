import "dotenv/config";
import { hash } from "bcrypt";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const required = [
  "DATABASE_URL",
  "BOOTSTRAP_COMPANY_ID",
  "BOOTSTRAP_BRANCH_ID",
  "BOOTSTRAP_ADMIN_USERNAME",
  "BOOTSTRAP_ADMIN_PASSWORD",
] as const;

async function main(): Promise<void> {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD as string;
  if (password.length < 14 || password.length > 128) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be between 14 and 128 characters");
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

      const companyId = process.env.BOOTSTRAP_COMPANY_ID as string;
      const branchId = process.env.BOOTSTRAP_BRANCH_ID as string;
      const username = (process.env.BOOTSTRAP_ADMIN_USERNAME as string).trim();
      const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;

      const company = await client.query(
        "SELECT id FROM companies WHERE id = $1 AND deleted_at IS NULL",
        [companyId],
      );
      if (company.rowCount !== 1) throw new Error("Configured company does not exist or is deleted");

      const branch = await client.query(
        "SELECT id FROM branches WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL",
        [branchId, companyId],
      );
      if (branch.rowCount !== 1) throw new Error("Configured primary branch is not active in the selected company");

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
      if (role.rowCount !== 1) throw new Error("SUPER_ADMIN role is missing. Apply migrations and the approved role seed first.");

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
