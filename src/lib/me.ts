import "server-only";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Person } from "@/lib/db/schema";

// No accounts. Creating a card issues a random edit token; its hash is stored, the token lives
// in an httpOnly cookie and in a private edit link the person can open on another device.
const COOKIE = "mc_card";

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const newToken = () => crypto.randomBytes(24).toString("base64url");

export async function setCardCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearCardCookie() {
  (await cookies()).delete(COOKIE);
}

export async function myToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function findByToken(token: string): Promise<Person | null> {
  if (!token || token.length > 100) return null;
  const db = await getDb();
  return (await db.query.people.findFirst({ where: eq(schema.people.editTokenHash, hashToken(token)) })) ?? null;
}

export async function getMe(): Promise<Person | null> {
  const token = await myToken();
  return token ? findByToken(token) : null;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/** Returns false when this IP has done `action` `limit` times within `windowMinutes`. */
export async function rateLimit(action: string, limit: number, windowMinutes: number): Promise<boolean> {
  const db = await getDb();
  const key = `${action}:${hashToken(await clientIp()).slice(0, 32)}`;
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.rateEvents)
    .where(and(eq(schema.rateEvents.key, key), gte(schema.rateEvents.createdAt, since)));
  if (n >= limit) return false;
  await db.insert(schema.rateEvents).values({ key });
  return true;
}

export function isAdminKey(key: string | undefined | null): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected || expected.length < 12 || !key) return false;
  const a = Buffer.from(hashToken(key));
  const b = Buffer.from(hashToken(expected));
  return crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  return isAdminKey((await cookies()).get("mc_admin")?.value);
}
