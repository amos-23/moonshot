import "server-only";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { schema } from "@/lib/db";
import { eventCounts, eventPhase, listEvents, type EventSpace, type Phase } from "@/lib/events";
import { themeKind } from "@/lib/theme";

// What the admin (/adminx) shows for Event Connect: what needs attention, the totals, and the events with their
// numbers. Pages ask for what they need; nothing here changes data.

export type EventStatus = Phase | "waiting" | "hidden" | "featured";

/** One status per event, in the order an admin cares about: hidden, waiting for approval, a featured ad, then by date. */
export function eventStatus(e: EventSpace): EventStatus {
  if (e.hidden) return "hidden";
  if (!e.listed) return "waiting";
  if (e.promo) return "featured";
  return eventPhase(e);
}

export const STATUS_LABEL: Record<EventStatus, string> = { live: "Happening now", before: "Upcoming", after: "Past", waiting: "Waiting for approval", hidden: "Hidden", featured: "Featured ad" };

/** What's missing for an event to look complete on the site. */
export function eventGaps(e: EventSpace): string[] {
  const gaps: string[] = [];
  if (!e.startsAt) gaps.push("dates");
  if (!e.venue) gaps.push("venue");
  if (!e.url) gaps.push("website");
  if (themeKind(e) === "default" && !e.logo && !e.brandColor) gaps.push("logo or colour");
  return gaps;
}

export type EventRow = EventSpace & { status: EventStatus; people: number; visits: number; moments: number; gaps: string[] };

/** Every event (hidden and waiting ones too) with its people, visits and moments. */
export async function eventRows(db: DB): Promise<EventRow[]> {
  const events = await listEvents(db, { includeHidden: true });
  const [counts, moments] = await Promise.all([
    eventCounts(db, events),
    events.length
      ? db
          .select({ id: schema.moments.eventId, n: sql<number>`count(*)::int` })
          .from(schema.moments)
          .where(and(inArray(schema.moments.eventId, events.map((e) => e.id)), eq(schema.moments.hidden, false)))
          .groupBy(schema.moments.eventId)
      : Promise.resolve([]),
  ]);
  const momentsBy = new Map(moments.map((m) => [m.id, m.n]));
  return events.map((e) => ({ ...e, status: eventStatus(e), ...(counts.get(e.id) ?? { people: 0, visits: 0 }), moments: momentsBy.get(e.id) ?? 0, gaps: eventGaps(e) }));
}

export type Report = typeof schema.reports.$inferSelect & { what: string; eventSlug: string | null; eventName: string | null; preview: string | null; hidden: boolean; count: number; reasons: string[] };

/**
 * Open reports, one per reported thing (several reports on the same moment are one row, with their count and
 * reasons): what it is, its event and whether it's already hidden. Newest first.
 */
