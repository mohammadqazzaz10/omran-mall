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
import {
  CreateBreakTypeDto,
  RejectBreakRequestDto,
  RequestBreakDto,
  UpdateBreakTypeDto,
} from "./breaks.dto";

type EmployeeRow = {
  id: string;
  branch_id: string;
  department_id: string;
  status: string;
};

type BreakTypeRow = {
  id: string;
  branch_id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  default_duration_minutes: number;
  max_duration_minutes: number;
  daily_quota_times: number;
  cooldown_between_breaks_minutes: number;
  requires_approval: boolean;
  deduct_from_work_hours: boolean;
  allowed_start_time: string | null;
  allowed_end_time: string | null;
  max_simultaneous_per_department: number;
  blackout_periods: Array<{ start: string; end: string }> | string;
  notify_before_end_minutes: number;
  allow_early_return: boolean;
  is_active: boolean;
};

@Injectable()
export class BreaksService {
  constructor(private readonly db: DatabaseService) {}

  private async assertBranch(
    client: PoolClient,
    branchId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const result = await client.query(
      `SELECT id
       FROM branches
       WHERE id = $1 AND company_id = $2
         AND is_active = TRUE AND deleted_at IS NULL
       FOR SHARE`,
      [branchId, user.companyId],
    );
    if (result.rowCount !== 1) {
      throw new NotFoundException("الفرع غير موجود أو غير فعال");
    }
  }

