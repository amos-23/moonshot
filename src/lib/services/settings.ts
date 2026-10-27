import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { SUGGESTED_SEARCHES } from "@/lib/constants";
import type { EventInfo } from "@/lib/validation";

// Facts provided in the product brief. Everything else (venue, schedule) is left for an admin to
// fill in from official sources rather than guessed.
export const DEFAULT_EVENT_INFO: EventInfo = {
  name: "Moonshot by TechCabal",
  dates: "28–29 October 2026",
  city: "Lagos, Nigeria",
  venue: "",
  officialUrl: null,
  summary:
    "Moonshot is TechCabal's annual conference for Africa's technology ecosystem. Check the official website for the agenda, venue and tickets.",
  hashtags: "",
};

export async function getSetting<T>(db: DB, key: string): Promise<T | null> {
  const row = await db.query.settings.findFirst({ where: eq(s.settings.key, key) });
  return (row?.value as T) ?? null;
}

export async function setSetting(db: DB, key: string, value: unknown) {
  await db
    .insert(s.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: s.settings.key, set: { value, updatedAt: new Date() } });
}

export async function getEventInfo(db: DB): Promise<EventInfo> {
  const stored = await getSetting<Partial<EventInfo>>(db, "event_info");
  return { ...DEFAULT_EVENT_INFO, ...(stored ?? {}) };
}

export async function getSearchQueries(db: DB): Promise<string[]> {
  return (await getSetting<string[]>(db, "x_search_queries")) ?? SUGGESTED_SEARCHES;
}
