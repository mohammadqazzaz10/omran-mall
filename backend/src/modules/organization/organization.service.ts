import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  DepartmentDto,
  EmployeeDto,
  EmployeeUpdateDto,
  PositionDto,
} from "./organization.dto";

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  private async assertBranch(
    client: any,
    branchId: string,
    user: AuthenticatedUser,
  ) {
    const result = await client.query(
      `SELECT id FROM branches
       WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL
       FOR SHARE`,
      [branchId, user.companyId],
    );
    if (result.rowCount !== 1)
      throw new NotFoundException("الفرع غير موجود أو غير فعال");
  }

  private async audit(
    client: PoolClient,
    user: AuthenticatedUser,
    branchId: string,
    tableName: string,
    recordId: string,
    action: "INSERT" | "UPDATE",
    oldValues: unknown,
    newValues: unknown,
  ) {
    await client.query(
      `INSERT INTO audit_logs
       (user_id, branch_id, table_name, record_id, action, old_values, new_values)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [
        user.id,
        branchId,
        tableName,
        recordId,
        action,
        oldValues == null ? null : JSON.stringify(oldValues),
        newValues == null ? null : JSON.stringify(newValues),
      ],
    );
  }

  async listDepartments(branchId: string, user: AuthenticatedUser) {
    await this.assertBranch(this.db, branchId, user);
    const result = await this.db.query(
      `SELECT d.id, d.branch_id, d.parent_id, d.code, d.name_ar, d.name_en,
              d.manager_employee_id, d.max_simultaneous_break_percentage,
              d.is_active, d.created_at, d.updated_at
       FROM departments d
       JOIN branches b ON b.id = d.branch_id
       WHERE d.branch_id = $1 AND b.company_id = $2 AND d.deleted_at IS NULL
       ORDER BY d.name_ar ASC, d.code ASC`,
      [branchId, user.companyId],
    );
    return result.rows;
  }

  async createDepartment(
    branchId: string,
    dto: DepartmentDto,
    user: AuthenticatedUser,
  ) {
    return this.db
      .transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        if (dto.parentId)
          await this.assertDepartment(client, branchId, dto.parentId);
        if (dto.managerEmployeeId)
          await this.assertEmployee(client, branchId, dto.managerEmployeeId);
        const result = await client.query(
          `INSERT INTO departments
         (branch_id,parent_id,code,name_ar,name_en,manager_employee_id,max_simultaneous_break_percentage)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            branchId,
            dto.parentId ?? null,
            dto.code.trim(),
            dto.nameAr.trim(),
            dto.nameEn?.trim() ?? null,
            dto.managerEmployeeId ?? null,
            dto.maxSimultaneousBreakPercentage ?? 20,
          ],
        );
        const row = result.rows[0];
        await this.audit(
          client,
          user,
          branchId,
          "departments",
          row.id,
          "INSERT",
          null,
          row,
        );
        return row;
      })
      .catch((error) =>
        this.mapConflict(error, "رمز القسم مستخدم مسبقاً في هذا الفرع"),
      );
  }

  async updateDepartment(
    branchId: string,
    id: string,
    dto: Partial<DepartmentDto>,
    user: AuthenticatedUser,
  ) {
    return this.db
      .transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [branchId],
        );
        if (Object.keys(dto).length === 0)
          throw new BadRequestException("لم يتم إرسال أي تغييرات");
        const old = await this.getDepartmentForUpdate(client, branchId, id);
        const parentId =
          dto.parentId === undefined ? old.parent_id : dto.parentId;
        const managerId =
          dto.managerEmployeeId === undefined
            ? old.manager_employee_id
            : dto.managerEmployeeId;
        if (parentId) {
          if (parentId === id)
            throw new BadRequestException("لا يمكن جعل القسم تابعاً لنفسه");
          await this.assertDepartment(client, branchId, parentId);
          const cycle = await client.query(
            `WITH RECURSIVE ancestors AS (
             SELECT id, parent_id FROM departments WHERE id=$1 AND branch_id=$2
             UNION ALL
             SELECT d.id, d.parent_id FROM departments d
             JOIN ancestors a ON d.id=a.parent_id
             WHERE d.branch_id=$2
           )
           SELECT 1 FROM ancestors WHERE id=$3 LIMIT 1`,
            [parentId, branchId, id],
          );
          if (cycle.rowCount)
            throw new BadRequestException(
              "لا يمكن إنشاء تسلسل هرمي دائري للأقسام",
            );
        }
        if (managerId) await this.assertEmployee(client, branchId, managerId);
        const result = await client.query(
          `UPDATE departments SET
          parent_id=$3, code=$4, name_ar=$5, name_en=$6, manager_employee_id=$7,
          max_simultaneous_break_percentage=$8, updated_at=NOW()
         WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL RETURNING *`,
          [
            id,
            branchId,
            parentId,
            dto.code?.trim() ?? old.code,
            dto.nameAr?.trim() ?? old.name_ar,
            dto.nameEn === undefined
              ? old.name_en
              : (dto.nameEn?.trim() ?? null),
            managerId,
            dto.maxSimultaneousBreakPercentage ??
              old.max_simultaneous_break_percentage,
          ],
        );
        const row = result.rows[0];
        await this.audit(
          client,
          user,
          branchId,
          "departments",
          id,
          "UPDATE",
          old,
          row,
        );
        return row;
      })
      .catch((error) =>
        this.mapConflict(error, "رمز القسم مستخدم مسبقاً في هذا الفرع"),
      );
  }

  async listPositions(branchId: string, user: AuthenticatedUser) {
    await this.assertBranch(this.db as unknown as PoolClient, branchId, user);
    const result = await this.db.query(
      `SELECT p.*, d.name_ar AS department_name_ar
       FROM positions p JOIN departments d ON d.id=p.department_id
       JOIN branches b ON b.id=d.branch_id
       WHERE d.branch_id=$1 AND b.company_id=$2 AND p.deleted_at IS NULL AND d.deleted_at IS NULL
       ORDER BY p.title_ar ASC, p.code ASC`,
      [branchId, user.companyId],
    );
    return result.rows;
  }

  async createPosition(
    branchId: string,
    dto: PositionDto,
    user: AuthenticatedUser,
  ) {
    return this.db
      .transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        await this.assertDepartment(client, branchId, dto.departmentId);
        if (
          dto.basicSalaryMin != null &&
          dto.basicSalaryMax != null &&
          dto.basicSalaryMin > dto.basicSalaryMax
        )
          throw new BadRequestException(
            "الحد الأدنى للراتب لا يجوز أن يتجاوز الحد الأعلى",
          );
        const result = await client.query(
          `INSERT INTO positions
         (department_id,code,title_ar,title_en,job_level,basic_salary_min,basic_salary_max,description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [
            dto.departmentId,
            dto.code.trim(),
            dto.titleAr.trim(),
            dto.titleEn?.trim() ?? null,
            dto.jobLevel ?? null,
            dto.basicSalaryMin ?? null,
            dto.basicSalaryMax ?? null,
            dto.description ?? null,
          ],
        );
        const row = result.rows[0];
        await this.audit(
          client,
          user,
          branchId,
          "positions",
          row.id,
          "INSERT",
          null,
          row,
        );
        return row;
      })
      .catch((error) =>
        this.mapConflict(error, "رمز المسمى الوظيفي مستخدم مسبقاً"),
      );
  }

  async updatePosition(
    branchId: string,
    id: string,
    dto: Partial<PositionDto>,
    user: AuthenticatedUser,
  ) {
    return this.db
      .transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        const oldResult = await client.query(
          `SELECT p.* FROM positions p JOIN departments d ON d.id=p.department_id
         WHERE p.id=$1 AND d.branch_id=$2 AND p.deleted_at IS NULL FOR UPDATE OF p`,
          [id, branchId],
        );
        if (oldResult.rowCount !== 1)
          throw new NotFoundException("المسمى الوظيفي غير موجود");
        const old = oldResult.rows[0];
        const departmentId = dto.departmentId ?? old.department_id;
        await this.assertDepartment(client, branchId, departmentId);
        const min = dto.basicSalaryMin ?? old.basic_salary_min;
        const max = dto.basicSalaryMax ?? old.basic_salary_max;
        if (min != null && max != null && Number(min) > Number(max))
          throw new BadRequestException(
            "الحد الأدنى للراتب لا يجوز أن يتجاوز الحد الأعلى",
          );
        const result = await client.query(
          `UPDATE positions SET department_id=$3,code=$4,title_ar=$5,title_en=$6,job_level=$7,
         basic_salary_min=$8,basic_salary_max=$9,description=$10,updated_at=NOW()
         WHERE id=$1 AND EXISTS (SELECT 1 FROM departments d WHERE d.id=positions.department_id AND d.branch_id=$2) RETURNING *`,
          [
            id,
            branchId,
            departmentId,
            dto.code?.trim() ?? old.code,
            dto.titleAr?.trim() ?? old.title_ar,
            dto.titleEn === undefined
              ? old.title_en
              : (dto.titleEn?.trim() ?? null),
            dto.jobLevel ?? old.job_level,
            min,
            max,
            dto.description ?? old.description,
          ],
        );
        const row = result.rows[0];
        await this.audit(
          client,
          user,
          branchId,
          "positions",
          id,
          "UPDATE",
          old,
          row,
        );
        return row;
      })
      .catch((error) =>
        this.mapConflict(error, "رمز المسمى الوظيفي مستخدم مسبقاً"),
      );
  }

  async listEmployees(
    branchId: string,
    user: AuthenticatedUser,
    query: { page?: string; limit?: string; search?: string; status?: string },
  ) {
    await this.assertBranch(this.db as unknown as PoolClient, branchId, user);
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25),
    );
    const offset = (page - 1) * limit;
    const search = query.search?.trim() ?? "";
    const values = [
      branchId,
      user.companyId,
      search,
      query.status ?? null,
      limit,
      offset,
    ];
    const result = await this.db.query(
      `SELECT e.id,e.employee_code,e.first_name_ar,e.second_name_ar,e.third_name_ar,e.last_name_ar,
       e.full_name_en,e.mobile_phone,e.hire_date,e.status,e.department_id,e.position_id,
       d.name_ar AS department_name_ar,p.title_ar AS position_title_ar,e.created_at,e.updated_at
       FROM employees e JOIN branches b ON b.id=e.branch_id
       JOIN departments d ON d.id=e.department_id JOIN positions p ON p.id=e.position_id
       WHERE e.branch_id=$1 AND b.company_id=$2 AND e.deleted_at IS NULL
       AND ($3='' OR concat_ws(' ',e.first_name_ar,e.second_name_ar,e.third_name_ar,e.last_name_ar,e.employee_code,e.mobile_phone) ILIKE '%'||$3||'%')
       AND ($4::text IS NULL OR e.status::text=$4)
       ORDER BY e.employee_code ASC LIMIT $5 OFFSET $6`,
      values,
    );
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM employees e JOIN branches b ON b.id=e.branch_id
       WHERE e.branch_id=$1 AND b.company_id=$2 AND e.deleted_at IS NULL
       AND ($3='' OR concat_ws(' ',e.first_name_ar,e.second_name_ar,e.third_name_ar,e.last_name_ar,e.employee_code,e.mobile_phone) ILIKE '%'||$3||'%')
       AND ($4::text IS NULL OR e.status::text=$4)`,
      [branchId, user.companyId, search, query.status ?? null],
    );
    return {
      items: result.rows,
      pagination: {
        page,
        limit,
        total: count.rows[0].total,
        pages: Math.ceil(count.rows[0].total / limit),
      },
    };
  }

  async getEmployee(branchId: string, id: string, user: AuthenticatedUser) {
    const result = await this.db.query(
      `SELECT e.*,d.name_ar AS department_name_ar,p.title_ar AS position_title_ar
       FROM employees e JOIN branches b ON b.id=e.branch_id
       JOIN departments d ON d.id=e.department_id JOIN positions p ON p.id=e.position_id
       WHERE e.id=$1 AND e.branch_id=$2 AND b.company_id=$3 AND e.deleted_at IS NULL`,
      [id, branchId, user.companyId],
    );
    if (result.rowCount !== 1)
      throw new NotFoundException("ملف الموظف غير موجود في هذا الفرع");
    return result.rows[0];
  }

  async createEmployee(
    branchId: string,
    dto: EmployeeDto,
    user: AuthenticatedUser,
  ) {
    return this.db
      .transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        await this.assertDepartment(client, branchId, dto.departmentId);
        await this.assertPosition(
          client,
          branchId,
          dto.positionId,
          dto.departmentId,
        );
        if (dto.directManagerId)
          await this.assertEmployee(client, branchId, dto.directManagerId);
        const result = await client.query(
          `INSERT INTO employees
         (branch_id,department_id,position_id,direct_manager_id,first_name_ar,second_name_ar,third_name_ar,last_name_ar,
          full_name_en,national_id,passport_number,nationality,gender,date_of_birth,personal_email,mobile_phone,
          emergency_contact_name,emergency_contact_phone,emergency_contact_relation,marital_status,hire_date,
          probation_end_date,contract_end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         RETURNING *`,
          [
            branchId,
            dto.departmentId,
            dto.positionId,
            dto.directManagerId ?? null,
            dto.firstNameAr.trim(),
            dto.secondNameAr.trim(),
            dto.thirdNameAr?.trim() ?? null,
            dto.lastNameAr.trim(),
            dto.fullNameEn?.trim() ?? null,
            dto.nationalId ?? null,
            dto.passportNumber ?? null,
            dto.nationality ?? "الأردنية",
            dto.gender ?? null,
            dto.dateOfBirth ?? null,
            dto.personalEmail ?? null,
            dto.mobilePhone.trim(),
            dto.emergencyContactName ?? null,
            dto.emergencyContactPhone ?? null,
            dto.emergencyContactRelation ?? null,
            dto.maritalStatus ?? null,
            dto.hireDate,
            dto.probationEndDate ?? null,
            dto.contractEndDate ?? null,
          ],
        );
        const row = result.rows[0];
        await client.query(
          `INSERT INTO employee_history(employee_id,event_type,new_data,effective_date,action_by_user_id)
         VALUES($1,'hire',$2::jsonb,$3,$4)`,
          [row.id, JSON.stringify(row), dto.hireDate, user.id],
        );
        await this.audit(
          client,
          user,
          branchId,
          "employees",
          row.id,
          "INSERT",
          null,
          row,
        );
        return row;
      })
      .catch((error) =>
        this.mapConflict(error, "تعذر إنشاء الموظف بسبب تعارض في البيانات"),
      );
  }

  async updateEmployee(
    branchId: string,
    id: string,
    dto: EmployeeUpdateDto,
    user: AuthenticatedUser,
  ) {
    return this.db
      .transaction(async (client) => {
        await this.assertBranch(client, branchId, user);
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [branchId],
        );
        if (Object.keys(dto).length === 0)
          throw new BadRequestException("لم يتم إرسال أي تغييرات");
        const oldResult = await client.query(
          `SELECT * FROM employees WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL FOR UPDATE`,
          [id, branchId],
        );
        if (oldResult.rowCount !== 1)
          throw new NotFoundException("ملف الموظف غير موجود في هذا الفرع");
        const old = oldResult.rows[0];
        const departmentId = dto.departmentId ?? old.department_id;
        const positionId = dto.positionId ?? old.position_id;
        const managerId =
          dto.directManagerId === undefined
            ? old.direct_manager_id
            : dto.directManagerId;
        await this.assertDepartment(client, branchId, departmentId);
        await this.assertPosition(client, branchId, positionId, departmentId);
        if (managerId) {
          if (managerId === id)
            throw new BadRequestException(
              "لا يمكن تعيين الموظف مديراً مباشراً لنفسه",
            );
          await this.assertEmployee(client, branchId, managerId);
          const cycle = await client.query(
            `WITH RECURSIVE management_chain AS (
             SELECT id,direct_manager_id FROM employees WHERE id=$1 AND branch_id=$2
             UNION ALL
             SELECT e.id,e.direct_manager_id FROM employees e
             JOIN management_chain m ON e.id=m.direct_manager_id
             WHERE e.branch_id=$2
           )
           SELECT 1 FROM management_chain WHERE id=$3 LIMIT 1`,
            [managerId, branchId, id],
          );
          if (cycle.rowCount)
            throw new BadRequestException("لا يمكن إنشاء تسلسل إداري دائري");
        }
        const map: Record<string, string> = {
          firstNameAr: "first_name_ar",
          secondNameAr: "second_name_ar",
          thirdNameAr: "third_name_ar",
          lastNameAr: "last_name_ar",
          fullNameEn: "full_name_en",
          nationalId: "national_id",
          passportNumber: "passport_number",
          nationality: "nationality",
          gender: "gender",
          dateOfBirth: "date_of_birth",
          personalEmail: "personal_email",
          mobilePhone: "mobile_phone",
          emergencyContactName: "emergency_contact_name",
          emergencyContactPhone: "emergency_contact_phone",
          emergencyContactRelation: "emergency_contact_relation",
          maritalStatus: "marital_status",
          hireDate: "hire_date",
          probationEndDate: "probation_end_date",
          contractEndDate: "contract_end_date",
          status: "status",
        };
        const sets: string[] = [
          "department_id=$2",
          "position_id=$3",
          "direct_manager_id=$4",
          "updated_at=NOW()",
        ];
        const values: any[] = [id, departmentId, positionId, managerId];
        for (const [key, column] of Object.entries(map)) {
          if (Object.prototype.hasOwnProperty.call(dto, key)) {
            values.push((dto as any)[key] ?? null);
            sets.push(`${column}=$${values.length}`);
          }
        }
        const result = await client.query(
          `UPDATE employees SET ${sets.join(",")} WHERE id=$1 AND branch_id=$${values.length + 1} RETURNING *`,
          [...values, branchId],
        );
        const row = result.rows[0];
        await client.query(
          `INSERT INTO employee_history(employee_id,event_type,old_data,new_data,effective_date,reason,action_by_user_id)
         VALUES($1,'update',$2::jsonb,$3::jsonb,CURRENT_DATE,'تحديث الملف الوظيفي',$4)`,
          [id, JSON.stringify(old), JSON.stringify(row), user.id],
        );
        await this.audit(
          client,
          user,
          branchId,
          "employees",
          id,
          "UPDATE",
          old,
          row,
        );
        return row;
      })
      .catch((error) =>
        this.mapConflict(error, "تعذر تحديث ملف الموظف بسبب تعارض في البيانات"),
      );
  }

  async archiveEmployee(branchId: string, id: string, user: AuthenticatedUser) {
    return this.db.transaction(async (client) => {
      await this.assertBranch(client, branchId, user);
      const oldResult = await client.query(
        `SELECT * FROM employees WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL FOR UPDATE`,
        [id, branchId],
      );
      if (oldResult.rowCount !== 1)
        throw new NotFoundException("ملف الموظف غير موجود أو مؤرشف");
      const old = oldResult.rows[0];
      const result = await client.query(
        `UPDATE employees SET status='archived',deleted_at=NOW(),updated_at=NOW()
         WHERE id=$1 AND branch_id=$2 RETURNING *`,
        [id, branchId],
      );
      const row = result.rows[0];
      await client.query(
        `INSERT INTO employee_history(employee_id,event_type,old_data,new_data,effective_date,reason,action_by_user_id)
         VALUES($1,'archive',$2::jsonb,$3::jsonb,CURRENT_DATE,'أرشفة الملف الوظيفي',$4)`,
        [id, JSON.stringify(old), JSON.stringify(row), user.id],
      );
      await this.audit(
        client,
        user,
        branchId,
        "employees",
        id,
        "UPDATE",
        old,
        row,
      );
      return { id: row.id, status: row.status, archivedAt: row.deleted_at };
    });
  }

  private async assertDepartment(
    client: PoolClient,
    branchId: string,
    id: string,
  ) {
    const r = await client.query(
      "SELECT 1 FROM departments WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL AND is_active=TRUE",
      [id, branchId],
    );
    if (r.rowCount !== 1)
      throw new BadRequestException(
        "القسم المحدد غير تابع لهذا الفرع أو غير فعال",
      );
  }
  private async assertPosition(
    client: PoolClient,
    branchId: string,
    id: string,
    departmentId: string,
  ) {
    const r = await client.query(
      `SELECT 1 FROM positions p JOIN departments d ON d.id=p.department_id
       WHERE p.id=$1 AND p.department_id=$2 AND d.branch_id=$3 AND p.deleted_at IS NULL AND p.is_active=TRUE`,
      [id, departmentId, branchId],
    );
    if (r.rowCount !== 1)
      throw new BadRequestException(
        "المسمى الوظيفي لا يتبع القسم والفرع المحددين",
      );
  }
  private async assertEmployee(
    client: PoolClient,
    branchId: string,
    id: string,
  ) {
    const r = await client.query(
      "SELECT 1 FROM employees WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL",
      [id, branchId],
    );
    if (r.rowCount !== 1)
      throw new BadRequestException(
        "الموظف المرجعي غير تابع لهذا الفرع أو غير فعال",
      );
  }
  private async getDepartmentForUpdate(
    client: PoolClient,
    branchId: string,
    id: string,
  ) {
    const r = await client.query(
      "SELECT * FROM departments WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL FOR UPDATE",
      [id, branchId],
    );
    if (r.rowCount !== 1)
      throw new NotFoundException("القسم غير موجود في هذا الفرع");
    return r.rows[0];
  }
  private mapConflict(error: any, message: string): never {
    if (error?.code === "23505") throw new ConflictException(message);
    if (error?.code === "23503")
      throw new BadRequestException("لا يمكن إتمام العملية لوجود سجلات مرتبطة");
    throw error;
  }
}
