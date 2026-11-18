import "server-only";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { adsSiteUrl, normaliseEmail, cleanName, rowsOf } from "@/lib/ads";
import { sendMail, type Mail } from "@/lib/mail";

// Support chat shared by AdsSim and Event Connect. A visitor keeps a random token in their browser (only its hash
// is stored) and has one thread per project. The admin answers from /adminx/support. New messages reach the admin by
// email (SUPPORT_NOTIFY_EMAIL) and, optionally, as a phone push through ntfy (NTFY_TOPIC); a reply reaches a visitor
// who left an email and isn't looking at the chat.

export const PROJECTS = ["ads", "connect"] as const;
export type SupportProject = (typeof PROJECTS)[number];
export const PROJECT_NAMES: Record<SupportProject, string> = { ads: "AdsSim", connect: "Event Connect" };

export const MAX_BODY = 2000;
export const MAX_MESSAGES_PER_THREAD = 300;
const TOKEN = /^[\w-]{20,100}$/;
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export const isProject = (v: unknown): v is SupportProject => typeof v === "string" && (PROJECTS as readonly string[]).includes(v);
export const validToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);
export const cleanBody = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_BODY) : null);
/** The page the visitor was on, kept short and path-only: it tells the admin which screen they meant. */
export const cleanPage = (v: unknown) => (typeof v === "string" ? v.replace(/[\r\n]/g, " ").trim().slice(0, 200) || null : null);

export interface ChatMessage {
  id: number;
  sender: "user" | "admin";
  body: string;
  at: string;
}

const iso = (d: Date | string) => new Date(d).toISOString();

// ─── Visitor side ────────────────────────────────────────────────────────────

export interface VisitorInput {
  project: SupportProject;
  token: string;
  body: string;
  name?: unknown;
  email?: unknown;
  page?: unknown;
}

