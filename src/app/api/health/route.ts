import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, auth: authMode(), database: process.env.DATABASE_URL ? "postgres" : "embedded" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
