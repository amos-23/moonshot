import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { RANGES, dailyRows } from "@/lib/stats";

// Admin-only: one row per day (Lagos time) for the chosen range, for spreadsheets.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 });
  const days = RANGES.find((r) => String(r.days) === req.nextUrl.searchParams.get("days"))?.days ?? 7;
  const rows = await dailyRows(await getDb(), days ? new Date(Date.now() - days * 86_400_000) : null);
  const head = ["day", "visits", "visitors", "returning_visitors", "clicks", "contact_clicks", "moment_opens", "video_plays", "searches", "minutes_on_site"];
  const lines = [head.join(","), ...rows.map((r) => [r.day, r.visits, r.visitors, r.returning, r.clicks, r.contactClicks, r.momentOpens, r.videoPlays, r.searches, r.minutesOnSite].join(","))];
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="moonshot-connect-stats-${days || "all"}d.csv"`, "Cache-Control": "private, no-store" },
  });
}