export async function postVisitorMessage(db: DB, i: VisitorInput) {
  const name = cleanName(i.name);
  const email = normaliseEmail(i.email);
  const page = cleanPage(i.page);
  const thread = rowsOf<{ id: string; name: string | null; email: string | null; page: string | null }>(await db.execute(sql`
    INSERT INTO "support"."threads" ("project","visitor_hash","name","email","page")
    VALUES (${i.project}, ${hash(i.token)}, ${name}, ${email}, ${page})
    ON CONFLICT ("project","visitor_hash") DO UPDATE SET
      "name" = COALESCE(EXCLUDED."name", "support"."threads"."name"),
      "email" = COALESCE(EXCLUDED."email", "support"."threads"."email"),
      "page" = COALESCE(EXCLUDED."page", "support"."threads"."page")
    RETURNING "id","name","email","page"`))[0];
  const count = rowsOf<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM "support"."messages" WHERE "thread_id" = ${thread.id}`))[0]?.n ?? 0;
  if (count >= MAX_MESSAGES_PER_THREAD) return { error: "full" as const };
  const msg = rowsOf<{ id: string | number; created_at: Date | string }>(await db.execute(sql`
    INSERT INTO "support"."messages" ("thread_id","sender","body") VALUES (${thread.id}, 'user', ${i.body})
    RETURNING "id","created_at"`))[0];
  await db.execute(sql`
    UPDATE "support"."threads" SET "last_message_at" = now(), "last_user_at" = now(), "visitor_seen_at" = now(), "status" = 'open'
    WHERE "id" = ${thread.id}`);
  // Tell the admin at most once per 15 minutes per thread, and again right after they've replied.
  const notify = rowsOf<{ id: string }>(await db.execute(sql`
    UPDATE "support"."threads" SET "admin_notified_at" = now()
    WHERE "id" = ${thread.id} AND ("admin_notified_at" IS NULL OR "admin_notified_at" < now() - interval '15 minutes')
    RETURNING "id"`)).length > 0;
  return { threadId: thread.id, who: { name: thread.name, email: thread.email, page: thread.page }, message: { id: Number(msg.id), sender: "user" as const, body: i.body, at: iso(msg.created_at) }, notify };
}

/** Messages newer than `after`, for the visitor's own thread. Also marks the visitor as looking at the chat. */
export async function fetchVisitorThread(db: DB, project: SupportProject, token: string, after: number) {
  const t = rowsOf<{ id: string; status: string }>(await db.execute(sql`
    UPDATE "support"."threads" SET "visitor_seen_at" = now() WHERE "project" = ${project} AND "visitor_hash" = ${hash(token)} RETURNING "id","status"`))[0];
  if (!t) return { messages: [] as ChatMessage[], status: "open" as const };
  const rows = rowsOf<{ id: string | number; sender: "user" | "admin"; body: string; created_at: Date | string }>(await db.execute(sql`
    SELECT "id","sender","body","created_at" FROM "support"."messages" WHERE "thread_id" = ${t.id} AND "id" > ${after} ORDER BY "id" LIMIT 200`));
  return { messages: rows.map((r) => ({ id: Number(r.id), sender: r.sender, body: r.body, at: iso(r.created_at) })), status: t.status as "open" | "closed" };
}

// ─── Admin side ──────────────────────────────────────────────────────────────

export interface ThreadRow {
  id: string;
  project: SupportProject;
  name: string | null;
  email: string | null;
  page: string | null;
  status: "open" | "closed";
  unread: boolean;
  lastAt: string;
  lastSender: "user" | "admin";
  preview: string;
  messages: number;
}

export async function listThreads(db: DB, filter: { project?: SupportProject | null; status?: "open" | "closed" | null } = {}): Promise<ThreadRow[]> {
  const rows = rowsOf<{
    id: string; project: SupportProject; name: string | null; email: string | null; page: string | null; status: "open" | "closed";
    last_message_at: Date | string; unread: boolean; last_sender: "user" | "admin"; preview: string; n: number;
  }>(await db.execute(sql`
    SELECT t."id", t."project", t."name", t."email", t."page", t."status", t."last_message_at",
      (t."last_user_at" IS NOT NULL AND (t."admin_read_at" IS NULL OR t."admin_read_at" < t."last_user_at")) AS unread,
      m."sender" AS last_sender, left(m."body", 140) AS preview,
      (SELECT count(*)::int FROM "support"."messages" WHERE "thread_id" = t."id") AS n
    FROM "support"."threads" t
    JOIN LATERAL (SELECT "sender","body" FROM "support"."messages" WHERE "thread_id" = t."id" ORDER BY "id" DESC LIMIT 1) m ON true
    WHERE (${filter.project ?? null}::text IS NULL OR t."project" = ${filter.project ?? null})
      AND (${filter.status ?? null}::text IS NULL OR t."status" = ${filter.status ?? null})
    ORDER BY t."last_message_at" DESC LIMIT 200`));
  return rows.map((r) => ({ id: r.id, project: r.project, name: r.name, email: r.email, page: r.page, status: r.status, unread: r.unread, lastAt: iso(r.last_message_at), lastSender: r.last_sender, preview: r.preview, messages: r.n }));
}

export async function getThreadForAdmin(db: DB, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const t = rowsOf<{ id: string; project: SupportProject; name: string | null; email: string | null; page: string | null; status: "open" | "closed"; created_at: Date | string }>(await db.execute(sql`
    SELECT "id","project","name","email","page","status","created_at" FROM "support"."threads" WHERE "id" = ${id}`))[0];
  if (!t) return null;
  const rows = rowsOf<{ id: string | number; sender: "user" | "admin"; body: string; created_at: Date | string }>(await db.execute(sql`
    SELECT "id","sender","body","created_at" FROM "support"."messages" WHERE "thread_id" = ${id} ORDER BY "id"`));
  return { ...t, createdAt: iso(t.created_at), messages: rows.map((r) => ({ id: Number(r.id), sender: r.sender, body: r.body, at: iso(r.created_at) })) as ChatMessage[] };
}

export async function markThreadRead(db: DB, id: string) {
  await db.execute(sql`UPDATE "support"."threads" SET "admin_read_at" = now() WHERE "id" = ${id}`);
}

export async function setThreadStatus(db: DB, id: string, status: "open" | "closed") {
  await db.execute(sql`UPDATE "support"."threads" SET "status" = ${status} WHERE "id" = ${id}`);
}

export async function unreadCount(db: DB): Promise<number> {
  return rowsOf<{ n: number }>(await db.execute(sql`
    SELECT count(*)::int AS n FROM "support"."threads"
    WHERE "last_user_at" IS NOT NULL AND ("admin_read_at" IS NULL OR "admin_read_at" < "last_user_at")`))[0]?.n ?? 0;
}

/** Saves the admin's reply. Returns the thread so the caller can email the visitor, or null if there's no such thread. */
export async function postAdminReply(db: DB, id: string, body: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const t = rowsOf<{ id: string; project: SupportProject; name: string | null; email: string | null }>(await db.execute(sql`SELECT "id","project","name","email" FROM "support"."threads" WHERE "id" = ${id}`))[0];
  if (!t) return null;
  await db.execute(sql`INSERT INTO "support"."messages" ("thread_id","sender","body") VALUES (${id}, 'admin', ${body})`);
  await db.execute(sql`
    UPDATE "support"."threads" SET "last_message_at" = now(), "admin_read_at" = now(), "admin_notified_at" = NULL, "status" = 'open' WHERE "id" = ${id}`);
  // Email the visitor only if they left an address, aren't looking at the chat right now, and haven't just been emailed.
  const emailVisitor = t.email
    ? rowsOf<{ id: string }>(await db.execute(sql`
        UPDATE "support"."threads" SET "visitor_notified_at" = now()
        WHERE "id" = ${id} AND ("visitor_seen_at" IS NULL OR "visitor_seen_at" < now() - interval '2 minutes')
          AND ("visitor_notified_at" IS NULL OR "visitor_notified_at" < now() - interval '30 minutes')
        RETURNING "id"`)).length > 0
    : false;
  return { ...t, emailVisitor };
}

// ─── Notifications ───────────────────────────────────────────────────────────

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://events.latars.xyz").replace(/\/$/, "");

/** Who gets the "new message" emails: SUPPORT_NOTIFY_EMAIL, else the first ADMIN_EMAILS address. */
export function notifyAddress(): string | null {
  const direct = process.env.SUPPORT_NOTIFY_EMAIL?.trim();
  if (direct) return direct;
  return process.env.ADMIN_EMAILS?.split(",")[0]?.trim() || null;
}

export function adminLink(threadId: string) {
  return `${siteUrl()}/adminx/support/${threadId}`;
}

export function adminNotificationEmail(p: { project: SupportProject; name: string | null; email: string | null; page: string | null; body: string; threadId: string }): Mail {
  const who = p.name || p.email || "A visitor";
  const link = adminLink(p.threadId);
  const lines = [`${who} wrote on ${PROJECT_NAMES[p.project]}:`, "", p.body, "", p.email ? `Their email: ${p.email}` : "They didn't leave an email.", p.page ? `Page: ${p.page}` : "", "", `Reply here: ${link}`].filter((l, i, a) => l !== "" || a[i - 1] !== "");
  return {
    to: notifyAddress() ?? "",
    subject: `New ${PROJECT_NAMES[p.project]} support message from ${who}`,
    text: lines.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1a1a2e"><p><b>${esc(who)}</b> wrote on ${esc(PROJECT_NAMES[p.project])}:</p><blockquote style="margin:12px 0;padding:10px 14px;background:#f4f4f8;border-radius:8px;white-space:pre-wrap">${esc(p.body)}</blockquote><p style="color:#666;font-size:13px">${p.email ? `Their email: ${esc(p.email)}` : "They didn't leave an email."}${p.page ? `<br>Page: ${esc(p.page)}` : ""}</p><p><a href="${esc(link)}" style="background:#1a1a2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Reply in the admin</a></p></div>`,
  };
}

