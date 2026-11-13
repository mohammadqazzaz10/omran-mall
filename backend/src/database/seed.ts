import { access, readFile } from "fs/promises";
import { resolve } from "path";
import { Pool } from "pg";

async function findSeedFile(): Promise<string> {
  const candidates = [
    resolve(process.cwd(), "database/seeds.sql"),
    resolve(process.cwd(), "../database/seeds.sql"),
    resolve(__dirname, "../../../database/seeds.sql"),
    resolve(__dirname, "../../database/seeds.sql"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported local/container path.
    }
  }
  throw new Error("Development seed file could not be located");
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed data is forbidden in production");
  }
  if (process.env.ALLOW_DEVELOPMENT_SEEDS !== "true") {
    throw new Error(
      "Set ALLOW_DEVELOPMENT_SEEDS=true to explicitly allow synthetic development seeds",
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to seed the development database",
    );
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  });

  try {
    const sql = await readFile(await findSeedFile(), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      process.stdout.write("Development seed data applied successfully.\n");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Development seed failed: ${error instanceof Error ? error.message : "Unknown error"}\n`,
  );
  process.exitCode = 1;
});
