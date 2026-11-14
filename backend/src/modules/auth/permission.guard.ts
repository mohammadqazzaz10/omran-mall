import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseService } from "../../database/database.service";
import {
  REQUIRED_PERMISSION_KEY,
  SKIP_PERMISSION_KEY,
} from "../../common/decorators/permission.decorator";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { AuthenticatedUser } from "./auth.types";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_KEY, targets)) {
      return true;
    }

    // Every protected business endpoint must declare its required permission.
    const permissionCode = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION_KEY,
      targets,
    );
    if (!permissionCode) {
      throw new ForbiddenException("المسار غير مربوط بصلاحية معتمدة");
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.id) {
      throw new ForbiddenException("يلزم التحقق من هوية المستخدم أولاً");
    }

    const requestedBranch =
      request.params?.branchId ??
      request.query?.branchId ??
      request.body?.branchId ??
      request.headers?.["x-branch-id"] ??
      user.primaryBranchId;

    if (!requestedBranch) {
      throw new ForbiddenException("يجب تحديد الفرع المطلوب");
    }

    const branchId = String(requestedBranch);
    if (!user.allowedBranchIds.includes(branchId)) {
      throw new ForbiddenException("لا توجد عضوية فعالة لهذا الفرع");
    }

    const grant = await this.db.query(
      `SELECT 1
       FROM user_roles ur
       JOIN roles r
         ON r.id = ur.role_id
        AND r.company_id = $2
        AND r.is_active = TRUE
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1
         AND p.code = $4
         AND (
           (ur.branch_id IS NULL AND ur.department_id IS NULL AND p.scope = 'company')
           OR
           (ur.branch_id = $3 AND ur.department_id IS NULL
             AND p.scope IN ('branch', 'department', 'own'))
           OR
           (ur.branch_id = $3 AND ur.department_id IS NOT NULL
             AND p.scope IN ('department', 'own')
             AND EXISTS (
               SELECT 1 FROM employees e
               WHERE e.user_id = ur.user_id
                 AND e.branch_id = $3
                 AND e.department_id = ur.department_id
                 AND e.deleted_at IS NULL
             ))
         )
       LIMIT 1`,
      [user.id, user.companyId, branchId, permissionCode],
    );

    if (grant.rowCount !== 1) {
      throw new ForbiddenException("لا تملك الصلاحية المطلوبة لهذا الإجراء");
    }

    // Record-level ownership for permissions with scope=own must also be
    // enforced by the corresponding service using the authenticated user ID.
    request.branchId = branchId;
    return true;
  }
}