export function visitorReplyEmail(p: { project: SupportProject; name: string | null; body: string }): Omit<Mail, "to"> {
  const product = PROJECT_NAMES[p.project];
  const back = p.project === "ads" ? adsSiteUrl(null) : siteUrl();
  const hi = p.name ? `Hi ${p.name},` : "Hi,";
  return {
    subject: `Reply from ${product} support`,
    text: `${hi}\n\nYou have a reply from ${product} support:\n\n${p.body}\n\nOpen ${product} and tap Help to continue the chat: ${back}\n`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e"><p>${esc(hi)}</p><p>You have a reply from ${esc(product)} support:</p><blockquote style="margin:12px 0;padding:10px 14px;background:#f4f4f8;border-radius:8px;white-space:pre-wrap">${esc(p.body)}</blockquote><p><a href="${esc(back)}">Open ${esc(product)}</a> and tap <b>Help</b> to continue the chat.</p></div>`,
  };
}

/** Email (and optional ntfy phone push) for a new visitor message. Never throws. */
export async function notifyAdminOfMessage(p: { project: SupportProject; name: string | null; email: string | null; page: string | null; body: string; threadId: string }) {
  try {
    const mail = adminNotificationEmail(p);
    if (mail.to) await sendMail(mail);
    else console.error("Support message not emailed: set SUPPORT_NOTIFY_EMAIL (or ADMIN_EMAILS).");
    const topic = process.env.NTFY_TOPIC?.trim();
    if (topic && /^[\w-]{6,100}$/.test(topic)) {
      // Only the sender and project go to ntfy.sh, never the message itself.
      await fetch(`https://ntfy.sh/${topic}`, {
        method: "POST",
        headers: { Title: `New ${PROJECT_NAMES[p.project]} message`, Click: adminLink(p.threadId), Tags: "speech_balloon" },
        body: `${p.name || p.email || "A visitor"} wrote to support. Tap to reply.`,
        signal: AbortSignal.timeout(8_000),
      }).catch((err) => console.error("ntfy push failed", err instanceof Error ? err.message : err));
    }
  } catch (err) {
    console.error("support notify failed", err);
  }
}

export async function notifyVisitorOfReply(p: { project: SupportProject; name: string | null; email: string; body: string }) {
  try {
    await sendMail({ to: p.email, ...visitorReplyEmail(p) });
  } catch (err) {
    console.error("support reply email failed", err);
  }
}
