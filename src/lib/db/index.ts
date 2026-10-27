import "server-only";
import path from "path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

// Migrations run automatically on first connection, so a fresh database just works.
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_SIZE ?? 5) });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as DB;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "true") {
    throw new Error("DATABASE_URL is not set");
  }
  // Local development: embedded Postgres stored in ./.data/pglite.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const g = globalThis as unknown as { __moonshotDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__moonshotDb) {
    g.__moonshotDb = connect().catch((err) => {
      g.__moonshotDb = undefined;
      throw err;
    });
  }
  return g.__moonshotDb;
}

export { schema };
