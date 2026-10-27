import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AppError } from "./errors";

type ReportInput = { targetType: "user" | "message" | "meetup" | "post"; targetId: string; reason: string; details: string };

export async function createReport(db: DB, reporterId: string, input: ReportInput) {
  let targetUserId: string | null = null;
  if (input.targetType === "user") {
    const u = await db.query.users.findFirst({ where: eq(s.users.id, input.targetId) });
    if (!u) throw new AppError("User not found.", "not_found");
    targetUserId = u.id;
  } else if (input.targetType === "message") {
    const m = await db.query.messages.findFirst({ where: eq(s.messages.id, input.targetId) });
    if (!m) throw new AppError("Message not found.", "not_found");
    const c = await db.query.conversations.findFirst({ where: eq(s.conversations.id, m.conversationId) });
    // Only participants may report a message (and therefore reveal it to moderators).
    if (!c || (c.userA !== reporterId && c.userB !== reporterId)) throw new AppError("Message not found.", "not_found");
    targetUserId = m.senderId;
  } else if (input.targetType === "meetup") {
    const m = await db.query.meetups.findFirst({ where: eq(s.meetups.id, input.targetId) });
    if (!m) throw new AppError("Meetup not found.", "not_found");
    targetUserId = m.organiserId;
  } else {
    const p = await db.query.socialPosts.findFirst({ where: eq(s.socialPosts.id, input.targetId) });
    if (!p) throw new AppError("Post not found.", "not_found");
  }
  if (targetUserId === reporterId) throw new AppError("You can't report yourself.");
  const [row] = await db
    .insert(s.reports)
    .values({ reporterId, targetType: input.targetType, targetId: input.targetId, targetUserId, reason: input.reason, details: input.details })
    .returning();
  return row;
}

export async function listReports(db: DB, status: "open" | "all" = "open") {
  const reporter = sql<string>`(select email from users u where u.id = ${s.reports.reporterId})`;
  const target = sql<string | null>`(select email from users u where u.id = ${s.reports.targetUserId})`;
  const rows = await db
    .select({ report: s.reports, reporterEmail: reporter, targetEmail: target })
    .from(s.reports)
    .where(status === "open" ? eq(s.reports.status, "open") : undefined)
    .orderBy(desc(s.reports.createdAt))
    .limit(200);
  // Attach the reported message body so moderators can judge it (only reported messages are revealed).
  const out = [];
  for (const r of rows) {
    let excerpt: string | null = null;
    if (r.report.targetType === "message") {
      const m = await db.query.messages.findFirst({ where: eq(s.messages.id, r.report.targetId) });
      excerpt = m?.body ?? null;
    } else if (r.report.targetType === "post") {
      const p = await db.query.socialPosts.findFirst({ where: eq(s.socialPosts.id, r.report.targetId) });
      excerpt = p ? `${p.url}${p.content ? ` — ${p.content}` : ""}` : null;
    } else if (r.report.targetType === "meetup") {
      const m = await db.query.meetups.findFirst({ where: eq(s.meetups.id, r.report.targetId) });
      excerpt = m ? m.title : null;
    }
    out.push({ ...r, excerpt });
  }
  return out;
}

export async function logAction(
  db: DB,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  opts: { reportId?: string; note?: string } = {},
) {
  await db.insert(s.moderationActions).values({ adminId, action, targetType, targetId, reportId: opts.reportId ?? null, note: opts.note ?? "" });
}

export async function resolveReport(db: DB, adminId: string, reportId: string, status: "actioned" | "dismissed", note = "") {
  const res = await db
    .update(s.reports)
    .set({ status, resolvedAt: new Date() })
    .where(and(eq(s.reports.id, reportId)))
    .returning();
  if (!res.length) throw new AppError("Report not found.", "not_found");
  await logAction(db, adminId, `report_${status}`, "report", reportId, { reportId, note });
}

export async function setSuspended(db: DB, adminId: string, userId: string, suspended: boolean, reportId?: string) {
  if (adminId === userId) throw new AppError("You can't suspend yourself.");
  await db.update(s.users).set({ suspendedAt: suspended ? new Date() : null }).where(eq(s.users.id, userId));
  await logAction(db, adminId, suspended ? "suspend_user" : "unsuspend_user", "user", userId, { reportId });
}

export async function recentActions(db: DB) {
  return db.select().from(s.moderationActions).orderBy(desc(s.moderationActions.createdAt)).limit(50);
}
