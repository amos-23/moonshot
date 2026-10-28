import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { Person } from "@/lib/db/schema";
import { scoreMatch } from "@/lib/matching";
import { FILTERS, isHereNow, matches, personText, postText, searchWords, type FilterKey } from "@/lib/search";
import { detectThemes, parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";

export type FeedItem =
  | { kind: "person"; at: Date; person: Person; score: number; reasons: string[] }
  | { kind: "x"; at: Date; post: s.SocialPost };

export type FeedOptions = { q?: string; filter?: FilterKey; sort?: "match" | "new" };

/**
 * The home feed: cards people made plus "From X" cards, searched word by word (tags included),
 * filtered, and sorted by fit ("match") or newest first ("new").
 */
export async function feed(db: DB, me: Person | null, opts: FeedOptions = {}) {
  const words = searchWords(opts.q);
  const [people, posts] = await Promise.all([
    db.select().from(s.people).where(eq(s.people.hidden, false)).orderBy(desc(s.people.createdAt)).limit(2000),
    listXCards(db),
  ]);
  const f = opts.filter && opts.filter !== "x" ? FILTERS[opts.filter] : null;

  const personItems = (opts.filter === "x" ? [] : people)
    .filter((p) => p.id !== me?.id && (!f || f.test(p)) && matches(personText(p), words))
    .map((p) => ({ kind: "person" as const, at: p.createdAt, person: p, ...(me ? scoreMatch(me, p) : { score: 0, reasons: [] as string[] }) }));
  const xItems = (f ? [] : posts)
    .filter((p) => matches(postText(p), words))
    .map((p) => ({ kind: "x" as const, at: p.postedAt ?? p.importedAt, post: p }));

  const newest = (a: FeedItem, b: FeedItem) => b.at.getTime() - a.at.getTime();
  const items: FeedItem[] =
    opts.sort === "new"
      ? [...personItems, ...xItems].sort(newest)
      : [...personItems.sort((a, b) => b.score - a.score || Number(isHereNow(b.person)) - Number(isHereNow(a.person)) || newest(a, b)), ...xItems.sort(newest)];

  // Supply vs demand for the scarce filters, e.g. "20 want investors · 1 investor here".
  const gaps: Record<string, { have: number; want: number }> = {};
  const counts: Record<string, number> = {};
  for (const [key, def] of Object.entries(FILTERS)) {
    counts[key] = people.filter(def.test).length;
    if (def.wantedBy) gaps[key] = { have: counts[key], want: people.filter((p) => p.wants.includes(def.wantedBy!)).length };
  }
  counts.x = posts.length;
  return { items, gaps, counts };
}

/** Cards people made, best fit first when we know who's looking. */
export async function listPeople(db: DB, me: Person | null, q?: string) {
  const { items } = await feed(db, me, { q, sort: "match" });
  return items.flatMap((i) => (i.kind === "person" ? [{ person: i.person, score: i.score, reasons: i.reasons }] : []));
}

/**
 * One card per X author who posted about Moonshot (their latest post), built only from what
 * they published. Authors who made their own card are shown once, as their own card.
 */
export async function listXCards(db: DB, q?: string) {
  const rows = await db
    .selectDistinctOn([sql`lower(${s.socialPosts.authorHandle})`])
    .from(s.socialPosts)
    .where(
      and(
        eq(s.socialPosts.hidden, false),
        sql`${s.socialPosts.authorHandle} is not null`,
        sql`not exists (select 1 from ${s.people} p where lower(p.x_handle) = lower(${s.socialPosts.authorHandle}) and p.hidden = false)`,
      ),
    )
    .orderBy(sql`lower(${s.socialPosts.authorHandle})`, desc(sql`coalesce(${s.socialPosts.postedAt}, ${s.socialPosts.importedAt})`));
  const words = searchWords(q);
  return rows
    .filter((p) => matches(postText(p), words))
    .sort((a, b) => (b.postedAt ?? b.importedAt).getTime() - (a.postedAt ?? a.importedAt).getTime());
}

/** Visible comments for the given posts, oldest first, grouped by post. */
export async function commentsFor(db: DB, postIds: string[]) {
  const map = new Map<string, s.Comment[]>();
  if (!postIds.length) return map;
  const rows = await db
    .select()
    .from(s.comments)
    .where(and(inArray(s.comments.postId, postIds), eq(s.comments.hidden, false)))
    .orderBy(asc(s.comments.createdAt));
  for (const c of rows) map.set(c.postId, [...(map.get(c.postId) ?? []), c]);
  return map;
}

type DetailsFetcher = (externalId: string) => Promise<{ media: string[]; avatarUrl: string | null } | null>;

/** Looks up a post's images once and stores them (or notes that there were none). */
export async function attachDetails(db: DB, post: { id: string; externalId: string }, fetchDetails: DetailsFetcher) {
  const d = await fetchDetails(post.externalId);
  await db
    .update(s.socialPosts)
    .set({ ...(d ? { media: d.media, avatarUrl: d.avatarUrl } : {}), detailsCheckedAt: new Date() })
    .where(eq(s.socialPosts.id, post.id));
}

/** Fills in images for posts added before this existed, a few at a time, newest first. */
export async function backfillDetails(db: DB, fetchDetails: DetailsFetcher, limit = 10) {
  const pending = await db
    .select({ id: s.socialPosts.id, externalId: s.socialPosts.externalId })
    .from(s.socialPosts)
    .where(and(eq(s.socialPosts.hidden, false), sql`${s.socialPosts.detailsCheckedAt} is null`))
    .orderBy(desc(s.socialPosts.importedAt))
    .limit(limit);
  for (const p of pending) await attachDetails(db, p, fetchDetails);
  return pending.length;
}

export class UserError extends Error {}

export type ImportRecord = { url: string; content?: string | null; authorName?: string | null; postedAt?: string | null };
export type ImportResult = { input: string; status: "added" | "duplicate" | "invalid"; message?: string; id?: string };

/** One public post URL per line, or a JSON array of { url, content?, authorName?, postedAt? }. */
export function parseImport(text: string): { records: ImportRecord[]; errors: ImportResult[] } {
  const t = text.trim();
  if (!t) return { records: [], errors: [] };
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const data = JSON.parse(t);
      const list: unknown[] = Array.isArray(data) ? data : [data];
      const records: ImportRecord[] = [];
      const errors: ImportResult[] = [];
      for (const item of list) {
        const r = item as Record<string, unknown>;
        if (!r || typeof r.url !== "string") {
          errors.push({ input: JSON.stringify(item).slice(0, 60), status: "invalid", message: "Missing url" });
          continue;
        }
        const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
        records.push({ url: r.url, content: str("content") ?? str("text"), authorName: str("authorName") ?? str("author_name"), postedAt: str("postedAt") ?? str("created_at") });
      }
      return { records, errors };
    } catch {
      return { records: [], errors: [{ input: "JSON", status: "invalid", message: "Couldn't read that JSON" }] };
    }
  }
  return { records: t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((url) => ({ url })), errors: [] };
}

