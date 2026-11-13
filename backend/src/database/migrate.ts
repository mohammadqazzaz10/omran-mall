import { createHash } from 'crypto';
import { access, readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Pool, PoolClient } from 'pg';

type Migration = { version: string; filePath: string };

async function firstExisting(paths: string[]): Promise<string> {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported local/container path.
    }
  }
  throw new Error('Database migration files could not be located');
}

async function discoverMigrations(): Promise<Migration[]> {
  const baselinePath = await firstExisting([
    resolve(process.cwd(), 'database/schema.sql'),
    resolve(process.cwd(), '../database/schema.sql'),
    resolve(__dirname, '../../../database/schema.sql'),
    resolve(__dirname, '../../database/schema.sql'),
  ]);

  const migrationDirectory = await firstExisting([
    resolve(process.cwd(), 'database/migrations'),
    resolve(process.cwd(), '../database/migrations'),
    resolve(__dirname, '../../../database/migrations'),
    resolve(__dirname, '../../database/migrations'),
  ]);

  const additionalFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of additionalFiles) {
    if (!/^\d{3,}_[a-z0-9_]+\.sql$/i.test(file)) {
      throw new Error(`Invalid migration filename: ${file}`);
    }
  }

  return [
    { version: '001_initial_schema', filePath: baselinePath },
    ...additionalFiles.map((file) => ({
      version: file.replace(/\.sql$/i, ''),
      filePath: join(migrationDirectory, file),
    })),
  ];
}

async function applyMigrations(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query("SELECT pg_advisory_lock(hashtext('omran_mall_schema_migrations'))");

  try {
    const migrations = await discoverMigrations();
    const availableVersions = new Set(migrations.map((migration) => migration.version));
    const appliedVersions = await client.query(
      'SELECT version FROM schema_migrations',
    );
    const removedMigrations = appliedVersions.rows
      .map((row: { version: string }) => row.version)
      .filter((version: string) => !availableVersions.has(version));
    if (removedMigrations.length > 0) {
      throw new Error(
        `Applied migrations are missing from the repository: ${removedMigrations.join(', ')}`,
      );
    }

    for (const migration of migrations) {
      const sql = await readFile(migration.filePath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE version = $1',
        [migration.version],
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Applied migration ${migration.version} was modified. Create a new migration instead.`,
          );
        }
        continue;
      }

      if (migration.version === '001_initial_schema') {
        const existingSchema = await client.query(
          "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations') AS has_tables",
        );
        if (existingSchema.rows[0].has_tables) {
          throw new Error(
            'An existing database schema was found without a migration ledger. Back up and verify it, then perform an explicit baseline adoption; migrations will not overwrite existing tables.',
          );
        }
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, checksum],
        );
        await client.query('COMMIT');
        process.stdout.write(`Applied migration: ${migration.version}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('omran_mall_schema_migrations'))");
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run database migrations');
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
  });

  try {
    const client = await pool.connect();
    try {
      await applyMigrations(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Database migration failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
  );
  process.exitCode = 1;
});
