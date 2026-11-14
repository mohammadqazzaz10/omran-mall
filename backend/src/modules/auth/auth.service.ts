import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcrypt";
import { createHash, randomBytes } from "crypto";
import type { Request } from "express";
import { DatabaseService } from "../../database/database.service";
import { LoginDto } from "./auth.dto";
import { durationToSeconds } from "./auth.config";
import { AccessTokenPayload } from "./auth.types";

type UserRow = {
  id: string;
  company_id: string;
  primary_branch_id: string | null;
  username: string;
  password_hash: string;
  is_active: boolean;
  failed_login_attempts: number;
  lockout_until: Date | null;
  must_change_password: boolean;
};

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  private async hasCompanyRole(
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1
       FROM user_roles ur
       JOIN roles r
         ON r.id = ur.role_id
        AND r.company_id = $2
        AND r.is_active = TRUE
       WHERE ur.user_id = $1
         AND ur.branch_id IS NULL
         AND ur.department_id IS NULL
       LIMIT 1`,
      [userId, companyId],
    );
    return result.rowCount === 1;
  }

  private async memberships(userId: string): Promise<string[]> {
    const result = await this.db.query<{ branch_id: string }>(
      `SELECT ubm.branch_id
       FROM user_branch_memberships ubm
       JOIN branches b ON b.id = ubm.branch_id
       WHERE ubm.user_id = $1
         AND ubm.revoked_at IS NULL
         AND b.is_active = TRUE
         AND b.deleted_at IS NULL
       ORDER BY ubm.branch_id`,
      [userId],
    );
    return result.rows.map((row) => row.branch_id);
  }

  private async accessToken(
    user: Pick<UserRow, "id" | "company_id">,
    sessionId: string,
  ): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      sid: sessionId,
      companyId: user.company_id,
    };
    return this.jwt.signAsync(payload);
  }

  async login(dto: LoginDto, request: Request) {
    const lookup = dto.username.trim();
    const result = await this.db.query<UserRow>(
      `SELECT id, company_id, primary_branch_id, username, password_hash,
              is_active, failed_login_attempts, lockout_until, must_change_password
       FROM users
       WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
         AND deleted_at IS NULL
       LIMIT 1`,
      [lookup],
    );
    const user = result.rows[0];

    // Keep the response identical for unknown users and bad passwords.
    if (!user) {
      throw new UnauthorizedException("اسم المستخدم أو كلمة المرور غير صحيحة");
    }
    if (
      !user.is_active ||
      (user.lockout_until && user.lockout_until > new Date())
    ) {
      throw new UnauthorizedException("الحساب غير متاح مؤقتاً");
    }

    const passwordMatches = await compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      await this.db.query(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             lockout_until = CASE
               WHEN failed_login_attempts + 1 >= 5
               THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
               ELSE lockout_until
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id],
      );
      throw new UnauthorizedException("اسم المستخدم أو كلمة المرور غير صحيحة");
    }

    const branchIds = await this.memberships(user.id);
    if (
      branchIds.length === 0 &&
      !(await this.hasCompanyRole(user.id, user.company_id))
    ) {
      throw new ForbiddenException(
        "لا توجد عضوية فرع أو صلاحية إدارية على مستوى الشركة لهذا الحساب",
      );
    }

    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTtlSeconds = durationToSeconds(
      process.env.JWT_REFRESH_EXPIRATION,
      7 * 24 * 60 * 60,
      90 * 24 * 60 * 60,
    );
    const refreshExpiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);
    const clientIp = request.ip || null;
    const userAgent = request.headers["user-agent"] || null;

    const session = await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE users
         SET failed_login_attempts = 0, lockout_until = NULL,
             last_login_at = CURRENT_TIMESTAMP, last_login_ip = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id, clientIp],
      );
      const created = await client.query<{ id: string }>(
        `INSERT INTO auth_sessions
          (user_id, refresh_token_hash, device_id, device_name,
           user_agent, ip_address, refresh_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          user.id,
          hashToken(refreshToken),
          dto.deviceId || null,
          dto.deviceName || null,
          userAgent,
          clientIp,
          refreshExpiresAt,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
          (user_id, branch_id, table_name, record_id, action, new_values, client_ip, user_agent)
         VALUES ($1, $2, 'auth_sessions', $3, 'LOGIN', $4::jsonb, $5, $6)`,
        [
          user.id,
          user.primary_branch_id,
          created.rows[0].id,
          JSON.stringify({ deviceId: dto.deviceId || null }),
          clientIp,
          userAgent,
        ],
      );
      return created.rows[0];
    });

    return {
      accessToken: await this.accessToken(user, session.id),
      refreshToken: `${session.id}.${refreshToken}`,
      tokenType: "Bearer",
      expiresIn: durationToSeconds(process.env.JWT_EXPIRATION, 900, 60 * 60),
      user: {
        id: user.id,
        username: user.username,
        companyId: user.company_id,
        primaryBranchId: user.primary_branch_id,
        allowedBranchIds: branchIds,
        mustChangePassword: user.must_change_password,
      },
    };
  }

  async refresh(refreshToken: string) {
    const separator = refreshToken.indexOf(".");
    if (separator < 1) {
      throw new UnauthorizedException("جلسة الدخول غير صالحة");
    }
    const sessionId = refreshToken.slice(0, separator);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        sessionId,
      )
    ) {
      throw new UnauthorizedException("جلسة الدخول غير صالحة");
    }
    const oldSecret = refreshToken.slice(separator + 1);
    const nextSecret = randomBytes(48).toString("base64url");

    const result = await this.db.transaction(async (client) => {
      const rotated = await client.query<{ user_id: string }>(
        `UPDATE auth_sessions
         SET refresh_token_hash = $3,
             last_used_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND refresh_token_hash = $2
           AND revoked_at IS NULL
           AND refresh_expires_at > CURRENT_TIMESTAMP
         RETURNING user_id`,
        [sessionId, hashToken(oldSecret), hashToken(nextSecret)],
      );
      if (rotated.rowCount !== 1) return null;

      const userResult = await client.query<UserRow>(
        `SELECT id, company_id, primary_branch_id, username, password_hash,
                is_active, failed_login_attempts, lockout_until, must_change_password
         FROM users WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [rotated.rows[0].user_id],
      );
      if (!userResult.rows[0]) {
        await client.query(
          `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP,
             revoke_reason = 'inactive_user' WHERE id = $1`,
          [sessionId],
        );
        return null;
      }
      return userResult.rows[0];
    });

    if (!result) {
      throw new UnauthorizedException(
        "انتهت الجلسة أو تم إبطالها؛ سجل الدخول مجدداً",
      );
    }
    const branchIds = await this.memberships(result.id);
    if (
      branchIds.length === 0 &&
      !(await this.hasCompanyRole(result.id, result.company_id))
    ) {
      await this.revokeSession(
        sessionId,
        "no_branch_membership_or_company_role",
      );
      throw new ForbiddenException(
        "لا توجد عضوية فرع أو صلاحية إدارية على مستوى الشركة",
      );
    }

    return {
      accessToken: await this.accessToken(result, sessionId),
      refreshToken: `${sessionId}.${nextSecret}`,
      tokenType: "Bearer",
      expiresIn: durationToSeconds(process.env.JWT_EXPIRATION, 900, 60 * 60),
      mustChangePassword: result.must_change_password,
    };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const result = await this.db.query(
      `SELECT id, device_id, device_name, user_agent, host(ip_address) AS ip_address,
              created_at, last_used_at, refresh_expires_at, (id=$2) AS is_current
       FROM auth_sessions
       WHERE user_id=$1 AND revoked_at IS NULL AND refresh_expires_at>CURRENT_TIMESTAMP
       ORDER BY last_used_at DESC`,
      [userId, currentSessionId],
    );
    return result.rows;
  }

  async revokeOwnedSession(
    userId: string,
    currentSessionId: string,
    targetSessionId: string,
  ) {
    if (targetSessionId === currentSessionId) {
      throw new ForbiddenException("استخدم تسجيل الخروج لإنهاء الجلسة الحالية");
    }
    const result = await this.db.transaction(async (client) => {
      const revoked = await client.query(
        `UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP, revoke_reason='user_revoked'
         WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`,
        [targetSessionId, userId],
      );
      if (revoked.rowCount !== 1) return false;
      await client.query(
        `INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values)
         VALUES($1,'auth_sessions',$2,'REVOKE',$3::jsonb)`,
        [userId, targetSessionId, JSON.stringify({ reason: "user_revoked" })],
      );
      return true;
    });
    if (!result) throw new UnauthorizedException("الجلسة غير موجودة أو منتهية");
    return { success: true };
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (currentPassword === newPassword)
      throw new ForbiddenException("يجب اختيار كلمة مرور جديدة مختلفة");
    if (Buffer.byteLength(newPassword, "utf8") > 72)
      throw new ForbiddenException(
        "كلمة المرور الجديدة تتجاوز الحد الآمن المسموح به",
      );
    const found = await this.db.query<{
      password_hash: string;
      must_change_password: boolean;
    }>(
      "SELECT password_hash,must_change_password FROM users WHERE id=$1 AND is_active=TRUE AND deleted_at IS NULL",
      [userId],
    );
    const user = found.rows[0];
    if (!user || !(await compare(currentPassword, user.password_hash))) {
      throw new UnauthorizedException("كلمة المرور الحالية غير صحيحة");
    }
    const newHash = await hash(newPassword, 12);
    await this.db.transaction(async (client) => {
      await client.query(
        "UPDATE users SET password_hash=$2,must_change_password=FALSE,password_changed_at=CURRENT_TIMESTAMP,failed_login_attempts=0,lockout_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [userId, newHash],
      );
      await client.query(
        "UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason='password_changed' WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL",
        [userId, sessionId],
      );
      await client.query(
        "INSERT INTO audit_logs(user_id,table_name,record_id,action) VALUES($1,'users',$2,'PASSWORD_CHANGE')",
        [userId, userId],
      );
    });
    return { success: true, mustChangePassword: false };
  }

  async revokeSession(sessionId: string, reason = "logout"): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
           revoke_reason = COALESCE(revoke_reason, $2)
       WHERE id = $1`,
      [sessionId, reason],
    );
  }

  async logout(sessionId: string, userId: string): Promise<{ success: true }> {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP,
           revoke_reason = 'logout'
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [sessionId, userId],
      );
      await client.query(
        `INSERT INTO audit_logs
          (user_id, table_name, record_id, action)
         VALUES ($1, 'auth_sessions', $2, 'LOGOUT')`,
        [userId, sessionId],
      );
    });
    return { success: true };
  }

  async me(userId: string, sessionId: string) {
    const result = await this.db.query<{
      id: string;
      username: string;
      email: string | null;
      company_id: string;
      primary_branch_id: string | null;
    }>(
      `SELECT id, username, email, company_id, primary_branch_id
       FROM users WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [userId],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException("الحساب غير متاح");
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      companyId: user.company_id,
      primaryBranchId: user.primary_branch_id,
      allowedBranchIds: await this.memberships(userId),
      sessionId,
    };
  }
}
