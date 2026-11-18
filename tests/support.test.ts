import path from "path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { MAX_MESSAGES_PER_THREAD, adminNotificationEmail, cleanBody, cleanPage, fetchVisitorThread, getThreadForAdmin, isProject, listThreads, markThreadRead, notifyAdminOfMessage, notifyAddress, postAdminReply, postVisitorMessage, setThreadStatus, unreadCount, validToken, visitorReplyEmail } from "@/lib/support";
import { setMailTransport, type Mail } from "@/lib/mail";

let db: DB;
beforeAll(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: path.join(__dirname, "..", "drizzle"), migrationsSchema: schema.DB_SCHEMA });
  db = d as unknown as DB;
});
beforeEach(async () => {
  await db.execute(sql`DELETE FROM "support"."threads"`);
});

const token = (n: string) => `${n}-`.padEnd(30, "x");
const send = (t: string, body: string, extra: Record<string, unknown> = {}) => postVisitorMessage(db, { project: "ads", token: t, body, ...extra });
const ok = <T>(r: T): Exclude<T, { error: string }> => {
  if (r && typeof r === "object" && "error" in r) throw new Error(String((r as { error: string }).error));
  return r as Exclude<T, { error: string }>;
};

describe("support chat", () => {
  it("validates input", () => {
    expect(isProject("ads")).toBe(true);
    expect(isProject("connect")).toBe(true);
    expect(isProject("other")).toBe(false);
    expect(validToken("short")).toBe(false);
    expect(validToken(token("ok"))).toBe(true);
    expect(cleanBody("   ")).toBeNull();
    expect(cleanBody("  hi  ")).toBe("hi");
    expect(cleanBody("x".repeat(5000))?.length).toBe(2000);
    expect(cleanPage("Google › Billing\nignored")).toBe("Google › Billing ignored");
  });

  it("keeps one thread per visitor and project, and returns only newer messages", async () => {
    const a = ok(await send(token("a"), "first", { name: "Ada", email: "Ada@X.io", page: "google/billing" }));
    const b = ok(await send(token("a"), "second"));
    expect(b.threadId).toBe(a.threadId);
    const all = await fetchVisitorThread(db, "ads", token("a"), 0);
    expect(all.messages.map((m) => m.body)).toEqual(["first", "second"]);
    const newer = await fetchVisitorThread(db, "ads", token("a"), a.message.id);
    expect(newer.messages.map((m) => m.body)).toEqual(["second"]);
    // The same token on the other project is a different chat; someone else's token sees nothing.
    expect((await fetchVisitorThread(db, "connect", token("a"), 0)).messages).toEqual([]);
    expect((await fetchVisitorThread(db, "ads", token("b"), 0)).messages).toEqual([]);
    const thread = await getThreadForAdmin(db, a.threadId);
    expect(thread?.email).toBe("ada@x.io");
    expect(thread?.name).toBe("Ada");
  });

  it("stores only a hash of the visitor token", async () => {
    await send(token("secret"), "hi");
    const rows = (await db.execute(sql`SELECT "visitor_hash" FROM "support"."threads"`)) as unknown as { rows?: { visitor_hash: string }[] } | { visitor_hash: string }[];
    const list = Array.isArray(rows) ? rows : rows.rows ?? [];
    expect(list[0].visitor_hash).not.toContain("secret");
    expect(list[0].visitor_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tells the admin once per 15 minutes, and again after they reply", async () => {
    expect(ok(await send(token("n"), "one")).notify).toBe(true);
    expect(ok(await send(token("n"), "two")).notify).toBe(false);
    const t = ok(await send(token("n"), "three"));
    await postAdminReply(db, t.threadId, "answer");
    expect(ok(await send(token("n"), "four")).notify).toBe(true);
  });

  it("tracks unread chats for the admin and clears them when read or answered", async () => {
    const a = ok(await send(token("u1"), "hello"));
    const b = ok(await send(token("u2"), "hello too"));
    expect(await unreadCount(db)).toBe(2);
    await markThreadRead(db, a.threadId);
    expect(await unreadCount(db)).toBe(1);
    await postAdminReply(db, b.threadId, "hi!");
    expect(await unreadCount(db)).toBe(0);
    ok(await send(token("u1"), "more"));
    expect(await unreadCount(db)).toBe(1);
    const rows = await listThreads(db);
    expect(rows.find((r) => r.id === a.threadId)?.unread).toBe(true);
    expect(rows.find((r) => r.id === b.threadId)).toMatchObject({ unread: false, lastSender: "admin", preview: "hi!" });
  });

  it("filters by project and status, and reopens a done chat when the visitor writes again", async () => {
    const a = ok(await send(token("f1"), "ads question"));
    ok(await postVisitorMessage(db, { project: "connect", token: token("f2"), body: "event question" }));
    expect((await listThreads(db, { project: "connect" })).map((r) => r.preview)).toEqual(["event question"]);
    await setThreadStatus(db, a.threadId, "closed");
    expect((await listThreads(db, { status: "open" })).length).toBe(1);
    expect((await listThreads(db, { status: "closed" })).length).toBe(1);
    ok(await send(token("f1"), "still broken"));
    expect((await listThreads(db, { status: "closed" })).length).toBe(0);
  });

  it("emails the visitor about a reply only when they left an address, aren't in the chat, and weren't just emailed", async () => {
    const withMail = ok(await send(token("e1"), "help", { email: "v@x.io" }));
    const noMail = ok(await send(token("e2"), "help"));
    // They're looking at the chat right now (the send marks them as seen): no email.
    expect((await postAdminReply(db, withMail.threadId, "r1"))?.emailVisitor).toBe(false);
    await db.execute(sql`UPDATE "support"."threads" SET "visitor_seen_at" = now() - interval '10 minutes'`);
    expect((await postAdminReply(db, withMail.threadId, "r2"))?.emailVisitor).toBe(true);
    // Just emailed: don't send another straight away.
    expect((await postAdminReply(db, withMail.threadId, "r3"))?.emailVisitor).toBe(false);
    // No address, nothing to email.
    expect((await postAdminReply(db, noMail.threadId, "r"))?.emailVisitor).toBe(false);
    expect(await postAdminReply(db, "00000000-0000-0000-0000-000000000000", "x")).toBeNull();
    expect(await postAdminReply(db, "not-a-uuid", "x")).toBeNull();
  });

  it("caps how long a chat can get", async () => {
    const first = ok(await send(token("cap"), "m0"));
    await db.execute(sql`INSERT INTO "support"."messages" ("thread_id","sender","body") SELECT ${first.threadId}, 'user', 'x' FROM generate_series(1, ${MAX_MESSAGES_PER_THREAD})`);
    expect(await send(token("cap"), "one too many")).toEqual({ error: "full" });
  });
});

describe("support notifications", () => {
  const sent: Mail[] = [];
  beforeAll(() => setMailTransport(async (m) => void sent.push(m)));
  beforeEach(() => {
    sent.length = 0;
    delete process.env.NTFY_TOPIC;
    process.env.SUPPORT_NOTIFY_EMAIL = "owner@example.com";
  });

  it("emails the owner a new message with a link to reply, and escapes what visitors wrote", async () => {
    await notifyAdminOfMessage({ project: "connect", name: "Bo <b>", email: "bo@x.io", page: "/moonshot", body: "<script>alert(1)</script>", threadId: "abc" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("owner@example.com");
    expect(sent[0].subject).toContain("Event Connect");
    expect(sent[0].text).toContain("/adminx/support/abc");
    expect(sent[0].html).not.toContain("<script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
  });

  it("falls back to the first admin email when no notify address is set", () => {
    delete process.env.SUPPORT_NOTIFY_EMAIL;
    process.env.ADMIN_EMAILS = "first@x.io, second@x.io";
    expect(notifyAddress()).toBe("first@x.io");
    delete process.env.ADMIN_EMAILS;
    expect(notifyAddress()).toBeNull();
  });

  it("never throws if nothing is configured", async () => {
    delete process.env.SUPPORT_NOTIFY_EMAIL;
    delete process.env.ADMIN_EMAILS;
    await expect(notifyAdminOfMessage({ project: "ads", name: null, email: null, page: null, body: "hi", threadId: "t" })).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("builds the visitor reply email", () => {
    const m = visitorReplyEmail({ project: "ads", name: "Ada", body: "Try again <now>" });
    expect(m.subject).toContain("AdsSim");
    expect(m.text).toContain("Try again <now>");
    expect(m.html).toContain("&lt;now&gt;");
    expect(adminNotificationEmail({ project: "ads", name: null, email: null, page: null, body: "x", threadId: "t" }).text).toContain("didn't leave an email");
  });
});