type Enrich = (url: string) => Promise<{ authorName: string | null; text: string | null } | null>;

export async function importPosts(db: DB, records: ImportRecord[], enrich?: Enrich): Promise<ImportResult[]> {
  const out: ImportResult[] = [];
  for (const r of records.slice(0, 200)) {
    const parsed = parseXPostUrl(r.url);
    if (!parsed) {
      out.push({ input: r.url, status: "invalid", message: "Not an x.com/<user>/status/<id> link" });
      continue;
    }
    let postedAt = r.postedAt ? new Date(r.postedAt) : null;
    if (postedAt && Number.isNaN(postedAt.getTime())) postedAt = null;
    postedAt ??= snowflakeToDate(parsed.id);
    let content = r.content?.trim().slice(0, 1000) || null;
    let authorName = r.authorName?.trim().slice(0, 80) || null;
    let source = "import";
    if (!content && enrich) {
      const e = await enrich(parsed.url);
      if (e?.text) {
        content = e.text.slice(0, 1000);
        authorName ??= e.authorName;
        source = "oembed";
      }
    }
    const res = await db
      .insert(s.socialPosts)
      .values({ externalId: parsed.id, url: parsed.url, authorHandle: parsed.handle, authorName, content, postedAt, themes: detectThemes(content), source })
      .onConflictDoNothing()
      .returning({ id: s.socialPosts.id });
    out.push({ input: r.url, status: res.length ? "added" : "duplicate", id: res[0]?.id });
  }
  return out;
}
