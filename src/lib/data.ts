import { and, asc, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { Person } from "@/lib/db/schema";
import { POST_THEMES } from "@/lib/constants";
import { scoreMatch } from "@/lib/matching";
import { detectThemes, parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";

export const HERE_NOW_HOURS = 3;

export function isHereNow(p: Pick<Person, "whereNote" | "whereUpdatedAt">) {
  return Boolean(p.whereNote && p.whereUpdatedAt && Date.now() - p.whereUpdatedAt.getTime() < HERE_NOW_HOURS * 3600_000);
}

export type PeopleFilters = { q?: string; want?: string; offer?: string; interest?: string; here?: boolean };

/** Visible cards, ranked by match when we know who's looking, otherwise newest first. */
export async function listPeople(db: DB, me: Person | null, f: PeopleFilters = {}) {
  const q = f.q?.trim().slice(0, 80);
  const rows = await db
    .select()
    .from(s.people)
    .where(
      and(
        eq(s.people.hidden, false),
        f.want ? sql`${f.want} = any(${s.people.wants})` : undefined,
        f.offer ? sql`${f.offer} = any(${s.people.offers})` : undefined,
        f.interest ? sql`${f.interest} = any(${s.people.interests})` : undefined,
        q ? or(ilike(s.people.name, `%${q}%`), ilike(s.people.headline, `%${q}%`), ilike(s.people.company, `%${q}%`), ilike(s.people.bio, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(s.people.createdAt))
    .limit(1000);

  return rows
    .filter((p) => p.id !== me?.id && (!f.here || isHereNow(p)))
    .map((p) => ({ person: p, ...(me ? scoreMatch(me, p) : { score: 0, reasons: [] as string[] }), here: isHereNow(p) }))
    .sort((a, b) => b.score - a.score || Number(b.here) - Number(a.here));
}

export async function counts(db: DB) {
  const [r] = await db
    .select({
      people: sql<number>`count(*)::int`,
      inPerson: sql<number>`count(*) filter (where ${s.people.attendance} = 'in_person')::int`,
      here: sql<number>`count(*) filter (where ${s.people.whereUpdatedAt} > now() - interval '${sql.raw(String(HERE_NOW_HOURS))} hours' and ${s.people.whereNote} is not null)::int`,
    })
    .from(s.people)
    .where(eq(s.people.hidden, false));
  return r;
}

// ─── Hangouts ────────────────────────────────────────────────────────────────

export async function listHangouts(db: DB, meId: string | null) {
  return db
    .select({
      hangout: s.hangouts,
      host: { id: s.people.id, name: s.people.name },
      going: sql<number>`(select count(*)::int from ${s.hangoutMembers} m where m.hangout_id = ${s.hangouts.id})`,
      joined: meId
        ? sql<boolean>`exists(select 1 from ${s.hangoutMembers} m where m.hangout_id = ${s.hangouts.id} and m.person_id = ${meId})`
        : sql<boolean>`false`,
    })
    .from(s.hangouts)
    .innerJoin(s.people, eq(s.people.id, s.hangouts.hostId))
    .where(and(eq(s.hangouts.cancelled, false), eq(s.people.hidden, false), gte(s.hangouts.startsAt, new Date(Date.now() - 2 * 3600_000))))
    .orderBy(asc(s.hangouts.startsAt));
}

export async function hangoutMembers(db: DB, hangoutId: string) {
  return db
    .select({ id: s.people.id, name: s.people.name, headline: s.people.headline })
    .from(s.hangoutMembers)
    .innerJoin(s.people, eq(s.people.id, s.hangoutMembers.personId))
    .where(and(eq(s.hangoutMembers.hangoutId, hangoutId), eq(s.people.hidden, false)))
    .orderBy(asc(s.hangoutMembers.createdAt));
}

export class UserError extends Error {}

export async function joinHangout(db: DB, personId: string, hangoutId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${s.hangouts} where id = ${hangoutId} for update`);
    const h = await tx.query.hangouts.findFirst({ where: eq(s.hangouts.id, hangoutId) });
    if (!h || h.cancelled) throw new UserError("This hangout isn't available.");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.hangoutMembers).where(eq(s.hangoutMembers.hangoutId, hangoutId));
    if (n >= h.capacity) throw new UserError("This hangout is full.");
    await tx.insert(s.hangoutMembers).values({ hangoutId, personId }).onConflictDoNothing();
  });
}

// ─── X posts ─────────────────────────────────────────────────────────────────

export type ImportRecord = { url: string; content?: string | null; authorName?: string | null; postedAt?: string | null; themes?: string[] };
export type ImportResult = { input: string; status: "added" | "duplicate" | "invalid"; message?: string };
const THEMES = new Set(POST_THEMES.map((t) => t.value));

/** One public post URL per line, or a JSON array of { url, content?, authorName?, postedAt?, themes? }. */
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
        records.push({
          url: r.url,
          content: str("content") ?? str("text"),
          authorName: str("authorName") ?? str("author_name"),
          postedAt: str("postedAt") ?? str("created_at"),
          themes: Array.isArray(r.themes) ? r.themes.filter((x): x is string => typeof x === "string") : undefined,
        });
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
    const themes = r.themes?.length ? r.themes.filter((x) => THEMES.has(x)) : detectThemes(content);
    const res = await db
      .insert(s.socialPosts)
      .values({ externalId: parsed.id, url: parsed.url, authorHandle: parsed.handle, authorName, content, postedAt, themes, source })
      .onConflictDoNothing()
      .returning({ id: s.socialPosts.id });
    out.push({ input: r.url, status: res.length ? "added" : "duplicate" });
  }
  return out;
}

export async function listPosts(db: DB, f: { q?: string; theme?: string } = {}) {
  const q = f.q?.trim().slice(0, 80);
  return db
    .select()
    .from(s.socialPosts)
    .where(
      and(
        eq(s.socialPosts.hidden, false),
        f.theme ? sql`${f.theme} = any(${s.socialPosts.themes})` : undefined,
        q ? or(ilike(s.socialPosts.content, `%${q}%`), ilike(s.socialPosts.authorHandle, `%${q.replace(/^@/, "")}%`), ilike(s.socialPosts.authorName, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(sql`coalesce(${s.socialPosts.postedAt}, ${s.socialPosts.importedAt})`))
    .limit(200);
}
