import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AppError } from "./errors";

export type ExhibitorFilters = { q?: string; industry?: string; category?: string; includeUnpublished?: boolean };

export async function listExhibitors(db: DB, viewerId: string | null, f: ExhibitorFilters = {}) {
  const q = f.q?.trim();
  const rows = await db
    .select({
      exhibitor: s.exhibitors,
      saved: viewerId
        ? sql<boolean>`exists(select 1 from saved_exhibitors se where se.exhibitor_id = ${s.exhibitors.id} and se.user_id = ${viewerId})`
        : sql<boolean>`false`,
    })
    .from(s.exhibitors)
    .where(
      and(
        f.includeUnpublished ? undefined : eq(s.exhibitors.published, true),
        f.industry ? eq(s.exhibitors.industry, f.industry) : undefined,
        f.category ? eq(s.exhibitors.category, f.category) : undefined,
        q
          ? or(ilike(s.exhibitors.name, `%${q}%`), ilike(s.exhibitors.tagline, `%${q}%`), ilike(s.exhibitors.description, `%${q}%`))
          : undefined,
      ),
    )
    .orderBy(asc(s.exhibitors.isDemo), asc(s.exhibitors.name));
  return rows;
}

export async function getExhibitor(db: DB, id: string, includeUnpublished = false) {
  const row = await db.query.exhibitors.findFirst({ where: eq(s.exhibitors.id, id) });
  if (!row || (!row.published && !includeUnpublished)) return null;
  return row;
}

export async function setExhibitorSaved(db: DB, userId: string, exhibitorId: string, saved: boolean) {
  if (saved) {
    if (!(await getExhibitor(db, exhibitorId))) throw new AppError("Exhibitor not found.", "not_found");
    await db.insert(s.savedExhibitors).values({ userId, exhibitorId }).onConflictDoNothing();
  } else {
    await db.delete(s.savedExhibitors).where(and(eq(s.savedExhibitors.userId, userId), eq(s.savedExhibitors.exhibitorId, exhibitorId)));
  }
}

export async function savedExhibitorsFor(db: DB, userId: string) {
  return db
    .select({ exhibitor: s.exhibitors })
    .from(s.savedExhibitors)
    .innerJoin(s.exhibitors, eq(s.exhibitors.id, s.savedExhibitors.exhibitorId))
    .where(and(eq(s.savedExhibitors.userId, userId), eq(s.exhibitors.published, true)))
    .orderBy(desc(s.savedExhibitors.createdAt));
}

export async function createInquiry(db: DB, userId: string, exhibitorId: string, kind: "question" | "introduction", body: string) {
  if (!(await getExhibitor(db, exhibitorId))) throw new AppError("Exhibitor not found.", "not_found");
  const open = await db
    .select({ id: s.exhibitorInquiries.id })
    .from(s.exhibitorInquiries)
    .where(
      and(eq(s.exhibitorInquiries.userId, userId), eq(s.exhibitorInquiries.exhibitorId, exhibitorId), eq(s.exhibitorInquiries.status, "open")),
    );
  if (open.length >= 3) throw new AppError("You already have open requests with this exhibitor.", "rate_limited");
  const [row] = await db.insert(s.exhibitorInquiries).values({ userId, exhibitorId, kind, body }).returning();
  return row;
}

export async function listInquiries(db: DB) {
  return db
    .select({ inquiry: s.exhibitorInquiries, exhibitor: s.exhibitors, profile: s.profiles, email: s.users.email })
    .from(s.exhibitorInquiries)
    .innerJoin(s.exhibitors, eq(s.exhibitors.id, s.exhibitorInquiries.exhibitorId))
    .innerJoin(s.users, eq(s.users.id, s.exhibitorInquiries.userId))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.exhibitorInquiries.userId))
    .orderBy(desc(s.exhibitorInquiries.createdAt))
    .limit(200);
}
