import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { POST_THEMES } from "@/lib/constants";
import { detectThemes, parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";
import { AppError } from "./errors";

export type ImportRecord = {
  url: string;
  content?: string | null;
  authorName?: string | null;
  authorHandle?: string | null;
  postedAt?: string | Date | null;
  themes?: string[];
};

export type ImportRowResult = { input: string; status: "imported" | "duplicate" | "invalid"; message?: string };

const THEMES = new Set(POST_THEMES.map((t) => t.value));

/**
 * Accepts either one URL per line, or a JSON array of records
 * ({ url, content?, authorName?, authorHandle?, postedAt?, themes? }).
 */
export function parseImportText(text: string): { records: ImportRecord[]; errors: ImportRowResult[] } {
  const trimmed = text.trim();
  if (!trimmed) return { records: [], errors: [] };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { records: [], errors: [{ input: "JSON", status: "invalid", message: "Could not parse JSON." }] };
    }
    const list = Array.isArray(data) ? data : [data];
    const records: ImportRecord[] = [];
    const errors: ImportRowResult[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object" || typeof (item as ImportRecord).url !== "string") {
        errors.push({ input: JSON.stringify(item).slice(0, 80), status: "invalid", message: "Each record needs a url." });
        continue;
      }
      const r = item as Record<string, unknown>;
      const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
      records.push({
        url: r.url as string,
        content: str("content") ?? str("text"),
        authorName: str("authorName") ?? str("author_name"),
        authorHandle: str("authorHandle") ?? str("author_handle"),
        postedAt: str("postedAt") ?? str("posted_at") ?? str("created_at"),
        themes: Array.isArray(r.themes) ? (r.themes as unknown[]).filter((t): t is string => typeof t === "string") : undefined,
      });
    }
    return { records, errors };
  }
  const records = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((url) => ({ url }));
  return { records, errors: [] };
}

type Enricher = (url: string) => Promise<{ authorName: string | null; text: string | null } | null>;

export async function importPosts(
  db: DB,
  importerId: string | null,
  records: ImportRecord[],
  opts: { source?: "manual" | "import"; enrich?: Enricher } = {},
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];
  for (const rec of records.slice(0, 200)) {
    const parsed = parseXPostUrl(rec.url);
    if (!parsed) {
      results.push({ input: rec.url, status: "invalid", message: "Not a public X post URL (x.com/<handle>/status/<id>)." });
      continue;
    }
    let postedAt: Date | null = null;
    if (rec.postedAt) {
      const d = new Date(rec.postedAt);
      if (Number.isNaN(d.getTime())) {
        results.push({ input: rec.url, status: "invalid", message: "postedAt is not a valid date." });
        continue;
      }
      postedAt = d;
    }
    postedAt ??= snowflakeToDate(parsed.id);

    let content = rec.content?.trim().slice(0, 1000) || null;
    let authorName = rec.authorName?.trim().slice(0, 100) || null;
    let source: "manual" | "import" | "oembed" = opts.source ?? "import";
    if (!content && opts.enrich) {
      const embed = await opts.enrich(parsed.url);
      if (embed?.text) {
        content = embed.text.slice(0, 1000);
        authorName ??= embed.authorName;
        source = "oembed";
      }
    }
    const themes = rec.themes?.length ? rec.themes.filter((t) => THEMES.has(t)) : detectThemes(content);

    const inserted = await db
      .insert(s.socialPosts)
      .values({
        platform: "x",
        externalId: parsed.id,
        url: parsed.url,
        authorHandle: rec.authorHandle?.replace(/^@/, "") || parsed.handle,
        authorName,
        content,
        postedAt,
        themes,
        source,
        importedById: importerId,
      })
      .onConflictDoNothing()
      .returning({ id: s.socialPosts.id });
    results.push({ input: rec.url, status: inserted.length ? "imported" : "duplicate" });
  }
  return results;
}

/** Store posts returned by a live provider. Existing rows are left as they are. */
export async function upsertProviderPosts(
  db: DB,
  posts: { externalId: string; url: string; authorHandle: string | null; authorName: string | null; content: string | null; postedAt: Date | null }[],
) {
  let added = 0;
  for (const p of posts) {
    const res = await db
      .insert(s.socialPosts)
      .values({ platform: "x", ...p, themes: detectThemes(p.content), source: "x_api" })
      .onConflictDoNothing()
      .returning({ id: s.socialPosts.id });
    added += res.length;
  }
  return added;
}

export type PostFilters = { q?: string; theme?: string; view?: "all" | "relevant" | "dismissed" };

export async function listPosts(db: DB, viewerId: string | null, filters: PostFilters = {}) {
  const q = filters.q?.trim();
  const rows = await db
    .select({
      post: s.socialPosts,
      mark: viewerId ? s.socialPostMarks.mark : sql<string | null>`null`,
      relevantCount: sql<number>`(select count(*)::int from social_post_marks m where m.post_id = ${s.socialPosts.id} and m.mark = 'relevant')`,
    })
    .from(s.socialPosts)
    .leftJoin(
      s.socialPostMarks,
      viewerId
        ? and(eq(s.socialPostMarks.postId, s.socialPosts.id), eq(s.socialPostMarks.userId, viewerId))
        : sql`false`,
    )
    .where(
      and(
        eq(s.socialPosts.hidden, false),
        filters.theme ? sql`${filters.theme} = any(${s.socialPosts.themes})` : undefined,
        q
          ? sql`(${s.socialPosts.content} ilike ${"%" + q + "%"} or ${s.socialPosts.authorHandle} ilike ${"%" + q.replace(/^@/, "") + "%"} or ${s.socialPosts.authorName} ilike ${"%" + q + "%"})`
          : undefined,
      ),
    )
    .orderBy(desc(sql`coalesce(${s.socialPosts.postedAt}, ${s.socialPosts.importedAt})`))
    .limit(200);

  const view = filters.view ?? "all";
  return rows.filter((r) => {
    if (view === "relevant") return r.mark === "relevant";
    if (view === "dismissed") return r.mark === "dismissed";
    return r.mark !== "dismissed";
  });
}

export async function markPost(db: DB, userId: string, postId: string, mark: "relevant" | "dismissed" | "clear") {
  const post = await db.query.socialPosts.findFirst({ where: eq(s.socialPosts.id, postId) });
  if (!post || post.hidden) throw new AppError("Post not found.", "not_found");
  if (mark === "clear") {
    await db.delete(s.socialPostMarks).where(and(eq(s.socialPostMarks.userId, userId), eq(s.socialPostMarks.postId, postId)));
    return;
  }
  await db
    .insert(s.socialPostMarks)
    .values({ userId, postId, mark })
    .onConflictDoUpdate({ target: [s.socialPostMarks.userId, s.socialPostMarks.postId], set: { mark, createdAt: new Date() } });
}

export async function recordInvite(db: DB, userId: string, postId: string) {
  const post = await db.query.socialPosts.findFirst({ where: eq(s.socialPosts.id, postId) });
  if (!post || post.hidden) throw new AppError("Post not found.", "not_found");
  await db.insert(s.postInvites).values({ postId, inviterId: userId }).onConflictDoNothing();
  return post;
}

export async function postCount(db: DB) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.socialPosts).where(eq(s.socialPosts.hidden, false));
  return r?.n ?? 0;
}
