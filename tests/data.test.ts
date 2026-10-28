import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { backfillDetails, commentsFor, importPosts, listMoments, listPeople, listXCards } from "@/lib/data";
import { siteStats } from "@/lib/stats";

let db: DB;
beforeAll(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: path.join(__dirname, "..", "drizzle"), migrationsSchema: schema.DB_SCHEMA });
  db = d as unknown as DB;
});

let n = 0;
async function person(over: Partial<typeof schema.people.$inferInsert> = {}) {
  n++;
  const [p] = await db.insert(schema.people).values({ editTokenHash: `h${n}`, name: `Person ${n}`, headline: "Builder", email: `p${n}@x.io`, ...over }).returning();
  return p;
}

describe("people", () => {
  it("ranks the best fit first, hides hidden cards and excludes yourself", async () => {
    const me = await person({ name: "Me", wants: ["investors"] });
    const vc = await person({ name: "Val VC", offers: ["investment"] });
    await person({ name: "Random" });
    const hidden = await person({ name: "Hidden", offers: ["investment"], hidden: true });
    const list = await listPeople(db, me);
    expect(list[0].person.id).toBe(vc.id);
    expect(list[0].reasons[0]).toMatch(/Val offers investment/);
    expect(list.map((r) => r.person.id)).not.toContain(me.id);
    expect(list.map((r) => r.person.id)).not.toContain(hidden.id);
    expect((await listPeople(db, null, "val")).length).toBe(1);
  });
});

describe("X cards", () => {
  it("imports, dedupes, keeps one card per author, and drops authors who made their own card", async () => {
    const res = await importPosts(db, [
      { url: "https://x.com/oreofe/status/1849000000000000000", content: "Looking to meet founders and engineers" },
      { url: "https://x.com/oreofe/status/1850000000000000000", content: "Newer post: see you at Moonshot" },
      { url: "https://x.com/oreofe/status/1849000000000000000" },
      { url: "https://example.com/nope" },
      { url: "https://x.com/kemi/status/1849000000000000002", content: "Who is going to Moonshot?" },
    ]);
    expect(res.map((r) => r.status)).toEqual(["added", "added", "duplicate", "invalid", "added"]);
    let cards = await listXCards(db);
    expect(cards.map((c) => c.authorHandle).sort()).toEqual(["kemi", "oreofe"]);
    expect(cards.find((c) => c.authorHandle === "oreofe")?.content).toMatch(/Newer post/);
    // Search matches the post each card shows (the latest one).
    expect((await listXCards(db, "founders")).map((c) => c.authorHandle)).toEqual([]);
    expect((await listXCards(db, "newer moonshot")).map((c) => c.authorHandle)).toEqual(["oreofe"]);
    await person({ name: "Kemi", xHandle: "Kemi" });
    cards = await listXCards(db);
    expect(cards.map((c) => c.authorHandle)).toEqual(["oreofe"]);
  });
});

describe("comments", () => {
  it("groups visible comments by post, oldest first", async () => {
    const [r] = await importPosts(db, [{ url: "https://x.com/tola/status/1851000000000000000", content: "Moonshot!" }]);
    const postId = r.id!;
    await db.insert(schema.comments).values([
      { postId, name: "A", body: "first" },
      { postId, name: "B", body: "hidden one", hidden: true },
    ]);
    await new Promise((res) => setTimeout(res, 5));
    await db.insert(schema.comments).values({ postId, name: "C", body: "second" });
    const map = await commentsFor(db, [postId]);
    expect(map.get(postId)?.map((c) => c.body)).toEqual(["first", "second"]);
    await expect(db.insert(schema.comments).values({ postId, name: "D", body: "" })).rejects.toThrow();
  });
});

describe("stats", () => {
  it("counts visits, unique visitors, clicks and the most-clicked cards", async () => {
    const p = await person({ name: "Clicky" });
    await db.insert(schema.events).values([
      { type: "view", path: "/", visitor: "a", referrer: "x.com" },
      { type: "view", path: "/", visitor: "a" },
      { type: "view", path: "/card", visitor: "b" },
      { type: "click", path: "/", visitor: "a", target: "whatsapp", targetId: p.id },
      { type: "view", path: "/", visitor: "old", createdAt: new Date(Date.now() - 40 * 86_400_000) },
      { type: "search", path: "/", visitor: "a", query: "fintech", results: 3 },
      { type: "search", path: "/", visitor: "b", query: "fintech", results: 3 },
      { type: "search", path: "/", visitor: "b", query: "drones", results: 0 },
    ]);
    const st = await siteStats(db, 7);
    expect(st.totals).toEqual({ views: 3, visitors: 2, clicks: 1, searches: 3 });
    expect(st.searches[0]).toEqual({ key: "fintech", n: 2, results: 3 });
    expect(st.emptySearches).toEqual([{ key: "drones", n: 1, results: 0 }]);
    expect(st.pages[0]).toEqual({ key: "/", n: 2 });
    expect(st.referrers).toEqual([{ key: "x.com", n: 1 }]);
    expect(st.topTargets[0]).toMatchObject({ name: "Clicky", n: 1 });
    expect(st.funnel).toEqual({ formVisitors: 1, contacters: 1, contactClicks: 1 });
    expect(st.series).toHaveLength(7);
    expect(st.series.at(-1)!.views).toBe(3);
  });
});

describe("X post images backfill", () => {
  it("fills in images once per post and remembers posts without any", async () => {
    await importPosts(db, [
      { url: "https://x.com/pics/status/1852000000000000000", content: "photo post" },
      { url: "https://x.com/nopics/status/1852000000000000001", content: "text only" },
    ]);
    const calls: string[] = [];
    const fake = async (id: string) => {
      calls.push(id);
      return id.endsWith("0") ? { media: ["https://pbs.twimg.com/media/A.jpg"], avatarUrl: null } : null;
    };
    await backfillDetails(db, fake, 50);
    const cards = await listXCards(db, "post");
    expect(cards.find((c) => c.authorHandle === "pics")?.media).toEqual(["https://pbs.twimg.com/media/A.jpg"]);
    expect(calls).toEqual(expect.arrayContaining(["1852000000000000000", "1852000000000000001"]));
    const before = calls.length;
    await backfillDetails(db, fake, 50);
    expect(calls.length).toBe(before); // nothing is fetched twice
  });
});

describe("moments", () => {
  it("lists visible moments newest first, with the author's card when there is one", async () => {
    const author = await person({ name: "Moment Maker" });
    await db.insert(schema.moments).values({ body: "first", name: "Anon", visitor: "v" });
    await new Promise((r) => setTimeout(r, 5));
    await db.insert(schema.moments).values({ body: "by a card holder", personId: author.id, visitor: "v" });
    await db.insert(schema.moments).values({ body: "hidden", hidden: true, visitor: "v" });
    const items = await listMoments(db);
    expect(items.map((i) => i.moment.body)).toEqual(["by a card holder", "first"]);
    expect(items[0].author?.name).toBe("Moment Maker");
    expect(items[1].author).toBeNull();
    await expect(db.insert(schema.moments).values({ body: "", hasPhoto: false, visitor: "v" })).rejects.toThrow();
  });
});
