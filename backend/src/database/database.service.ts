import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";

/**
 * Small PostgreSQL connection owner used by readiness checks and future
 * repositories. It never treats a missing DATABASE_URL as a healthy database.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = connectionString
      ? new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl:
            process.env.DATABASE_SSL === "true"
              ? { rejectUnauthorized: true }
              : undefined,
        })
      : null;
  }

  async isReady(): Promise<boolean> {
    if (!this.pool) return false;

    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
