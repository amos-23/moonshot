import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Reports configuration problems without exposing secrets.
export async function GET() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "true") {
    return NextResponse.json({ ok: false, problem: "DATABASE_URL is not set" }, { status: 503 });
  }
  try {
    const db = await getDb();
    await db.execute(sql`select 1 from people limit 1`);
    return NextResponse.json({ ok: true, database: process.env.DATABASE_URL ? "postgres" : "embedded", admin: Boolean(process.env.ADMIN_KEY), xApi: Boolean(process.env.X_BEARER_TOKEN) });
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    console.error("health check failed", err);
    return NextResponse.json({ ok: false, problem: "Could not connect to the database", code: e?.code ?? e?.cause?.code ?? "unknown" }, { status: 503 });
  }
}
