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
  EmployeeContractCreateDto,
  EmployeeDocumentCreateDto,
  EmployeeProfileUpsertDto,
} from "./employee-records.dto";

@Injectable()
export class EmployeeRecordsService {
  constructor(private readonly db: DatabaseService) {}

  private async assertEmployee(
    client: PoolClient,
    branchId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ) {
    const result = await client.query(
      `SELECT e.id, e.employee_code
       FROM employees e
       JOIN branches b ON b.id=e.branch_id
       WHERE e.id=$1 AND e.branch_id=$2 AND b.company_id=$3
         AND e.deleted_at IS NULL AND b.deleted_at IS NULL
       FOR UPDATE OF e`,
      [employeeId, branchId, user.companyId],
    );
    if (result.rowCount !== 1) {
      throw new NotFoundException("ملف الموظف غير موجود في هذا الفرع");
    }
    return result.rows[0];
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

  private objectKey(
    key: string | null | undefined,
    user: AuthenticatedUser,
    branchId: string,
    employeeId: string,
  ) {
    if (!key) return null;
    const prefix = `companies/${user.companyId}/branches/${branchId}/employees/${employeeId}/`;
    if (
      !key.startsWith(prefix) ||
      key.includes("..") ||
      key.includes("\\") ||
      key.includes("?") ||
      key.includes("#") ||
      key.length > 1024
    ) {
      throw new BadRequestException(
        "مفتاح الملف يجب أن يكون ضمن مساحة الموظف الخاصة بالشركة والفرع",
      );
    }
    return key;
  }

  async getProfile(
    branchId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertEmployee(this.db as unknown as PoolClient, branchId, employeeId, user);
    const result = await this.db.query(
      `SELECT employee_id, bank_name, bank_iban, social_security_number,
              tax_identification_number, education_level, specialization,
              graduation_year, address_city, address_area, address_street,
              notes, created_at, updated_at
       FROM employee_profiles WHERE employee_id=$1`,
      [employeeId],
    );
    return result.rows[0] ?? {
      employee_id: employeeId,
      bank_name: null,
      bank_iban: null,
      social_security_number: null,
      tax_identification_number: null,
      education_level: null,
      specialization: null,
      graduation_year: null,
      address_city: "Amman",
      address_area: null,
      address_street: null,
      notes: null,
    };
  }

  async upsertProfile(
    branchId: string,
    employeeId: string,
    dto: EmployeeProfileUpsertDto,
    user: AuthenticatedUser,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("لم يتم إرسال أي تغييرات");
    }
    return this.db.transaction(async (client) => {
      await this.assertEmployee(client, branchId, employeeId, user);
      const oldResult = await client.query(
        "SELECT * FROM employee_profiles WHERE employee_id=$1 FOR UPDATE",
        [employeeId],
      );
      const old = oldResult.rows[0] ?? {};
      const fields: Record<string, string> = {
        bankName: "bank_name",
        bankIban: "bank_iban",
        socialSecurityNumber: "social_security_number",
        taxIdentificationNumber: "tax_identification_number",
        educationLevel: "education_level",
        specialization: "specialization",
        graduationYear: "graduation_year",
        addressCity: "address_city",
        addressArea: "address_area",
        addressStreet: "address_street",
        notes: "notes",
      };
      const merged: Record<string, unknown> = {};
      for (const [key, column] of Object.entries(fields)) {
        merged[column] = Object.prototype.hasOwnProperty.call(dto, key)
          ? (dto as any)[key]
          : (old[column] ?? (column === "address_city" ? "Amman" : null));
      }
      const result = await client.query(
        `INSERT INTO employee_profiles
         (employee_id,bank_name,bank_iban,social_security_number,
          tax_identification_number,education_level,specialization,graduation_year,
          address_city,address_area,address_street,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (employee_id) DO UPDATE SET
          bank_name=EXCLUDED.bank_name,
          bank_iban=EXCLUDED.bank_iban,
          social_security_number=EXCLUDED.social_security_number,
          tax_identification_number=EXCLUDED.tax_identification_number,
          education_level=EXCLUDED.education_level,
          specialization=EXCLUDED.specialization,
          graduation_year=EXCLUDED.graduation_year,
          address_city=EXCLUDED.address_city,
          address_area=EXCLUDED.address_area,
          address_street=EXCLUDED.address_street,
          notes=EXCLUDED.notes,
          updated_at=CURRENT_TIMESTAMP
         RETURNING *`,
        [
          employeeId,
          merged.bank_name,
          merged.bank_iban,
          merged.social_security_number,
          merged.tax_identification_number,
          merged.education_level,
          merged.specialization,
          merged.graduation_year,
          merged.address_city,
          merged.address_area,
          merged.address_street,
          merged.notes,
        ],
      );
      const maskIban = (value: unknown) =>
        typeof value === "string" && value.length > 4
          ? `••••${value.slice(-4)}`
          : value == null ? null : "••••";
      const safe = (value: Record<string, any>) => ({
        ...value,
        bank_iban: maskIban(value.bank_iban),
        social_security_number: value.social_security_number ? "••••" : null,
        tax_identification_number: value.tax_identification_number ? "••••" : null,
      });
      await this.audit(
        client,
        user,
        branchId,
        "employee_profiles",
        employeeId,
        oldResult.rowCount ? "UPDATE" : "INSERT",
        oldResult.rowCount ? safe(old) : null,
        safe(result.rows[0]),
      );
      return result.rows[0];
    });
  }

