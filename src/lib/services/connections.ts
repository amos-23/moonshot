import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AppError, isUniqueViolation } from "./errors";
import { getProfile, isBlockedPair, liveConnection } from "./people";

const DAILY_REQUEST_LIMIT = 30;

export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function ensureConversation(db: DB, a: string, b: string) {
  const [userA, userB] = pairKey(a, b);
  await db.insert(s.conversations).values({ userA, userB }).onConflictDoNothing();
  const conv = await db.query.conversations.findFirst({
    where: and(eq(s.conversations.userA, userA), eq(s.conversations.userB, userB)),
  });
  return conv!;
}

export type SendResult = { status: "sent" | "accepted"; requestId: string };

export async function sendConnectionRequest(
  db: DB,
  requesterId: string,
  recipientId: string,
  message: string,
): Promise<SendResult> {
  if (requesterId === recipientId) throw new AppError("You can't connect with yourself.");
  const [me, them] = await Promise.all([getProfile(db, requesterId), getProfile(db, recipientId)]);
  if (!me) throw new AppError("Create your profile before connecting.", "forbidden");
  if (!them || (await isBlockedPair(db, requesterId, recipientId))) throw new AppError("This person isn't available.", "not_found");

  const existing = await liveConnection(db, requesterId, recipientId);
  if (existing?.status === "accepted") throw new AppError("You're already connected.", "conflict");
  if (existing?.requesterId === requesterId) throw new AppError("You've already sent a request to this person.", "conflict");
  if (existing && existing.recipientId === requesterId) {
    // They already asked us: treat our request as acceptance.
    await respondToRequest(db, requesterId, existing.id, "accept");
    return { status: "accepted", requestId: existing.id };
  }

  if (them.visibility === "hidden") throw new AppError("This person isn't accepting requests.", "forbidden");
  if (them.contactPreference === "nobody") throw new AppError("This person isn't accepting connection requests.", "forbidden");
  if (them.contactPreference === "shared_interests" && !them.interests.some((i) => me.interests.includes(i))) {
    throw new AppError("This person only accepts requests from people who share an interest with them.", "forbidden");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ id: s.connectionRequests.id })
    .from(s.connectionRequests)
    .where(and(eq(s.connectionRequests.requesterId, requesterId), gte(s.connectionRequests.createdAt, since)));
  if (recent.length >= DAILY_REQUEST_LIMIT) {
    throw new AppError("You've reached today's limit for connection requests. Try again tomorrow.", "rate_limited");
  }

  try {
    const [row] = await db
      .insert(s.connectionRequests)
      .values({ requesterId, recipientId, message: message.trim().slice(0, 300) })
      .returning();
    return { status: "sent", requestId: row.id };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("A request between you two already exists.", "conflict");
    throw err;
  }
}

export async function respondToRequest(db: DB, userId: string, requestId: string, action: "accept" | "decline") {
  const req = await db.query.connectionRequests.findFirst({ where: eq(s.connectionRequests.id, requestId) });
  if (!req || req.recipientId !== userId) throw new AppError("Request not found.", "not_found");
  if (req.status !== "pending") throw new AppError("This request has already been answered.", "conflict");
  if (action === "accept" && (await isBlockedPair(db, req.requesterId, req.recipientId))) {
    throw new AppError("This person isn't available.", "forbidden");
  }
  await db
    .update(s.connectionRequests)
    .set({ status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() })
    .where(and(eq(s.connectionRequests.id, requestId), eq(s.connectionRequests.status, "pending")));
  if (action === "accept") await ensureConversation(db, req.requesterId, req.recipientId);
  return req;
}

export async function cancelRequest(db: DB, userId: string, requestId: string) {
  const res = await db
    .update(s.connectionRequests)
    .set({ status: "cancelled", respondedAt: new Date() })
    .where(
      and(
        eq(s.connectionRequests.id, requestId),
        eq(s.connectionRequests.requesterId, userId),
        eq(s.connectionRequests.status, "pending"),
      ),
    )
    .returning();
  if (!res.length) throw new AppError("Request not found.", "not_found");
}

export async function removeConnection(db: DB, userId: string, otherId: string) {
  const live = await liveConnection(db, userId, otherId);
  if (!live || live.status !== "accepted") throw new AppError("You're not connected.", "not_found");
  await db.update(s.connectionRequests).set({ status: "removed", respondedAt: new Date() }).where(eq(s.connectionRequests.id, live.id));
}

export async function connectionOverview(db: DB, userId: string) {
  const rows = await db
    .select({ req: s.connectionRequests, profile: s.profiles })
    .from(s.connectionRequests)
    .innerJoin(
      s.profiles,
      or(
        and(eq(s.connectionRequests.requesterId, userId), eq(s.profiles.userId, s.connectionRequests.recipientId)),
        and(eq(s.connectionRequests.recipientId, userId), eq(s.profiles.userId, s.connectionRequests.requesterId)),
      ),
    )
    .innerJoin(s.users, eq(s.users.id, s.profiles.userId))
    .where(
      and(
        isNull(s.users.suspendedAt),
        inArray(s.connectionRequests.status, ["pending", "accepted"]),
        or(eq(s.connectionRequests.requesterId, userId), eq(s.connectionRequests.recipientId, userId)),
      ),
    )
    .orderBy(desc(s.connectionRequests.createdAt));

  const active = rows;
  return {
    incoming: active.filter((r) => r.req.status === "pending" && r.req.recipientId === userId),
    outgoing: active.filter((r) => r.req.status === "pending" && r.req.requesterId === userId),
    connections: active.filter((r) => r.req.status === "accepted"),
  };
}

export async function pendingIncomingCount(db: DB, userId: string) {
  const rows = await db
    .select({ id: s.connectionRequests.id })
    .from(s.connectionRequests)
    .where(and(eq(s.connectionRequests.recipientId, userId), eq(s.connectionRequests.status, "pending")));
  return rows.length;
}
