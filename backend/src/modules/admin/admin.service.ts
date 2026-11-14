import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from "@nestjs/common";
import { hash, randomBytes } from "bcrypt";
import { DatabaseService } from "../../database/database.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { AssignUserRoleDto, CreateBranchDto, CreateUserDto, UpdateBranchDto } from "./admin.dto";

const GLOBAL_ROLES = ["SUPER_ADMIN", "GENERAL_MANAGER", "HR_MANAGER"];
const ELEVATED_ROLES = ["SUPER_ADMIN", "GENERAL_MANAGER", "BRANCH_MANAGER", "HR_MANAGER", "SUPERVISOR"];

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
          [actor.companyId, dto.code.trim().toUpperCase(), dto.nameAr.trim(), dto.nameEn?.trim() ?? null, dto.address?.trim() ?? null, dto.phone?.trim() ?? null, dto.email?.trim().toLowerCase() ?? null],
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
      if (error?.code === "23505") throw new ConflictException("رمز الفرع مستخدم مسبقاً");
      throw error;
    }
  }

  async updateBranch(id: string, dto: UpdateBranchDto, actor: AuthenticatedUser) {
    if (Object.keys(dto).length === 0) throw new BadRequestException("لم يتم إرسال تغييرات");
    const old = await this.db.query("SELECT * FROM branches WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL", [id, actor.companyId]);
    if (!old.rows[0]) throw new NotFoundException("الفرع غير موجود");
    return this.db.transaction(async (client) => {
      const updated = await client.query(
        "UPDATE branches SET name_ar=COALESCE($3,name_ar), name_en=CASE WHEN $4 THEN $5 ELSE name_en END, address=CASE WHEN $6 THEN $7 ELSE address END, phone=CASE WHEN $8 THEN $9 ELSE phone END, email=CASE WHEN $10 THEN $11 ELSE email END, is_active=COALESCE($12,is_active), updated_at=NOW() WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL RETURNING id,code,name_ar,name_en,address,phone,email,is_active,updated_at",
        [id, actor.companyId, dto.nameAr?.trim() ?? null, dto.nameEn !== undefined, dto.nameEn ?? null, dto.address !== undefined, dto.address ?? null, dto.phone !== undefined, dto.phone ?? null, dto.email !== undefined, dto.email?.trim().toLowerCase() ?? null, dto.isActive ?? null],
      );
      await client.query(
        "INSERT INTO audit_logs(user_id,branch_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,'branches',$3,'UPDATE',$4::jsonb,$5::jsonb)",
        [actor.id, id, id, JSON.stringify(old.rows[0]), JSON.stringify(updated.rows[0])],
      );
      if (dto.isActive === false) {
        await client.query("UPDATE user_branch_memberships SET revoked_at=COALESCE(revoked_at,NOW()) WHERE branch_id=$1 AND revoked_at IS NULL", [id]);
      }
      return updated.rows[0];
    });
  }

  async listRoles(actor: AuthenticatedUser) {
    const result = await this.db.query(
      "SELECT r.id,r.code,r.name_ar,r.name_en,r.description,r.is_system_role,r.is_active,COUNT(DISTINCT rp.permission_id)::int AS permissions_count FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id WHERE r.company_id=$1 GROUP BY r.id ORDER BY r.is_system_role DESC,r.code",
      [actor.companyId],
    );
    return result.rows;
  }

  async listPermissions() {
    const result = await this.db.query("SELECT id,module,action,scope,code,description_ar FROM permissions ORDER BY module,scope,action");
    return result.rows;
  }

  async listUsers(actor: AuthenticatedUser, query: { search?: string; active?: string; page?: string; limit?: string }) {
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
    if (ELEVATED_ROLES.includes(dto.roleCode) && !superAdmin) throw new ForbiddenException("إسناد الأدوار الإدارية العليا يتطلب مدير النظام الأعلى");
    if (!GLOBAL_ROLES.includes(dto.roleCode) && !dto.branchIds?.length) throw new BadRequestException("يجب تحديد فرع واحد على الأقل");
    if (dto.primaryBranchId && !GLOBAL_ROLES.includes(dto.roleCode) && !dto.branchIds?.includes(dto.primaryBranchId)) throw new BadRequestException("الفرع الأساسي يجب أن يكون ضمن فروع العضوية");
    if (dto.roleCode === "SUPERVISOR" && !dto.departmentId) throw new BadRequestException("يجب تحديد القسم لمشرف القسم");
    const temporaryPassword = randomBytes(24).toString("base64url") + "A1!";
    const passwordHash = await hash(temporaryPassword, 12);
    try {
      return await this.db.transaction(async (client) => {
        const role = await client.query("SELECT id FROM roles WHERE company_id=$1 AND code=$2 AND is_active=TRUE", [actor.companyId, dto.roleCode]);
        if (!role.rows[0]) throw new BadRequestException("الدور المحدد غير موجود في الشركة");
        const inserted = await client.query(
          "INSERT INTO users(company_id,username,email,phone,password_hash,primary_branch_id,must_change_password) VALUES($1,$2,$3,$4,$5,$6,TRUE) RETURNING id,username,email,phone,primary_branch_id,is_active,must_change_password,created_at",
          [actor.companyId, dto.username.trim(), dto.email?.trim().toLowerCase() ?? null, dto.phone?.trim() ?? null, passwordHash, dto.primaryBranchId ?? null],
        );
        const user = inserted.rows[0];
        if (dto.employeeId) {
          const linked = await client.query("UPDATE employees SET user_id=$1,updated_at=NOW() WHERE id=$2 AND branch_id=ANY($3::uuid[]) AND user_id IS NULL AND deleted_at IS NULL", [user.id, dto.employeeId, dto.branchIds ?? []]);
          if (linked.rowCount !== 1) throw new BadRequestException("ملف الموظف غير متاح أو لا ينتمي للفروع المحددة");
        }
        if (GLOBAL_ROLES.includes(dto.roleCode)) {
          await client.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [user.id, role.rows[0].id]);
          const branches = await client.query("SELECT id FROM branches WHERE company_id=$1 AND is_active=TRUE AND deleted_at IS NULL ORDER BY id", [actor.companyId]);
          for (const b of branches.rows) {
            await client.query("INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4)", [user.id,b.id,actor.companyId,actor.id]);
            await client.query("INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [user.id,role.rows[0].id,b.id]);
          }
        } else {
          for (const branchId of dto.branchIds ?? []) {
            const valid = await client.query("SELECT id FROM branches WHERE id=$1 AND company_id=$2 AND is_active=TRUE AND deleted_at IS NULL", [branchId,actor.companyId]);
            if (!valid.rows[0]) throw new BadRequestException("أحد الفروع المحددة غير تابع للشركة أو غير فعال");
            await client.query("INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4)", [user.id,branchId,actor.companyId,actor.id]);
            if (dto.roleCode === "SUPERVISOR") {
              const dep = await client.query("SELECT id FROM departments WHERE id=$1 AND branch_id=$2 AND is_active=TRUE AND deleted_at IS NULL", [dto.departmentId,branchId]);
              if (!dep.rows[0]) throw new BadRequestException("قسم المشرف غير تابع للفرع المحدد");
              await client.query("INSERT INTO user_roles(user_id,role_id,branch_id,department_id) VALUES($1,$2,$3,$4)", [user.id,role.rows[0].id,branchId,dto.departmentId]);
            } else {
              await client.query("INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3)", [user.id,role.rows[0].id,branchId]);
            }
          }
        }
        await client.query("INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'users',$2,'INSERT',$3::jsonb)", [actor.id,user.id,JSON.stringify({id:user.id,username:user.username,roleCode:dto.roleCode})]);
        return { user, temporaryPassword };
      });
    } catch (error: any) {
      if (error?.code === "23505") throw new ConflictException("اسم المستخدم أو البريد أو الهاتف مستخدم مسبقاً");
      throw error;
    }
  }

  async assignRole(userId: string, dto: AssignUserRoleDto, actor: AuthenticatedUser) {
    const superAdmin = await this.isSuperAdmin(actor);
    if (ELEVATED_ROLES.includes(dto.roleCode) && !superAdmin) throw new ForbiddenException("إسناد الأدوار الإدارية يتطلب مدير النظام الأعلى");
    return this.db.transaction(async (client) => {
      const target = await client.query("SELECT id FROM users WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL FOR UPDATE", [userId,actor.companyId]);
      if (!target.rows[0]) throw new NotFoundException("حساب المستخدم غير موجود");
      const role = await client.query("SELECT id FROM roles WHERE company_id=$1 AND code=$2 AND is_active=TRUE", [actor.companyId,dto.roleCode]);
      if (!role.rows[0]) throw new BadRequestException("الدور غير موجود");
      if (GLOBAL_ROLES.includes(dto.roleCode)) {
        if (!superAdmin) throw new ForbiddenException("هذا الدور يتطلب مدير النظام الأعلى");
        await client.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [userId,role.rows[0].id]);
        const branches = await client.query("SELECT id FROM branches WHERE company_id=$1 AND is_active=TRUE AND deleted_at IS NULL", [actor.companyId]);
        for (const b of branches.rows) {
          await client.query("INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING", [userId,b.id,actor.companyId,actor.id]);
          await client.query("INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [userId,role.rows[0].id,b.id]);
        }
      } else {
        if (!dto.branchIds?.length) throw new BadRequestException("حدد فرعاً واحداً على الأقل");
        for (const branchId of dto.branchIds) {
          const valid = await client.query("SELECT id FROM branches WHERE id=$1 AND company_id=$2 AND is_active=TRUE AND deleted_at IS NULL", [branchId,actor.companyId]);
          if (!valid.rows[0]) throw new BadRequestException("الفرع المحدد غير تابع للشركة");
          await client.query("INSERT INTO user_branch_memberships(user_id,branch_id,company_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,branch_id) WHERE revoked_at IS NULL DO NOTHING", [userId,branchId,actor.companyId,actor.id]);
          if (dto.roleCode === "SUPERVISOR") {
            if (!dto.departmentId) throw new BadRequestException("حدد قسم المشرف");
            const dep = await client.query("SELECT id FROM departments WHERE id=$1 AND branch_id=$2 AND is_active=TRUE AND deleted_at IS NULL", [dto.departmentId,branchId]);
            if (!dep.rows[0]) throw new BadRequestException("القسم لا يتبع الفرع");
            await client.query("INSERT INTO user_roles(user_id,role_id,branch_id,department_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [userId,role.rows[0].id,branchId,dto.departmentId]);
          } else {
            await client.query("INSERT INTO user_roles(user_id,role_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [userId,role.rows[0].id,branchId]);
          }
        }
      }
      await client.query("INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'user_roles',$2,'INSERT',$3::jsonb)", [actor.id,userId,JSON.stringify({roleCode:dto.roleCode,branchIds:dto.branchIds ?? []})]);
      return { success: true };
    });
  }

  async updateUserStatus(userId: string, isActive: boolean, actor: AuthenticatedUser) {
    if (userId === actor.id && !isActive) throw new BadRequestException("لا يمكنك تعطيل حسابك بنفسك");
    return this.db.transaction(async (client) => {
      const updated = await client.query("UPDATE users SET is_active=$3,updated_at=NOW() WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL RETURNING id,username,is_active", [userId,actor.companyId,isActive]);
      if (!updated.rows[0]) throw new NotFoundException("حساب المستخدم غير موجود");
      if (!isActive) await client.query("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoke_reason=COALESCE(revoke_reason,'user_deactivated') WHERE user_id=$1 AND revoked_at IS NULL", [userId]);
      await client.query("INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,'users',$2,'UPDATE',$3::jsonb)", [actor.id,userId,JSON.stringify({isActive})]);
      return updated.rows[0];
    });
  }
}
