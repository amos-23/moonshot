import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

/** Everything the admin Stats page shows, for the last `days` days. */
export async function siteStats(db: DB, days: number) {
  const from = since(days);
  const inRange = gte(s.events.createdAt, from);

  const [totals] = await db
    .select({
      views: sql<number>`count(*) filter (where ${s.events.type} = 'view')::int`,
      visitors: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view')::int`,
      clicks: sql<number>`count(*) filter (where ${s.events.type} = 'click')::int`,
      searches: sql<number>`count(*) filter (where ${s.events.type} = 'search')::int`,
    })
    .from(s.events)
    .where(inRange);

  const day = sql<string>`to_char(${s.events.createdAt} at time zone 'Africa/Lagos', 'YYYY-MM-DD')`;
  const daily = await db
    .select({ day, views: sql<number>`count(*)::int`, visitors: sql<number>`count(distinct ${s.events.visitor})::int` })
    .from(s.events)
    .where(and(inRange, eq(s.events.type, "view")))
    .groupBy(day)
    .orderBy(day);

  const top = (col: typeof s.events.path | typeof s.events.referrer | typeof s.events.target, type: "view" | "click") =>
    db
      .select({ key: col, n: sql<number>`count(*)::int` })
      .from(s.events)
      .where(and(inRange, eq(s.events.type, type), sql`${col} is not null`))
      .groupBy(col)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

  const searchRows = (onlyEmpty: boolean) =>
    db
      .select({ key: s.events.query, n: sql<number>`count(*)::int`, results: sql<number>`max(${s.events.results})::int` })
      .from(s.events)
      .where(and(inRange, eq(s.events.type, "search"), onlyEmpty ? eq(s.events.results, 0) : undefined))
      .groupBy(s.events.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

  const [pages, referrers, clicks, topTargets, searches, emptySearches] = await Promise.all([
    top(s.events.path, "view"),
    top(s.events.referrer, "view"),
    top(s.events.target, "click"),
    // Which cards / posts get clicked most (contact buttons, "View post", comments).
    db
      .select({
        id: s.events.targetId,
        n: sql<number>`count(*)::int`,
        name: sql<string | null>`coalesce((select p.name from ${s.people} p where p.id = ${s.events.targetId}), (select '@' || x.author_handle from ${s.socialPosts} x where x.id = ${s.events.targetId}))`,
      })
      .from(s.events)
      .where(and(inRange, eq(s.events.type, "click"), sql`${s.events.targetId} is not null`))
      .groupBy(s.events.targetId)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    searchRows(false),
    searchRows(true),
  ]);

  const count = async (table: typeof s.people | typeof s.socialPosts | typeof s.comments, col: typeof s.people.createdAt | typeof s.socialPosts.importedAt | typeof s.comments.createdAt) => {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(gte(col, from));
    return r.n;
  };
  const [mRow] = await db.select({ n: sql<number>`count(*)::int`, photos: sql<number>`count(*) filter (where ${s.moments.hasPhoto})::int` }).from(s.moments).where(gte(s.moments.createdAt, from));
  const [cards, posts, comments] = await Promise.all([
    count(s.people, s.people.createdAt),
    count(s.socialPosts, s.socialPosts.importedAt),
    count(s.comments, s.comments.createdAt),
  ]);

  // Fill missing days so the chart has one bar per day.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: Math.min(days, 31) }, (_, i) => {
    const d = new Date(Date.now() - (Math.min(days, 31) - 1 - i) * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
    return { day: key, views: byDay.get(key)?.views ?? 0, visitors: byDay.get(key)?.visitors ?? 0 };
  });

  // Funnel: visitors → opened the form → made a card → contacted someone.
  const CONTACT = ["whatsapp", "x_profile", "linkedin", "email", "website"];
  const [funnel] = await db
    .select({
      formVisitors: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view' and ${s.events.path} = '/card')::int`,
      contacters: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${sql.join(CONTACT.map((c) => sql`${c}`), sql`, `)}))::int`,
      contactClicks: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${sql.join(CONTACT.map((c) => sql`${c}`), sql`, `)}))::int`,
    })
    .from(s.events)
    .where(inRange);

  return { funnel, totals, series, pages, referrers, clicks, topTargets, searches, emptySearches, added: { cards, posts, comments, moments: mRow.n, momentPhotos: mRow.photos } };
}
