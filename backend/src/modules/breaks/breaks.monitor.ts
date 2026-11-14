import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { BreaksGateway } from "./breaks.gateway";

@Injectable()
export class BreaksMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BreaksMonitor.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly gateway: BreaksGateway,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.scanOverstays();
    }, 30_000);
    this.timer.unref();
    void this.scanOverstays();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async scanOverstays(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.scanUpcomingWarnings();
      await this.scanExpiredSessions();
    } catch (error) {
      this.logger.error(
        "Failed to scan break timers",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async scanUpcomingWarnings(): Promise<void> {
    const result = await this.db.query(
      `WITH due AS (
         SELECT s.id, s.branch_id, s.employee_id, s.department_id,
                s.break_type_id, s.start_time, s.expected_end_time,
                GREATEST(
                  0,
                  CEIL(EXTRACT(EPOCH FROM (s.expected_end_time - CURRENT_TIMESTAMP)))
                )::int AS remaining_seconds
         FROM break_sessions s
         JOIN break_types t ON t.id = s.break_type_id
         WHERE s.actual_end_time IS NULL
           AND s.pre_end_alert_sent_at IS NULL
           AND t.notify_before_end_minutes > 0
           AND s.expected_end_time > CURRENT_TIMESTAMP
           AND s.expected_end_time <= CURRENT_TIMESTAMP
             + (t.notify_before_end_minutes * INTERVAL '1 minute')
         ORDER BY s.expected_end_time ASC
         LIMIT 100
         FOR UPDATE OF s SKIP LOCKED
       )
       UPDATE break_sessions s
       SET pre_end_alert_sent_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       FROM due
       WHERE s.id = due.id
       RETURNING due.id, due.branch_id, due.employee_id, due.department_id,
                 due.break_type_id, due.start_time, due.expected_end_time,
                 due.remaining_seconds`,
    );
    for (const alert of result.rows) {
      this.gateway.broadcastBreakAlert(alert.branch_id, {
        ...alert,
        event: "BREAK_ENDING_SOON",
      });
    }
  }

  private async scanExpiredSessions(): Promise<void> {
    const result = await this.db.query(
      `WITH due AS (
         SELECT s.id, s.branch_id, s.employee_id, s.department_id,
                s.break_type_id, s.start_time, s.expected_end_time,
                GREATEST(
                  0,
                  FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.expected_end_time)) / 60)::int
                ) AS overstay_minutes
         FROM break_sessions s
         WHERE s.actual_end_time IS NULL
           AND s.expected_end_time <= CURRENT_TIMESTAMP
           AND s.overstay_alert_sent_at IS NULL
         ORDER BY s.expected_end_time ASC
         LIMIT 100
         FOR UPDATE SKIP LOCKED
       )
       UPDATE break_sessions s
       SET overstay_alert_sent_at = CURRENT_TIMESTAMP,
           overstay_minutes = due.overstay_minutes,
           updated_at = CURRENT_TIMESTAMP
       FROM due
       WHERE s.id = due.id
       RETURNING due.id, due.branch_id, due.employee_id, due.department_id,
                 due.break_type_id, due.start_time, due.expected_end_time,
                 due.overstay_minutes`,
    );
    for (const alert of result.rows) {
      this.gateway.broadcastBreakAlert(alert.branch_id, {
        ...alert,
        event: "BREAK_OVERSTAY_ALERT",
      });
    }
  }
}
