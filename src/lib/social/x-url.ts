// Parsing helpers for public X (Twitter) post URLs. Only data present in the URL itself is derived.

const HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "mobile.x.com"]);
const TWITTER_EPOCH = BigInt(1288834974657);
// Smallest IDs issued once Snowflake launched (Nov 2010); older sequential IDs carry no timestamp.
const SNOWFLAKE_MIN = BigInt("27000000000000000");

export type ParsedPostUrl = { handle: string; id: string; url: string };

export function parseXPostUrl(input: string): ParsedPostUrl | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOSTS.has(u.hostname.toLowerCase())) return null;
  const m = u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})\/?/);
  if (!m) return null;
  const [, handle, id] = m;
  if (["i", "home", "search", "intent"].includes(handle.toLowerCase())) return null;
  return { handle, id, url: `https://x.com/${handle}/status/${id}` };
}

/**
 * X post IDs are Snowflake IDs that encode their creation time. This is how X itself derives
 * timestamps, so it is a reliable source when no timestamp was supplied. Returns null for
 * pre-Snowflake IDs (before Nov 2010).
 */
export function snowflakeToDate(id: string): Date | null {
  try {
    const n = BigInt(id);
    if (n < SNOWFLAKE_MIN) return null;
    const ms = (n >> BigInt(22)) + TWITTER_EPOCH;
    const d = new Date(Number(ms));
    if (d.getTime() < Date.UTC(2010, 10, 4) || d.getTime() > Date.now() + 86_400_000) return null;
    return d;
  } catch {
    return null;
  }
}

const THEME_KEYWORDS: Record<string, RegExp> = {
  attendance: /\b(going to|attending|see you at|who('| i)s going|be at|tickets?|registered|in lagos|speaking at)\b/i,
  networking: /\b(network(ing)?|meet(ing)? up|connect|link up|let'?s meet|looking to meet|say hi)\b/i,
  startups: /\b(startups?|founders?|building|launch(ed|ing)?|product|pitch)\b/i,
  ai: /\b(ai|a\.i\.|artificial intelligence|llms?|machine learning|ml|agents?|genai)\b/i,
  investors: /\b(investors?|vcs?|venture|fund(ing|raise|raising)?|angels?|capital|raise)\b/i,
  exhibitors: /\b(booth|exhibit(or|ion|ing)?|stand|expo|sponsor(s|ing)?|demo day)\b/i,
};

export function detectThemes(text: string | null | undefined): string[] {
  if (!text) return [];
  return Object.entries(THEME_KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([theme]) => theme);
}

/** Official X web intent for replying to a post. The user reviews and posts it themselves. */
export function replyIntentUrl(postId: string | null, text: string): string {
  const params = new URLSearchParams({ text });
  if (postId) params.set("in_reply_to", postId);
  return `https://x.com/intent/post?${params.toString()}`;
}

// Who the author says they want to meet, from words they actually used in the post.
const MENTIONS: [string, RegExp][] = [
  ["Founders", /\bfounders?\b/i],
  ["Investors", /\b(investors?|vcs?|angels?)\b/i],
  ["Engineers", /\b(engineers?|developers?|devs?)\b/i],
  ["Designers", /\bdesigners?\b/i],
  ["Operators", /\boperators?\b/i],
  ["Marketers", /\b(marketers?|growth)\b/i],
  ["Distribution", /\bdistribution\b/i],
  ["AI builders", /\b(ai|agents?|llms?)\b/i],
  ["Fintech", /\bfintech|payments?\b/i],
  ["Hiring", /\b(hiring|we're hiring|open roles?)\b/i],
  ["Partners", /\bpartners?(hips?)?\b/i],
  ["Customers", /\bcustomers?\b/i],
];

export function detectMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  return MENTIONS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

// ─── Post images ─────────────────────────────────────────────────────────────

export type PostDetails = { media: string[]; avatarUrl: string | null };

const X_IMAGE = /^https:\/\/pbs\.twimg\.com\/[A-Za-z0-9_\-./?=&%]+$/;
const safeImage = (u: unknown): string | null => (typeof u === "string" && X_IMAGE.test(u) ? u : null);

/** Token X's embed widget sends with a post ID when loading its details. */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

/**
 * Picks the images a post shows: attached photos (or video/GIF stills), else its link-preview
 * image, plus the author's profile picture. Only images hosted by X are kept.
 */
export function parseSyndication(data: unknown): PostDetails {
  const d = (data ?? {}) as {
    mediaDetails?: { media_url_https?: string }[];
    card?: { binding_values?: Record<string, { image_value?: { url?: string } }> };
    user?: { profile_image_url_https?: string };
  };
  let media = (d.mediaDetails ?? []).map((m) => safeImage(m.media_url_https)).filter((u): u is string => Boolean(u));
  if (!media.length && d.card?.binding_values) {
    const b = d.card.binding_values;
    const preview = safeImage(b.photo_image_full_size_large?.image_value?.url ?? b.summary_photo_image_large?.image_value?.url ?? b.thumbnail_image_large?.image_value?.url);
    if (preview) media = [preview];
  }
  // "_normal" avatars are 48px; "_bigger" is 73px and still small.
  const avatar = safeImage(d.user?.profile_image_url_https?.replace("_normal.", "_bigger."));
  return { media: media.slice(0, 4), avatarUrl: avatar };
}
