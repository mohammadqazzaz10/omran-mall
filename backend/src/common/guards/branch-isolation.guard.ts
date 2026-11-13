import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class BranchIsolationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('المستخدم غير مسجل الدخول');
    }

    // Super Admin and General Managers have cross-branch authority
    const isGlobalAdmin = user.roles?.some(
      (role: string) => role === 'SUPER_ADMIN' || role === 'GENERAL_MANAGER',
    );

    if (isGlobalAdmin) {
      return true;
    }

    // Get requested branch_id from params, query, or body
    const targetBranchId =
      request.params?.branchId ||
      request.query?.branchId ||
      request.body?.branchId ||
      request.headers['x-branch-id'];

    if (!targetBranchId) {
      // If no branch specified, inject the user's primary assigned branch
      request.branchId = user.primaryBranchId;
      return true;
    }

    // Verify user belongs to the target branch
    const hasBranchAccess =
      user.primaryBranchId === targetBranchId ||
      user.allowedBranchIds?.includes(targetBranchId);

    if (!hasBranchAccess) {
      throw new ForbiddenException(
        'غير مصرح لك بالوصول أو التعديل على بيانات هذا الفرع (عزل الفروع مفروض)',
      );
    }

    request.branchId = targetBranchId;
    return true;
  }
}
