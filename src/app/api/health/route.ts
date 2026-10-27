import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authMode } from "@/lib/env";

export const dynamic = "force-dynamic";

// Reports configuration problems without exposing secrets (no connection strings or messages with credentials).
export async function GET() {
  const base = { auth: authMode(), database: process.env.DATABASE_URL ? "postgres" : "embedded" };
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "true") {
    return NextResponse.json({ ok: false, ...base, problem: "DATABASE_URL is not set" }, { status: 503 });
  }
  let db;
  try {
    db = await getDb();
    await db.execute(sql`select 1`);
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    const code = e?.code ?? e?.cause?.code ?? "unknown";
    console.error("health: database connection failed", err);
    return NextResponse.json(
      {
        ok: false,
        ...base,
        problem: "Could not connect to the database",
        code,
        hint:
          code === "ENOTFOUND" || code === "ENETUNREACH" || code === "EHOSTUNREACH"
            ? "Host unreachable. With Supabase, use the connection pooler URI (…pooler.supabase.com), not the IPv6-only direct db.<ref>.supabase.co host."
            : code === "28P01"
              ? "Wrong database password in DATABASE_URL."
              : code === "3D000"
                ? "Database name in DATABASE_URL does not exist."
                : "Check DATABASE_URL and that the database accepts connections from this host.",
      },
      { status: 503 },
    );
  }
  try {
    await db.execute(sql`select 1 from profiles limit 1`);
  } catch {
    return NextResponse.json(
      { ok: false, ...base, problem: "Database tables are missing", hint: "Run `npm run db:migrate` or set AUTO_MIGRATE=true and redeploy." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, ...base });
}
