import { and, asc, eq, gte, ne, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AppError } from "./errors";
import { blockedIds } from "./people";

export type MeetupInput = {
  title: string;
  description: string;
  topic: string;
  startsAt: Date;
  location: string | null;
  onlineUrl: string | null;
  capacity: number;
};

export async function createMeetup(db: DB, organiserId: string, input: MeetupInput) {
  if (input.startsAt.getTime() < Date.now() - 5 * 60_000) throw new AppError("Pick a time in the future.");
  return db.transaction(async (tx) => {
    const [m] = await tx.insert(s.meetups).values({ organiserId, ...input, status: "proposed" }).returning();
    await tx.insert(s.meetupParticipants).values({ meetupId: m.id, userId: organiserId });
    return m;
  });
}

export async function listMeetups(db: DB, viewerId: string | null, opts: { topic?: string; includePast?: boolean } = {}) {
  return db
    .select({
      meetup: s.meetups,
      organiser: s.profiles,
      count: sql<number>`(select count(*)::int from meetup_participants mp where mp.meetup_id = ${s.meetups.id})`,
      joined: viewerId
        ? sql<boolean>`exists(select 1 from meetup_participants mp where mp.meetup_id = ${s.meetups.id} and mp.user_id = ${viewerId})`
        : sql<boolean>`false`,
    })
    .from(s.meetups)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.meetups.organiserId))
    .where(
      and(
        ne(s.meetups.status, "cancelled"),
        opts.topic ? eq(s.meetups.topic, opts.topic) : undefined,
        opts.includePast ? undefined : gte(s.meetups.startsAt, new Date(Date.now() - 3 * 60 * 60_000)),
      ),
    )
    .orderBy(asc(s.meetups.startsAt));
}

export async function getMeetup(db: DB, viewerId: string | null, id: string) {
  const m = await db.query.meetups.findFirst({ where: eq(s.meetups.id, id) });
  if (!m) return null;
  const organiser = await db.query.profiles.findFirst({ where: eq(s.profiles.userId, m.organiserId) });
  const participants = await db
    .select({ profile: s.profiles, joinedAt: s.meetupParticipants.joinedAt })
    .from(s.meetupParticipants)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.meetupParticipants.userId))
    .where(eq(s.meetupParticipants.meetupId, id))
    .orderBy(asc(s.meetupParticipants.joinedAt));
  const blocked = viewerId ? await blockedIds(db, viewerId) : new Set<string>();
  // Privacy: list only people whose profile the viewer is allowed to see; count everyone else.
  const visible = participants.filter(
    (p) =>
      p.profile.userId === viewerId ||
      (!blocked.has(p.profile.userId) &&
        (p.profile.visibility === "public" || (viewerId && p.profile.visibility === "members"))),
  );
  return {
    meetup: m,
    organiser,
    visible: visible.map((p) => p.profile),
    total: participants.length,
    joined: viewerId ? participants.some((p) => p.profile.userId === viewerId) : false,
  };
}

export async function joinMeetup(db: DB, userId: string, meetupId: string) {
  await db.transaction(async (tx) => {
    // Lock the meetup row so concurrent joins can't exceed capacity.
    await tx.execute(sql`select id from meetups where id = ${meetupId} for update`);
    const m = await tx.query.meetups.findFirst({ where: eq(s.meetups.id, meetupId) });
    if (!m || m.status === "cancelled") throw new AppError("Meetup not found.", "not_found");
    if ((await blockedIds(tx as unknown as DB, userId)).has(m.organiserId)) throw new AppError("Meetup not found.", "not_found");
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.meetupParticipants)
      .where(eq(s.meetupParticipants.meetupId, meetupId));
    const already = await tx.query.meetupParticipants.findFirst({
      where: and(eq(s.meetupParticipants.meetupId, meetupId), eq(s.meetupParticipants.userId, userId)),
    });
    if (already) return;
    if (n >= m.capacity) throw new AppError("This meetup is full.", "conflict");
    await tx.insert(s.meetupParticipants).values({ meetupId, userId });
  });
}

export async function leaveMeetup(db: DB, userId: string, meetupId: string) {
  const m = await db.query.meetups.findFirst({ where: eq(s.meetups.id, meetupId) });
  if (!m) throw new AppError("Meetup not found.", "not_found");
  if (m.organiserId === userId) throw new AppError("Organisers can cancel the meetup instead of leaving.", "invalid");
  await db
    .delete(s.meetupParticipants)
    .where(and(eq(s.meetupParticipants.meetupId, meetupId), eq(s.meetupParticipants.userId, userId)));
}

export async function setMeetupStatus(db: DB, actor: { id: string; role: string }, meetupId: string, status: "proposed" | "confirmed" | "cancelled") {
  const m = await db.query.meetups.findFirst({ where: eq(s.meetups.id, meetupId) });
  if (!m) throw new AppError("Meetup not found.", "not_found");
  if (m.organiserId !== actor.id && actor.role !== "admin") throw new AppError("Only the organiser can change this meetup.", "forbidden");
  await db.update(s.meetups).set({ status, updatedAt: new Date() }).where(eq(s.meetups.id, meetupId));
}

export async function meetupsJoinedBy(db: DB, userId: string) {
  return db
    .select({ meetup: s.meetups })
    .from(s.meetupParticipants)
    .innerJoin(s.meetups, eq(s.meetups.id, s.meetupParticipants.meetupId))
    .where(and(eq(s.meetupParticipants.userId, userId), ne(s.meetups.status, "cancelled")))
    .orderBy(asc(s.meetups.startsAt));
}
