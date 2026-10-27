import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { Person } from "@/lib/db/schema";
import { scoreMatch } from "@/lib/matching";
import { detectThemes, parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";

/** Cards people made, best fit first when we know who's looking. */
export async function listPeople(db: DB, me: Person | null, q?: string) {
  const term = q?.trim().slice(0, 80);
  const rows = await db
    .select()
    .from(s.people)
    .where(
      and(
        eq(s.people.hidden, false),
        term ? or(ilike(s.people.name, `%${term}%`), ilike(s.people.headline, `%${term}%`), ilike(s.people.company, `%${term}%`), ilike(s.people.bio, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(desc(s.people.createdAt))
    .limit(1000);
  return rows
    .filter((p) => p.id !== me?.id)
    .map((p) => ({ person: p, ...(me ? scoreMatch(me, p) : { score: 0, reasons: [] as string[] }) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * One card per X author who posted about Moonshot (their latest post), built only from what
 * they published. Authors who made their own card are shown once, as their own card.
 */
export async function listXCards(db: DB, q?: string) {
  const term = q?.trim().slice(0, 80);
  const rows = await db
    .selectDistinctOn([sql`lower(${s.socialPosts.authorHandle})`])
    .from(s.socialPosts)
    .where(
      and(
        eq(s.socialPosts.hidden, false),
        sql`${s.socialPosts.authorHandle} is not null`,
        sql`not exists (select 1 from ${s.people} p where lower(p.x_handle) = lower(${s.socialPosts.authorHandle}) and p.hidden = false)`,
        term ? or(ilike(s.socialPosts.content, `%${term}%`), ilike(s.socialPosts.authorHandle, `%${term.replace(/^@/, "")}%`), ilike(s.socialPosts.authorName, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(sql`lower(${s.socialPosts.authorHandle})`, desc(sql`coalesce(${s.socialPosts.postedAt}, ${s.socialPosts.importedAt})`));
  return rows.sort((a, b) => (b.postedAt ?? b.importedAt).getTime() - (a.postedAt ?? a.importedAt).getTime());
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
