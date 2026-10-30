import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isAdmin } from "@/lib/me";

// Admin-only download of everyone who signed up.
export async function GET() {
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 });
  const rows = await (await getDb()).select().from(schema.signups).orderBy(asc(schema.signups.createdAt));
  // Quote every cell; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
  const cell = (v: string | null) => `"${(v ?? "").replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
  const lines = [["email", "name", "about", "has_card", "signed_up_at"].join(","), ...rows.map((r) => [cell(r.email), cell(r.name), cell(r.about), r.personId ? "yes" : "no", r.createdAt.toISOString()].join(","))];
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="moonshot-connect-signups.csv"', "Cache-Control": "private, no-store" },
  });
}
