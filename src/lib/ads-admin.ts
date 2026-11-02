import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { rowsOf } from "@/lib/ads";

export interface AdsAdminStats {
  users: number;
  newUsers7: number;
  newUsers30: number;
  withProgress: number;
  visitors30: number;
  events30: { name: string; n: number }[];
  platforms30: { platform: string; n: number }[];
  recent: { id: string; email: string; name: string | null; created_at: Date | string; last_seen_at: Date | string; has_progress: boolean }[];
}

/** Numbers for the AdsSim admin page. */
export async function adsAdminStats(db: DB): Promise<AdsAdminStats> {
  const one = async (q: ReturnType<typeof sql>) => Number(rowsOf<{ n: number | string }>(await db.execute(q))[0]?.n ?? 0);
  const [users, newUsers7, newUsers30, withProgress, visitors30] = await Promise.all([
    one(sql`SELECT count(*)::int AS n FROM "ads"."users"`),
    one(sql`SELECT count(*)::int AS n FROM "ads"."users" WHERE "created_at" > now() - interval '7 days'`),
    one(sql`SELECT count(*)::int AS n FROM "ads"."users" WHERE "created_at" > now() - interval '30 days'`),
    one(sql`SELECT count(*)::int AS n FROM "ads"."progress"`),
    one(sql`SELECT count(DISTINCT "visitor")::int AS n FROM "ads"."events" WHERE "created_at" > now() - interval '30 days'`),
  ]);
  const events30 = rowsOf<{ name: string; n: number | string }>(
    await db.execute(sql`SELECT "name", count(*)::int AS n FROM "ads"."events" WHERE "created_at" > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC`),
  ).map((r) => ({ name: r.name, n: Number(r.n) }));
  const platforms30 = rowsOf<{ platform: string; n: number | string }>(
    await db.execute(sql`SELECT "platform", count(*)::int AS n FROM "ads"."events" WHERE "name" = 'platform_start' AND "platform" IS NOT NULL AND "created_at" > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC`),
  ).map((r) => ({ platform: r.platform, n: Number(r.n) }));
  const recent = rowsOf<AdsAdminStats["recent"][number]>(
    await db.execute(sql`
      SELECT u."id", u."email", u."name", u."created_at", u."last_seen_at", (p."user_id" IS NOT NULL) AS has_progress
      FROM "ads"."users" u LEFT JOIN "ads"."progress" p ON p."user_id" = u."id"
      ORDER BY u."created_at" DESC LIMIT 200`),
  );
  return { users, newUsers7, newUsers30, withProgress, visitors30, events30, platforms30, recent };
}

export async function adsUsersCsv(db: DB): Promise<string> {
  const rows = rowsOf<{ email: string; name: string | null; created_at: Date | string; last_seen_at: Date | string; has_progress: boolean }>(
    await db.execute(sql`
      SELECT u."email", u."name", u."created_at", u."last_seen_at", (p."user_id" IS NOT NULL) AS has_progress
      FROM "ads"."users" u LEFT JOIN "ads"."progress" p ON p."user_id" = u."id" ORDER BY u."created_at"`),
  );
  // Quote every cell; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
  const cell = (v: string | null) => `"${(v ?? "").replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
  const iso = (d: Date | string) => new Date(d).toISOString();
  return [["email", "name", "has_progress", "signed_up_at", "last_seen_at"].join(","), ...rows.map((r) => [cell(r.email), cell(r.name), r.has_progress ? "yes" : "no", iso(r.created_at), iso(r.last_seen_at)].join(","))].join("\r\n") + "\r\n";
}