export async function openReports(db: DB, limit = 100): Promise<Report[]> {
  const reports = await db.select().from(schema.reports).where(eq(schema.reports.resolved, false)).orderBy(desc(schema.reports.createdAt)).limit(limit);
  if (!reports.length) return [];
  const ids = (t: string) => reports.filter((r) => r.targetType === t).map((r) => r.targetId);
  const ev = schema.eventSpaces;
  const [people, moments, posts, comments, checkins] = await Promise.all([
    ids("person").length ? db.select({ id: schema.people.id, name: schema.people.name, sub: schema.people.headline, hidden: schema.people.hidden, slug: ev.slug, ev: ev.name }).from(schema.people).innerJoin(ev, eq(ev.id, schema.people.eventId)).where(inArray(schema.people.id, ids("person"))) : [],
    ids("moment").length
      ? db.select({ id: schema.moments.id, body: schema.moments.body, xText: schema.moments.xText, name: schema.moments.name, hidden: schema.moments.hidden, slug: ev.slug, ev: ev.name }).from(schema.moments).innerJoin(ev, eq(ev.id, schema.moments.eventId)).where(inArray(schema.moments.id, ids("moment")))
      : [],
    ids("post").length ? db.select({ id: schema.socialPosts.id, handle: schema.socialPosts.authorHandle, content: schema.socialPosts.content, hidden: schema.socialPosts.hidden, slug: ev.slug, ev: ev.name }).from(schema.socialPosts).innerJoin(ev, eq(ev.id, schema.socialPosts.eventId)).where(inArray(schema.socialPosts.id, ids("post"))) : [],
    ids("comment").length
      ? db
          .select({ id: schema.comments.id, name: schema.comments.name, body: schema.comments.body, hidden: schema.comments.hidden, slug: ev.slug, ev: ev.name })
          .from(schema.comments)
          .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
          .innerJoin(ev, eq(ev.id, schema.socialPosts.eventId))
          .where(inArray(schema.comments.id, ids("comment")))
      : [],
    ids("checkin").length ? db.select({ id: schema.checkins.id, name: schema.checkins.name, place: schema.checkins.place, hidden: schema.checkins.hidden, slug: ev.slug, ev: ev.name }).from(schema.checkins).innerJoin(ev, eq(ev.id, schema.checkins.eventId)).where(inArray(schema.checkins.id, ids("checkin"))) : [],
  ]);
  const info = new Map<string, { what: string; preview: string | null; hidden: boolean; slug: string; ev: string }>();
  for (const p of people) info.set(p.id, { what: `Card: ${p.name}`, preview: p.sub, hidden: p.hidden, slug: p.slug, ev: p.ev });
  for (const m of moments) info.set(m.id, { what: m.name ? `Moment by ${m.name}` : "Moment", preview: m.body || m.xText || "Photo", hidden: m.hidden, slug: m.slug, ev: m.ev });
  for (const p of posts) info.set(p.id, { what: `X card: @${p.handle}`, preview: p.content, hidden: p.hidden, slug: p.slug, ev: p.ev });
  for (const c of comments) info.set(c.id, { what: `Comment by ${c.name}`, preview: c.body, hidden: c.hidden, slug: c.slug, ev: c.ev });
  for (const c of checkins) info.set(c.id, { what: `Check-in: ${c.name}`, preview: c.place, hidden: c.hidden, slug: c.slug, ev: c.ev });
  const grouped = new Map<string, Report>();
  for (const r of reports) {
    const g = grouped.get(r.targetId);
    if (g) {
      g.count++;
      if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
      continue;
    }
    const i = info.get(r.targetId);
    grouped.set(r.targetId, { ...r, what: i?.what ?? `${r.targetType} (removed)`, preview: i?.preview?.slice(0, 160) ?? null, hidden: i?.hidden ?? true, eventSlug: i?.slug ?? null, eventName: i?.ev ?? null, count: 1, reasons: [r.reason] });
  }
  return [...grouped.values()];
}

/** Site-wide totals for Event Connect. */
export async function connectTotals(db: DB) {
  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);
  const count = sql<number>`count(*)::int`;
  const [people, moments, comments, here, accounts, mailing, views30] = await Promise.all([
    n(db.select({ n: count }).from(schema.people).where(eq(schema.people.hidden, false))),
    n(db.select({ n: count }).from(schema.moments).where(eq(schema.moments.hidden, false))),
    n(db.select({ n: count }).from(schema.comments).where(eq(schema.comments.hidden, false))),
    n(db.select({ n: count }).from(schema.checkins).where(and(eq(schema.checkins.hidden, false), isNull(schema.checkins.endedAt), gt(schema.checkins.expiresAt, new Date())))),
    n(db.select({ n: count }).from(schema.accounts)),
    n(db.select({ n: count }).from(schema.signups)),
    n(db.select({ n: count }).from(schema.events).where(and(eq(schema.events.type, "view"), gt(schema.events.createdAt, new Date(Date.now() - 30 * 86_400_000))))),
  ]);
  return { people, moments, comments, here, accounts, mailing, views30 };
}

export type Activity = { at: Date; icon: string; text: string; sub: string | null; slug: string };

