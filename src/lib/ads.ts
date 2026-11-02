import "server-only";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db";

// Backend for AdsSim (ads.latars.xyz). Its own users and sessions in the `ads` Postgres schema,
// separate from the events app's accounts. Sign-in is by email alone, with no verification, on purpose:
// it only saves practice campaigns, and anyone who knows the email can load them.

export const MAX_STATE_BYTES = 4_000_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normaliseEmail = (v: unknown) => (typeof v === "string" && v.length <= 254 && EMAIL.test(v.trim()) ? v.trim().toLowerCase() : null);
export const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) || null : null);
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Rows from db.execute: an array with postgres-js (production), `{ rows }` with the embedded PGlite. */
function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : (res as { rows?: T[] }).rows ?? []) as T[];
}

export interface AdsUser {
  id: string;
  email: string;
  name: string | null;
}

/** Signs an email in (creating the user the first time) and returns a new session token for this device. */
export async function signIn(db: DB, email: string, name: string | null) {
  const [user] = rowsOf<AdsUser>(await db.execute(sql`
    INSERT INTO "ads"."users" ("email","name") VALUES (${email}, ${name})
    ON CONFLICT ("email") DO UPDATE SET "last_seen_at" = now(), "name" = COALESCE(${name}, "ads"."users"."name")
    RETURNING "id","email","name"`));
  const token = crypto.randomBytes(32).toString("base64url");
  await db.execute(sql`INSERT INTO "ads"."sessions" ("token_hash","user_id") VALUES (${hash(token)}, ${user.id})`);
  const state = await getProgress(db, user.id);
  return { token, user, state };
}

export async function userForToken(db: DB, token: string | null): Promise<AdsUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const rows = rowsOf<AdsUser>(await db.execute(sql`
    SELECT u."id", u."email", u."name" FROM "ads"."sessions" s JOIN "ads"."users" u ON u."id" = s."user_id"
    WHERE s."token_hash" = ${hash(token)}`));
  return rows[0] ?? null;
}

export async function signOut(db: DB, token: string) {
  await db.execute(sql`DELETE FROM "ads"."sessions" WHERE "token_hash" = ${hash(token)}`);
}

export async function getProgress(db: DB, userId: string): Promise<{ state: unknown; updatedAt: string } | null> {
  const rows = rowsOf<{ state: unknown; updated_at: Date | string }>(await db.execute(sql`SELECT "state","updated_at" FROM "ads"."progress" WHERE "user_id" = ${userId}`));
  return rows[0] ? { state: rows[0].state, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
}

export async function saveProgress(db: DB, userId: string, state: unknown) {
  const json = JSON.stringify(state);
  await db.execute(sql`
    INSERT INTO "ads"."progress" ("user_id","state") VALUES (${userId}, ${json}::jsonb)
    ON CONFLICT ("user_id") DO UPDATE SET "state" = EXCLUDED."state", "updated_at" = now()`);
}

/** The events AdsSim reports. Anything else is dropped. */
export const EVENT_NAMES = new Set(["view", "signup", "signin", "platform_start", "campaign_saved", "days_advanced", "ad_rejected", "scenario_started", "reset"]);
const PLATFORMS = new Set(["meta", "tiktok", "google", "x", "chatgpt"]);

export function cleanEvent(body: unknown): { name: string; platform: string | null; props: Record<string, string | number | boolean> | null } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !EVENT_NAMES.has(b.name)) return null;
  const platform = typeof b.platform === "string" && PLATFORMS.has(b.platform) ? b.platform : null;
  let props: Record<string, string | number | boolean> | null = null;
  if (b.props && typeof b.props === "object") {
    const out: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(b.props as Record<string, unknown>).slice(0, 8)) {
      const key = k.replace(/[^a-z0-9_]/gi, "").slice(0, 30);
      if (!key) continue;
      if (typeof v === "string") out[key] = v.slice(0, 60);
      else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
      else if (typeof v === "boolean") out[key] = v;
    }
    props = Object.keys(out).length ? out : null;
  }
  return { name: b.name, platform, props };
}

export async function recordEvent(db: DB, e: NonNullable<ReturnType<typeof cleanEvent>>, visitor: string, signedIn: boolean) {
  await db.execute(sql`
    INSERT INTO "ads"."events" ("name","platform","props","visitor","signed_in")
    VALUES (${e.name}, ${e.platform}, ${e.props ? JSON.stringify(e.props) : null}::jsonb, ${visitor}, ${signedIn})`);
}

/** Which web pages may call the API from a browser. */
export function allowedOrigins(): string[] {
  const configured = (process.env.ADS_ORIGINS ?? "https://ads.latars.xyz").split(",").map((s) => s.trim()).filter(Boolean);
  return process.env.NODE_ENV === "production" ? configured : [...configured, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"];
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && allowedOrigins().includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
