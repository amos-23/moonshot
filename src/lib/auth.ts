import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminEmails, authMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, User } from "@/lib/db/schema";

const DEMO_COOKIE = "mc_demo_session";

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (32+ chars) is required when demo auth is enabled in production.");
  }
  return "local-development-only-secret-change-me-please";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function verifyDemoToken(token: string | undefined): string | null {
  if (!token) return null;
  const [userId, issued, sig] = token.split(".");
  if (!userId || !issued || !sig) return null;
  const expected = sign(`${userId}.${issued}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() - Number(issued) > 1000 * 60 * 60 * 24 * 30) return null;
  return userId;
}

/** Find or create the account row for an authenticated email. */
export async function upsertAccount(email: string, id?: string): Promise<User> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const role = adminEmails().includes(normalized) ? "admin" : "user";
  const existing = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${normalized}` });
  if (existing) {
    if (role === "admin" && existing.role !== "admin") {
      await db.update(schema.users).set({ role }).where(eq(schema.users.id, existing.id));
      return { ...existing, role };
    }
    return existing;
  }
  const [created] = await db
    .insert(schema.users)
    .values({ ...(id ? { id } : {}), email: normalized, role })
    .returning();
  return created;
}

export async function startDemoSession(email: string): Promise<void> {
  if (authMode() !== "demo") throw new Error("Demo sign-in is disabled.");
  const user = await upsertAccount(email);
  const issued = String(Date.now());
  const token = `${user.id}.${issued}.${sign(`${user.id}.${issued}`)}`;
  (await cookies()).set(DEMO_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession(): Promise<void> {
  if (authMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(DEMO_COOKIE);
}

export type SessionUser = User;

/** The signed-in account, or null. Suspended accounts are treated as signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const mode = authMode();
  const db = await getDb();
  let user: User | undefined;

  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return null;
    user = await db.query.users.findFirst({ where: eq(schema.users.id, data.user.id) });
    if (!user) user = await upsertAccount(data.user.email, data.user.id);
  } else if (mode === "demo") {
    const id = verifyDemoToken((await cookies()).get(DEMO_COOKIE)?.value);
    if (!id) return null;
    user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  }

  if (!user || user.suspendedAt) return null;
  return user;
}

export type Viewer = { user: SessionUser; profile: Profile | null };

export async function getViewer(): Promise<Viewer | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const db = await getDb();
  const profile = (await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, user.id) })) ?? null;
  return { user, profile };
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Signed in with a completed profile; otherwise redirect to the right step. */
export async function requireProfile(next?: string): Promise<{ user: SessionUser; profile: Profile }> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (!viewer.profile) redirect("/onboarding");
  return { user: viewer.user, profile: viewer.profile };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}
