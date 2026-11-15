const { randomBytes } = require("node:crypto");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  let challengeId;

  try {
    const fixture = await pool.query(
      `SELECT e.id AS employee_id, e.branch_id, u.id AS user_id
       FROM employees e
       JOIN users u ON u.username = 'ci-schema-invariant-user'
       WHERE e.employee_code = 'OM-1001'
         AND e.deleted_at IS NULL
       LIMIT 1`,
    );

    if (fixture.rowCount !== 1) {
      throw new Error("QR concurrency fixture was not created by schema_invariants.sql");
    }

    const { employee_id: employeeId, branch_id: branchId, user_id: userId } =
      fixture.rows[0];
    const challenge = await pool.query(
      `INSERT INTO attendance_qr_challenges
         (branch_id, nonce_hash, expires_at, created_by_user_id)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '45 seconds', $3)
       RETURNING id`,
      [branchId, randomBytes(32).toString("hex"), userId],
    );
    challengeId = challenge.rows[0].id;

    let ready = 0;
    let releaseStart;
    const startGate = new Promise((resolve) => {
      releaseStart = resolve;
    });

    const attemptUse = async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        ready += 1;
        if (ready === 2) releaseStart();
        await startGate;
        await client.query(
          `INSERT INTO attendance_qr_uses (challenge_id, employee_id, branch_id)
           VALUES ($1, $2, $3)`,
          [challengeId, employeeId, branchId],
        );
        await client.query("COMMIT");
        return "committed";
      } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") return "duplicate";
        throw error;
      } finally {
        client.release();
      }
    };

    const outcomes = await Promise.all([attemptUse(), attemptUse()]);
    const committed = outcomes.filter((value) => value === "committed").length;
    const duplicates = outcomes.filter((value) => value === "duplicate").length;

    if (committed !== 1 || duplicates !== 1) {
      throw new Error(
        `Expected one successful QR use and one duplicate rejection; received: ${outcomes.join(", ")}`,
      );
    }

    console.log(
      "QR concurrency invariant passed: exactly one concurrent use committed and one was rejected.",
    );
  } finally {
    if (challengeId) {
      await pool.query(
        "DELETE FROM attendance_qr_challenges WHERE id = $1",
        [challengeId],
      );
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
