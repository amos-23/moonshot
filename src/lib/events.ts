import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { MOONSHOT_EVENT_ID } from "@/lib/db/schema";
import type { EventSpace } from "@/lib/db/schema";

export type { EventSpace };

/** Addresses taken by the site itself, so no event can use them as its slug. */
export const RESERVED_SLUGS = new Set(["admin", "api", "auth", "signin", "account", "card", "m", "p", "og", "photo", "moment-photo", "moments", "meet", "update", "signup", "events", "new-event", "icon.svg", "favicon.ico", "robots.txt", "sitemap.xml", "_next"]);

/** Where an event is in time. EVENT_MODE=before|live|after overrides it for every event (for testing). */
export type Phase = "before" | "live" | "after";
export function eventPhase(e: Pick<EventSpace, "startsAt" | "endsAt">, now = new Date()): Phase {
  const mode = process.env.EVENT_MODE;
  if (mode === "before" || mode === "live" || mode === "after") return mode;
  if (e.endsAt && now >= e.endsAt) return "after";
  if (e.startsAt && now < e.startsAt) return "before";
  return "live";
}

export async function getEvent(db: DB, slug: string): Promise<EventSpace | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  return (await db.query.eventSpaces.findFirst({ where: eq(s.eventSpaces.slug, slug) })) ?? null;
}

export async function getEventById(db: DB, id: string): Promise<EventSpace | null> {
  return (await db.query.eventSpaces.findFirst({ where: eq(s.eventSpaces.id, id) })) ?? null;
}

/** Events for the homepage, in the order chosen in admin. Admins also see hidden and not-yet-approved ones. */
export async function listEvents(db: DB, opts: { includeHidden?: boolean } = {}): Promise<EventSpace[]> {
  const all = await db.select().from(s.eventSpaces).orderBy(asc(s.eventSpaces.position), asc(s.eventSpaces.createdAt));
  return opts.includeHidden ? all : all.filter((e) => !e.hidden && e.listed);
}

/**
 * For each event: people (cards plus "From X" authors without their own card, the same people its page lists)
 * and visits (page views on its pages). Views from before events had their own addresses were all Moonshot's.
 */
export async function eventCounts(db: DB, events: Pick<EventSpace, "id" | "slug">[]) {
  const out = new Map<string, { people: number; visits: number }>(events.map((e) => [e.id, { people: 0, visits: 0 }]));
  if (!events.length) return out;
  const ids = events.map((e) => e.id);
  const slugs = events.map((e) => e.slug);
  const segment = sql<string>`split_part(${s.events.path}, '/', 2)`;
  const [cards, xAuthors, views, legacy] = await Promise.all([
    db.select({ id: s.people.eventId, n: sql<number>`count(*)::int` }).from(s.people).where(and(inArray(s.people.eventId, ids), eq(s.people.hidden, false))).groupBy(s.people.eventId),
    db
      .select({ id: s.socialPosts.eventId, n: sql<number>`count(distinct lower(${s.socialPosts.authorHandle}))::int` })
      .from(s.socialPosts)
      .where(
        and(
          inArray(s.socialPosts.eventId, ids),
          eq(s.socialPosts.hidden, false),
          sql`${s.socialPosts.authorHandle} is not null`,
          sql`not exists (select 1 from ${s.people} p where lower(p.x_handle) = lower(${s.socialPosts.authorHandle}) and p.hidden = false and p.event_id = ${s.socialPosts.eventId})`,
        ),
      )
      .groupBy(s.socialPosts.eventId),
    db.select({ slug: segment, n: sql<number>`count(*)::int` }).from(s.events).where(and(eq(s.events.type, "view"), inArray(segment, slugs))).groupBy(segment),
    ids.includes(MOONSHOT_EVENT_ID)
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(s.events)
          .where(sql`${s.events.type} = 'view' and ${s.events.createdAt} < (select min(e.created_at) from ${s.events} e where e.type = 'view' and split_part(e.path, '/', 2) = 'moonshot')`)
          .then((r) => r[0].n)
      : Promise.resolve(0),
  ]);
  for (const r of [...cards, ...xAuthors]) out.get(r.id)!.people += r.n;
  const bySlug = new Map(events.map((e) => [e.slug, e.id]));
  for (const r of views) out.get(bySlug.get(r.slug)!)!.visits += r.n;
  if (out.has(MOONSHOT_EVENT_ID)) out.get(MOONSHOT_EVENT_ID)!.visits += legacy;
  return out;
}

/** Events an account created, newest first. */
export async function ownedEvents(db: DB, accountId: string): Promise<EventSpace[]> {
  return db.select().from(s.eventSpaces).where(eq(s.eventSpaces.ownerId, accountId)).orderBy(desc(s.eventSpaces.createdAt));
}

/** A brand colour as typed: "#5b3df5" or "5B3DF5" → "#5b3df5"; anything else → null. */
export function cleanColor(v: string | null | undefined): string | null {
  const m = String(v ?? "").trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/** "Moonshot" → "#Moonshot" style tag used in ready-made posts: the event's hashtag, else none. */
export const eventTag = (e: Pick<EventSpace, "hashtag">) => e.hashtag?.trim() || "";

/** Each event has its own check-in cookie (Moonshot keeps the original name). */
export const checkinCookie = (eventId: string) => (eventId === MOONSHOT_EVENT_ID ? "mc_checkin" : `mc_checkin_${eventId.slice(0, 8)}`);