  async listDocuments(
    branchId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertEmployee(this.db as unknown as PoolClient, branchId, employeeId, user);
    const result = await this.db.query(
      `SELECT id, employee_id, branch_id, document_type, title,
              file_size_bytes, mime_type, issue_date, expiry_date,
              alert_before_days, created_at, updated_at
       FROM employee_documents
       WHERE employee_id=$1 AND branch_id=$2 AND deleted_at IS NULL
       ORDER BY expiry_date ASC NULLS LAST, created_at DESC`,
      [employeeId, branchId],
    );
    return result.rows;
  }

  async createDocument(
    branchId: string,
    employeeId: string,
    dto: EmployeeDocumentCreateDto,
    user: AuthenticatedUser,
  ) {
    if (dto.issueDate && dto.expiryDate && dto.expiryDate < dto.issueDate) {
      throw new BadRequestException("تاريخ انتهاء الوثيقة لا يسبق تاريخ إصدارها");
    }
    if (
      dto.mimeType &&
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(dto.mimeType)
    ) {
      throw new BadRequestException("نوع الملف غير مسموح؛ الأنواع المقبولة PDF وJPEG وPNG وWebP");
    }
    const storageKey = this.objectKey(dto.storageKey, user, branchId, employeeId);
    return this.db.transaction(async (client) => {
      await this.assertEmployee(client, branchId, employeeId, user);
      const result = await client.query(
        `INSERT INTO employee_documents
         (employee_id,branch_id,document_type,title,file_url,file_size_bytes,
          mime_type,issue_date,expiry_date,alert_before_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, employee_id, branch_id, document_type, title,
                   file_size_bytes, mime_type, issue_date, expiry_date,
                   alert_before_days, created_at`,
        [
          employeeId, branchId, dto.documentType.trim(), dto.title.trim(),
          storageKey, dto.fileSizeBytes ?? null, dto.mimeType ?? null,
          dto.issueDate ?? null, dto.expiryDate ?? null, dto.alertBeforeDays ?? 30,
        ],
      );
      await this.audit(client, user, branchId, "employee_documents", result.rows[0].id, "INSERT", null, result.rows[0]);
      return result.rows[0];
    });
  }

  async archiveDocument(
    branchId: string,
    employeeId: string,
    documentId: string,
    user: AuthenticatedUser,
  ) {
    return this.db.transaction(async (client) => {
      await this.assertEmployee(client, branchId, employeeId, user);
      const oldResult = await client.query(
        `SELECT id, employee_id, branch_id, document_type, title, expiry_date
         FROM employee_documents
         WHERE id=$1 AND employee_id=$2 AND branch_id=$3 AND deleted_at IS NULL
         FOR UPDATE`,
        [documentId, employeeId, branchId],
      );
      if (oldResult.rowCount !== 1) {
        throw new NotFoundException("الوثيقة غير موجودة أو مؤرشفة");
      }
      const result = await client.query(
        `UPDATE employee_documents SET deleted_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,deleted_at`,
        [documentId],
      );
      await this.audit(client, user, branchId, "employee_documents", documentId, "UPDATE", oldResult.rows[0], result.rows[0]);
      return result.rows[0];
    });
  }

