import { asc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { MOONSHOT_EVENT_ID } from "@/lib/db/schema";
import type { EventSpace } from "@/lib/db/schema";

export type { EventSpace };

/** Addresses taken by the site itself, so no event can use them as its slug. */
export const RESERVED_SLUGS = new Set(["admin", "api", "card", "m", "p", "og", "photo", "moment-photo", "moments", "meet", "update", "signup", "events", "icon.svg", "favicon.ico", "robots.txt", "sitemap.xml", "_next"]);

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

/** Events for the homepage, in the order chosen in admin (hidden ones only for admins). */
export async function listEvents(db: DB, opts: { includeHidden?: boolean } = {}): Promise<EventSpace[]> {
  const all = await db.select().from(s.eventSpaces).orderBy(asc(s.eventSpaces.position), asc(s.eventSpaces.createdAt));
  return opts.includeHidden ? all : all.filter((e) => !e.hidden);
}

/** "Moonshot" → "#Moonshot" style tag used in ready-made posts: the event's hashtag, else none. */
export const eventTag = (e: Pick<EventSpace, "hashtag">) => e.hashtag?.trim() || "";

/** Each event has its own check-in cookie (Moonshot keeps the original name). */
export const checkinCookie = (eventId: string) => (eventId === MOONSHOT_EVENT_ID ? "mc_checkin" : `mc_checkin_${eventId.slice(0, 8)}`);
