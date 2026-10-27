// Standalone DB connection for CLI scripts (mirrors src/lib/db without Next.js-only imports).
import "dotenv/config";
import path from "path";
import * as schema from "../src/lib/db/schema";
import type { DB } from "../src/lib/db";

export const MIGRATIONS = path.join(__dirname, "..", "drizzle");

export async function connect(): Promise<{ db: DB; close: () => Promise<void>; kind: string }> {
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
    return { db: drizzle(client, { schema }) as unknown as DB, close: () => client.end(), kind: "postgres" };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR ?? path.join(__dirname, "..", ".data", "pglite"));
  return { db: drizzle(client, { schema }) as unknown as DB, close: () => client.close(), kind: "pglite" };
}