  async listContracts(
    branchId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertEmployee(this.db as unknown as PoolClient, branchId, employeeId, user);
    const result = await this.db.query(
      `SELECT id, employee_id, branch_id, contract_type, start_date, end_date,
              basic_salary, working_hours_per_day, working_days_per_week,
              has_social_security, has_health_insurance, is_current,
              created_at, updated_at
       FROM employee_contracts
       WHERE employee_id=$1 AND branch_id=$2
       ORDER BY start_date DESC, created_at DESC`,
      [employeeId, branchId],
    );
    return result.rows;
  }

  async createContract(
    branchId: string,
    employeeId: string,
    dto: EmployeeContractCreateDto,
    user: AuthenticatedUser,
  ) {
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException("تاريخ نهاية العقد يجب ألا يسبق تاريخ بدايته");
    }
    const documentKey = this.objectKey(dto.documentStorageKey, user, branchId, employeeId);
    return this.db.transaction(async (client) => {
      await this.assertEmployee(client, branchId, employeeId, user);
      const current = await client.query(
        `SELECT id FROM employee_contracts
         WHERE employee_id=$1 AND branch_id=$2 AND is_current=TRUE
         FOR UPDATE`,
        [employeeId, branchId],
      );
      if (current.rowCount) {
        throw new ConflictException("يوجد عقد حالي للموظف؛ يجب إنهاؤه أو إغلاقه بإجراء مستقل قبل إضافة عقد حالي جديد");
      }
      const result = await client.query(
        `INSERT INTO employee_contracts
         (employee_id,branch_id,contract_type,start_date,end_date,basic_salary,
          working_hours_per_day,working_days_per_week,has_social_security,
          has_health_insurance,document_url,is_current)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)
         RETURNING id, employee_id, branch_id, contract_type, start_date, end_date,
                   basic_salary, working_hours_per_day, working_days_per_week,
                   has_social_security, has_health_insurance, is_current, created_at`,
        [
          employeeId, branchId, dto.contractType, dto.startDate, dto.endDate ?? null,
          dto.basicSalary, dto.workingHoursPerDay ?? 8, dto.workingDaysPerWeek ?? 6,
          dto.hasSocialSecurity ?? true, dto.hasHealthInsurance ?? true, documentKey,
        ],
      );
      await client.query(
        `INSERT INTO employee_history
         (employee_id,event_type,new_data,effective_date,reason,action_by_user_id)
         VALUES ($1,'contract_created',$2::jsonb,$3,'إنشاء عقد وظيفي',$4)`,
        [employeeId, JSON.stringify(result.rows[0]), dto.startDate, user.id],
      );
      await this.audit(client, user, branchId, "employee_contracts", result.rows[0].id, "INSERT", null, result.rows[0]);
      return result.rows[0];
    });
  }

  async listHistory(
    branchId: string,
    employeeId: string,
    user: AuthenticatedUser,
    page = 1,
    limit = 25,
  ) {
    await this.assertEmployee(this.db as unknown as PoolClient, branchId, employeeId, user);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const result = await this.db.query(
      `SELECT h.id,h.event_type,h.old_data,h.new_data,h.effective_date,
              h.reason,h.action_by_user_id,h.created_at
       FROM employee_history h
       WHERE h.employee_id=$1
       ORDER BY h.effective_date DESC,h.created_at DESC
       LIMIT $2 OFFSET $3`,
      [employeeId, safeLimit, offset],
    );
    const count = await this.db.query(
      "SELECT COUNT(*)::int AS total FROM employee_history WHERE employee_id=$1",
      [employeeId],
    );
    return {
      items: result.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count.rows[0].total,
        pages: Math.ceil(count.rows[0].total / safeLimit),
      },
    };
  }
}
