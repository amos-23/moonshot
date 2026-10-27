import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AppError } from "./errors";
import { areConnected, isBlockedPair } from "./people";

const SEND_WINDOW_MS = 60_000;
const SEND_LIMIT_PER_WINDOW = 20;

/** Loads a conversation only if `userId` participates in it. */
export async function getConversationFor(db: DB, userId: string, conversationId: string) {
  const conv = await db.query.conversations.findFirst({ where: eq(s.conversations.id, conversationId) });
  if (!conv || (conv.userA !== userId && conv.userB !== userId)) throw new AppError("Conversation not found.", "not_found");
  const otherId = conv.userA === userId ? conv.userB : conv.userA;
  return { conv, otherId };
}

export async function canMessage(db: DB, userId: string, otherId: string) {
  if (await isBlockedPair(db, userId, otherId)) return false;
  return areConnected(db, userId, otherId);
}

export async function listConversations(db: DB, userId: string) {
  const rows = await db
    .select({ conv: s.conversations, profile: s.profiles })
    .from(s.conversations)
    .innerJoin(
      s.profiles,
      or(
        and(eq(s.conversations.userA, userId), eq(s.profiles.userId, s.conversations.userB)),
        and(eq(s.conversations.userB, userId), eq(s.profiles.userId, s.conversations.userA)),
      ),
    )
    .where(or(eq(s.conversations.userA, userId), eq(s.conversations.userB, userId)))
    .orderBy(desc(sql`coalesce(${s.conversations.lastMessageAt}, ${s.conversations.createdAt})`));

  if (!rows.length) return [];
  const ids = rows.map((r) => r.conv.id);
  const [lastMessages, unread] = await Promise.all([
    db
      .selectDistinctOn([s.messages.conversationId])
      .from(s.messages)
      .where(inArray(s.messages.conversationId, ids))
      .orderBy(s.messages.conversationId, desc(s.messages.createdAt)),
    db
      .select({ conversationId: s.messages.conversationId, n: sql<number>`count(*)::int` })
      .from(s.messages)
      .where(and(inArray(s.messages.conversationId, ids), ne(s.messages.senderId, userId), isNull(s.messages.readAt)))
      .groupBy(s.messages.conversationId),
  ]);
  const last = new Map(lastMessages.map((m) => [m.conversationId, m]));
  const unreadMap = new Map(unread.map((u) => [u.conversationId, u.n]));
  return rows.map((r) => ({
    ...r,
    lastMessage: last.get(r.conv.id) ?? null,
    unread: unreadMap.get(r.conv.id) ?? 0,
  }));
}

export async function listMessages(db: DB, userId: string, conversationId: string, after?: Date) {
  await getConversationFor(db, userId, conversationId);
  return db
    .select()
    .from(s.messages)
    .where(and(eq(s.messages.conversationId, conversationId), after ? gt(s.messages.createdAt, after) : undefined))
    .orderBy(asc(s.messages.createdAt))
    .limit(500);
}

export async function markRead(db: DB, userId: string, conversationId: string) {
  await getConversationFor(db, userId, conversationId);
  await db
    .update(s.messages)
    .set({ readAt: new Date() })
    .where(and(eq(s.messages.conversationId, conversationId), ne(s.messages.senderId, userId), isNull(s.messages.readAt)));
}

export async function sendMessage(db: DB, userId: string, conversationId: string, body: string) {
  const text = body.trim();
  if (!text) throw new AppError("Message can't be empty.");
  if (text.length > 2000) throw new AppError("Messages are limited to 2000 characters.");
  const { otherId } = await getConversationFor(db, userId, conversationId);
  if (!(await canMessage(db, userId, otherId))) {
    throw new AppError("You can only message people you're connected with.", "forbidden");
  }
  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.messages)
    .where(and(eq(s.messages.senderId, userId), gt(s.messages.createdAt, new Date(Date.now() - SEND_WINDOW_MS))));
  if ((recent[0]?.n ?? 0) >= SEND_LIMIT_PER_WINDOW) throw new AppError("You're sending messages too quickly.", "rate_limited");

  const [msg] = await db.insert(s.messages).values({ conversationId, senderId: userId, body: text }).returning();
  await db.update(s.conversations).set({ lastMessageAt: msg.createdAt }).where(eq(s.conversations.id, conversationId));
  return msg;
}

export async function unreadTotal(db: DB, userId: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.messages)
    .innerJoin(s.conversations, eq(s.conversations.id, s.messages.conversationId))
    .where(
      and(
        or(eq(s.conversations.userA, userId), eq(s.conversations.userB, userId)),
        ne(s.messages.senderId, userId),
        isNull(s.messages.readAt),
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function getMessage(db: DB, messageId: string) {
  return db.query.messages.findFirst({ where: eq(s.messages.id, messageId) });
}