  private async employeeForUser(
    client: PoolClient,
    branchId: string,
    userId: string,
  ): Promise<EmployeeRow> {
    const result = await client.query<EmployeeRow>(
      `SELECT id, branch_id, department_id, status
       FROM employees
       WHERE user_id = $1 AND branch_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [userId, branchId],
    );
    const employee = result.rows[0];
    if (!employee) {
      throw new ForbiddenException("لا يوجد ملف موظف مرتبط بحسابك في هذا الفرع");
    }
    if (employee.status !== "active") {
      throw new ForbiddenException("حالة الموظف لا تسمح بطلب الاستراحة");
    }
    return employee;
  }

  private async breakType(
    client: PoolClient,
    branchId: string,
    breakTypeId: string,
    lock = false,
  ): Promise<BreakTypeRow> {
    const result = await client.query<BreakTypeRow>(
      `SELECT *
       FROM break_types
       WHERE id = $1 AND branch_id = $2 AND is_active = TRUE
       ${lock ? "FOR UPDATE" : ""}`,
      [breakTypeId, branchId],
    );
    const type = result.rows[0];
    if (!type) {
      throw new NotFoundException("نوع الاستراحة غير موجود أو غير مفعل");
    }
    return type;
  }

  private minutes(value: string): number {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private isInTimeWindow(now: number, start: number, end: number): boolean {
    if (start === end) return true;
    if (start < end) return now >= start && now < end;
    return now >= start || now < end;
  }

  private blackoutPeriods(
    value: BreakTypeRow["blackout_periods"],
  ): Array<{ start: string; end: string }> {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  }

  private async assertCanStart(
    client: PoolClient,
    employee: EmployeeRow,
    type: BreakTypeRow,
    durationMinutes: number,
  ): Promise<void> {
    if (durationMinutes < 1 || durationMinutes > type.max_duration_minutes) {
      throw new BadRequestException("مدة الاستراحة تتجاوز الحد المسموح");
    }

    const department = await client.query(
      `SELECT id FROM departments
       WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [employee.department_id, employee.branch_id],
    );
    if (!department.rowCount) {
      throw new ConflictException("قسم الموظف غير متاح حالياً");
    }

    const active = await client.query(
      `SELECT id FROM break_sessions
       WHERE employee_id = $1 AND actual_end_time IS NULL
       LIMIT 1 FOR UPDATE`,
      [employee.id],
    );
    if (active.rowCount) {
      throw new ConflictException("لديك استراحة نشطة بالفعل");
    }

    const clock = await client.query<{
      local_date: string;
      local_time: string;
    }>(
      `SELECT
         (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date::text AS local_date,
         TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman', 'HH24:MI') AS local_time`,
    );
    const localDate = clock.rows[0].local_date;
    const localTime = clock.rows[0].local_time;
    const currentMinutes = this.minutes(localTime);

    if (type.allowed_start_time && type.allowed_end_time) {
      const start = this.minutes(type.allowed_start_time);
      const end = this.minutes(type.allowed_end_time);
      if (!this.isInTimeWindow(currentMinutes, start, end)) {
        throw new ConflictException("الاستراحة خارج الأوقات المسموح بها");
      }
    }

    for (const period of this.blackoutPeriods(type.blackout_periods)) {
      if (!period || typeof period.start !== "string" || typeof period.end !== "string") {
        continue;
      }
      const start = this.minutes(period.start);
      const end = this.minutes(period.end);
      if (this.isInTimeWindow(currentMinutes, start, end)) {
        throw new ConflictException("الوقت الحالي ضمن فترة منع الاستراحات");
      }
    }

    const daily = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM break_sessions
       WHERE employee_id = $1 AND break_type_id = $2
         AND (start_time AT TIME ZONE 'Asia/Amman')::date = $3::date`,
      [employee.id, type.id, localDate],
    );
    if (Number(daily.rows[0]?.count ?? 0) >= type.daily_quota_times) {
      throw new ConflictException("تم استنفاد عدد مرات هذا النوع من الاستراحة اليوم");
    }

    if (type.cooldown_between_breaks_minutes > 0) {
      const previous = await client.query<{ last_end: Date | null }>(
        `SELECT MAX(actual_end_time) AS last_end
         FROM break_sessions
         WHERE employee_id = $1 AND actual_end_time IS NOT NULL`,
        [employee.id],
      );
      const lastEnd = previous.rows[0]?.last_end;
      if (lastEnd) {
        const cooldown = await client.query<{ allowed: boolean }>(
          `SELECT CURRENT_TIMESTAMP >=
             $1::timestamptz + ($2::int * INTERVAL '1 minute') AS allowed`,
          [lastEnd, type.cooldown_between_breaks_minutes],
        );
        if (!cooldown.rows[0]?.allowed) {
          throw new ConflictException("لم تنتهِ فترة الانتظار بين الاستراحات بعد");
        }
      }
    }

    const concurrent = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM break_sessions
       WHERE branch_id = $1 AND department_id = $2
         AND actual_end_time IS NULL`,
      [employee.branch_id, employee.department_id],
    );
    if (
      Number(concurrent.rows[0]?.count ?? 0) >=
      type.max_simultaneous_per_department
    ) {
      throw new ConflictException("وصل القسم إلى الحد الأقصى للموظفين خارج العمل");
    }
  }

  private async createSession(
    client: PoolClient,
    requestId: string,
    employee: EmployeeRow,
    type: BreakTypeRow,
    durationMinutes: number,
  ) {
    const result = await client.query(
      `INSERT INTO break_sessions
        (break_request_id, employee_id, branch_id, department_id,
         break_type_id, start_time, expected_end_time)
       VALUES (
         $1, $2, $3, $4, $5, CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP + ($6::int * INTERVAL '1 minute')
       )
       RETURNING id, break_request_id, employee_id, branch_id, department_id,
                 break_type_id, start_time, expected_end_time, actual_end_time`,
      [
        requestId,
        employee.id,
        employee.branch_id,
        employee.department_id,
        type.id,
        durationMinutes,
      ],
    );
    return result.rows[0];
  }

  async listTypes(branchId: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `SELECT id, branch_id, code, name_ar, name_en,
                default_duration_minutes, max_duration_minutes, daily_quota_times,
                cooldown_between_breaks_minutes, requires_approval,
                deduct_from_work_hours, allowed_start_time, allowed_end_time,
                max_simultaneous_per_department, blackout_periods,
                notify_before_end_minutes, allow_early_return, is_active
         FROM break_types
         WHERE branch_id = $1
         ORDER BY name_ar, code`,
        [branchId],
      );
      return result.rows;
    });
  }

  async createType(
    branchId: string,
    dto: CreateBreakTypeDto,
    user: AuthenticatedUser,
  ) {
    if (
      (dto.allowedStartTime && !dto.allowedEndTime) ||
      (!dto.allowedStartTime && dto.allowedEndTime)
    ) {
      throw new BadRequestException("يجب تحديد بداية ونهاية الوقت المسموح معاً");
    }
    if (dto.defaultDurationMinutes > dto.maxDurationMinutes) {
      throw new BadRequestException("المدة الافتراضية لا يمكن أن تتجاوز الحد الأقصى");
    }

    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `INSERT INTO break_types
          (branch_id, code, name_ar, name_en, default_duration_minutes,
           max_duration_minutes, daily_quota_times,
           cooldown_between_breaks_minutes, requires_approval,
           deduct_from_work_hours, allowed_start_time, allowed_end_time,
           max_simultaneous_per_department, blackout_periods,
           notify_before_end_minutes, allow_early_return)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
         RETURNING *`,
        [
          branchId,
          dto.code,
          dto.nameAr,
          dto.nameEn ?? null,
          dto.defaultDurationMinutes,
          dto.maxDurationMinutes,
          dto.dailyQuotaTimes ?? 1,
          dto.cooldownBetweenBreaksMinutes ?? 60,
          dto.requiresApproval ?? true,
          dto.deductFromWorkHours ?? false,
          dto.allowedStartTime ?? null,
          dto.allowedEndTime ?? null,
          dto.maxSimultaneousPerDepartment ?? 1,
          JSON.stringify(dto.blackoutPeriods ?? []),
          dto.notifyBeforeEndMinutes ?? 3,
          dto.allowEarlyReturn ?? true,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1,$2,'break_types',$3,'INSERT',$4::jsonb)`,
        [user.id, branchId, result.rows[0].id, JSON.stringify(result.rows[0])],
      );
      return result.rows[0];
    });
  }

  async updateType(
    branchId: string,
    typeId: string,
    dto: UpdateBreakTypeDto,
    user: AuthenticatedUser,
  ) {
    const columns: Record<string, string> = {
      code: "code",
      nameAr: "name_ar",
      nameEn: "name_en",
      defaultDurationMinutes: "default_duration_minutes",
      maxDurationMinutes: "max_duration_minutes",
      dailyQuotaTimes: "daily_quota_times",
      cooldownBetweenBreaksMinutes: "cooldown_between_breaks_minutes",
      requiresApproval: "requires_approval",
      deductFromWorkHours: "deduct_from_work_hours",
      allowedStartTime: "allowed_start_time",
      allowedEndTime: "allowed_end_time",
      maxSimultaneousPerDepartment: "max_simultaneous_per_department",
      blackoutPeriods: "blackout_periods",
      notifyBeforeEndMinutes: "notify_before_end_minutes",
      allowEarlyReturn: "allow_early_return",
      isActive: "is_active",
    };
    const values: unknown[] = [branchId, typeId];
    const assignments: string[] = [];
    for (const [key, column] of Object.entries(columns)) {
      if (Object.prototype.hasOwnProperty.call(dto, key) && dto[key as keyof UpdateBreakTypeDto] !== undefined) {
        values.push(
          key === "blackoutPeriods"
            ? JSON.stringify(dto.blackoutPeriods ?? [])
            : dto[key as keyof UpdateBreakTypeDto],
        );
        assignments.push(
          `${column} = $${values.length}${key === "blackoutPeriods" ? "::jsonb" : ""}`,
        );
      }
    }
    if (!assignments.length) {
      throw new BadRequestException("لم يتم إرسال أي تعديل");
    }

    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const currentResult = await client.query<BreakTypeRow>(
        `SELECT * FROM break_types
         WHERE id = $1 AND branch_id = $2
         FOR UPDATE`,
        [typeId, branchId],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException("نوع الاستراحة غير موجود");

      const defaultDuration =
        dto.defaultDurationMinutes ?? current.default_duration_minutes;
      const maxDuration = dto.maxDurationMinutes ?? current.max_duration_minutes;
      if (defaultDuration < 1 || maxDuration < defaultDuration) {
        throw new BadRequestException("سياسة مدة الاستراحة غير صحيحة");
      }
      const hasStart = Object.prototype.hasOwnProperty.call(dto, "allowedStartTime");
      const hasEnd = Object.prototype.hasOwnProperty.call(dto, "allowedEndTime");
      const startTime = hasStart
        ? dto.allowedStartTime ?? null
        : current.allowed_start_time;
      const endTime = hasEnd
        ? dto.allowedEndTime ?? null
        : current.allowed_end_time;
      if ((startTime === null) !== (endTime === null)) {
        throw new BadRequestException("يجب تحديد بداية ونهاية الوقت المسموح معاً");
      }

      const result = await client.query(
        `UPDATE break_types
         SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE branch_id = $1 AND id = $2
         RETURNING *`,
        values,
      );
      if (!result.rowCount) throw new NotFoundException("نوع الاستراحة غير موجود");
      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1,$2,'break_types',$3,'UPDATE',$4::jsonb)`,
        [user.id, branchId, typeId, JSON.stringify(result.rows[0])],
      );
      return result.rows[0];
    });
  }

  async requestBreak(
    branchId: string,
    dto: RequestBreakDto,
    user: AuthenticatedUser,
  ) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const employee = await this.employeeForUser(client, branchId, user.id);
      const type = await this.breakType(client, branchId, dto.breakTypeId);
      const duration = dto.requestedDurationMinutes ?? type.default_duration_minutes;
      if (duration > type.max_duration_minutes) {
        throw new BadRequestException("مدة الاستراحة تتجاوز الحد الأقصى المحدد");
      }

      const pending = await client.query(
        `SELECT id FROM break_requests
         WHERE employee_id = $1 AND break_type_id = $2 AND status = 'pending'
         LIMIT 1 FOR UPDATE`,
        [employee.id, type.id],
      );
      if (pending.rowCount) {
        throw new ConflictException("لديك طلب استراحة معلق من النوع نفسه");
      }

      await this.assertCanStart(client, employee, type, duration);

      const requestResult = await client.query(
        `INSERT INTO break_requests
          (employee_id, branch_id, department_id, break_type_id,
           requested_duration_minutes, status, decided_at)
         VALUES ($1,$2,$3,$4,$5,$6,
                 CASE WHEN $6 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END)
         RETURNING *`,
        [
          employee.id,
          branchId,
          employee.department_id,
          type.id,
          duration,
          type.requires_approval ? "pending" : "approved",
        ],
      );
      const request = requestResult.rows[0];
      const session = type.requires_approval
        ? null
        : await this.createSession(client, request.id, employee, type, duration);

      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1,$2,'break_requests',$3,'INSERT',$4::jsonb)`,
        [user.id, branchId, request.id, JSON.stringify(request)],
      );
      return { request, session };
    });
  }

  async listRequests(
    branchId: string,
    status: string | undefined,
    user: AuthenticatedUser,
  ) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `SELECT r.*, e.employee_code, e.first_name_ar, e.second_name_ar,
                e.last_name_ar, t.name_ar AS break_type_name_ar
         FROM break_requests r
         JOIN employees e ON e.id = r.employee_id
         JOIN break_types t ON t.id = r.break_type_id
         WHERE r.branch_id = $1 AND ($2::text IS NULL OR r.status = $2)
         ORDER BY r.created_at DESC
         LIMIT 200`,
        [branchId, status ?? null],
      );
      return result.rows;
    });
  }

  async approveRequest(
    branchId: string,
    requestId: string,
    user: AuthenticatedUser,
  ) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const requestResult = await client.query(
        `SELECT * FROM break_requests
         WHERE id = $1 AND branch_id = $2
         FOR UPDATE`,
        [requestId, branchId],
      );
      const request = requestResult.rows[0];
      if (!request) throw new NotFoundException("طلب الاستراحة غير موجود");
      if (request.status !== "pending") {
        throw new ConflictException("تمت معالجة هذا الطلب مسبقاً");
      }
      const employee = await client.query<EmployeeRow>(
        `SELECT id, branch_id, department_id, status
         FROM employees
         WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL
         FOR UPDATE`,
        [request.employee_id, branchId],
      );
      const employeeRow = employee.rows[0];
      if (!employeeRow || employeeRow.status !== "active") {
        throw new ConflictException("لم يعد الموظف مؤهلاً لبدء الاستراحة");
      }
      const type = await this.breakType(client, branchId, request.break_type_id, true);
      await this.assertCanStart(
        client,
        employeeRow,
        type,
        request.requested_duration_minutes,
      );
      const session = await this.createSession(
        client,
        request.id,
        employeeRow,
        type,
        request.requested_duration_minutes,
      );
      const updated = await client.query(
        `UPDATE break_requests
         SET status = 'approved', approved_by_user_id = $3,
             decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $2
         RETURNING *`,
        [requestId, branchId, user.id],
      );
      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1,$2,'break_requests',$3,'UPDATE',$4::jsonb)`,
        [user.id, branchId, requestId, JSON.stringify(updated.rows[0])],
      );
      return { request: updated.rows[0], session };
    });
  }

  async rejectRequest(
    branchId: string,
    requestId: string,
    dto: RejectBreakRequestDto,
    user: AuthenticatedUser,
  ) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const current = await client.query(
        `SELECT id FROM break_requests
         WHERE id = $1 AND branch_id = $2 AND status = 'pending'
         FOR UPDATE`,
        [requestId, branchId],
      );
      if (!current.rowCount) {
        throw new NotFoundException("طلب الاستراحة غير موجود أو تمت معالجته");
      }
      const result = await client.query(
        `UPDATE break_requests
         SET status = 'rejected', rejection_reason = $3,
             approved_by_user_id = $4, decided_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $2
         RETURNING *`,
        [requestId, branchId, dto.reason, user.id],
      );
      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1,$2,'break_requests',$3,'UPDATE',$4::jsonb)`,
        [user.id, branchId, requestId, JSON.stringify(result.rows[0])],
      );
      return result.rows[0];
    });
  }

  async endOwnSession(
    branchId: string,
    sessionId: string,
    user: AuthenticatedUser,
  ) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const sessionResult = await client.query(
        `SELECT s.*, t.allow_early_return, e.user_id
         FROM break_sessions s
         JOIN break_types t ON t.id = s.break_type_id
         JOIN employees e ON e.id = s.employee_id
         WHERE s.id = $1 AND s.branch_id = $2
         FOR UPDATE OF s`,
        [sessionId, branchId],
      );
      const session = sessionResult.rows[0];
      if (!session || session.user_id !== user.id) {
        throw new NotFoundException("جلسة الاستراحة غير موجودة");
      }
      if (session.actual_end_time) {
        throw new ConflictException("تم إنهاء هذه الاستراحة مسبقاً");
      }
      if (!session.allow_early_return) {
        const early = await client.query<{ early: boolean }>(
          "SELECT CURRENT_TIMESTAMP < $1::timestamptz AS early",
          [session.expected_end_time],
        );
        if (early.rows[0]?.early) {
          throw new ConflictException("لا يمكن إنهاء هذه الاستراحة قبل موعدها");
        }
      }
      const ended = await client.query(
        `UPDATE break_sessions
         SET actual_end_time = CURRENT_TIMESTAMP,
             duration_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60)::int),
             overstay_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - expected_end_time)) / 60)::int),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [sessionId],
      );
      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values)
         VALUES ($1,$2,'break_sessions',$3,'UPDATE',$4::jsonb)`,
        [user.id, branchId, sessionId, JSON.stringify(ended.rows[0])],
      );
      return ended.rows[0];
    });
  }

  async live(branchId: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const [sessions, requests] = await Promise.all([
        client.query(
        `SELECT s.id, s.employee_id, s.department_id, s.break_type_id,
                s.start_time, s.expected_end_time,
                GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.expected_end_time - CURRENT_TIMESTAMP))))::int AS remaining_seconds,
                e.employee_code, e.first_name_ar, e.second_name_ar, e.last_name_ar,
                t.name_ar AS break_type_name_ar, d.name_ar AS department_name_ar
         FROM break_sessions s
         JOIN employees e ON e.id = s.employee_id
         JOIN break_types t ON t.id = s.break_type_id
         JOIN departments d ON d.id = s.department_id
         WHERE s.branch_id = $1 AND s.actual_end_time IS NULL
         ORDER BY s.expected_end_time ASC`,
        [branchId],
      ),
      client.query(
        `SELECT r.id, r.employee_id, r.department_id, r.break_type_id,
                r.requested_duration_minutes, r.created_at,
                e.employee_code, e.first_name_ar, e.second_name_ar, e.last_name_ar,
                t.name_ar AS break_type_name_ar, d.name_ar AS department_name_ar
         FROM break_requests r
         JOIN employees e ON e.id = r.employee_id
         JOIN break_types t ON t.id = r.break_type_id
         JOIN departments d ON d.id = r.department_id
         WHERE r.branch_id = $1 AND r.status = 'pending'
         ORDER BY r.created_at ASC`,
        [branchId],
      ),
      ]);
      return { activeSessions: sessions.rows, pendingRequests: requests.rows };
    });
  }
}
