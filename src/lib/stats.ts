import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";

const DAY = 86_400_000;
const LAGOS = "Africa/Lagos";
// Written into the SQL as-is (not a parameter), so GROUP BY sees the same expression as SELECT.
const TZ = sql.raw(`'${LAGOS}'`);

/** Buttons that reach out to someone: the whole point of the site. */
export const CONTACT = ["whatsapp", "x_profile", "linkedin", "email", "website", "checkin_contact"];
/** Share buttons (X, WhatsApp, copy, the phone's share sheet). */
const SHARE = sql`(${s.events.target} like '%share%' and ${s.events.target} not in ('moments_share_open', 'moments_share_fab'))`;

/** Ways of opening a moment. */
export const MOMENT_OPEN = ["moment_open", "moments_featured", "highlights_tile", "moments_strip_open", "moment_browse"];

const list = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);
/** Visits that arrived on a link shared with the site's own share buttons (their campaign names). */
export const SHARE_CAMPAIGNS = ["moment", "moments", "posted", "card", "home", "invite", "story"];
const FROM_SHARE = sql`split_part(${s.events.campaign}, '/', 2) in (${list(SHARE_CAMPAIGNS)})`;

/** 1, 7, 30 or 90 days, or 0 for all time. */
export type Range = 0 | 1 | 7 | 30 | 90;
export const RANGES: { days: Range; label: string }[] = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

/** Headline numbers between two times. */
async function totals(db: DB, from: Date, to: Date) {
  const [t] = await db
    .select({
      views: sql<number>`count(*) filter (where ${s.events.type} = 'view')::int`,
      visitors: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view')::int`,
      returning: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view' and ${s.events.returning})::int`,
      clicks: sql<number>`count(*) filter (where ${s.events.type} = 'click')::int`,
      searches: sql<number>`count(*) filter (where ${s.events.type} = 'search')::int`,
      contacters: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${list(CONTACT)}))::int`,
      contactClicks: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${list(CONTACT)}))::int`,
      timeMs: sql<number>`coalesce(sum(${s.events.ms}) filter (where ${s.events.type} = 'leave'), 0)::float8`,
      timedVisitors: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'leave')::int`,
      shares: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${SHARE})::int`,
      fromShares: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view' and ${FROM_SHARE})::int`,
    })
    .from(s.events)
    .where(and(gte(s.events.createdAt, from), lt(s.events.createdAt, to)));
  return {
    ...t,
    // Average time on the site per visitor whose time was measured (older visits didn't measure it).
    avgTimeMs: t.timedVisitors ? t.timeMs / t.timedVisitors : 0,
    pagesPerVisitor: t.visitors ? t.views / t.visitors : 0,
    contactRate: t.visitors ? t.contacters / t.visitors : 0,
  };
}

export type Totals = Awaited<ReturnType<typeof totals>>;

