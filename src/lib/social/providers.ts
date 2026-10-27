import "server-only";

// Provider abstraction for public social posts. Each provider must use a documented,
// compliant access method. We never scrape, never bypass login, and never fabricate results.

export type ProviderPost = {
  externalId: string;
  url: string;
  authorHandle: string | null;
  authorName: string | null;
  content: string | null;
  postedAt: Date | null;
};

export type SearchOutcome =
  | { ok: true; posts: ProviderPost[] }
  | { ok: false; reason: "not_configured" | "rate_limited" | "error"; message: string };

export interface SocialSearchProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  search(query: string, opts?: { maxResults?: number }): Promise<SearchOutcome>;
}

/** Official X API v2 recent search (https://docs.x.com/x-api/posts/search-recent-posts). */
export const xApiProvider: SocialSearchProvider = {
  id: "x_api",
  label: "X API v2 (recent search)",
  isConfigured: () => Boolean(process.env.X_BEARER_TOKEN),
  async search(query, opts) {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) return { ok: false, reason: "not_configured", message: "X_BEARER_TOKEN is not set." };
    const params = new URLSearchParams({
      query: `(${query}) -is:retweet`,
      max_results: String(Math.min(Math.max(opts?.maxResults ?? 25, 10), 100)),
      "tweet.fields": "created_at,author_id,lang",
      expansions: "author_id",
      "user.fields": "username,name",
    });
    try {
      const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429) {
        return { ok: false, reason: "rate_limited", message: "X API rate limit reached. Try again later." };
      }
      if (!res.ok) {
        return { ok: false, reason: "error", message: `X API returned ${res.status}.` };
      }
      const json = (await res.json()) as {
        data?: { id: string; text: string; author_id?: string; created_at?: string }[];
        includes?: { users?: { id: string; username: string; name: string }[] };
      };
      const users = new Map((json.includes?.users ?? []).map((u) => [u.id, u]));
      const posts = (json.data ?? []).map((t) => {
        const user = t.author_id ? users.get(t.author_id) : undefined;
        const handle = user?.username ?? null;
        return {
          externalId: t.id,
          url: handle ? `https://x.com/${handle}/status/${t.id}` : `https://x.com/i/web/status/${t.id}`,
          authorHandle: handle,
          authorName: user?.name ?? null,
          content: t.text,
          postedAt: t.created_at ? new Date(t.created_at) : null,
        };
      });
      return { ok: true, posts };
    } catch (err) {
      return { ok: false, reason: "error", message: err instanceof Error ? err.message : "X API request failed." };
    }
  },
};

export const searchProviders: SocialSearchProvider[] = [xApiProvider];

export function activeSearchProvider(): SocialSearchProvider | null {
  return searchProviders.find((p) => p.isConfigured()) ?? null;
}

export type OEmbed = { authorName: string | null; authorUrl: string | null; text: string | null };

/**
 * X's public oEmbed endpoint (https://developer.x.com/en/docs/x-for-websites/oembed-api) returns
 * the author and text of a single public post without authentication. Used to enrich imports.
 */
export async function fetchOEmbed(url: string): Promise<OEmbed | null> {
  if (process.env.X_OEMBED_ENABLED === "false") return null;
  try {
    const res = await fetch(
      `https://publish.x.com/oembed?${new URLSearchParams({ url, omit_script: "1", dnt: "true" })}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { author_name?: string; author_url?: string; html?: string };
    return { authorName: json.author_name ?? null, authorUrl: json.author_url ?? null, text: extractOEmbedText(json.html ?? "") };
  } catch {
    return null;
  }
}

export function extractOEmbedText(html: string): string | null {
  const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return null;
  const text = m[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .trim();
  return text || null;
}
