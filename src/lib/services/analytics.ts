import { and, eq, gte, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";

export const EVENTS = [
  "profile_created",
  "profile_completed",
  "recommendation_viewed",
  "search_performed",
  "profile_saved",
  "connection_request_sent",
  "connection_request_accepted",
  "message_sent",
  "meeting_proposed",
  "meeting_confirmed",
  "meetup_joined",
  "exhibitor_saved",
  "x_post_opened",
] as const;
export type AnalyticsEvent = (typeof EVENTS)[number];

/** Fire-and-forget: analytics must never break a user flow. */
export async function track(db: DB, name: AnalyticsEvent, userId: string | null, props: Record<string, unknown> = {}) {
  try {
    await db.insert(s.analyticsEvents).values({ name, userId, props });
  } catch (err) {
    console.error("analytics: failed to record", name, err);
  }
}

export async function metrics(db: DB, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const counts = await db
    .select({ name: s.analyticsEvents.name, n: sql<number>`count(*)::int`, users: sql<number>`count(distinct user_id)::int` })
    .from(s.analyticsEvents)
    .where(gte(s.analyticsEvents.createdAt, since))
    .groupBy(s.analyticsEvents.name);

  const one = async (q: ReturnType<typeof sql>) => {
    const res = await db.execute(q);
    const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { n: number }[];
    return Number(rows[0]?.n ?? 0);
  };

  const [profiles, users, accepted, conversationsBothWays, confirmedMeetings, meetupJoins, pending] = await Promise.all([
    one(sql`select count(*)::int as n from profiles`),
    one(sql`select count(*)::int as n from users`),
    one(sql`select count(*)::int as n from connection_requests where status = 'accepted'`),
    // A "meaningful" connection: both people have sent at least one message.
    one(sql`select count(*)::int as n from conversations c
            where exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = c.user_a)
              and exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = c.user_b)`),
    one(sql`select count(*)::int as n from meetings where status = 'confirmed'`),
    one(sql`select count(*)::int as n from meetup_participants`),
    one(sql`select count(*)::int as n from connection_requests where status = 'pending'`),
  ]);

  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${s.analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(s.analyticsEvents)
    .where(and(eq(s.analyticsEvents.name, "connection_request_accepted"), gte(s.analyticsEvents.createdAt, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return {
    counts: Object.fromEntries(counts.map((c) => [c.name, c])) as Record<string, { n: number; users: number }>,
    totals: { profiles, users, accepted, conversationsBothWays, confirmedMeetings, meetupJoins, pending },
    daily,
  };
}
