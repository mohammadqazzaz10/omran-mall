import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

/**
 * Central PostgreSQL connection owner. Services use parameterized queries and
 * explicit transactions through this class; missing DB configuration fails
 * closed instead of silently degrading to an in-memory mode.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = connectionString
      ? new Pool({
          connectionString,
          max: Number(process.env.DB_POOL_MAX || 10),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl:
            process.env.DATABASE_SSL === "true"
              ? { rejectUnauthorized: true }
              : undefined,
        })
      : null;
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    }
    return this.pool;
  }

  query<T extends QueryResultRow = any>(
    text: string,
    values: any[] = [],
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(text, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
