import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async listForUser(userId: string, limit = 30, offset = 0) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 30, 1), 100);
    const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
    const result = await this.db.query(
      `SELECT id, title, body, type, payload, is_read, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset],
    );
    return result.rows;
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.db.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, body, type, payload, is_read, read_at, created_at`,
      [notificationId, userId],
    );
    if (result.rowCount !== 1) {
      throw new NotFoundException("الإشعار غير موجود");
    }
    return result.rows[0];
  }

  async markAllRead(userId: string) {
    const result = await this.db.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return { updatedCount: result.rowCount ?? 0 };
  }
}
