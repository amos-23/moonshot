import "server-only";
import type { DB } from "@/lib/db";
import { getSearchQueries, getSetting, setSetting } from "@/lib/services/settings";
import { upsertProviderPosts } from "@/lib/services/social";
import { activeSearchProvider } from "./providers";

const MIN_INTERVAL_MS = 15 * 60_000;

export type LiveStatus = {
  provider: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
  lastAdded: number | null;
};

export async function liveStatus(db: DB): Promise<LiveStatus> {
  const p = activeSearchProvider();
  const state = await getSetting<Omit<LiveStatus, "provider">>(db, "live_search_state");
  return { provider: p?.label ?? null, lastRefreshAt: state?.lastRefreshAt ?? null, lastError: state?.lastError ?? null, lastAdded: state?.lastAdded ?? null };
}

/**
 * Pulls fresh posts from the configured provider, at most once every 15 minutes (or on demand by
 * an admin), to stay well within API rate limits. Results are stored so users can curate them.
 */
export async function refreshLive(db: DB, opts: { force?: boolean } = {}): Promise<LiveStatus> {
  const provider = activeSearchProvider();
  const status = await liveStatus(db);
  if (!provider) return status;
  if (!opts.force && status.lastRefreshAt && Date.now() - new Date(status.lastRefreshAt).getTime() < MIN_INTERVAL_MS) return status;

  // Claim the slot first so concurrent page loads don't all hit the API.
  await setSetting(db, "live_search_state", { ...status, lastRefreshAt: new Date().toISOString() });
  const queries = await getSearchQueries(db);
  const query = queries.join(" OR ").slice(0, 500);
  const outcome = await provider.search(query, { maxResults: 50 });
  const next = outcome.ok
    ? { lastRefreshAt: new Date().toISOString(), lastError: null, lastAdded: await upsertProviderPosts(db, outcome.posts) }
    : { lastRefreshAt: new Date().toISOString(), lastError: outcome.message, lastAdded: 0 };
  await setSetting(db, "live_search_state", next);
  return { provider: provider.label, ...next };
}
