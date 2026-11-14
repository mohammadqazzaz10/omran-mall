import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";\nimport { Reflector } from "@nestjs/core";\nimport { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { DatabaseService } from "../../database/database.service";
import { AccessTokenPayload, AuthenticatedUser } from "./auth.types";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("يلزم تسجيل الدخول");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(
        header.slice(7),
      );
    } catch {
      throw new UnauthorizedException("رمز الدخول غير صالح أو منتهي");
    }

    if (!payload?.sub || !payload?.sid || !payload?.companyId) {
      throw new UnauthorizedException("بيانات جلسة الدخول غير مكتملة");
    }

    const session = await this.db.query<{
      user_id: string;
      company_id: string;
      username: string;
      primary_branch_id: string | null;
    }>(
      `SELECT s.user_id, u.company_id, u.username, u.primary_branch_id
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
         AND s.user_id = $2
         AND u.company_id = $3
         AND s.revoked_at IS NULL
         AND s.refresh_expires_at > CURRENT_TIMESTAMP
         AND u.is_active = TRUE
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [payload.sid, payload.sub, payload.companyId],
    );
    const active = session.rows[0];
    if (!active) {
      throw new UnauthorizedException("تم إبطال جلسة الدخول؛ سجل الدخول مجدداً");
    }

    const memberships = await this.db.query<{ branch_id: string }>(
      `SELECT ubm.branch_id
       FROM user_branch_memberships ubm
       JOIN branches b ON b.id = ubm.branch_id
       WHERE ubm.user_id = $1
         AND ubm.revoked_at IS NULL
         AND b.is_active = TRUE
         AND b.deleted_at IS NULL
       ORDER BY ubm.branch_id`,
      [active.user_id],
    );
    const allowedBranchIds = memberships.rows.map((row) => row.branch_id);
    if (allowedBranchIds.length === 0) {
      throw new UnauthorizedException("لا توجد عضوية فرع فعالة لهذا الحساب");
    }

    const principal: AuthenticatedUser = {
      id: active.user_id,
      companyId: active.company_id,
      username: active.username,
      primaryBranchId: active.primary_branch_id,
      allowedBranchIds,
      sessionId: payload.sid,
    };
    request.user = principal;
    return true;
  }
}
