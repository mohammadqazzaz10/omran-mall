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
  CreateAssignmentDto,
  CreateCoverageRequirementDto,
  CreateShiftDto,
  CreateSwapRequestDto,
  DecideSwapDto,
  RespondSwapDto,
} from "./shifts.dto";

@Injectable()
export class ShiftsService {
  constructor(private readonly db: DatabaseService) {}

  private async assertBranch(client: PoolClient, branchId: string, user: AuthenticatedUser) {
    const result = await client.query(
      `SELECT id FROM branches
       WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL
       FOR SHARE`,
      [branchId, user.companyId],
    );
    if (!result.rowCount) throw new NotFoundException("الفرع غير موجود أو غير فعال");
  }

  private async audit(
    client: PoolClient,
    user: AuthenticatedUser,
    branchId: string,
    tableName: string,
    recordId: string,
    action: "INSERT" | "UPDATE",
    newValues: unknown,
    oldValues: unknown = null,
  ) {
    await client.query(
      `INSERT INTO audit_logs
       (user_id, branch_id, table_name, record_id, action, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [user.id, branchId, tableName, recordId, action,
        oldValues == null ? null : JSON.stringify(oldValues),
        newValues == null ? null : JSON.stringify(newValues)],
    );
  }

  private assertRange(from: string, to: string) {
    const start = Date.parse(from);
    const end = Date.parse(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      throw new BadRequestException("نطاق التاريخ غير صحيح");
    }
    if ((end - start) / 86400000 > 62) {
      throw new BadRequestException("لا يمكن طلب أكثر من 63 يوماً في المرة الواحدة");
    }
  }

  async listTemplates(branchId: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `SELECT id, branch_id, code, name_ar, name_en, start_time, end_time,
                shift_type, required_staff_count, grace_period_late_minutes,
                grace_period_early_leave_minutes, is_night_shift, description,
                is_active, created_at, updated_at
         FROM shifts WHERE branch_id = $1 AND deleted_at IS NULL
         ORDER BY start_time, name_ar`,
        [branchId],
      );
      return result.rows;
    });
  }

  async createTemplate(branchId: string, dto: CreateShiftDto, user: AuthenticatedUser) {
    if (dto.startTime === dto.endTime && dto.shiftType !== "flexible") {
      throw new BadRequestException("بداية ونهاية الوردية لا يمكن أن تتطابقا");
    }
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `INSERT INTO shifts
          (branch_id, code, name_ar, name_en, start_time, end_time,
           shift_type, required_staff_count, grace_period_late_minutes,
           grace_period_early_leave_minutes, is_night_shift, description)
         VALUES ($1,$2,$3,$4,$5::time,$6::time,$7,$8,$9,$10,
                 ($6::time <= $5::time),$11)
         RETURNING id, branch_id, code, name_ar, name_en, start_time, end_time,
                   shift_type, required_staff_count, grace_period_late_minutes,
                   grace_period_early_leave_minutes, is_night_shift, description,
                   is_active, created_at, updated_at`,
        [
          branchId, dto.code, dto.nameAr, dto.nameEn ?? null, dto.startTime,
          dto.endTime, dto.shiftType ?? "morning", dto.requiredStaffCount ?? 0,
          dto.gracePeriodLateMinutes ?? 15, dto.gracePeriodEarlyLeaveMinutes ?? 10,
          dto.description ?? null,
        ],
      );
      await this.audit(client, user, branchId, "shifts", result.rows[0].id, "INSERT", result.rows[0]);
      return result.rows[0];
    });
  }

  async listSchedule(branchId: string, from: string, to: string, user: AuthenticatedUser) {
    this.assertRange(from, to);
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `SELECT sa.id, sa.branch_id, sa.employee_id, e.employee_code,
                e.first_name_ar, e.last_name_ar, sa.department_id, d.name_ar AS department_name,
                sa.shift_id, s.name_ar AS shift_name, s.name_en AS shift_name_en,
                sa.work_date, sa.is_day_off, sa.status, sa.notes,
                sa.scheduled_start_at, sa.scheduled_end_at, sa.published_at
         FROM shift_assignments sa
         JOIN employees e ON e.id = sa.employee_id AND e.branch_id = sa.branch_id
         JOIN departments d ON d.id = sa.department_id AND d.branch_id = sa.branch_id
         LEFT JOIN shifts s ON s.id = sa.shift_id AND s.branch_id = sa.branch_id
         WHERE sa.branch_id = $1 AND sa.work_date BETWEEN $2::date AND $3::date
           AND sa.status <> 'cancelled'
         ORDER BY sa.work_date, d.name_ar, s.start_time NULLS FIRST, e.employee_code`,
        [branchId, from, to],
      );
      return result.rows;
    });
  }

  async mySchedule(branchId: string, from: string, to: string, user: AuthenticatedUser) {
    this.assertRange(from, to);
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const employee = await client.query(
        `SELECT id FROM employees WHERE user_id = $1 AND branch_id = $2
         AND status = 'active' AND deleted_at IS NULL`,
        [user.id, branchId],
      );
      if (!employee.rowCount) throw new ForbiddenException("لا يوجد ملف موظف فعال لهذا الحساب");
      const result = await client.query(
        `SELECT sa.id, sa.work_date, sa.is_day_off, sa.status, sa.notes,
                sa.scheduled_start_at, sa.scheduled_end_at,
                s.id AS shift_id, s.name_ar AS shift_name, s.name_en AS shift_name_en,
                s.shift_type, d.name_ar AS department_name
         FROM shift_assignments sa
         LEFT JOIN shifts s ON s.id = sa.shift_id AND s.branch_id = sa.branch_id
         JOIN departments d ON d.id = sa.department_id AND d.branch_id = sa.branch_id
         WHERE sa.branch_id = $1 AND sa.employee_id = $2
           AND sa.work_date BETWEEN $3::date AND $4::date
           AND sa.status = 'published'
         ORDER BY sa.work_date`,
        [branchId, employee.rows[0].id, from, to],
      );
      return result.rows;
    });
  }

  async createAssignment(branchId: string, dto: CreateAssignmentDto, user: AuthenticatedUser) {
    if (!dto.isDayOff && !dto.shiftId) throw new BadRequestException("يجب اختيار الوردية أو تحديد يوم عطلة");
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const employee = await client.query<{ id: string; department_id: string }>(
        `SELECT id, department_id FROM employees
         WHERE id = $1 AND branch_id = $2 AND status = 'active' AND deleted_at IS NULL
         FOR UPDATE`,
        [dto.employeeId, branchId],
      );
      if (!employee.rowCount) throw new NotFoundException("الموظف غير موجود أو غير فعال في هذا الفرع");
      const departmentId = dto.departmentId ?? employee.rows[0].department_id;
      const department = await client.query(
        "SELECT id FROM departments WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [departmentId, branchId],
      );
      if (!department.rowCount) throw new BadRequestException("القسم المحدد غير تابع لهذا الفرع");
      if (dto.shiftId) {
        const shift = await client.query(
          "SELECT id FROM shifts WHERE id = $1 AND branch_id = $2 AND is_active = TRUE AND deleted_at IS NULL",
          [dto.shiftId, branchId],
        );
        if (!shift.rowCount) throw new BadRequestException("الوردية غير موجودة أو غير فعالة في هذا الفرع");
      }
      const result = await client.query(
        `INSERT INTO shift_assignments
          (employee_id, shift_id, branch_id, work_date, is_day_off, is_published,
           assigned_by_user_id, department_id, scheduled_start_at, scheduled_end_at,
           status, notes)
         SELECT $1, $2, $3, $4::date, $5, FALSE, $6, $7,
           CASE WHEN $5 THEN NULL ELSE $4::date + s.start_time END,
           CASE WHEN $5 THEN NULL ELSE $4::date + s.end_time
             + CASE WHEN s.end_time <= s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END END,
           'draft', $8
         FROM (SELECT 1) seed
         LEFT JOIN shifts s ON s.id = $2 AND s.branch_id = $3
         RETURNING id, employee_id, shift_id, branch_id, work_date, is_day_off,
                   department_id, scheduled_start_at, scheduled_end_at, status, notes`,
        [dto.employeeId, dto.isDayOff ? null : dto.shiftId, branchId, dto.workDate,
          dto.isDayOff ?? false, user.id, departmentId, dto.notes ?? null],
      );
      await this.audit(client, user, branchId, "shift_assignments", result.rows[0].id, "INSERT", result.rows[0]);
      return result.rows[0];
    });
  }

  async publish(branchId: string, from: string, to: string, user: AuthenticatedUser) {
    this.assertRange(from, to);
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `UPDATE shift_assignments
         SET status = 'published', is_published = TRUE,
             published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE branch_id = $1 AND work_date BETWEEN $2::date AND $3::date
           AND status = 'draft'
         RETURNING id, employee_id, work_date`,
        [branchId, from, to],
      );
      for (const assignment of result.rows) {
        await this.audit(client, user, branchId, "shift_assignments", assignment.id, "UPDATE", assignment);
      }
      if (result.rowCount) {
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type, payload)
           SELECT DISTINCT e.user_id, 'تم نشر جدول الورديات',
             'تم نشر جدول الورديات للفترة المحددة. راجع جدولك الشخصي.',
             'shift_change', jsonb_build_object('kind','shift_schedule_published',
               'branchId',$1,'from',$2::date,'to',$3::date)
           FROM employees e
           JOIN shift_assignments sa ON sa.employee_id = e.id AND sa.branch_id = e.branch_id
           WHERE sa.branch_id = $1 AND sa.work_date BETWEEN $2::date AND $3::date
             AND sa.status = 'published' AND e.user_id IS NOT NULL`,
          [branchId, from, to],
        );
      }
      return { publishedCount: result.rowCount ?? 0 };
    });
  }

  async listSwaps(branchId: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `SELECT sw.*, re.employee_code AS requester_number,
                re.first_name_ar AS requester_first_name, re.last_name_ar AS requester_last_name,
                te.employee_code AS target_number,
                te.first_name_ar AS target_first_name, te.last_name_ar AS target_last_name,
                ra.work_date AS requester_work_date, ta.work_date AS target_work_date
         FROM shift_swap_requests sw
         JOIN employees re ON re.id = sw.requester_employee_id AND re.branch_id = sw.branch_id
         JOIN employees te ON te.id = sw.target_employee_id AND te.branch_id = sw.branch_id
         JOIN shift_assignments ra ON ra.id = sw.requester_assignment_id AND ra.branch_id = sw.branch_id
         JOIN shift_assignments ta ON ta.id = sw.target_assignment_id AND ta.branch_id = sw.branch_id
         WHERE sw.branch_id = $1 ORDER BY sw.created_at DESC LIMIT 200`,
        [branchId],
      );
      return result.rows;
    });
  }

  async createSwap(branchId: string, dto: CreateSwapRequestDto, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const requester = await client.query<{ id: string }>(
        "SELECT id FROM employees WHERE user_id = $1 AND branch_id = $2 AND status = 'active' AND deleted_at IS NULL",
        [user.id, branchId],
      );
      if (!requester.rowCount) throw new ForbiddenException("لا يوجد ملف موظف فعال لهذا الحساب");
      if (dto.requesterAssignmentId === dto.targetAssignmentId) throw new BadRequestException("لا يمكن تبديل الوردية مع نفس الإسناد");
      const assignments = await client.query<{
        id: string; employee_id: string; status: string; is_day_off: boolean;
      }>(
        `SELECT id, employee_id, status, is_day_off FROM shift_assignments
         WHERE id = ANY($1::uuid[]) AND branch_id = $2 FOR UPDATE`,
        [[dto.requesterAssignmentId, dto.targetAssignmentId], branchId],
      );
      if (assignments.rowCount !== 2) throw new NotFoundException("أحد إسنادي الوردية غير موجود");
      const own = assignments.rows.find((a) => a.id === dto.requesterAssignmentId);
      const target = assignments.rows.find((a) => a.id === dto.targetAssignmentId);
      if (own?.employee_id !== requester.rows[0].id) throw new ForbiddenException("لا يمكنك طلب تبديل إسناد لا يخصك");
      if (!target || target.employee_id === requester.rows[0].id) throw new BadRequestException("يجب اختيار إسناد موظف آخر");
      if (own?.status !== "published" || target.status !== "published" || own.is_day_off || target.is_day_off) {
        throw new ConflictException("يمكن تبديل الورديات المنشورة فقط، ولا تشمل أيام العطلة");
      }
      const result = await client.query(
        `INSERT INTO shift_swap_requests
          (requester_employee_id, requester_assignment_id, target_employee_id,
           target_assignment_id, branch_id, status, reason)
         VALUES ($1,$2,$3,$4,$5,'pending_colleague',$6)
         RETURNING *`,
        [requester.rows[0].id, dto.requesterAssignmentId, target.employee_id,
          dto.targetAssignmentId, branchId, dto.reason],
      );
      await this.audit(client, user, branchId, "shift_swap_requests", result.rows[0].id, "INSERT", result.rows[0]);
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, payload)
         SELECT e.user_id, 'طلب تبديل وردية جديد',
           'لديك طلب تبديل وردية بانتظار ردك.',
           'request_update',
           jsonb_build_object('kind','shift_swap','swapId',$1,'status','pending_colleague')
         FROM employees e
         WHERE e.id = $2 AND e.branch_id = $3 AND e.user_id IS NOT NULL`,
        [result.rows[0].id, target.employee_id, branchId],
      );
      return result.rows[0];
    });
  }

  async respondSwap(branchId: string, swapId: string, dto: RespondSwapDto, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const employee = await client.query(
        "SELECT id FROM employees WHERE user_id = $1 AND branch_id = $2 AND status = 'active'",
        [user.id, branchId],
      );
      if (!employee.rowCount) throw new ForbiddenException("لا يوجد ملف موظف فعال لهذا الحساب");
      const result = await client.query(
        `UPDATE shift_swap_requests
         SET status = $3, target_responded_at = CURRENT_TIMESTAMP,
             rejection_reason = CASE WHEN $3 = 'rejected' THEN $4 ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $2 AND target_employee_id = $5
           AND status = 'pending_colleague'
         RETURNING *`,
        [swapId, branchId, dto.accept ? "pending_manager" : "rejected",
          dto.notes ?? null, employee.rows[0].id],
      );
      if (!result.rowCount) throw new NotFoundException("طلب التبديل غير موجود أو لا يخصك أو تمت معالجته");
      await this.audit(client, user, branchId, "shift_swap_requests", result.rows[0].id, "UPDATE", result.rows[0]);
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, payload)
         SELECT e.user_id, $3, $4, 'request_update',
           jsonb_build_object('kind','shift_swap','swapId',$1,'status',$5)
         FROM employees e
         JOIN shift_swap_requests sw ON sw.requester_employee_id = e.id
         WHERE sw.id = $1 AND sw.branch_id = $2 AND e.user_id IS NOT NULL`,
        [swapId, branchId,
          dto.accept ? "وافق الموظف على طلب التبديل" : "رفض الموظف طلب التبديل",
          dto.accept ? "أصبح الطلب بانتظار اعتماد المدير." : (dto.notes ?? "تم رفض طلب التبديل."),
          dto.accept ? "pending_manager" : "rejected"],
      );
      return result.rows[0];
    });
  }

  async decideSwap(branchId: string, swapId: string, dto: DecideSwapDto, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const swap = await client.query<{
        id: string; requester_assignment_id: string; target_assignment_id: string;
        status: string; requester_employee_id: string; target_employee_id: string;
      }>(
        `SELECT id, requester_assignment_id, target_assignment_id, status,
                requester_employee_id, target_employee_id
         FROM shift_swap_requests WHERE id = $1 AND branch_id = $2 FOR UPDATE`,
        [swapId, branchId],
      );
      const row = swap.rows[0];
      if (!row || row.status !== "pending_manager") throw new NotFoundException("طلب التبديل غير موجود أو ليس بانتظار اعتماد المدير");
      if (dto.approve) {
        const assignments = await client.query(
          `SELECT id FROM shift_assignments
           WHERE id = ANY($1::uuid[]) AND branch_id = $2
           AND status = 'published' AND is_day_off = FALSE
           FOR UPDATE`,
          [[row.requester_assignment_id, row.target_assignment_id], branchId],
        );
        if (assignments.rowCount !== 2) throw new ConflictException("أحد إسنادي الوردية لم يعد صالحاً للتبديل");
        await client.query("SET CONSTRAINTS uq_emp_shift_date, ex_shift_assignment_employee_time DEFERRED");
        const swapped = await client.query(
          `WITH current_assignments AS (
             SELECT id, shift_id
             FROM shift_assignments
             WHERE id = ANY($3::uuid[]) AND branch_id = $4
           ), exchanged AS (
             SELECT source.id, target.shift_id AS new_shift_id
             FROM current_assignments source
             JOIN current_assignments target
               ON target.id = CASE WHEN source.id = $1 THEN $2 ELSE $1 END
           )
           UPDATE shift_assignments assignment
           SET shift_id = exchanged.new_shift_id,
               scheduled_start_at = assignment.work_date + new_shift.start_time,
               scheduled_end_at = assignment.work_date + new_shift.end_time
                 + CASE WHEN new_shift.end_time <= new_shift.start_time
                        THEN INTERVAL '1 day' ELSE INTERVAL '0' END,
               updated_at = CURRENT_TIMESTAMP
           FROM exchanged
           JOIN shifts new_shift
             ON new_shift.id = exchanged.new_shift_id
            AND new_shift.branch_id = $4
           WHERE assignment.id = exchanged.id
             AND assignment.branch_id = $4
           RETURNING assignment.id, assignment.employee_id, assignment.work_date,
                     assignment.shift_id, assignment.scheduled_start_at,
                     assignment.scheduled_end_at`,
          [row.requester_assignment_id, row.target_assignment_id,
            [row.requester_assignment_id, row.target_assignment_id], branchId],
        );
        for (const assignment of swapped.rows) {
          await this.audit(client, user, branchId, "shift_assignments", assignment.id, "UPDATE", assignment);
        }
      }
      const result = await client.query(
        `UPDATE shift_swap_requests
         SET status = $3, manager_decided_at = CURRENT_TIMESTAMP,
             approved_by_user_id = $4, manager_notes = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $2 RETURNING *`,
        [swapId, branchId, dto.approve ? "approved" : "rejected", user.id, dto.notes ?? null],
      );
      await this.audit(client, user, branchId, "shift_swap_requests", result.rows[0].id, "UPDATE", result.rows[0]);
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, payload)
         SELECT e.user_id, $3, $4, 'request_update',
           jsonb_build_object('kind','shift_swap','swapId',$1,'status',$5)
         FROM employees e
         WHERE e.id = ANY($2::uuid[]) AND e.user_id IS NOT NULL`,
        [swapId, [row.requester_employee_id, row.target_employee_id],
          dto.approve ? "تم اعتماد تبديل الوردية" : "تم رفض تبديل الوردية",
          dto.approve ? "تم اعتماد طلب التبديل وتحديث الجدول." : "تم رفض طلب التبديل.",
          dto.approve ? "approved" : "rejected"],
      );
      return result.rows[0];
    });
  }

  async coverage(branchId: string, from: string, to: string, user: AuthenticatedUser) {
    this.assertRange(from, to);
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `WITH dates AS (
           SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS work_date
         ), required AS (
           SELECT dates.work_date, cr.department_id, cr.shift_id,
                  MAX(cr.minimum_staff) AS minimum_staff
           FROM dates
           JOIN shift_coverage_requirements cr
             ON cr.branch_id = $1
            AND cr.day_of_week = EXTRACT(DOW FROM dates.work_date)::int
            AND cr.valid_from <= dates.work_date
            AND (cr.valid_to IS NULL OR cr.valid_to >= dates.work_date)
           GROUP BY dates.work_date, cr.department_id, cr.shift_id
         ), assigned AS (
           SELECT work_date, department_id, shift_id, COUNT(*)::int AS assigned_staff
           FROM shift_assignments
           WHERE branch_id = $1 AND status = 'published' AND is_day_off = FALSE
             AND work_date BETWEEN $2::date AND $3::date
           GROUP BY work_date, department_id, shift_id
         )
         SELECT r.work_date, r.department_id, d.name_ar AS department_name,
                r.shift_id, s.name_ar AS shift_name, r.minimum_staff,
                COALESCE(a.assigned_staff,0) AS assigned_staff,
                GREATEST(r.minimum_staff - COALESCE(a.assigned_staff,0),0) AS shortage
         FROM required r
         JOIN departments d ON d.id = r.department_id AND d.branch_id = $1
         JOIN shifts s ON s.id = r.shift_id AND s.branch_id = $1
         LEFT JOIN assigned a ON a.work_date = r.work_date
           AND a.department_id = r.department_id AND a.shift_id = r.shift_id
         ORDER BY r.work_date, d.name_ar, s.start_time`,
        [branchId, from, to],
      );
      return result.rows;
    });
  }

  async createCoverageRequirement(branchId: string, dto: CreateCoverageRequirementDto, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const result = await client.query(
        `INSERT INTO shift_coverage_requirements
          (branch_id, department_id, shift_id, day_of_week, minimum_staff,
           valid_from, valid_to, created_by_user_id)
         SELECT $1, d.id, s.id, $4, $5, $6::date, $7::date, $8
         FROM departments d CROSS JOIN shifts s
         WHERE d.id = $2 AND d.branch_id = $1 AND d.deleted_at IS NULL
           AND s.id = $3 AND s.branch_id = $1 AND s.is_active = TRUE
         RETURNING *`,
        [branchId, dto.departmentId, dto.shiftId, dto.dayOfWeek,
          dto.minimumStaff, dto.validFrom, dto.validTo ?? null, user.id],
      );
      if (!result.rowCount) throw new BadRequestException("القسم أو الوردية غير موجودة في هذا الفرع");
      await this.audit(client, user, branchId, "shift_coverage_requirements", result.rows[0].id, "INSERT", result.rows[0]);
      return result.rows[0];
    });
  }
}
