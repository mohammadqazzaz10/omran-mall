import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { AttendanceCorrectionDto } from "./attendance.dto";

type EmployeeRow = { id: string; status: string };
type AttendanceRow = {
  id: string;
  employee_id: string;
  branch_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly db: DatabaseService) {}

  private async assertBranch(client: PoolClient, branchId: string, user: AuthenticatedUser) {
    const result = await client.query(
      `SELECT id FROM branches
       WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL
       FOR SHARE`,
      [branchId, user.companyId],
    );
    if (result.rowCount !== 1) throw new NotFoundException("الفرع غير موجود أو غير فعال");
  }

  private async employeeForUser(client: PoolClient, branchId: string, user: AuthenticatedUser): Promise<EmployeeRow> {
    const result = await client.query<EmployeeRow>(
      `SELECT id, status FROM employees
       WHERE user_id = $1 AND branch_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [user.id, branchId],
    );
    const employee = result.rows[0];
    if (!employee) throw new ForbiddenException("لا يوجد ملف موظف مرتبط بحسابك في هذا الفرع");
    if (employee.status !== "active") throw new ForbiddenException("حالة الموظف لا تسمح بتسجيل الحضور");
    return employee;
  }

  private async audit(client: PoolClient, user: AuthenticatedUser, branchId: string, id: string, action: "INSERT" | "UPDATE", oldValues: unknown, newValues: unknown) {
    await client.query(
      `INSERT INTO audit_logs (user_id, branch_id, table_name, record_id, action, old_values, new_values)
       VALUES ($1, $2, 'attendance_records', $3, $4, $5::jsonb, $6::jsonb)`,
      [user.id, branchId, id, action, oldValues == null ? null : JSON.stringify(oldValues), newValues == null ? null : JSON.stringify(newValues)],
    );
  }

  async checkIn(branchId: string, user: AuthenticatedUser) {
    try {
      return await this.db.transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        const employee = await this.employeeForUser(client, branchId, user);
        const clock = await client.query<{ work_date: string; local_time: string }>(
          `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date::text AS work_date,
                  TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman', 'HH24:MI') AS local_time`,
        );
        const { work_date: workDate, local_time: localTime } = clock.rows[0];
        const assignment = await client.query<{
          shift_id: string | null;
          start_time: string | null;
          grace_period_late_minutes: number | null;
          is_day_off: boolean;
        }>(
          `SELECT sa.shift_id, s.start_time::text, s.grace_period_late_minutes, sa.is_day_off
           FROM shift_assignments sa
           LEFT JOIN shifts s ON s.id = sa.shift_id AND s.branch_id = sa.branch_id
           WHERE sa.employee_id = $1 AND sa.branch_id = $2
             AND sa.work_date = $3 AND sa.is_published = TRUE
           LIMIT 1`,
          [employee.id, branchId, workDate],
        );
        const scheduled = assignment.rows[0];
        let lateMinutes = 0;
        let status = "present";
        if (scheduled?.is_day_off) status = "needs_review";
        if (scheduled?.start_time && !scheduled.is_day_off) {
          const [sh, sm] = scheduled.start_time.slice(0, 5).split(":").map(Number);
          const [nh, nm] = localTime.split(":").map(Number);
          lateMinutes = Math.max(0, nh * 60 + nm - (sh * 60 + sm) - (scheduled.grace_period_late_minutes ?? 0));
          if (lateMinutes > 0) status = "late";
        }
        const inserted = await client.query<AttendanceRow>(
          `INSERT INTO attendance_records
           (employee_id, branch_id, shift_id, work_date, check_in_time, check_in_method, late_minutes, status)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'mobile_app', $5, $6::attendance_status_enum)
           RETURNING id, employee_id, branch_id, work_date::text, check_in_time, check_out_time, status`,
          [employee.id, branchId, scheduled?.shift_id ?? null, workDate, lateMinutes, status],
        );
        await this.audit(client, user, branchId, inserted.rows[0].id, "INSERT", null, inserted.rows[0]);
        return inserted.rows[0];
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") throw new ConflictException("تم تسجيل حضورك لهذا اليوم مسبقاً");
      throw error;
    }
  }

  async checkOut(branchId: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const employee = await this.employeeForUser(client, branchId, user);
      const current = await client.query<AttendanceRow>(
        `SELECT id, employee_id, branch_id, work_date::text, check_in_time, check_out_time, status
         FROM attendance_records
         WHERE employee_id = $1 AND branch_id = $2
           AND check_in_time IS NOT NULL AND check_out_time IS NULL
         ORDER BY check_in_time DESC LIMIT 1 FOR UPDATE`,
        [employee.id, branchId],
      );
      const record = current.rows[0];
      if (!record) throw new ConflictException("لا يوجد سجل حضور مفتوح لتسجيل الانصراف");
      const updated = await client.query<AttendanceRow>(
        `UPDATE attendance_records
         SET check_out_time = CURRENT_TIMESTAMP,
             total_work_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in_time)) / 60)::int),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $2 AND employee_id = $3 AND check_out_time IS NULL
         RETURNING id, employee_id, branch_id, work_date::text, check_in_time, check_out_time, status`,
        [record.id, branchId, employee.id],
      );
      await this.audit(client, user, branchId, record.id, "UPDATE", record, updated.rows[0]);
      return updated.rows[0];
    });
  }

  async myRecords(branchId: string, user: AuthenticatedUser, limit = 30) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    await this.assertBranch(this.db as unknown as PoolClient, branchId, user);
    const employee = await this.db.query<EmployeeRow>(
      "SELECT id, status FROM employees WHERE user_id = $1 AND branch_id = $2 AND deleted_at IS NULL",
      [user.id, branchId],
    );
    if (!employee.rowCount) throw new ForbiddenException("لا يوجد ملف موظف مرتبط بحسابك في هذا الفرع");
    const result = await this.db.query(
      `SELECT ar.*, s.name_ar AS shift_name_ar
       FROM attendance_records ar
       LEFT JOIN shifts s ON s.id = ar.shift_id
       WHERE ar.employee_id = $1 AND ar.branch_id = $2
       ORDER BY ar.work_date DESC LIMIT $3`,
      [employee.rows[0].id, branchId, safeLimit],
    );
    return result.rows;
  }

  async branchRecords(branchId: string, workDate: string, user: AuthenticatedUser) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) throw new BadRequestException("صيغة التاريخ يجب أن تكون YYYY-MM-DD");
    await this.assertBranch(this.db as unknown as PoolClient, branchId, user);
    const result = await this.db.query(
      `SELECT ar.*, e.employee_code, e.first_name_ar, e.second_name_ar, e.last_name_ar,
              d.name_ar AS department_name_ar, p.title_ar AS position_title_ar
       FROM attendance_records ar
       JOIN employees e ON e.id = ar.employee_id AND e.branch_id = ar.branch_id
       JOIN departments d ON d.id = e.department_id AND d.branch_id = ar.branch_id
       JOIN positions p ON p.id = e.position_id AND p.department_id = d.id
       WHERE ar.branch_id = $1 AND ar.work_date = $2
       ORDER BY d.name_ar, e.employee_code`,
      [branchId, workDate],
    );
    return result.rows;
  }

  async requestCorrection(branchId: string, dto: AttendanceCorrectionDto, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const employee = await this.employeeForUser(client, branchId, user);
      const record = await client.query<AttendanceRow>(
        `SELECT id, employee_id, branch_id, work_date::text, check_in_time, check_out_time, status
         FROM attendance_records
         WHERE employee_id = $1 AND branch_id = $2 AND work_date = $3
         FOR UPDATE`,
        [employee.id, branchId, dto.workDate],
      );
      if (!record.rowCount) throw new NotFoundException("لا يوجد سجل حضور لهذا التاريخ");
      const row = record.rows[0];
      const result = await client.query(
        `INSERT INTO attendance_corrections
         (attendance_record_id, employee_id, branch_id, work_date,
          original_check_in, original_check_out, requested_check_in, requested_check_out, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [row.id, employee.id, branchId, dto.workDate, row.check_in_time, row.check_out_time,
         dto.requestedCheckIn ?? null, dto.requestedCheckOut ?? null, dto.reason.trim()],
      );
      return result.rows[0];
    });
  }

  async approveCorrection(branchId: string, correctionId: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const correction = await client.query(
        `SELECT * FROM attendance_corrections
         WHERE id = $1 AND branch_id = $2 AND status = 'pending'
         FOR UPDATE`,
        [correctionId, branchId],
      );
      const row = correction.rows[0];
      if (!row) throw new NotFoundException("طلب التصحيح غير موجود أو تمت معالجته");
      const record = await client.query<AttendanceRow>(
        `SELECT id, employee_id, branch_id, work_date::text, check_in_time, check_out_time, status
         FROM attendance_records WHERE id = $1 AND branch_id = $2 AND employee_id = $3
         FOR UPDATE`,
        [row.attendance_record_id, branchId, row.employee_id],
      );
      if (!record.rowCount) throw new NotFoundException("سجل الحضور المرتبط غير موجود");
      const updated = await client.query(
        `UPDATE attendance_records
         SET check_in_time = COALESCE($2, check_in_time),
             check_out_time = COALESCE($3, check_out_time),
             total_work_minutes = CASE
               WHEN COALESCE($3, check_out_time) IS NOT NULL
               THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE($3, check_out_time) - COALESCE($2, check_in_time))) / 60)::int)
               ELSE total_work_minutes END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $4
         RETURNING *`,
        [row.attendance_record_id, row.requested_check_in, row.requested_check_out, branchId],
      );
      await client.query(
        `UPDATE attendance_corrections
         SET status = 'approved', reviewed_by_user_id = $2, reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $3`,
        [correctionId, user.id, branchId],
      );
      await this.audit(client, user, branchId, row.attendance_record_id, "UPDATE", record.rows[0], updated.rows[0]);
      return { correctionId, attendance: updated.rows[0], status: "approved" };
    });
  }
}