/** Everything the admin Stats page shows for a range (with the period before it, to compare). */
export async function siteStats(db: DB, days: Range, now = new Date()) {
  const [first] = await db.select({ at: sql<Date | null>`min(${s.events.createdAt})` }).from(s.events);
  const firstAt = first.at ? new Date(first.at) : now;
  const from = days ? new Date(now.getTime() - days * DAY) : firstAt;
  const span = now.getTime() - from.getTime();
  const inRange = and(gte(s.events.createdAt, from), lt(s.events.createdAt, now));
  const views = and(inRange, eq(s.events.type, "view"));
  const clicks = and(inRange, eq(s.events.type, "click"));

  const ranked = (col: SQL | typeof s.events.path, where: SQL | undefined, by: "rows" | "visitors" = "rows", limit = 10) =>
    db
      .select({ key: sql<string>`${col}`, n: by === "rows" ? sql<number>`count(*)::int` : sql<number>`count(distinct ${s.events.visitor})::int` })
      .from(s.events)
      .where(and(where, sql`${col} is not null`))
      .groupBy(col)
      .orderBy(desc(sql`2`))
      .limit(limit);

  const searchRows = (onlyEmpty: boolean) =>
    db
      .select({ key: s.events.query, n: sql<number>`count(*)::int`, results: sql<number>`max(${s.events.results})::int` })
      .from(s.events)
      .where(and(inRange, eq(s.events.type, "search"), onlyEmpty ? eq(s.events.results, 0) : undefined))
      .groupBy(s.events.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

  // One bar per hour for 24 hours, else one per day (up to the last 120 days).
  const hourly = days === 1;
  const bucket = hourly ? sql<string>`to_char(${s.events.createdAt} at time zone ${TZ}, 'YYYY-MM-DD"T"HH24')` : sql<string>`to_char(${s.events.createdAt} at time zone ${TZ}, 'YYYY-MM-DD')`;
  const hour = sql<number>`extract(hour from ${s.events.createdAt} at time zone ${TZ})::int`;

  const [cur, prev, live, series, hours, pages, referrers, buttons, devices, campaigns, timeByPage, searches, emptySearches, topTargets, momentFunnel, topMoments] = await Promise.all([
    totals(db, from, now),
    days ? totals(db, new Date(from.getTime() - span), from) : Promise.resolve(null),
    db
      .select({ n: sql<number>`count(distinct ${s.events.visitor})::int` })
      .from(s.events)
      .where(gte(s.events.createdAt, new Date(now.getTime() - 5 * 60_000)))
      .then((r) => r[0].n),
    db
      .select({ key: bucket, views: sql<number>`count(*)::int`, visitors: sql<number>`count(distinct ${s.events.visitor})::int` })
      .from(s.events)
      .where(views)
      .groupBy(bucket)
      .orderBy(bucket),
    db.select({ hour, n: sql<number>`count(*)::int` }).from(s.events).where(views).groupBy(hour).orderBy(hour),
    ranked(s.events.path, views),
    ranked(sql`${s.events.referrer}`, views, "visitors"),
    ranked(sql`${s.events.target}`, clicks, "rows", 40),
    ranked(sql`${s.events.device}`, views, "visitors"),
    ranked(sql`${s.events.campaign}`, views, "visitors"),
    db
      .select({
        key: s.events.path,
        avgMs: sql<number>`(sum(${s.events.ms}) / nullif(count(distinct ${s.events.visitor}), 0))::float8`,
        visitors: sql<number>`count(distinct ${s.events.visitor})::int`,
      })
      .from(s.events)
      .where(and(inRange, eq(s.events.type, "leave")))
      .groupBy(s.events.path)
      .orderBy(desc(sql`count(distinct ${s.events.visitor})`))
      .limit(8),
    searchRows(false),
    searchRows(true),
    // Which cards, posts and moments get clicked most.
    db
      .select({
        id: s.events.targetId,
        n: sql<number>`count(*)::int`,
        name: sql<string | null>`coalesce(
          (select p.name from ${s.people} p where p.id = ${s.events.targetId}),
          (select '@' || x.author_handle from ${s.socialPosts} x where x.id = ${s.events.targetId}),
          (select '📸 ' || coalesce(nullif(m.body, ''), m.x_text, 'photo') from ${s.moments} m where m.id = ${s.events.targetId}))`,
      })
      .from(s.events)
      .where(and(clicks, sql`${s.events.targetId} is not null`))
      .groupBy(s.events.targetId)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    // Moments: visited → opened one → watched a video → followed up with someone / went to X.
    db
      .select({
        visitors: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view' and ${s.events.path} = '/moments')::int`,
        openers: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${list(MOMENT_OPEN)}))::int`,
        opens: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${list(MOMENT_OPEN)}))::int`,
        plays: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in ('video_play', 'gif_play'))::int`,
        followUps: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} in ('moment_person', 'moment_author'))::int`,
        toX: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} = 'moment_x_open')::int`,
        storyViewers: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} = 'story_open')::int`,
        storyFinishers: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'click' and ${s.events.target} = 'story_end')::int`,
        avgMs: sql<number>`coalesce(sum(${s.events.ms}) filter (where ${s.events.type} = 'leave' and ${s.events.path} = '/moments') / nullif(count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'leave' and ${s.events.path} = '/moments'), 0), 0)::float8`,
      })
      .from(s.events)
      .where(inRange)
      .then((r) => r[0]),
    db
      .select({
        id: s.moments.id,
        text: sql<string>`coalesce(nullif(${s.moments.body}, ''), ${s.moments.xText}, 'photo')`,
        who: sql<string>`coalesce(${s.moments.xAuthorName}, '@' || ${s.moments.xAuthorHandle}, ${s.moments.name}, '@' || ${s.moments.xHandle}, (select p.name from ${s.people} p where p.id = ${s.moments.personId}), 'Someone')`,
        likes: s.moments.xLikes,
        opens: sql<number>`count(*) filter (where ${s.events.target} in (${list(MOMENT_OPEN)}))::int`,
        plays: sql<number>`count(*) filter (where ${s.events.target} in ('video_play', 'gif_play'))::int`,
        followUps: sql<number>`count(*) filter (where ${s.events.target} in ('moment_person', 'moment_author', 'moment_x_open'))::int`,
      })
      .from(s.events)
      .innerJoin(s.moments, eq(s.moments.id, s.events.targetId))
      .where(clicks)
      .groupBy(s.moments.id)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);

  // Fill in empty hours/days so the chart has an evenly spaced bar for each.
  const byKey = new Map(series.map((d) => [d.key, d]));
  const fmt = (d: Date) =>
    hourly
      ? new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).format(d).replace(", ", "T")
      : new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS }).format(d);
  const step = hourly ? 3600_000 : DAY;
  const bars = hourly ? 24 : Math.max(1, Math.min(120, Math.ceil(span / DAY)));
  const chart = Array.from({ length: bars }, (_, i) => {
    const key = fmt(new Date(now.getTime() - (bars - 1 - i) * step));
    return { key, views: byKey.get(key)?.views ?? 0, visitors: byKey.get(key)?.visitors ?? 0 };
  });
  const byHour = new Map(hours.map((h) => [h.hour, h.n]));

  // What was added in the range, and in total.
  const added = async (since: Date | null) => {
    const w = (col: PgColumn) => (since ? gte(col, since) : undefined);
    const one = (q: Promise<{ n: number }[]>) => q.then((r) => r[0].n);
    const n = sql<number>`count(*)::int`;
    const [cards, posts, comments, moments, momentPhotos, signups] = await Promise.all([
      one(db.select({ n }).from(s.people).where(w(s.people.createdAt))),
      one(db.select({ n }).from(s.socialPosts).where(w(s.socialPosts.importedAt))),
      one(db.select({ n }).from(s.comments).where(w(s.comments.createdAt))),
      one(db.select({ n }).from(s.moments).where(w(s.moments.createdAt))),
      one(db.select({ n }).from(s.moments).where(and(w(s.moments.createdAt), eq(s.moments.hasPhoto, true)))),
      one(db.select({ n }).from(s.signups).where(w(s.signups.createdAt))),
    ]);
    return { cards, posts, comments, moments, momentPhotos, signups };
  };
  const [addedInRange, addedTotal, formVisitors, reactionsInRange] = await Promise.all([
    added(from),
    added(null),
    db
      .select({ n: sql<number>`count(distinct ${s.events.visitor})::int` })
      .from(s.events)
      .where(and(views, eq(s.events.path, "/card")))
      .then((r) => r[0].n),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.reactions)
      .where(gte(s.reactions.createdAt, from))
      .then((r) => r[0].n),
  ]);

  return {
    days,
    from,
    hourly,
    totals: cur,
    prev,
    live,
    chart,
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, n: byHour.get(h) ?? 0 })),
    funnel: { visitors: cur.visitors, formVisitors, cards: addedInRange.cards, contacters: cur.contacters, contactClicks: cur.contactClicks },
    momentFunnel: { ...momentFunnel, reactions: reactionsInRange },
    topMoments,
    pages,
    referrers,
    clicks: buttons,
    devices,
    campaigns,
    timeByPage,
    searches,
    emptySearches,
    topTargets,
    added: addedInRange,
    allTime: addedTotal,
  };
}

/** One row per day (Lagos time) for the CSV download. */
export async function dailyRows(db: DB, from: Date | null) {
  const day = sql<string>`to_char(${s.events.createdAt} at time zone ${TZ}, 'YYYY-MM-DD')`;
  return db
    .select({
      day,
      visits: sql<number>`count(*) filter (where ${s.events.type} = 'view')::int`,
      visitors: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view')::int`,
      returning: sql<number>`count(distinct ${s.events.visitor}) filter (where ${s.events.type} = 'view' and ${s.events.returning})::int`,
      clicks: sql<number>`count(*) filter (where ${s.events.type} = 'click')::int`,
      contactClicks: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${list(CONTACT)}))::int`,
      momentOpens: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in (${list(MOMENT_OPEN)}))::int`,
      videoPlays: sql<number>`count(*) filter (where ${s.events.type} = 'click' and ${s.events.target} in ('video_play', 'gif_play'))::int`,
      searches: sql<number>`count(*) filter (where ${s.events.type} = 'search')::int`,
      minutesOnSite: sql<number>`round(coalesce(sum(${s.events.ms}) filter (where ${s.events.type} = 'leave'), 0) / 60000.0)::int`,
    })
    .from(s.events)
    .where(from ? gte(s.events.createdAt, from) : undefined)
    .groupBy(day)
    .orderBy(day);
}