/** The latest things people did, across every event. */
export async function latestActivity(db: DB, limit = 12): Promise<Activity[]> {
  const ev = schema.eventSpaces;
  const [people, moments, comments] = await Promise.all([
    db.select({ at: schema.people.createdAt, name: schema.people.name, sub: schema.people.headline, slug: ev.slug, short: ev.short }).from(schema.people).innerJoin(ev, eq(ev.id, schema.people.eventId)).orderBy(desc(schema.people.createdAt)).limit(limit),
    db
      .select({ at: schema.moments.createdAt, name: schema.moments.name, x: schema.moments.xAuthorName, xh: schema.moments.xAuthorHandle, body: schema.moments.body, xText: schema.moments.xText, slug: ev.slug, short: ev.short })
      .from(schema.moments)
      .innerJoin(ev, eq(ev.id, schema.moments.eventId))
      .orderBy(desc(schema.moments.createdAt))
      .limit(limit),
    db
      .select({ at: schema.comments.createdAt, name: schema.comments.name, body: schema.comments.body, slug: ev.slug, short: ev.short })
      .from(schema.comments)
      .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
      .innerJoin(ev, eq(ev.id, schema.socialPosts.eventId))
      .orderBy(desc(schema.comments.createdAt))
      .limit(limit),
  ]);
  return [
    ...people.map((p) => ({ at: p.at, icon: "🪪", text: `${p.name} added a card · ${p.short}`, sub: p.sub, slug: p.slug })),
    ...moments.map((m) => ({ at: m.at, icon: m.x || m.xh ? "𝕏" : "📸", text: `${m.name ?? m.x ?? (m.xh ? `@${m.xh}` : "Someone")} shared a moment · ${m.short}`, sub: (m.body || m.xText || "").slice(0, 100) || null, slug: m.slug })),
    ...comments.map((c) => ({ at: c.at, icon: "💬", text: `${c.name} commented · ${c.short}`, sub: c.body.slice(0, 100), slug: c.slug })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

/** Recently hidden things across every event (by reports or by an admin), so a wrong call can be undone. */
export async function recentlyHidden(db: DB, limit = 40) {
  const ev = schema.eventSpaces;
  const [people, moments, comments] = await Promise.all([
    db.select({ id: schema.people.id, title: schema.people.name, sub: schema.people.headline, at: schema.people.updatedAt, slug: ev.slug, short: ev.short }).from(schema.people).innerJoin(ev, eq(ev.id, schema.people.eventId)).where(eq(schema.people.hidden, true)).orderBy(desc(schema.people.updatedAt)).limit(limit),
    db
      .select({ id: schema.moments.id, name: schema.moments.name, body: schema.moments.body, xText: schema.moments.xText, at: schema.moments.createdAt, slug: ev.slug, short: ev.short })
      .from(schema.moments)
      .innerJoin(ev, eq(ev.id, schema.moments.eventId))
      .where(eq(schema.moments.hidden, true))
      .orderBy(desc(schema.moments.createdAt))
      .limit(limit),
    db
      .select({ id: schema.comments.id, title: schema.comments.name, sub: schema.comments.body, at: schema.comments.createdAt, slug: ev.slug, short: ev.short })
      .from(schema.comments)
      .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
      .innerJoin(ev, eq(ev.id, schema.socialPosts.eventId))
      .where(eq(schema.comments.hidden, true))
      .orderBy(desc(schema.comments.createdAt))
      .limit(limit),
  ]);
  return [
    ...people.map((p) => ({ kind: "person" as const, id: p.id, title: `Card: ${p.title}`, sub: p.sub, at: p.at, slug: p.slug, short: p.short })),
    ...moments.map((m) => ({ kind: "moment" as const, id: m.id, title: m.name ? `Moment by ${m.name}` : "Moment", sub: (m.body || m.xText || "Photo").slice(0, 120), at: m.at, slug: m.slug, short: m.short })),
    ...comments.map((c) => ({ kind: "comment" as const, id: c.id, title: `Comment by ${c.title}`, sub: c.sub.slice(0, 120), at: c.at, slug: c.slug, short: c.short })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
