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
    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_KEY, targets)
    ) {
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

    const branchId =
      requestedBranch === null || requestedBranch === undefined
        ? null
        : String(requestedBranch);
    const hasBranchMembership =
      branchId !== null && user.allowedBranchIds.includes(branchId);

    // Company-scoped administrators may operate on inactive branches to reactivate them.
    // Branch/department permissions still require an active membership.
    if (branchId && !hasBranchMembership) {
      const branch = await this.db.query(
        `SELECT 1 FROM branches
         WHERE id = $1 AND company_id = $2
           AND deleted_at IS NULL
         LIMIT 1`,
        [branchId, user.companyId],
      );
      if (branch.rowCount !== 1) {
        throw new ForbiddenException("الفرع غير موجود ضمن الشركة");
      }
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
           (
             ur.branch_id IS NULL
             AND ur.department_id IS NULL
             AND (
               p.scope = 'company'
               OR (
                 p.scope = 'branch'
                 AND $3::uuid IS NOT NULL
                 AND EXISTS (
                   SELECT 1 FROM branches scoped_branch
                   WHERE scoped_branch.id = $3
                     AND scoped_branch.company_id = $2
                     AND scoped_branch.deleted_at IS NULL
                 )
               )
             )
           )
           OR
           ($5::boolean = TRUE AND ur.branch_id = $3
             AND ur.department_id IS NULL AND p.scope = 'branch')
           OR
           ($6::boolean = TRUE AND ur.branch_id = ANY($7::uuid[])
             AND ur.department_id IS NULL AND p.scope = 'own')
           OR
           ($5::boolean = TRUE AND ur.branch_id = $3
             AND ur.department_id IS NOT NULL
             AND (p.scope = 'department' OR (p.scope = 'branch' AND p.module = 'breaks'))
             AND EXISTS (
               SELECT 1 FROM employees e
               WHERE e.user_id = ur.user_id
                 AND e.branch_id = $3
                 AND e.department_id = ur.department_id
                 AND e.deleted_at IS NULL
             ))
         )
       LIMIT 1`,
      [
        user.id,
        user.companyId,
        branchId,
        permissionCode,
        hasBranchMembership,
        user.allowedBranchIds.length > 0,
        user.allowedBranchIds,
      ],
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
