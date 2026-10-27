import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { Profile } from "@/lib/db/schema";
import { rankMatches, scoreMatch, type MatchReason } from "@/lib/matching";
import { AppError } from "./errors";

export type Relationship = {
  blockedByMe: boolean;
  blockedMe: boolean;
  connection: s.ConnectionRequest | null; // latest live request between the pair, if any
  connected: boolean;
  saved: boolean;
};

/** IDs of users the viewer must not see: anyone they blocked or who blocked them. */
export async function blockedIds(db: DB, viewerId: string): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(s.blocks)
    .where(or(eq(s.blocks.blockerId, viewerId), eq(s.blocks.blockedId, viewerId)));
  return new Set(rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId)));
}

export async function isBlockedPair(db: DB, a: string, b: string): Promise<boolean> {
  const row = await db
    .select({ x: sql`1` })
    .from(s.blocks)
    .where(
      or(
        and(eq(s.blocks.blockerId, a), eq(s.blocks.blockedId, b)),
        and(eq(s.blocks.blockerId, b), eq(s.blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return row.length > 0;
}

export async function liveConnection(db: DB, a: string, b: string) {
  const rows = await db
    .select()
    .from(s.connectionRequests)
    .where(
      and(
        inArray(s.connectionRequests.status, ["pending", "accepted"]),
        or(
          and(eq(s.connectionRequests.requesterId, a), eq(s.connectionRequests.recipientId, b)),
          and(eq(s.connectionRequests.requesterId, b), eq(s.connectionRequests.recipientId, a)),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function areConnected(db: DB, a: string, b: string): Promise<boolean> {
  const c = await liveConnection(db, a, b);
  return c?.status === "accepted";
}

export async function relationship(db: DB, viewerId: string, otherId: string): Promise<Relationship> {
  const [blockRows, connection, savedRows] = await Promise.all([
    db
      .select()
      .from(s.blocks)
      .where(
        or(
          and(eq(s.blocks.blockerId, viewerId), eq(s.blocks.blockedId, otherId)),
          and(eq(s.blocks.blockerId, otherId), eq(s.blocks.blockedId, viewerId)),
        ),
      ),
    liveConnection(db, viewerId, otherId),
    db
      .select()
      .from(s.savedProfiles)
      .where(and(eq(s.savedProfiles.userId, viewerId), eq(s.savedProfiles.savedUserId, otherId))),
  ]);
  return {
    blockedByMe: blockRows.some((r) => r.blockerId === viewerId),
    blockedMe: blockRows.some((r) => r.blockerId === otherId),
    connection,
    connected: connection?.status === "accepted",
    saved: savedRows.length > 0,
  };
}

/** Profiles of active (non-suspended) users. */
async function activeProfiles(db: DB, where?: ReturnType<typeof and>) {
  const rows = await db
    .select({ profile: s.profiles })
    .from(s.profiles)
    .innerJoin(s.users, eq(s.users.id, s.profiles.userId))
    .where(and(isNull(s.users.suspendedAt), where));
  return rows.map((r) => r.profile);
}

/**
 * Can `viewerId` (null = signed out) see `target`'s profile page?
 * public → everyone; members → signed-in; hidden → self or accepted connections. Never across a block.
 */
export async function canViewProfile(db: DB, viewerId: string | null, target: Profile): Promise<boolean> {
  if (viewerId === target.userId) return true;
  if (!viewerId) return target.visibility === "public";
  if (await isBlockedPair(db, viewerId, target.userId)) return false;
  if (target.visibility !== "hidden") return true;
  return areConnected(db, viewerId, target.userId);
}

export async function getProfile(db: DB, userId: string) {
  const rows = await activeProfiles(db, and(eq(s.profiles.userId, userId)));
  return rows[0] ?? null;
}

export type DiscoverFilters = {
  q?: string;
  role?: string;
  industry?: string;
  attendance?: string;
  interest?: string;
  goal?: string;
};

export type DiscoverResult = { profile: Profile; score: number; reasons: MatchReason[]; saved: boolean; status: string | null };

export async function discover(db: DB, viewer: Profile, filters: DiscoverFilters = {}): Promise<DiscoverResult[]> {
  const hidden = await blockedIds(db, viewer.userId);
  const candidates = (await activeProfiles(db, and(inArray(s.profiles.visibility, ["public", "members"])))).filter(
    (p) => p.userId !== viewer.userId && !hidden.has(p.userId),
  );

  const q = filters.q?.trim().toLowerCase();
  const filtered = candidates.filter((p) => {
    if (filters.role && p.roleCategory !== filters.role) return false;
    if (filters.industry && p.industry !== filters.industry) return false;
    if (filters.attendance && p.attendance !== filters.attendance) return false;
    if (filters.interest && !p.interests.includes(filters.interest)) return false;
    if (filters.goal && !p.goals.includes(filters.goal)) return false;
    if (q) {
      const hay = [p.name, p.company, p.headline, p.bio, p.lookingFor, p.canOffer, ...p.interests, ...p.goals, ...p.offers]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/_/g, " ");
      if (!q.split(/\s+/).every((term) => hay.includes(term))) return false;
    }
    return true;
  });

  const ranked = rankMatches(viewer, filtered);
  const ids = ranked.map((r) => r.profile.userId);
  const [saved, conns] = ids.length
    ? await Promise.all([
        db.select().from(s.savedProfiles).where(and(eq(s.savedProfiles.userId, viewer.userId), inArray(s.savedProfiles.savedUserId, ids))),
        db
          .select()
          .from(s.connectionRequests)
          .where(
            and(
              inArray(s.connectionRequests.status, ["pending", "accepted"]),
              or(eq(s.connectionRequests.requesterId, viewer.userId), eq(s.connectionRequests.recipientId, viewer.userId)),
            ),
          ),
      ])
    : [[], []];
  const savedSet = new Set(saved.map((r) => r.savedUserId));
  const statusOf = new Map<string, string>();
  for (const c of conns) {
    const other = c.requesterId === viewer.userId ? c.recipientId : c.requesterId;
    statusOf.set(other, c.status === "accepted" ? "connected" : c.requesterId === viewer.userId ? "sent" : "received");
  }

  return ranked.map((r) => ({
    profile: r.profile,
    score: r.score,
    reasons: r.reasons,
    saved: savedSet.has(r.profile.userId),
    status: statusOf.get(r.profile.userId) ?? null,
  }));
}

export function explainMatch(viewer: Profile, other: Profile) {
  return scoreMatch(viewer, other);
}

/** Public, featured profiles for the landing page. Never shows members-only or hidden profiles. */
export async function featuredProfiles(db: DB, limit = 6) {
  const rows = await activeProfiles(db, and(eq(s.profiles.visibility, "public")));
  return rows
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function setSaved(db: DB, userId: string, otherId: string, saved: boolean) {
  if (userId === otherId) throw new AppError("You can't save your own profile.");
  if (saved) {
    const target = await getProfile(db, otherId);
    if (!target || !(await canViewProfile(db, userId, target))) throw new AppError("Profile not found.", "not_found");
    await db.insert(s.savedProfiles).values({ userId, savedUserId: otherId }).onConflictDoNothing();
  } else {
    await db.delete(s.savedProfiles).where(and(eq(s.savedProfiles.userId, userId), eq(s.savedProfiles.savedUserId, otherId)));
  }
}

export async function savedProfilesFor(db: DB, userId: string) {
  const hidden = await blockedIds(db, userId);
  const rows = await db
    .select({ profile: s.profiles, savedAt: s.savedProfiles.createdAt })
    .from(s.savedProfiles)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.savedProfiles.savedUserId))
    .innerJoin(s.users, eq(s.users.id, s.profiles.userId))
    .where(and(eq(s.savedProfiles.userId, userId), isNull(s.users.suspendedAt)))
    .orderBy(desc(s.savedProfiles.createdAt));
  return rows.filter((r) => !hidden.has(r.profile.userId));
}

export async function setNote(db: DB, ownerId: string, subjectId: string, body: string) {
  const text = body.trim().slice(0, 2000);
  if (!text) {
    await db.delete(s.followUpNotes).where(and(eq(s.followUpNotes.ownerId, ownerId), eq(s.followUpNotes.subjectId, subjectId)));
    return;
  }
  await db
    .insert(s.followUpNotes)
    .values({ ownerId, subjectId, body: text })
    .onConflictDoUpdate({ target: [s.followUpNotes.ownerId, s.followUpNotes.subjectId], set: { body: text, updatedAt: new Date() } });
}

export async function notesFor(db: DB, ownerId: string) {
  return db
    .select({ note: s.followUpNotes, profile: s.profiles })
    .from(s.followUpNotes)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.followUpNotes.subjectId))
    .where(eq(s.followUpNotes.ownerId, ownerId))
    .orderBy(desc(s.followUpNotes.updatedAt));
}

export async function getNote(db: DB, ownerId: string, subjectId: string) {
  const row = await db.query.followUpNotes.findFirst({
    where: and(eq(s.followUpNotes.ownerId, ownerId), eq(s.followUpNotes.subjectId, subjectId)),
  });
  return row?.body ?? "";
}

/** Blocking also cancels pending requests, ends the connection, and cancels open meetings. */
export async function block(db: DB, blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new AppError("You can't block yourself.");
  await db.transaction(async (tx) => {
    await tx.insert(s.blocks).values({ blockerId, blockedId }).onConflictDoNothing();
    const pair = or(
      and(eq(s.connectionRequests.requesterId, blockerId), eq(s.connectionRequests.recipientId, blockedId)),
      and(eq(s.connectionRequests.requesterId, blockedId), eq(s.connectionRequests.recipientId, blockerId)),
    );
    await tx
      .update(s.connectionRequests)
      .set({ status: "removed", respondedAt: new Date() })
      .where(and(pair, inArray(s.connectionRequests.status, ["pending", "accepted"])));
    await tx
      .update(s.meetings)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(
        and(
          inArray(s.meetings.status, ["proposed", "confirmed"]),
          or(
            and(eq(s.meetings.proposerId, blockerId), eq(s.meetings.inviteeId, blockedId)),
            and(eq(s.meetings.proposerId, blockedId), eq(s.meetings.inviteeId, blockerId)),
          ),
        ),
      );
    await tx.delete(s.savedProfiles).where(and(eq(s.savedProfiles.userId, blockerId), eq(s.savedProfiles.savedUserId, blockedId)));
  });
}

export async function unblock(db: DB, blockerId: string, blockedId: string) {
  await db.delete(s.blocks).where(and(eq(s.blocks.blockerId, blockerId), eq(s.blocks.blockedId, blockedId)));
}

export async function blockedList(db: DB, blockerId: string) {
  return db
    .select({ profile: s.profiles })
    .from(s.blocks)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.blocks.blockedId))
    .where(eq(s.blocks.blockerId, blockerId));
}
