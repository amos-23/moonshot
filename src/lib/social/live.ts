import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { SEARCH_PHRASES } from "@/lib/constants";
import { detectThemes } from "./x-url";
import { activeSearchProvider, fetchPostDetails } from "./providers";
import { backfillDetails, refreshMomentStats } from "@/lib/data";

const KEY = "x_last_refresh";
const MIN_INTERVAL_MS = 15 * 60_000;

/** Pulls new posts from the official X API at most every 15 minutes. No-op without X_BEARER_TOKEN. */
export async function refreshLive(db: DB, force = false): Promise<{ provider: string | null; error?: string; added?: number }> {
  const provider = activeSearchProvider();
  if (!provider) return { provider: null };
  const last = await db.query.settings.findFirst({ where: eq(s.settings.key, KEY) });
  if (!force && last && Date.now() - Number(last.value) < MIN_INTERVAL_MS) return { provider: provider.label };
  await db
    .insert(s.settings)
    .values({ key: KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: String(Date.now()) } });
  const query = SEARCH_PHRASES.map((p) => `"${p}"`).join(" OR ");
  const res = await provider.search(query, { maxResults: 50 });
  if (!res.ok) return { provider: provider.label, error: res.message };
  let added = 0;
  for (const p of res.posts) {
    const r = await db
      .insert(s.socialPosts)
      .values({ externalId: p.externalId, url: p.url, authorHandle: p.authorHandle, authorName: p.authorName, content: p.content, postedAt: p.postedAt, themes: detectThemes(p.content), source: "x_api" })
      .onConflictDoNothing()
      .returning({ id: s.socialPosts.id });
    added += r.length;
  }
  return { provider: provider.label, added };
}

const BACKFILL_KEY = "details_backfill";

/** Fetches images for up to 10 older posts, at most once a minute. Call after the response. */
export async function backfillImages(db: DB) {
  const last = await db.query.settings.findFirst({ where: eq(s.settings.key, BACKFILL_KEY) });
  if (last && Date.now() - Number(last.value) < 60_000) return;
  await db
    .insert(s.settings)
    .values({ key: BACKFILL_KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: String(Date.now()) } });
  await backfillDetails(db, fetchPostDetails, 10);
}

const MOMENT_STATS_KEY = "moment_stats_refresh";

/** Refreshes likes/replies for up to 10 X moments, at most once a minute. Call after the response. */
export async function refreshMoments(db: DB) {
  const last = await db.query.settings.findFirst({ where: eq(s.settings.key, MOMENT_STATS_KEY) });
  if (last && Date.now() - Number(last.value) < 60_000) return;
  await db
    .insert(s.settings)
    .values({ key: MOMENT_STATS_KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: String(Date.now()) } });
  await refreshMomentStats(db, fetchPostDetails, 10);
}
