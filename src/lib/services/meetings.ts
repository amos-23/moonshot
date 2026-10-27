import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AppError } from "./errors";
import { areConnected, isBlockedPair } from "./people";

export type MeetingInput = { inviteeId: string; startsAt: Date; durationMinutes: number; location: string; note: string };

export async function proposeMeeting(db: DB, proposerId: string, input: MeetingInput) {
  if (proposerId === input.inviteeId) throw new AppError("You can't schedule a meeting with yourself.");
  if (input.startsAt.getTime() < Date.now() - 5 * 60_000) throw new AppError("Pick a time in the future.");
  if ((await isBlockedPair(db, proposerId, input.inviteeId)) || !(await areConnected(db, proposerId, input.inviteeId))) {
    throw new AppError("You can only suggest meetings to your connections.", "forbidden");
  }
  const [row] = await db
    .insert(s.meetings)
    .values({ proposerId, ...input, status: "proposed" })
    .returning();
  return row;
}

export async function respondToMeeting(db: DB, userId: string, meetingId: string, action: "confirm" | "decline") {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId) });
  if (!m || m.inviteeId !== userId) throw new AppError("Meeting not found.", "not_found");
  if (m.status !== "proposed") throw new AppError("This meeting has already been answered.", "conflict");
  const [row] = await db
    .update(s.meetings)
    .set({ status: action === "confirm" ? "confirmed" : "declined", respondedAt: new Date() })
    .where(and(eq(s.meetings.id, meetingId), eq(s.meetings.status, "proposed")))
    .returning();
  return row;
}

export async function cancelMeeting(db: DB, userId: string, meetingId: string) {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId) });
  if (!m || (m.inviteeId !== userId && m.proposerId !== userId)) throw new AppError("Meeting not found.", "not_found");
  if (!["proposed", "confirmed"].includes(m.status)) throw new AppError("This meeting is no longer active.", "conflict");
  await db.update(s.meetings).set({ status: "cancelled", respondedAt: new Date() }).where(eq(s.meetings.id, meetingId));
}

export async function meetingsFor(db: DB, userId: string) {
  const rows = await db
    .select({ meeting: s.meetings, profile: s.profiles })
    .from(s.meetings)
    .innerJoin(
      s.profiles,
      or(
        and(eq(s.meetings.proposerId, userId), eq(s.profiles.userId, s.meetings.inviteeId)),
        and(eq(s.meetings.inviteeId, userId), eq(s.profiles.userId, s.meetings.proposerId)),
      ),
    )
    .where(
      and(
        inArray(s.meetings.status, ["proposed", "confirmed"]),
        or(eq(s.meetings.proposerId, userId), eq(s.meetings.inviteeId, userId)),
      ),
    )
    .orderBy(asc(s.meetings.startsAt));
  return rows.map((r) => ({ ...r, mine: r.meeting.proposerId === userId }));
}
