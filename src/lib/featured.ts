import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { listMoments, type MomentItem } from "@/lib/data";

// Featured on Moments: an admin's pin wins; otherwise one of the top 5 moments by engagement,
// rotating every 30 minutes (everyone sees the same one at the same time).

export const TOP_ACCOUNTS_KEY = "top_accounts";
export const ROTATE_MS = 30 * 60_000;
const TOP_N = 5;

/** "@a, b\nc" → ["a", "b", "c"] (lowercase, valid X handles only, no repeats). */
export function parseHandles(text: string): string[] {
  const found = text.match(/@?[A-Za-z0-9_]{1,15}/g) ?? [];
  return Array.from(new Set(found.map((h) => h.replace(/^@/, "").toLowerCase()))).slice(0, 200);
}

export async function getTopAccounts(db: DB): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(s.settings.key, TOP_ACCOUNTS_KEY) });
  return row ? parseHandles(row.value) : [];
}

const hasImage = (m: s.Moment) => m.photoCount > 0 || m.hasPhoto || m.xMedia.length > 0;

/**
 * How much a moment deserves the spotlight: likes and replies on X, plus how often people opened it
 * here (so uploaded photos can compete). Posts from your top accounts get a strong boost; verified
 * accounts a small one.
 */
export function momentScore(m: Pick<s.Moment, "xLikes" | "xReplies" | "xVerified" | "xAuthorHandle" | "xHandle">, opens: number, top: Set<string>): number {
  const handle = (m.xAuthorHandle ?? m.xHandle ?? "").toLowerCase();
  const boost = handle && top.has(handle) ? 4 : m.xVerified ? 1.25 : 1;
  return (m.xLikes + 2 * m.xReplies + 5 * opens + 1) * boost;
}

/** Same pick for everyone within a 30-minute window; a different one (when there's a choice) the next. */
export function rotationIndex(n: number, now: number): number {
  if (n <= 1) return 0;
  let x = Math.floor(now / ROTATE_MS) >>> 0;
  // A small integer hash so consecutive windows don't just step through the list in order.
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) % n;
}

export type FeaturedPick = { item: MomentItem; reason: "pinned" | "top"; candidates: number };

export async function pickFeatured(db: DB, now = Date.now()): Promise<FeaturedPick | null> {
  const items = await listMoments(db, { limit: 300 });
  const pinned = items.filter((i) => i.moment.featuredAt).sort((a, b) => b.moment.featuredAt!.getTime() - a.moment.featuredAt!.getTime())[0];
  if (pinned) return { item: pinned, reason: "pinned", candidates: 1 };

  const withImages = items.filter((i) => hasImage(i.moment));
  if (!withImages.length) return null;
  const [top, opens] = await Promise.all([getTopAccounts(db), momentOpens(db, withImages.map((i) => i.moment.id), now)]);
  const topSet = new Set(top);
  const ranked = withImages
    .map((i) => ({ i, score: momentScore(i.moment, opens.get(i.moment.id) ?? 0, topSet) }))
    // Ties go to the newer moment.
    .sort((a, b) => b.score - a.score || b.i.moment.createdAt.getTime() - a.i.moment.createdAt.getTime())
    .slice(0, TOP_N);
  return { item: ranked[rotationIndex(ranked.length, now)].i, reason: "top", candidates: ranked.length };
}

/** Times each moment was opened on the site in the last 30 days. */
async function momentOpens(db: DB, ids: string[], now: number) {
  if (!ids.length) return new Map<string, number>();
  const rows = await db
    .select({ id: s.events.targetId, n: sql<number>`count(*)::int` })
    .from(s.events)
    .where(
      and(
        eq(s.events.type, "click"),
        inArray(s.events.target, ["moment_open", "moments_featured", "highlights_tile"]),
        isNotNull(s.events.targetId),
        inArray(s.events.targetId, ids),
        gte(s.events.createdAt, new Date(now - 30 * 86_400_000)),
      ),
    )
    .groupBy(s.events.targetId)
    .orderBy(desc(sql`count(*)`));
  return new Map(rows.map((r) => [r.id!, r.n]));
}
