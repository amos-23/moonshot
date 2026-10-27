import "server-only";
import path from "path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare:false keeps us compatible with Supabase's transaction-mode pooler.
    const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_SIZE ?? 5) });
    const db = drizzle(client, { schema });
    if (process.env.AUTO_MIGRATE === "true") {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
    }
    return db as unknown as DB;
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "true") {
    throw new Error("DATABASE_URL is required in production. See README → Database setup.");
  }

  // Zero-config local mode: embedded Postgres (PGlite) persisted to ./.data/pglite.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const globalForDb = globalThis as unknown as { __moonshotDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!globalForDb.__moonshotDb) {
    globalForDb.__moonshotDb = connect().catch((err) => {
      globalForDb.__moonshotDb = undefined;
      throw err;
    });
  }
  return globalForDb.__moonshotDb;
}

export { schema };
