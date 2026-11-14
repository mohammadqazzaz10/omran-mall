import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  AssignUserRoleDto,
  CreateRoleDto,
  CreateBranchDto,
  CreateUserDto,
  UpdateBranchDto,
  UpdateRoleDto,
} from "./admin.dto";

const GLOBAL_ROLES = ["SUPER_ADMIN", "GENERAL_MANAGER", "HR_MANAGER"];
const ELEVATED_ROLES = [
  "SUPER_ADMIN",
  "GENERAL_MANAGER",
  "BRANCH_MANAGER",
  "HR_MANAGER",
  "SUPERVISOR",
];

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  private async isSuperAdmin(actor: AuthenticatedUser): Promise<boolean> {
    const result = await this.db.query(
      "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.company_id=$2 AND r.code='SUPER_ADMIN' AND r.is_active=TRUE AND ur.branch_id IS NULL AND ur.department_id IS NULL LIMIT 1",
      [actor.id, actor.companyId],
    );
    return result.rowCount === 1;
  }

  async listBranches(actor: AuthenticatedUser) {
    const result = await this.db.query(
      "SELECT id, code, name_ar, name_en, address, phone, email, is_active, created_at, updated_at FROM branches WHERE company_id=$1 AND deleted_at IS NULL ORDER BY code",
      [actor.companyId],
    );
    return result.rows;
  }

  async createBranch(dto: CreateBranchDto, actor: AuthenticatedUser) {
    try {
      return await this.db.transaction(async (client) => {
        const inserted = await client.query(
          "INSERT INTO branches(company_id,code,name_ar,name_en,address,phone,email) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,code,name_ar,name_en,address,phone,email,is_active,created_at",
          [
            actor.companyId,
            dto.code.trim().toUpperCase(),
            dto.nameAr.trim(),
            dto.nameEn?.trim() ?? null,
            dto.address?.trim() ?? null,
            dto.phone?.trim() ?? null,
            dto.email?.trim().toLowerCase() ?? null,
          ],
        );
        const branch = inserted.rows[0];
        await client.query(
          "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) SELECT ur.user_id,$1,$2,$3 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.company_id=$2 AND r.code=ANY($4::text[]) AND r.is_active=TRUE AND u.is_active=TRUE AND u.deleted_at IS NULL AND ur.branch_id IS NULL AND ur.department_id IS NULL ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING",
          [branch.id, actor.companyId, actor.id, GLOBAL_ROLES],
        );
        await client.query(
          "INSERT INTO user_roles(user_id,role_id,branch_id) SELECT ur.user_id,ur.role_id,$1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.company_id=$2 AND r.code=ANY($3::text[]) AND r.is_active=TRUE AND u.is_active=TRUE AND u.deleted_at IS NULL AND ur.branch_id IS NULL AND ur.department_id IS NULL ON CONFLICT DO NOTHING",
          [branch.id, actor.companyId, GLOBAL_ROLES],
        );
        await client.query(
          "INSERT INTO audit_logs(user_id,branch_id,table_name,record_id,action,new_values) VALUES($1,$2,'branches',$3,'INSERT',$4::jsonb)",
          [actor.id, branch.id, branch.id, JSON.stringify(branch)],
        );
        return branch;
      });
    } catch (error: any) {
      if (error?.code === "23505")
        throw new ConflictException("رمز الفرع مستخدم مسبقاً");
      throw error;
    }
  }

  async updateBranch(
    id: string,
    dto: UpdateBranchDto,
    actor: AuthenticatedUser,
  ) {
    if (Object.keys(dto).length === 0)
      throw new BadRequestException("لم يتم إرسال تغييرات");
    const old = await this.db.query(
      "SELECT * FROM branches WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL",
      [id, actor.companyId],
    );
    if (!old.rows[0]) throw new NotFoundException("الفرع غير موجود");
    return this.db.transaction(async (client) => {
      const updated = await client.query(
        "UPDATE branches SET name_ar=COALESCE($3,name_ar), name_en=CASE WHEN $4 THEN $5 ELSE name_en END, address=CASE WHEN $6 THEN $7 ELSE address END, phone=CASE WHEN $8 THEN $9 ELSE phone END, email=CASE WHEN $10 THEN $11 ELSE email END, is_active=COALESCE($12,is_active), updated_at=NOW() WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL RETURNING id,code,name_ar,name_en,address,phone,email,is_active,updated_at",
        [
          id,
          actor.companyId,
          dto.nameAr?.trim() ?? null,
          dto.nameEn !== undefined,
          dto.nameEn ?? null,
          dto.address !== undefined,
          dto.address ?? null,
          dto.phone !== undefined,
          dto.phone ?? null,
          dto.email !== undefined,
          dto.email?.trim().toLowerCase() ?? null,
          dto.isActive ?? null,
        ],
      );
      await client.query(
        "INSERT INTO audit_logs(user_id,branch_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,'branches',$3,'UPDATE',$4::jsonb,$5::jsonb)",
        [
          actor.id,
          id,
          id,
          JSON.stringify(old.rows[0]),
          JSON.stringify(updated.rows[0]),
        ],
      );
      if (dto.isActive === false) {
        await client.query(
          "UPDATE user_branch_memberships SET revoked_at=COALESCE(revoked_at,NOW()) WHERE branch_id=$1 AND revoked_at IS NULL",
          [id],
        );
      } else if (dto.isActive === true) {
        await client.query(
          "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) SELECT DISTINCT ur.user_id,$1,$2,$3 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE ur.branch_id=$1 AND r.company_id=$2 AND r.is_active=TRUE AND u.is_active=TRUE AND u.deleted_at IS NULL ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING",
          [id, actor.companyId, actor.id],
        );
        await client.query(
          "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) SELECT ur.user_id,$1,$2,$3 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.company_id=$2 AND r.code=ANY($4::text[]) AND r.is_active=TRUE AND u.is_active=TRUE AND u.deleted_at IS NULL AND ur.branch_id IS NULL AND ur.department_id IS NULL ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING",
          [id, actor.companyId, actor.id, GLOBAL_ROLES],
        );
        await client.query(
          "INSERT INTO user_roles(user_id,role_id,branch_id) SELECT ur.user_id,ur.role_id,$1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.company_id=$2 AND r.code=ANY($3::text[]) AND r.is_active=TRUE AND u.is_active=TRUE AND u.deleted_at IS NULL AND ur.branch_id IS NULL AND ur.department_id IS NULL ON CONFLICT DO NOTHING",
          [id, actor.companyId, GLOBAL_ROLES],
        );
      }
      return updated.rows[0];
    });
  }

  async listRoles(actor: AuthenticatedUser) {
    const result = await this.db.query(
      "SELECT r.id,r.code,r.name_ar,r.name_en,r.description,r.is_system_role,r.is_active,COUNT(DISTINCT rp.permission_id)::int AS permissions_count,COALESCE(jsonb_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL),'[]'::jsonb) AS permission_codes FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE r.company_id=$1 GROUP BY r.id ORDER BY r.is_system_role DESC,r.code",
      [actor.companyId],
    );
    return result.rows;
  }

  private async assertRoleAdministrator(actor: AuthenticatedUser) {
    if (!(await this.isSuperAdmin(actor))) {
      throw new ForbiddenException("إدارة الأدوار المخصصة متاحة لمدير النظام الأعلى فقط");
    }
  }

  private async validateCustomRolePermissions(client: any, codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length !== codes.length) {
      throw new BadRequestException("لا تكرر الصلاحية نفسها");
    }
    if (uniqueCodes.length === 0) return [];
    const result = await client.query(
      "SELECT id,code,scope FROM permissions WHERE code=ANY($1::text[])",
      [uniqueCodes],
    );
    if (result.rows.length !== uniqueCodes.length) {
      throw new BadRequestException("تتضمن القائمة صلاحية غير موجودة");
    }
    const scopes = new Set(result.rows.map((permission: any) => permission.scope));
    if (scopes.size > 1) {
      throw new BadRequestException("يجب أن تكون صلاحيات الدور المخصص ضمن نطاق واحد متجانس");
    }
    const blocked = result.rows.filter((permission: any) =>
      !["branch", "department", "own"].includes(permission.scope) ||
      ["companies", "users", "roles", "sessions"].includes(permission.code.split(".")[0]) ||
      ["branches.manage.company", "employees.transfer.company"].includes(permission.code),
    );
    if (blocked.length) {
      throw new ForbiddenException("لا يمكن إسناد صلاحيات إدارية على مستوى الشركة أو إدارة الهوية إلى دور مخصص");
    }
    return result.rows;
  }

  async createRole(dto: CreateRoleDto, actor: AuthenticatedUser) {
    await this.assertRoleAdministrator(actor);
    const code = dto.code.trim().toUpperCase();
    try {
      return await this.db.transaction(async (client) => {
        const permissions = await this.validateCustomRolePermissions(client, dto.permissionCodes);
        const inserted = await client.query(
          "INSERT INTO roles(company_id,code,name_ar,name_en,description,is_system_role) VALUES($1,$2,$3,$4,$5,FALSE) RETURNING id,code,name_ar,name_en,description,is_system_role,is_active",
          [actor.companyId, code, dto.nameAr.trim(), dto.nameEn?.trim() || null, dto.description?.trim() || null],
        );
        const role = inserted.rows[0];
        for (const permission of permissions) {
          await client.query(
            "INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)",
            [role.id, permission.id],
          );
        }
        await client.query(
          "INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'roles',$2,'INSERT',$3::jsonb)",
          [actor.id, role.id, JSON.stringify({ code, permissionCodes: permissions.map((item: any) => item.code) })],
        );
        return { ...role, permission_codes: permissions.map((item: any) => item.code) };
      });
    } catch (error: any) {
      if (error?.code === "23505") throw new ConflictException("رمز الدور مستخدم مسبقاً في الشركة");
      throw error;
    }
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    await this.assertRoleAdministrator(actor);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("لم يتم إرسال أي تعديل");
    }
    return this.db.transaction(async (client) => {
      const current = await client.query(
        "SELECT id,code,name_ar,name_en,description,is_system_role FROM roles WHERE id=$1 AND company_id=$2 FOR UPDATE",
        [roleId, actor.companyId],
      );
      if (!current.rows[0]) throw new NotFoundException("الدور غير موجود");
      if (current.rows[0].is_system_role || !String(current.rows[0].code).startsWith("CUSTOM_")) {
        throw new ForbiddenException("لا يمكن تعديل الأدوار الأساسية المحمية");
      }
      let permissions: any[] | undefined;
      if (dto.permissionCodes !== undefined) {
        permissions = await this.validateCustomRolePermissions(client, dto.permissionCodes);
        await client.query("DELETE FROM role_permissions WHERE role_id=$1", [roleId]);
        for (const permission of permissions) {
          await client.query(
            "INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)",
            [roleId, permission.id],
          );
        }
      }
      const updated = await client.query(
        "UPDATE roles SET name_ar=COALESCE($3,name_ar),name_en=CASE WHEN $4 THEN $5 ELSE name_en END,description=CASE WHEN $6 THEN $7 ELSE description END,updated_at=NOW() WHERE id=$1 AND company_id=$2 RETURNING id,code,name_ar,name_en,description,is_system_role,is_active",
        [roleId, actor.companyId, dto.nameAr?.trim() ?? null, dto.nameEn !== undefined, dto.nameEn?.trim() ?? null, dto.description !== undefined, dto.description?.trim() ?? null],
      );
      await client.query(
        "INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,'roles',$2,'UPDATE',$3::jsonb,$4::jsonb)",
        [actor.id, roleId, JSON.stringify(current.rows[0]), JSON.stringify({ ...updated.rows[0], permissionCodes: permissions?.map((item) => item.code) })],
      );
      return { ...updated.rows[0], ...(permissions ? { permission_codes: permissions.map((item) => item.code) } : {}) };
    });
  }

  async listPermissions() {
    const result = await this.db.query(
      "SELECT id,module,action,scope,code,description_ar FROM permissions ORDER BY module,scope,action",
    );
    return result.rows;
  }

  async listUsers(
    actor: AuthenticatedUser,
    query: { search?: string; active?: string; page?: string; limit?: string },
  ) {
    const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 25));
    const search = query.search?.trim() || null;
    const active = query.active === undefined ? null : query.active === "true";
    const result = await this.db.query(
      "SELECT u.id,u.username,u.email,u.phone,u.primary_branch_id,u.is_active,u.must_change_password,u.last_login_at,u.created_at,COALESCE(jsonb_agg(DISTINCT jsonb_build_object('code',r.code,'nameAr',r.name_ar,'branchId',ur.branch_id,'departmentId',ur.department_id)) FILTER(WHERE r.id IS NOT NULL),'[]'::jsonb) AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id AND r.company_id=u.company_id WHERE u.company_id=$1 AND u.deleted_at IS NULL AND ($2::text IS NULL OR u.username ILIKE '%'||$2||'%' OR COALESCE(u.email,'') ILIKE '%'||$2||'%' OR COALESCE(u.phone,'') ILIKE '%'||$2||'%') AND ($3::boolean IS NULL OR u.is_active=$3) GROUP BY u.id ORDER BY u.created_at DESC LIMIT $4 OFFSET $5",
      [actor.companyId, search, active, limit, (page - 1) * limit],
    );
    const count = await this.db.query(
      "SELECT COUNT(*)::int AS total FROM users WHERE company_id=$1 AND deleted_at IS NULL AND ($2::text IS NULL OR username ILIKE '%'||$2||'%' OR COALESCE(email,'') ILIKE '%'||$2||'%' OR COALESCE(phone,'') ILIKE '%'||$2||'%') AND ($3::boolean IS NULL OR is_active=$3)",
      [actor.companyId, search, active],
    );
    return { items: result.rows, page, limit, total: count.rows[0].total };
  }

  async createUser(dto: CreateUserDto, actor: AuthenticatedUser) {
    const superAdmin = await this.isSuperAdmin(actor);
    if (ELEVATED_ROLES.includes(dto.roleCode) && !superAdmin)
      throw new ForbiddenException(
        "إسناد الأدوار الإدارية العليا يتطلب مدير النظام الأعلى",
      );
    if (!GLOBAL_ROLES.includes(dto.roleCode) && !dto.branchIds?.length)
      throw new BadRequestException("يجب تحديد فرع واحد على الأقل");
    if (
      dto.primaryBranchId &&
      !GLOBAL_ROLES.includes(dto.roleCode) &&
      !dto.branchIds?.includes(dto.primaryBranchId)
    )
      throw new BadRequestException(
        "الفرع الأساسي يجب أن يكون ضمن فروع العضوية",
      );
    if (dto.roleCode === "SUPERVISOR" && !dto.departmentId)
      throw new BadRequestException("يجب تحديد القسم لمشرف القسم");
    if (["EMPLOYEE", "CASHIER"].includes(dto.roleCode) && !dto.employeeId)
      throw new BadRequestException("يجب ربط حساب الموظف بملفه الوظيفي");
    if (new Set(dto.branchIds ?? []).size !== (dto.branchIds ?? []).length)
      throw new BadRequestException("لا تكرر الفرع نفسه في قائمة العضويات");
    const temporaryPassword = randomBytes(24).toString("base64url") + "A1!";
    const passwordHash = await hash(temporaryPassword, 12);
    try {
      return await this.db.transaction(async (client) => {
        if (dto.primaryBranchId) {
          const primary = await client.query(
            "SELECT id FROM branches WHERE id=$1 AND company_id=$2 AND is_active=TRUE AND deleted_at IS NULL",
            [dto.primaryBranchId, actor.companyId],
          );
          if (!primary.rows[0])
            throw new BadRequestException(
              "الفرع الأساسي غير تابع للشركة أو غير فعال",
            );
        }
        const role = await client.query(
          "SELECT id FROM roles WHERE company_id=$1 AND code=$2 AND is_active=TRUE",
          [actor.companyId, dto.roleCode],
        );
        if (!role.rows[0])
          throw new BadRequestException("الدور المحدد غير موجود في الشركة");
        const inserted = await client.query(
          "INSERT INTO users(company_id,username,email,phone,password_hash,primary_branch_id,must_change_password) VALUES($1,$2,$3,$4,$5,$6,TRUE) RETURNING id,username,email,phone,primary_branch_id,is_active,must_change_password,created_at",
          [
            actor.companyId,
            dto.username.trim().toLowerCase(),
            dto.email?.trim().toLowerCase() ?? null,
            dto.phone?.trim() ?? null,
            passwordHash,
            dto.primaryBranchId ?? null,
          ],
        );
        const user = inserted.rows[0];
        if (dto.employeeId) {
          const linked = GLOBAL_ROLES.includes(dto.roleCode)
            ? await client.query(
                "UPDATE employees e SET user_id=$1,updated_at=NOW() FROM branches b WHERE e.id=$2 AND e.branch_id=b.id AND b.company_id=$3 AND b.is_active=TRUE AND e.user_id IS NULL AND e.deleted_at IS NULL",
                [user.id, dto.employeeId, actor.companyId],
              )
            : await client.query(
                "UPDATE employees SET user_id=$1,updated_at=NOW() WHERE id=$2 AND branch_id=ANY($3::uuid[]) AND user_id IS NULL AND deleted_at IS NULL",
                [user.id, dto.employeeId, dto.branchIds ?? []],
              );
          if (linked.rowCount !== 1)
            throw new BadRequestException(
              "ملف الموظف غير متاح أو لا ينتمي للفروع المحددة",
            );
        }
        if (GLOBAL_ROLES.includes(dto.roleCode)) {
          await client.query(
            "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)",
            [user.id, role.rows[0].id],
          );
          const branches = await client.query(
            "SELECT id FROM branches WHERE company_id=$1 AND is_active=TRUE AND deleted_at IS NULL ORDER BY id",
            [actor.companyId],
          );
          for (const b of branches.rows) {
            await client.query(
              "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4)",
              [user.id, b.id, actor.companyId, actor.id],
            );
            await client.query(
              "INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
              [user.id, role.rows[0].id, b.id],
            );
          }
        } else {
          for (const branchId of dto.branchIds ?? []) {
            const valid = await client.query(
              "SELECT id FROM branches WHERE id=$1 AND company_id=$2 AND is_active=TRUE AND deleted_at IS NULL",
              [branchId, actor.companyId],
            );
            if (!valid.rows[0])
              throw new BadRequestException(
                "أحد الفروع المحددة غير تابع للشركة أو غير فعال",
              );
            await client.query(
              "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4)",
              [user.id, branchId, actor.companyId, actor.id],
            );
            if (dto.roleCode === "SUPERVISOR") {
              const dep = await client.query(
                "SELECT id FROM departments WHERE id=$1 AND branch_id=$2 AND is_active=TRUE AND deleted_at IS NULL",
                [dto.departmentId, branchId],
              );
              if (!dep.rows[0])
                throw new BadRequestException(
                  "قسم المشرف غير تابع للفرع المحدد",
                );
              await client.query(
                "INSERT INTO user_roles(user_id,role_id,branch_id,department_id) VALUES($1,$2,$3,$4)",
                [user.id, role.rows[0].id, branchId, dto.departmentId],
              );
            } else {
              await client.query(
                "INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3)",
                [user.id, role.rows[0].id, branchId],
              );
            }
          }
        }
        await client.query(
          "INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'users',$2,'INSERT',$3::jsonb)",
          [
            actor.id,
            user.id,
            JSON.stringify({
              id: user.id,
              username: user.username,
              roleCode: dto.roleCode,
            }),
          ],
        );
        return { user, temporaryPassword };
      });
    } catch (error: any) {
      if (error?.code === "23505")
        throw new ConflictException(
          "اسم المستخدم أو البريد أو الهاتف مستخدم مسبقاً",
        );
      throw error;
    }
  }

  async assignRole(
    userId: string,
    dto: AssignUserRoleDto,
    actor: AuthenticatedUser,
  ) {
    const superAdmin = await this.isSuperAdmin(actor);
    if (ELEVATED_ROLES.includes(dto.roleCode) && !superAdmin)
      throw new ForbiddenException(
        "إسناد الأدوار الإدارية يتطلب مدير النظام الأعلى",
      );
    return this.db.transaction(async (client) => {
      const target = await client.query(
        "SELECT id FROM users WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [userId, actor.companyId],
      );
      if (!target.rows[0])
        throw new NotFoundException("حساب المستخدم غير موجود");
      const role = await client.query(
        "SELECT id,is_system_role FROM roles WHERE company_id=$1 AND code=$2 AND is_active=TRUE",
        [actor.companyId, dto.roleCode],
      );
      if (!role.rows[0]) throw new BadRequestException("الدور غير موجود");
      let customRoleRequiresDepartment = false;
      if (dto.roleCode.startsWith("CUSTOM_")) {
        if (role.rows[0].is_system_role) {
          throw new ForbiddenException("رمز الدور المخصص غير صالح");
        }
        const customPermissions = await client.query(
          "SELECT p.scope FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=$1",
          [role.rows[0].id],
        );
        customRoleRequiresDepartment = customPermissions.rows.some((item: any) => item.scope === "department");
        if (customRoleRequiresDepartment && !dto.departmentId) {
          throw new BadRequestException("هذا الدور يتطلب تحديد القسم");
        }
        if (!customRoleRequiresDepartment && dto.departmentId) {
          throw new BadRequestException("هذا الدور لا يقبل تقييداً بقسم");
        }
      }
      if (GLOBAL_ROLES.includes(dto.roleCode)) {
        if (!superAdmin)
          throw new ForbiddenException("هذا الدور يتطلب مدير النظام الأعلى");
        await client.query(
          "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [userId, role.rows[0].id],
        );
        const branches = await client.query(
          "SELECT id FROM branches WHERE company_id=$1 AND is_active=TRUE AND deleted_at IS NULL",
          [actor.companyId],
        );
        for (const b of branches.rows) {
          await client.query(
            "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING",
            [userId, b.id, actor.companyId, actor.id],
          );
          await client.query(
            "INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [userId, role.rows[0].id, b.id],
          );
        }
      } else {
        if (!dto.branchIds?.length)
          throw new BadRequestException("حدد فرعاً واحداً على الأقل");
        for (const branchId of dto.branchIds) {
          const valid = await client.query(
            "SELECT id FROM branches WHERE id=$1 AND company_id=$2 AND is_active=TRUE AND deleted_at IS NULL",
            [branchId, actor.companyId],
          );
          if (!valid.rows[0])
            throw new BadRequestException("الفرع المحدد غير تابع للشركة");
          await client.query(
            "INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING",
            [userId, branchId, actor.companyId, actor.id],
          );
          if (dto.roleCode === "SUPERVISOR" || customRoleRequiresDepartment) {
            if (!dto.departmentId)
              throw new BadRequestException("حدد القسم لهذا الدور");
            const dep = await client.query(
              "SELECT id FROM departments WHERE id=$1 AND branch_id=$2 AND is_active=TRUE AND deleted_at IS NULL",
              [dto.departmentId, branchId],
            );
            if (!dep.rows[0])
              throw new BadRequestException("القسم لا يتبع الفرع");
            await client.query(
              "INSERT INTO user_roles(user_id,role_id,branch_id,department_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
              [userId, role.rows[0].id, branchId, dto.departmentId],
            );
          } else {
            await client.query(
              "INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
              [userId, role.rows[0].id, branchId],
            );
          }
        }
      }
      await client.query(
        "INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'user_roles',$2,'INSERT',$3::jsonb)",
        [
          actor.id,
          userId,
          JSON.stringify({
            roleCode: dto.roleCode,
            branchIds: dto.branchIds ?? [],
          }),
        ],
      );
      return { success: true };
    });
  }

  async updateUserStatus(
    userId: string,
    isActive: boolean,
    actor: AuthenticatedUser,
  ) {
    if (userId === actor.id && !isActive)
      throw new BadRequestException("لا يمكنك تعطيل حسابك بنفسك");
    const actorIsSuperAdmin = await this.isSuperAdmin(actor);
    return this.db.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [actor.companyId],
      );
      const target = await client.query(
        "SELECT id FROM users WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [userId, actor.companyId],
      );
      if (!target.rows[0])
        throw new NotFoundException("حساب المستخدم غير موجود");
      const targetIsSuperAdmin = await client.query(
        "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.company_id=$2 AND r.code='SUPER_ADMIN' AND ur.branch_id IS NULL AND ur.department_id IS NULL LIMIT 1",
        [userId, actor.companyId],
      );
      if (targetIsSuperAdmin.rowCount === 1 && !actorIsSuperAdmin) {
        throw new ForbiddenException(
          "لا يمكن إلا لمدير النظام الأعلى إدارة حساب مدير نظام أعلى آخر",
        );
      }
      if (targetIsSuperAdmin.rowCount === 1 && !isActive) {
        const count = await client.query(
          "SELECT COUNT(DISTINCT u.id)::int AS total FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.company_id=$1 AND u.is_active=TRUE AND u.deleted_at IS NULL AND r.code='SUPER_ADMIN' AND r.is_active=TRUE AND ur.branch_id IS NULL AND ur.department_id IS NULL",
          [actor.companyId],
        );
        if (count.rows[0].total <= 1)
          throw new BadRequestException(
            "لا يمكن تعطيل آخر مدير نظام أعلى نشط في الشركة",
          );
      }
      const updated = await client.query(
        "UPDATE users SET is_active=$3,updated_at=NOW() WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL RETURNING id,username,is_active",
        [userId, actor.companyId, isActive],
      );
      if (!isActive)
        await client.query(
          "UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoke_reason=COALESCE(revoke_reason,'user_deactivated') WHERE user_id=$1 AND revoked_at IS NULL",
          [userId],
        );
      await client.query(
        "INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'users',$2,'UPDATE',$3::jsonb)",
        [actor.id, userId, JSON.stringify({ isActive })],
      );
      return updated.rows[0];
    });
  }
}
