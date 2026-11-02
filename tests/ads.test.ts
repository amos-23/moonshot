import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { sql } from "drizzle-orm";
import { adsAdminStats, adsUsersCsv } from "@/lib/ads-admin";

import { cleanEvent, corsHeaders, getProgress, hashPassword, normaliseEmail, recordEvent, saveProgress, signIn, signOut, signUp, userForToken, validPassword, verifyPassword } from "@/lib/ads";

let db: DB;
beforeAll(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: path.join(__dirname, "..", "drizzle"), migrationsSchema: schema.DB_SCHEMA });
  db = d as unknown as DB;
});

describe("ads backend", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("s3cret-pass");
    expect(h).not.toContain("s3cret");
    expect(await verifyPassword("s3cret-pass", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
    expect(validPassword("short")).toBe(false);
    expect(validPassword("long enough")).toBe(true);
  });

  it("checks the password on sign-in, refuses duplicate sign-ups and lets old accounts claim a password", async () => {
    const made = await signUp(db, "pw@x.io", "first password", null);
    expect("error" in made).toBe(false);
    expect(await signUp(db, "pw@x.io", "other password", null)).toEqual({ error: "exists" });
    expect(await signIn(db, "pw@x.io", "wrong password")).toEqual({ error: "bad_login" });
    expect(await signIn(db, "nobody@x.io", "first password")).toEqual({ error: "bad_login" });
    expect("error" in (await signIn(db, "pw@x.io", "first password"))).toBe(false);
    // An account from before passwords existed has none; signing up with its email claims it.
    await db.execute(sql`INSERT INTO "ads"."users" ("email") VALUES ('old@x.io')`);
    expect(await signIn(db, "old@x.io", "anything at all")).toEqual({ error: "no_password" });
    const claimed = await signUp(db, "old@x.io", "new password", null);
    expect("error" in claimed).toBe(false);
    expect("error" in (await signIn(db, "old@x.io", "new password"))).toBe(false);
  });

  it("validates and lowercases emails", () => {
    expect(normaliseEmail("  Me@Example.COM ")).toBe("me@example.com");
    expect(normaliseEmail("nope")).toBeNull();
    expect(normaliseEmail(42)).toBeNull();
  });

  it("signs in, saves and restores progress, per device token", async () => {
    const a = await signUp(db, "amy@x.io", "correct horse", "Amy");
    if ("error" in a) throw new Error(a.error);
    expect(a.state).toBeNull();
    await saveProgress(db, a.user.id, { meta: { day: 3 } });
    const b = await signIn(db, "amy@x.io", "correct horse");
    if ("error" in b) throw new Error(b.error);
    expect(b.user.id).toBe(a.user.id);
    expect(b.user.name).toBe("Amy");
    expect(b.state?.state).toEqual({ meta: { day: 3 } });
    expect((await userForToken(db, a.token))?.email).toBe("amy@x.io");
    expect((await userForToken(db, b.token))?.id).toBe(a.user.id);
    await signOut(db, a.token);
    expect(await userForToken(db, a.token)).toBeNull();
    expect(await userForToken(db, b.token)).not.toBeNull();
    expect(await userForToken(db, "x")).toBeNull();
  });

  it("keeps users separate and overwrites progress", async () => {
    const a = await signUp(db, "one@x.io", "password one", null);
    const b = await signUp(db, "two@x.io", "password two", null);
    if ("error" in a || "error" in b) throw new Error("signup failed");
    await saveProgress(db, a.user.id, { v: 1 });
    await saveProgress(db, a.user.id, { v: 2 });
    expect((await getProgress(db, a.user.id))?.state).toEqual({ v: 2 });
    expect(await getProgress(db, b.user.id)).toBeNull();
  });

  it("only records known events and trims their properties", async () => {
    expect(cleanEvent({ name: "drop table" })).toBeNull();
    expect(cleanEvent(null)).toBeNull();
    const e = cleanEvent({ name: "platform_start", platform: "meta", props: { scenario: "x".repeat(200), n: 3, "bad key!": true, o: { a: 1 } } })!;
    expect(e.platform).toBe("meta");
    expect(e.props).toEqual({ scenario: "x".repeat(60), n: 3, badkey: true });
    expect(cleanEvent({ name: "view", platform: "myspace" })!.platform).toBeNull();
    await recordEvent(db, e, "v1", false);
    const res = await db.execute(sql`SELECT "name","platform","props" FROM "ads"."events"`);
    const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { name: string; platform: string; props: { n: number } }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].props.n).toBe(3);
  });

  it("allows only the ads origins to call the API", () => {
    expect(corsHeaders("https://ads.latars.xyz")["Access-Control-Allow-Origin"]).toBe("https://ads.latars.xyz");
    expect(corsHeaders("https://evil.example")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(null)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("summarises sign-ups and activity for the admin page, and exports a safe CSV", async () => {
    const u = await signUp(db, "=evil@x.io", "password evil", 'Ev"il');
    if ("error" in u) throw new Error(u.error);
    await saveProgress(db, u.user.id, { a: 1 });
    await recordEvent(db, cleanEvent({ name: "platform_start", platform: "google" })!, "v2", true);
    const st = await adsAdminStats(db);
    expect(st.users).toBeGreaterThanOrEqual(3);
    expect(st.withProgress).toBeGreaterThanOrEqual(1);
    expect(st.platforms30.find((p) => p.platform === "google")?.n).toBe(1);
    expect(st.events30.some((e) => e.name === "platform_start")).toBe(true);
    const csv = await adsUsersCsv(db);
    expect(csv.split("\r\n")[0]).toBe("email,name,has_progress,signed_up_at,last_seen_at");
    expect(csv).toContain('"\'=evil@x.io"');
    expect(csv).toContain('"Ev""il"');
  });
});
