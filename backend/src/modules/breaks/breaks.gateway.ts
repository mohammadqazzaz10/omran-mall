import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { DatabaseService } from "../../database/database.service";
import { AccessTokenPayload } from "../auth/auth.types";

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  namespace: "/breaks",
})
export class BreaksGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger("BreaksGateway");

  constructor(
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
  ) {}

  private reject(client: Socket): void {
    client.disconnect(true);
  }

  async handleConnection(client: Socket): Promise<void> {
    const authToken = client.handshake.auth?.token;
    const authorization = client.handshake.headers.authorization;
    const token =
      typeof authToken === "string"
        ? authToken.replace(/^Bearer\s+/i, "")
        : typeof authorization === "string" &&
            authorization.startsWith("Bearer ")
          ? authorization.slice(7)
          : null;

    if (!token) {
      this.logger.warn(`Rejected breaks socket without token: ${client.id}`);
      this.reject(client);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      this.logger.warn(`Rejected breaks socket with invalid token: ${client.id}`);
      this.reject(client);
      return;
    }

    if (!payload?.sub || !payload?.sid || !payload?.companyId) {
      this.reject(client);
      return;
    }

    try {
      const session = await this.db.query(
        `SELECT s.user_id
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.user_id = $2 AND u.company_id = $3
           AND s.revoked_at IS NULL
           AND s.refresh_expires_at > CURRENT_TIMESTAMP
           AND u.is_active = TRUE AND u.deleted_at IS NULL
         LIMIT 1`,
        [payload.sid, payload.sub, payload.companyId],
      );
      if (!session.rowCount) {
        this.reject(client);
        return;
      }

      const memberships = await this.db.query<{ branch_id: string }>(
        `SELECT ubm.branch_id
         FROM user_branch_memberships ubm
         JOIN branches b ON b.id = ubm.branch_id
         WHERE ubm.user_id = $1 AND ubm.company_id = $2
           AND ubm.revoked_at IS NULL
           AND b.is_active = TRUE AND b.deleted_at IS NULL`,
        [payload.sub, payload.companyId],
      );
      const branchIds = new Set(memberships.rows.map((row) => row.branch_id));

      const companyBreakAccess = await this.db.query(
        `SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = $1 AND r.company_id = $2
           AND ur.branch_id IS NULL AND ur.department_id IS NULL
           AND r.is_active = TRUE
           AND p.code IN ('breaks.view.branch', 'breaks.approve.branch')
         LIMIT 1`,
        [payload.sub, payload.companyId],
      );

      if (companyBreakAccess.rowCount) {
        const companyBranches = await this.db.query<{ id: string }>(
          `SELECT id FROM branches
           WHERE company_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
          [payload.companyId],
        );
        for (const branch of companyBranches.rows) branchIds.add(branch.id);
      }

      if (branchIds.size === 0) {
        this.reject(client);
        return;
      }

      client.data.userId = payload.sub;
      client.data.companyId = payload.companyId;
      client.data.branchIds = [...branchIds];
      await client.join([...branchIds].map((id) => `branch_${id}`));
    } catch (error) {
      this.logger.error(
        `Failed to authenticate breaks socket ${client.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.reject(client);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Breaks socket disconnected: ${client.id}`);
  }

  broadcastBreakStarted(branchId: string, sessionData: unknown): void {
    this.server?.to(`branch_${branchId}`).emit("break_started", {
      event: "BREAK_STARTED",
      timestamp: new Date().toISOString(),
      session: sessionData,
    });
  }

  broadcastBreakAlert(branchId: string, alertData: unknown): void {
    this.server?.to(`branch_${branchId}`).emit("break_alert", {
      event: "BREAK_OVERSTAY_ALERT",
      timestamp: new Date().toISOString(),
      alert: alertData,
    });
  }

  broadcastBreakEnded(branchId: string, sessionData: unknown): void {
    this.server?.to(`branch_${branchId}`).emit("break_ended", {
      event: "BREAK_ENDED",
      timestamp: new Date().toISOString(),
      session: sessionData,
    });
  }
}
