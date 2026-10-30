import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { Person } from "@/lib/db/schema";
import { scoreMatch } from "@/lib/matching";
import { FILTERS, isHereNow, matches, personText, postText, searchWords, type FilterKey } from "@/lib/search";
import { detectThemes, parseXPostUrl, snowflakeToDate, type PostDetails } from "@/lib/social/x-url";

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

type DetailsFetcher = (externalId: string) => Promise<PostDetails | null>;

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

/** What a moment copies from an X post's details: engagement, and its video if it has one. */
export function momentDetailFields(d: PostDetails, now = new Date()) {
  return {
    xLikes: d.likes ?? 0,
    xReplies: d.replies ?? 0,
    xVerified: d.verified ?? false,
    xStatsAt: now,
    xVideo: d.video?.src ?? null,
    xVideoSmall: d.video?.small ?? null,
    xVideoGif: d.video?.gif ?? false,
  };
}

/**
 * Keeps likes and replies on X moments fresh (they keep growing after the event), so Featured follows
 * what people actually loved. Up to `limit` moments, those not checked for 3 hours first.
 */
export async function refreshMomentStats(db: DB, fetchDetails: DetailsFetcher, limit = 10, now = new Date()) {
  const due = await db
    .select({ id: s.moments.id, url: s.moments.xPostUrl, media: s.moments.xMedia })
    .from(s.moments)
    .where(and(eq(s.moments.hidden, false), sql`${s.moments.xPostUrl} is not null`, or(isNull(s.moments.xStatsAt), lt(s.moments.xStatsAt, new Date(now.getTime() - 3 * 3600_000)))))
    .orderBy(sql`${s.moments.xStatsAt} asc nulls first`)
    .limit(limit);
  for (const m of due) {
    const post = parseXPostUrl(m.url!);
    const d = post ? await fetchDetails(post.id) : null;
    // A failed fetch still waits 3 hours before the next try, so a deleted post isn't retried forever.
    const fields = d ? { ...momentDetailFields(d, now), ...(m.media.length ? {} : { xMedia: d.media }) } : { xStatsAt: now };
    await db.update(s.moments).set(fields).where(eq(s.moments.id, m.id));
  }
  return due.length;
}

export type MomentItem = {
  moment: s.Moment;
  author: { id: string; name: string; headline: string; xHandle: string | null } | null;
};

/** The Moments feed, newest first. Posts by hidden cards are left out. */
export async function listMoments(db: DB, opts: { limit?: number; before?: Date } = {}): Promise<MomentItem[]> {
  const rows = await db
    .select({ moment: s.moments, aid: s.people.id, aname: s.people.name, aheadline: s.people.headline, ax: s.people.xHandle, ahidden: s.people.hidden })
    .from(s.moments)
    .leftJoin(s.people, eq(s.people.id, s.moments.personId))
    .where(and(eq(s.moments.hidden, false), opts.before ? lt(s.moments.createdAt, opts.before) : undefined))
    .orderBy(desc(s.moments.createdAt))
    .limit(opts.limit ?? 60);
  return rows
    .filter((r) => !r.ahidden)
    .map((r) => ({ moment: r.moment, author: r.aid ? { id: r.aid, name: r.aname!, headline: r.aheadline!, xHandle: r.ax } : null }));
}

export const REACTIONS = ["fire", "love", "clap"] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export type ReactionCounts = Record<ReactionKind, number>;
export const noReactions = (): ReactionCounts => ({ fire: 0, love: 0, clap: 0 });

/** 🔥 ❤️ 👏 counts for each moment. */
export async function reactionCounts(db: DB, ids: string[]): Promise<Map<string, ReactionCounts>> {
  const out = new Map<string, ReactionCounts>();
  if (!ids.length) return out;
  const rows = await db
    .select({ id: s.reactions.momentId, kind: s.reactions.kind, n: sql<number>`count(*)::int` })
    .from(s.reactions)
    .where(inArray(s.reactions.momentId, ids))
    .groupBy(s.reactions.momentId, s.reactions.kind);
  for (const r of rows) {
    const c = out.get(r.id) ?? noReactions();
    if ((REACTIONS as readonly string[]).includes(r.kind)) c[r.kind as ReactionKind] = r.n;
    out.set(r.id, c);
  }
  return out;
}

export type MomentPerson = { key: string; name: string; q: string };

/**
 * The people a moment is about, so a photo leads to someone you can follow up with: who posted it on X
 * and anyone it @mentions, when they have a card (or a "From X" card) on the site. Up to 4 each.
 */
export async function momentPeople(db: DB, items: MomentItem[]): Promise<Map<string, MomentPerson[]>> {
  const handlesOf = (m: s.Moment, author: MomentItem["author"]) => {
    const found = [m.xAuthorHandle, m.xHandle, author?.xHandle, ...[...`${m.body} ${m.xText ?? ""}`.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map((x) => x[1])];
    return Array.from(new Set(found.filter((h): h is string => Boolean(h)).map((h) => h.toLowerCase())));
  };
  const all = Array.from(new Set(items.flatMap((i) => handlesOf(i.moment, i.author))));
  const [people, posts] = all.length
    ? await Promise.all([
        db
          .select({ id: s.people.id, name: s.people.name, x: s.people.xHandle })
          .from(s.people)
          .where(and(eq(s.people.hidden, false), inArray(sql`lower(${s.people.xHandle})`, all))),
        db
          .select({ name: s.socialPosts.authorName, x: s.socialPosts.authorHandle })
          .from(s.socialPosts)
          .where(and(eq(s.socialPosts.hidden, false), inArray(sql`lower(${s.socialPosts.authorHandle})`, all))),
      ])
    : [[], []];
  const byHandle = new Map<string, MomentPerson>();
  for (const p of posts) if (p.x) byHandle.set(p.x.toLowerCase(), { key: `x:${p.x.toLowerCase()}`, name: p.name ?? `@${p.x}`, q: p.x });
  // A real card wins over a "From X" card for the same handle.
  for (const p of people) if (p.x) byHandle.set(p.x.toLowerCase(), { key: p.id, name: p.name, q: p.x });

  const out = new Map<string, MomentPerson[]>();
  for (const { moment, author } of items) {
    // A card holder's own name already links to their card, so they aren't repeated here.
    const list: MomentPerson[] = [];
    for (const h of handlesOf(moment, author)) {
      const p = byHandle.get(h);
      if (p && p.key !== author?.id && !list.some((x) => x.key === p.key)) list.push(p);
    }
    if (list.length) out.set(moment.id, list.slice(0, 4));
  }
  return out;
}

/** Active "Meet up" check-ins (not expired or ended), newest first. */
export async function listCheckins(db: DB, now = new Date()) {
  const rows = await db
    .select({ c: s.checkins, cardHidden: s.people.hidden })
    .from(s.checkins)
    .leftJoin(s.people, eq(s.people.id, s.checkins.personId))
    .where(and(eq(s.checkins.hidden, false), sql`${s.checkins.endedAt} is null`, gt(s.checkins.expiresAt, now)))
    .orderBy(desc(s.checkins.createdAt))
    .limit(300);
  return rows.filter((r) => !r.cardHidden).map((r) => r.c);
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
