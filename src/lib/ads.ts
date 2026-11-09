import "server-only";
import crypto from "crypto";
import { promisify } from "util";
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db";

// Backend for AdsSim (ads.latars.xyz). Its own users and sessions in the `ads` Postgres schema,
// separate from the events app's accounts. Sign in with an email and a password (scrypt-hashed).
// There is no email verification and no password reset yet.

export const MAX_STATE_BYTES = 4_000_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normaliseEmail = (v: unknown) => (typeof v === "string" && v.length <= 254 && EMAIL.test(v.trim()) ? v.trim().toLowerCase() : null);
export const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) || null : null);
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Rows from db.execute: an array with postgres-js (production), `{ rows }` with the embedded PGlite. */
export function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : (res as { rows?: T[] }).rows ?? []) as T[];
}

export interface AdsUser {
  id: string;
  email: string;
  name: string | null;
}

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const MIN_PASSWORD = 8;
export const validPassword = (v: unknown): v is string => typeof v === "string" && v.length >= MIN_PASSWORD && v.length <= 200;

/** "scrypt$<salt>$<hash>", both base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scrypt(password, salt, 64)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [kind, salt, want] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !want) return false;
  const expected = Buffer.from(want, "base64url");
  const got = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

export type AuthFailure = "exists" | "bad_login" | "no_password";

async function startSession(db: DB, user: AdsUser) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.execute(sql`INSERT INTO "ads"."sessions" ("token_hash","user_id") VALUES (${hash(token)}, ${user.id})`);
  return { token, user, state: await getProgress(db, user.id) };
}

/**
 * Creates an account with a password. An account made before passwords existed (no password yet) is claimed
 * by whoever signs up with its email first. One that already has a password is refused.
 */
export async function signUp(db: DB, email: string, password: string, name: string | null) {
  const passwordHash = await hashPassword(password);
  const rows = rowsOf<AdsUser>(await db.execute(sql`
    INSERT INTO "ads"."users" ("email","name","password_hash") VALUES (${email}, ${name}, ${passwordHash})
    ON CONFLICT ("email") DO UPDATE SET "password_hash" = EXCLUDED."password_hash", "last_seen_at" = now(), "name" = COALESCE(${name}, "ads"."users"."name")
    WHERE "ads"."users"."password_hash" IS NULL
    RETURNING "id","email","name"`));
  if (!rows[0]) return { error: "exists" as AuthFailure };
  return startSession(db, rows[0]);
}

/** Checks the email and password and returns a new session token for this device. */
export async function signIn(db: DB, email: string, password: string) {
  const rows = rowsOf<AdsUser & { password_hash: string | null }>(await db.execute(sql`SELECT "id","email","name","password_hash" FROM "ads"."users" WHERE "email" = ${email}`));
  const row = rows[0];
  // Always run a hash, so a missing account takes as long as a wrong password.
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) return row && !row.password_hash ? { error: "no_password" as AuthFailure } : { error: "bad_login" as AuthFailure };
  await db.execute(sql`UPDATE "ads"."users" SET "last_seen_at" = now() WHERE "id" = ${row.id}`);
  return startSession(db, { id: row.id, email: row.email, name: row.name });
}

// ─── Password reset ──────────────────────────────────────────────────────────

export const RESET_TTL_MINUTES = 60;
const RESET_REQUESTS_PER_HOUR = 3;
const RESET_TOKEN = /^[\w-]{20,100}$/;

/**
 * Starts a password reset for an email: returns a one-time token to put in the emailed link, or null when there's
 * nothing to send (no such account, or it asked too often). Callers answer the same either way, so the response
 * never says whether an email has an account. Earlier unused links stop working.
 */
export async function requestPasswordReset(db: DB, email: string): Promise<{ token: string; email: string; name: string | null } | null> {
  const user = rowsOf<AdsUser>(await db.execute(sql`SELECT "id","email","name" FROM "ads"."users" WHERE "email" = ${email}`))[0];
  if (!user) return null;
  await db.execute(sql`DELETE FROM "ads"."password_resets" WHERE "created_at" < now() - interval '1 day'`);
  const recent = rowsOf<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM "ads"."password_resets" WHERE "user_id" = ${user.id} AND "created_at" > now() - interval '1 hour'`))[0]?.n ?? 0;
  if (recent >= RESET_REQUESTS_PER_HOUR) return null;
  await db.execute(sql`UPDATE "ads"."password_resets" SET "used_at" = now() WHERE "user_id" = ${user.id} AND "used_at" IS NULL`);
  const token = crypto.randomBytes(32).toString("base64url");
  await db.execute(sql`INSERT INTO "ads"."password_resets" ("token_hash","user_id","expires_at") VALUES (${hash(token)}, ${user.id}, now() + ${sql.raw(`interval '${RESET_TTL_MINUTES} minutes'`)})`);
  return { token, email: user.email, name: user.name };
}

/**
 * Sets a new password with a reset token (once, within the hour). Every device is signed out, then this one is
 * signed in so the person lands back in their account. Returns "bad_token" for an unknown, used or expired link.
 */
export async function resetPassword(db: DB, token: string, password: string) {
  if (!RESET_TOKEN.test(token)) return { error: "bad_token" as const };
  const passwordHash = await hashPassword(password);
  // Claim the token first: of two people using the same link at once, only one gets through.
  const claimed = rowsOf<{ user_id: string }>(await db.execute(sql`
    UPDATE "ads"."password_resets" SET "used_at" = now()
    WHERE "token_hash" = ${hash(token)} AND "used_at" IS NULL AND "expires_at" > now()
    RETURNING "user_id"`))[0];
  if (!claimed) return { error: "bad_token" as const };
  const user = rowsOf<AdsUser>(await db.execute(sql`
    UPDATE "ads"."users" SET "password_hash" = ${passwordHash}, "last_seen_at" = now() WHERE "id" = ${claimed.user_id}
    RETURNING "id","email","name"`))[0];
  if (!user) return { error: "bad_token" as const };
  await db.execute(sql`DELETE FROM "ads"."sessions" WHERE "user_id" = ${user.id}`);
  return startSession(db, user);
}

/** The AdsSim page a reset link points to: the page that made the request if it's an allowed origin, else the main site. */
export function adsSiteUrl(origin: string | null): string {
  const allowed = allowedOrigins();
  return (origin && allowed.includes(origin) ? origin : allowed[0]).replace(/\/$/, "");
}

export function resetEmail(link: string, name: string | null) {
  const minutes = RESET_TTL_MINUTES;
  const hi = name ? `Hi ${name},` : "Hi,";
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return {
    subject: "Reset your AdsSim password",
    text: `${hi}\n\nSomeone asked to reset the password for your AdsSim account. To choose a new one, open this link (it works once, for the next ${minutes} minutes):\n\n${link}\n\nIf that wasn't you, ignore this email: your password stays the same.\n\nAdsSim`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e"><p>${esc(hi)}</p><p>Someone asked to reset the password for your AdsSim account. Choose a new one here (the link works once, for the next ${minutes} minutes):</p><p style="margin:24px 0"><a href="${esc(link)}" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p style="color:#666;font-size:13px">If the button doesn't work, paste this into your browser:<br>${esc(link)}</p><p style="color:#666;font-size:13px">If that wasn't you, ignore this email: your password stays the same.</p></div>`,
  };
}

const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

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
export const EVENT_NAMES = new Set(["view", "signup", "signin", "platform_start", "campaign_saved", "days_advanced", "ad_rejected", "scenario_started", "reset", "password_reset"]);
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
