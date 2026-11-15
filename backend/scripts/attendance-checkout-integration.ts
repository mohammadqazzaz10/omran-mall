import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { AttendanceService } from "../src/modules/attendance/attendance.service";
import { AuthenticatedUser } from "../src/modules/auth/auth.types";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the PostgreSQL check-out integration test.");

const client = new Client({ connectionString });
const schema = `attendance_checkout_it_${process.pid}_${randomUUID().replace(/-/g, "")}`;
const companyId = randomUUID();
const branchId = randomUUID();
const employeeId = randomUUID();
const userId = randomUUID();
const user = {
  id: userId,
  companyId,
  primaryBranchId: branchId,
  allowedBranchIds: [branchId],
  sessionId: randomUUID(),
  username: "attendance-checkout-integration",
  mustChangePassword: false,
} as AuthenticatedUser;

async function createFixture(workDate: string, endTime: string, nightShift: boolean) {
  const shiftId = randomUUID();
  const attendanceId = randomUUID();
  await client.query(
    `INSERT INTO shifts (id, branch_id, end_time, is_night_shift, grace_period_early_leave_minutes)
     VALUES ($1, $2, $3::time, $4, 5)`,
    [shiftId, branchId, endTime, nightShift],
  );
  await client.query(
    `INSERT INTO attendance_records
       (id, employee_id, branch_id, shift_id, work_date, check_in_time, check_out_time)
     VALUES ($1, $2, $3, $4, $5::date, CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL)`,
    [attendanceId, employeeId, branchId, shiftId, workDate],
  );
  return attendanceId;
}

async function run() {
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE branches (
        id uuid PRIMARY KEY, company_id uuid NOT NULL,
        is_active boolean NOT NULL, deleted_at timestamptz
      );
      CREATE TABLE employees (
        id uuid PRIMARY KEY, user_id uuid NOT NULL, branch_id uuid NOT NULL,
        status text NOT NULL, deleted_at timestamptz
      );
      CREATE TABLE shifts (
        id uuid PRIMARY KEY, branch_id uuid NOT NULL, end_time time NOT NULL,
        is_night_shift boolean NOT NULL,
        grace_period_early_leave_minutes integer
      );
      CREATE TABLE attendance_records (
        id uuid PRIMARY KEY, employee_id uuid NOT NULL, branch_id uuid NOT NULL,
        shift_id uuid, work_date date NOT NULL, check_in_time timestamptz NOT NULL,
        check_out_time timestamptz, check_out_method text,
        check_out_lat numeric(10, 8), check_out_lng numeric(11, 8),
        total_break_minutes integer DEFAULT 0,
        total_work_minutes integer DEFAULT 0, early_departure_minutes integer DEFAULT 0,
        status text DEFAULT 'present', updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE break_sessions (
        employee_id uuid NOT NULL, branch_id uuid NOT NULL,
        actual_end_time timestamptz, start_time timestamptz NOT NULL
      );
      CREATE TABLE audit_logs (
        user_id uuid, branch_id uuid, table_name text, record_id uuid,
        action text, old_values jsonb, new_values jsonb
      );
    `);
    await client.query(
      `INSERT INTO branches (id, company_id, is_active) VALUES ($1, $2, TRUE)`,
      [branchId, companyId],
    );
    await client.query(
      `INSERT INTO employees (id, user_id, branch_id, status)
       VALUES ($1, $2, $3, 'active')`,
      [employeeId, userId, branchId],
    );

    const db = {
      transaction: async <T>(work: (connection: typeof client) => Promise<T>): Promise<T> => {
        await client.query("BEGIN");
        try {
          const result = await work(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      },
    };
    const service = new AttendanceService(db as never);

    const clock = await client.query<{
      work_date: string;
      yesterday: string;
      local_now: Date;
      end_time: string;
      end_date: string;
    }>(`
      SELECT
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date::text AS work_date,
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date - 1)::text AS yesterday,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman') AS local_now,
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman') + INTERVAL '20 minutes')::time::text AS end_time,
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman') + INTERVAL '20 minutes')::date::text AS end_date
    `);
    const { work_date, yesterday, end_time, end_date } = clock.rows[0];

    // Overnight shift: previous work date + next-day end clock must produce a
    // positive early-departure result through the actual AttendanceService SQL.
    const overnightId = await createFixture(yesterday, end_time, true);
    const overnight = await service.checkOut(branchId, user);
    if (overnight.id !== overnightId || (overnight as any).early_departure_minutes < 14 ||
        (overnight as any).early_departure_minutes > 15) {
      throw new Error(`Overnight check-out integration failed: ${JSON.stringify(overnight)}`);
    }

    // Regular shift is deterministic when the target end remains on the same
    // local work date; around midnight the overnight case above covers rollover.
    if (end_date === work_date) {
      const regularId = await createFixture(work_date, end_time, false);
      const regular = await service.checkOut(branchId, user);
      if (regular.id !== regularId || (regular as any).early_departure_minutes < 14 ||
          (regular as any).early_departure_minutes > 15) {
        throw new Error(`Regular check-out integration failed: ${JSON.stringify(regular)}`);
      }
    }

    console.log("PostgreSQL AttendanceService.checkOut integration passed (overnight; regular when within same local date).");
  } finally {
    await client.query("SET search_path TO public").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
