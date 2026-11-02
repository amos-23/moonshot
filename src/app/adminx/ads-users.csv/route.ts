import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { adsUsersCsv } from "@/lib/ads-admin";

export const dynamic = "force-dynamic";

// Admin-only download of everyone who signed up to AdsSim.
export async function GET() {
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 });
  return new NextResponse(await adsUsersCsv(await getDb()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="adssim-users.csv"', "Cache-Control": "private, no-store" },
  });
}
