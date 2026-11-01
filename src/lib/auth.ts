import "server-only";
import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Account } from "@/lib/db/schema";

// Sign-in is optional: everything works without an account, and an account keeps your cards across
// devices. In production it's Supabase Auth (email + password, magic links, password reset). Without
// Supabase settings, a small built-in sign-in can be switched on (LOCAL_AUTH=true) for local work and
// tests; otherwise sign-in is simply off.

export type AuthMode = "supabase" | "local" | "off";

export function authMode(): AuthMode {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  if (process.env.LOCAL_AUTH === "true" || process.env.NODE_ENV === "development") return "local";
  return "off";
}

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Called while rendering a page; the middleware keeps the session fresh instead.
        }
      },
    },
  });
}

// ─── Local sign-in (only when Supabase isn't set up) ─────────────────────────

export const LOCAL_SESSION_COOKIE = "ec_session";
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_KEY || "local-dev-only-secret";
const sign = (id: string) => crypto.createHmac("sha256", secret()).update(id).digest("base64url");

export async function setLocalSession(accountId: string) {
  (await cookies()).set(LOCAL_SESSION_COOKIE, `${accountId}.${sign(accountId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

function readLocalSession(value: string | undefined): string | null {
  if (!value) return null;
  const [id, sig] = value.split(".");
  if (!id || !sig) return null;
  const expected = sign(id);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function checkPassword(password: string, stored: string | null): boolean {
  const [kind, salt, hash] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const got = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 32);
  const want = Buffer.from(hash, "base64url");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// ─── Who's signed in ─────────────────────────────────────────────────────────

/** Makes sure there's an account row for a Supabase user (the auth user's id is the account id). */
export async function upsertAccount(id: string, email: string, extra: { name?: string | null; emailOptIn?: boolean } = {}): Promise<Account> {
  const db = await getDb();
  const now = new Date();
  const [row] = await db
    .insert(schema.accounts)
    .values({ id, email: email.toLowerCase(), name: extra.name ?? null, emailOptIn: extra.emailOptIn ?? false, lastSignInAt: now })
    .onConflictDoUpdate({ target: schema.accounts.id, set: { email: email.toLowerCase(), lastSignInAt: now, ...(extra.name ? { name: extra.name } : {}) } })
    .returning();
  return row;
}

/** The signed-in account for this request, or null. Cached, so pages and layouts can all ask. */
export const getAccount = cache(async (): Promise<Account | null> => {
  const mode = authMode();
  if (mode === "off") return null;
  const db = await getDb();
  if (mode === "local") {
    const id = readLocalSession((await cookies()).get(LOCAL_SESSION_COOKIE)?.value);
    if (!id) return null;
    return (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) })) ?? null;
  }
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    const user = data.user;
    if (!user?.email) return null;
    return (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, user.id) })) ?? (await upsertAccount(user.id, user.email, { name: (user.user_metadata?.name as string | undefined) ?? null }));
  } catch {
    return null;
  }
});

/** Records that this account has proven it owns its inbox (it came back through an email link or code). */
export async function markEmailVerified(id: string) {
  await (await getDb()).update(schema.accounts).set({ emailVerifiedAt: new Date() }).where(eq(schema.accounts.id, id));
}

/**
 * Admin by email: the email is in ADMIN_EMAILS and the account has proven it owns that inbox, so signing up
 * with someone else's address (possible when Supabase doesn't confirm emails) never grants admin. The built-in
 * local sign-in (development and tests only) sends no emails, so it skips the proof.
 */
export function isAdminAccount(account: Account | null | undefined): boolean {
  if (!account || !isAdminEmail(account.email)) return false;
  return authMode() === "local" || !!account.emailVerifiedAt;
}

/** Emails in ADMIN_EMAILS get admin when signed in (alongside the ADMIN_KEY). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
