import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { backfillDetails, commentsFor, importPosts, listMoments, listPeople, listXCards, momentPeople, refreshMomentStats } from "@/lib/data";
import { pickFeatured, TOP_ACCOUNTS_KEY } from "@/lib/featured";
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
    await db.insert(schema.moments).values({ xPostUrl: "https://x.com/a/status/1", xText: "shared from X", visitor: "v" });
    const items = await listMoments(db);
    expect(items.map((i) => i.moment.body || i.moment.xText)).toEqual(["shared from X", "by a card holder", "first"]);
    expect(items[1].author?.name).toBe("Moment Maker");
    expect(items[2].author).toBeNull();
    await expect(db.insert(schema.moments).values({ body: "", hasPhoto: false, visitor: "v" })).rejects.toThrow();
  });
});

describe("moments and people", () => {
  it("links a moment to its poster and the people it @mentions who are on the site", async () => {
    const tola = await person({ name: "Tola Card", xHandle: "TolaC" });
    await person({ name: "Hidden Mention", xHandle: "hidem", hidden: true });
    await importPosts(db, [{ url: "https://x.com/kunle_x/status/1853000000000000000", content: "Moonshot!" }]);
    const [m] = await db
      .insert(schema.moments)
      .values({ xPostUrl: "https://x.com/someone/status/2", xAuthorHandle: "someone", xText: "Great day with @tolac, @Kunle_X, @hidem and @nobody", visitor: "v", photoCount: 0 })
      .returning();
    await db.insert(schema.moments).values({ body: "two photos", hasPhoto: true, photoCount: 2, visitor: "v" });
    const items = await listMoments(db);
    const ppl = await momentPeople(db, items);
    expect(ppl.get(m.id)?.map((p) => p.name)).toEqual(["Tola Card", "@kunle_x"]);
    expect(ppl.get(m.id)?.[0]).toMatchObject({ key: tola.id, q: "TolaC" });
  });

  it("stores several photos per moment, in order", async () => {
    const [m] = await db.insert(schema.moments).values({ body: "gallery", hasPhoto: true, photoCount: 2, visitor: "v" }).returning();
    await db.insert(schema.momentPhotos).values([
      { momentId: m.id, position: 0, mime: "image/jpeg", data: "AA==" },
      { momentId: m.id, position: 1, mime: "image/jpeg", data: "AQ==" },
    ]);
    await expect(db.insert(schema.momentPhotos).values({ momentId: m.id, position: 1, mime: "image/jpeg", data: "Ag==" })).rejects.toThrow();
  });
});

describe("Featured", () => {
  it("picks among the most engaging moments with images, boosts top accounts, and lets a pin win", async () => {
    // Fresh state for this test: hide everything from earlier tests.
    await db.update(schema.moments).set({ hidden: true });
    const add = async (o: Partial<typeof schema.moments.$inferInsert>) =>
      (await db.insert(schema.moments).values({ body: "m", visitor: "v", ...o }).returning())[0];
    const textOnly = await add({ body: "loved but no photo", xLikes: 9999 });
    const popular = await add({ xPostUrl: "https://x.com/a/status/10", xAuthorHandle: "a", xMedia: ["https://pbs.twimg.com/media/a.jpg"], xLikes: 500 });
    const official = await add({ xPostUrl: "https://x.com/TechCabal/status/11", xAuthorHandle: "TechCabal", xMedia: ["https://pbs.twimg.com/media/b.jpg"], xLikes: 200 });
    const photo = await add({ hasPhoto: true, photoCount: 1 });
    for (let i = 0; i < 6; i++) await add({ xPostUrl: `https://x.com/q/status/${20 + i}`, xAuthorHandle: "q", xMedia: ["https://pbs.twimg.com/media/q.jpg"], xLikes: i });

    // Only the top 5 rotate; text-only moments never feature.
    const seen = new Set<string>();
    for (let k = 0; k < 40; k++) seen.add((await pickFeatured(db, Date.now() + k * 30 * 60_000))!.item.moment.id);
    expect(seen.has(textOnly.id)).toBe(false);
    expect(seen.has(popular.id)).toBe(true);
    expect(seen.size).toBeLessThanOrEqual(5);

    // Opens on the site lift an uploaded photo into the top 5.
    await db.insert(schema.events).values(Array.from({ length: 60 }, () => ({ type: "click", path: "/moments", visitor: "v", target: "moment_open", targetId: photo.id })));
    const seen2 = new Set<string>();
    for (let k = 0; k < 40; k++) seen2.add((await pickFeatured(db, Date.now() + k * 30 * 60_000))!.item.moment.id);
    expect(seen2.has(photo.id)).toBe(true);

    // A top account outranks a more-liked post from anyone else.
    await db.insert(schema.settings).values({ key: TOP_ACCOUNTS_KEY, value: "techcabal" }).onConflictDoUpdate({ target: schema.settings.key, set: { value: "techcabal" } });
    await db.update(schema.moments).set({ hidden: true }).where(sql`${schema.moments.xAuthorHandle} = 'q'`);
    await db.update(schema.moments).set({ hidden: true }).where(eq(schema.moments.id, photo.id));
    // With two candidates left, both rotate, but the official one scores higher: 201*4 vs 501.
    const picked = await pickFeatured(db);
    expect([official.id, popular.id]).toContain(picked!.item.moment.id);

    // An admin's pin always wins.
    await db.update(schema.moments).set({ featuredAt: new Date() }).where(eq(schema.moments.id, textOnly.id));
    const pinned = await pickFeatured(db);
    expect(pinned).toMatchObject({ reason: "pinned" });
    expect(pinned!.item.moment.id).toBe(textOnly.id);
  });

  it("refreshes likes, replies and video for X moments that are due", async () => {
    const [m] = await db.insert(schema.moments).values({ xPostUrl: "https://x.com/v/status/1860000000000000000", xAuthorHandle: "v", visitor: "v" }).returning();
    const calls: string[] = [];
    const fake = async (id: string) => {
      calls.push(id);
      return { media: ["https://pbs.twimg.com/ext_tw_video_thumb/1/a.jpg"], avatarUrl: null, likes: 42, replies: 7, verified: true, video: { src: "https://video.twimg.com/a.mp4", small: "https://video.twimg.com/s.mp4", gif: false } };
    };
    await refreshMomentStats(db, fake, 50);
    const [after] = await db.select().from(schema.moments).where(eq(schema.moments.id, m.id));
    expect(after).toMatchObject({ xLikes: 42, xReplies: 7, xVerified: true, xVideo: "https://video.twimg.com/a.mp4", xVideoSmall: "https://video.twimg.com/s.mp4", xMedia: ["https://pbs.twimg.com/ext_tw_video_thumb/1/a.jpg"] });
    const before = calls.length;
    await refreshMomentStats(db, fake, 50);
    expect(calls.length).toBe(before); // not due again for 3 hours
  });
});
