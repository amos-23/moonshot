import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { Profile } from "@/lib/db/schema";
import type { ProfileInput } from "@/lib/validation";

export async function saveProfile(db: DB, userId: string, input: ProfileInput, avatarUrl?: string | null) {
  const existing = await db.query.profiles.findFirst({ where: eq(s.profiles.userId, userId) });
  const values = { ...input, ...(avatarUrl !== undefined ? { avatarUrl } : {}), updatedAt: new Date() };
  if (existing) {
    const [row] = await db.update(s.profiles).set(values).where(eq(s.profiles.userId, userId)).returning();
    return { profile: row, created: false, wasComplete: profileCompleteness(existing).complete };
  }
  const [row] = await db
    .insert(s.profiles)
    .values({ userId, ...values })
    .returning();
  return { profile: row, created: true, wasComplete: false };
}

/** Completion checklist shown on the dashboard. "Complete" = everything that improves matching. */
export function profileCompleteness(p: Profile) {
  const checks = [
    { label: "Add a photo", done: Boolean(p.avatarUrl) },
    { label: "Write a bio", done: p.bio.length >= 40 },
    { label: "Pick 3+ interests", done: p.interests.length >= 3 },
    { label: "Choose your goals", done: p.goals.length >= 1 },
    { label: "Say what you can offer", done: p.offers.length >= 1 || p.canOffer.length >= 10 },
    { label: "Say what you're looking for", done: p.lookingFor.length >= 10 },
    { label: "Add your company or project", done: Boolean(p.company) },
  ];
  const done = checks.filter((c) => c.done).length;
  return { checks, percent: Math.round((done / checks.length) * 100), complete: done === checks.length };
}
