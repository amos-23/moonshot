import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { importPosts, joinHangout, listHangouts, listPeople, listPosts } from "@/lib/data";

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

describe("people directory", () => {
  it("ranks the best fit first, hides hidden cards and excludes yourself", async () => {
    const me = await person({ name: "Me", wants: ["investors"], interests: ["fintech"] });
    const vc = await person({ name: "Val VC", offers: ["investment"], interests: ["fintech"] });
    await person({ name: "Random" });
    const hidden = await person({ name: "Hidden", offers: ["investment"], hidden: true });
    const list = await listPeople(db, me);
    expect(list[0].person.id).toBe(vc.id);
    expect(list[0].reasons[0]).toMatch(/Val offers investment/);
    expect(list.map((r) => r.person.id)).not.toContain(me.id);
    expect(list.map((r) => r.person.id)).not.toContain(hidden.id);
    expect((await listPeople(db, null, { offer: "investment" })).map((r) => r.person.id)).toEqual([vc.id]);
    expect((await listPeople(db, null, { q: "val" })).length).toBe(1);
  });

  it("shows 'findable now' only for fresh location notes", async () => {
    const fresh = await person({ whereNote: "Coffee stand", whereUpdatedAt: new Date() });
    await person({ whereNote: "Old spot", whereUpdatedAt: new Date(Date.now() - 5 * 3600_000) });
    expect((await listPeople(db, null, { here: true })).map((r) => r.person.id)).toEqual([fresh.id]);
  });
});

describe("hangouts", () => {
  it("enforces capacity and counts members", async () => {
    const host = await person();
    const [h] = await db.insert(schema.hangouts).values({ hostId: host.id, title: "AI lunch", startsAt: new Date(Date.now() + 3600_000), place: "Lobby", capacity: 2 }).returning();
    await joinHangout(db, host.id, h.id);
    await joinHangout(db, (await person()).id, h.id);
    await expect(joinHangout(db, (await person()).id, h.id)).rejects.toThrow(/full/);
    const [row] = (await listHangouts(db, host.id)).filter((r) => r.hangout.id === h.id);
    expect(row.going).toBe(2);
    expect(row.joined).toBe(true);
  });
});

describe("post import", () => {
  it("validates, dedupes and auto-tags themes", async () => {
    const res = await importPosts(db, [
      { url: "https://x.com/a/status/1849000000000000000", content: "Who's going to Moonshot? Looking to meet investors" },
      { url: "https://x.com/a/status/1849000000000000000" },
      { url: "https://example.com/nope" },
    ]);
    expect(res.map((r) => r.status)).toEqual(["added", "duplicate", "invalid"]);
    const [post] = await listPosts(db, { theme: "investors" });
    expect(post.themes).toEqual(expect.arrayContaining(["attendance", "investors"]));
    expect(post.postedAt?.getUTCFullYear()).toBe(2024);
  });
});
