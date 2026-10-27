import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { commentsFor, importPosts, listPeople, listXCards } from "@/lib/data";

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
    expect((await listXCards(db, "founders")).map((c) => c.authorHandle)).toEqual(["oreofe"]);
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
