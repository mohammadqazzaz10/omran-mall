import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Provisional request-scope branch guard.
 *
 * Authentication must run before this guard and populate request.user from a
 * verified server-side identity. This guard deliberately grants no implicit
 * cross-branch access based on role names. Company-wide access must be
 * represented by explicit branch memberships issued by the trusted auth layer.
 */
@Injectable()
export class BranchIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException("المستخدم غير مسجل الدخول");
    }

    const requestedBranchId =
      request.params?.branchId ??
      request.query?.branchId ??
      request.body?.branchId ??
      request.headers?.["x-branch-id"] ??
      user.primaryBranchId;

    if (!requestedBranchId) {
      throw new ForbiddenException("لا يوجد فرع محدد لهذا الحساب");
    }

    const targetBranchId = String(requestedBranchId);
    const allowedBranchIds = new Set<string>(
      [
        ...(Array.isArray(user.allowedBranchIds) ? user.allowedBranchIds : []),
        ...(user.primaryBranchId ? [user.primaryBranchId] : []),
      ].map((id: unknown) => String(id)),
    );

    if (!allowedBranchIds.has(targetBranchId)) {
      throw new ForbiddenException("غير مصرح لك بالوصول إلى بيانات هذا الفرع");
    }

    request.branchId = targetBranchId;
    return true;
  }
}
