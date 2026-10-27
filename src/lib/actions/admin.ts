"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/services/errors";
import { eventInfoSchema, exhibitorSchema, fieldErrors, postThemesSchema } from "@/lib/validation";
import { importPosts, parseImportText } from "@/lib/services/social";
import { logAction, resolveReport, setSuspended } from "@/lib/services/moderation";
import { setMeetupStatus } from "@/lib/services/meetups";
import { setSetting } from "@/lib/services/settings";
import { fetchOEmbed } from "@/lib/social/providers";
import { refreshLive } from "@/lib/social/live";
import { attempt, type ActionResult } from "./result";

/** Every admin action re-checks the role server-side; hiding UI is not access control. */
async function admin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new AppError("Admins only.", "forbidden");
  return { user, db: await getDb() };
}

function done(path = "/admin") {
  revalidatePath(path, "layout");
}

export async function importPostsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    const text = String(form.get("records") ?? "");
    if (text.length > 200_000) return { ok: false, error: "That's too much at once — import up to 200 posts per batch." };
    const { records, errors } = parseImportText(text);
    if (!records.length && !errors.length) return { ok: false, error: "Paste at least one X post URL." };
    const enrich = form.get("enrich") === "on" ? async (url: string) => fetchOEmbed(url) : undefined;
    const results = [...errors, ...(await importPosts(db, user.id, records, { source: "import", enrich }))];
    await logAction(db, user.id, "import_posts", "social_posts", "batch", {
      note: `${results.filter((r) => r.status === "imported").length} imported`,
    });
    done();
    const imported = results.filter((r) => r.status === "imported").length;
    const dup = results.filter((r) => r.status === "duplicate").length;
    const invalid = results.filter((r) => r.status === "invalid").length;
    return { ok: true, message: `${imported} imported, ${dup} already existed, ${invalid} invalid.`, data: results };
  });
}

export async function updatePostAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    const id = String(form.get("id"));
    const themes = postThemesSchema.safeParse(form.getAll("themes"));
    if (!themes.success) return { ok: false, error: "Unknown theme." };
    const content = String(form.get("content") ?? "").trim().slice(0, 1000) || null;
    const authorName = String(form.get("authorName") ?? "").trim().slice(0, 100) || null;
    await db.update(schema.socialPosts).set({ themes: themes.data, content, authorName }).where(eq(schema.socialPosts.id, id));
    await logAction(db, user.id, "edit_post", "post", id);
    done();
    return { ok: true, message: "Saved." };
  });
}

export async function setPostHiddenAction(id: string, hidden: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await db.update(schema.socialPosts).set({ hidden }).where(eq(schema.socialPosts.id, id));
    await logAction(db, user.id, hidden ? "hide_post" : "unhide_post", "post", id);
    done();
    revalidatePath("/conversation");
  });
}

export async function deletePostAction(id: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await db.delete(schema.socialPosts).where(eq(schema.socialPosts.id, id));
    await logAction(db, user.id, "delete_post", "post", id);
    done();
  });
}

export async function refreshLiveAction(): Promise<ActionResult> {
  return attempt(async () => {
    const { db } = await admin();
    const status = await refreshLive(db, { force: true });
    if (!status.provider) return { ok: false, error: "No live search provider is configured (set X_BEARER_TOKEN)." };
    if (status.lastError) return { ok: false, error: status.lastError };
    done();
    return { ok: true, message: `Added ${status.lastAdded ?? 0} new posts.` };
  });
}

export async function saveSearchQueriesAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    const queries = String(form.get("queries") ?? "")
      .split(/\r?\n/)
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (!queries.length) return { ok: false, error: "Add at least one search phrase." };
    if (queries.some((q) => q.length > 100)) return { ok: false, error: "Each phrase must be 100 characters or fewer." };
    await setSetting(db, "x_search_queries", queries);
    await logAction(db, user.id, "edit_search_queries", "settings", "x_search_queries");
    done();
    return { ok: true, message: "Search phrases saved." };
  });
}

export async function saveEventInfoAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    const parsed = eventInfoSchema.safeParse(Object.fromEntries(["name", "dates", "city", "venue", "officialUrl", "summary", "hashtags"].map((k) => [k, form.get(k) ?? ""])));
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    await setSetting(db, "event_info", parsed.data);
    await logAction(db, user.id, "edit_event_info", "settings", "event_info");
    revalidatePath("/", "layout");
    return { ok: true, message: "Event information saved." };
  });
}

function exhibitorFromForm(form: FormData) {
  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : undefined);
  return exhibitorSchema.safeParse({
    name: str("name"),
    tagline: str("tagline") ?? "",
    description: str("description") ?? "",
    industry: str("industry"),
    category: str("category"),
    websiteUrl: str("websiteUrl"),
    logoUrl: str("logoUrl"),
    boothLocation: str("boothLocation"),
    boothVerified: form.get("boothVerified") === "on",
    isDemo: form.get("isDemo") === "on",
    published: form.get("published") === "on",
  });
}

export async function saveExhibitorAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await attempt(async () => {
    const { user, db } = await admin();
    const parsed = exhibitorFromForm(form);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const id = String(form.get("id") ?? "");
    const values = { ...parsed.data, boothVerified: parsed.data.boothVerified && Boolean(parsed.data.boothLocation) };
    if (id) {
      await db.update(schema.exhibitors).set({ ...values, updatedAt: new Date() }).where(eq(schema.exhibitors.id, id));
      await logAction(db, user.id, "edit_exhibitor", "exhibitor", id);
      done();
      revalidatePath("/explore", "layout");
      return { ok: true, message: "Exhibitor saved." };
    }
    const [row] = await db.insert(schema.exhibitors).values(values).returning();
    await logAction(db, user.id, "create_exhibitor", "exhibitor", row.id);
    return { ok: true, data: row.id };
  });
  if (result.ok && typeof result.data === "string") redirect(`/admin/exhibitors?created=${result.data}`);
  return result;
}

export async function deleteExhibitorAction(id: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await db.delete(schema.exhibitors).where(eq(schema.exhibitors.id, id));
    await logAction(db, user.id, "delete_exhibitor", "exhibitor", id);
    done();
    revalidatePath("/explore", "layout");
  });
}

export async function setInquiryStatusAction(id: string, status: "open" | "forwarded" | "closed"): Promise<ActionResult> {
  return attempt(async () => {
    const { db } = await admin();
    await db.update(schema.exhibitorInquiries).set({ status }).where(eq(schema.exhibitorInquiries.id, id));
    done();
  });
}

export async function resolveReportAction(reportId: string, status: "actioned" | "dismissed"): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await resolveReport(db, user.id, reportId, status);
    done();
  });
}

export async function suspendUserAction(userId: string, suspended: boolean, reportId?: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await setSuspended(db, user.id, userId, suspended, reportId);
    if (reportId && suspended) await resolveReport(db, user.id, reportId, "actioned");
    done();
  });
}

export async function setProfileFlagAction(userId: string, flag: "featured" | "ticketVerified", value: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await db
      .update(schema.profiles)
      .set(flag === "featured" ? { featured: value } : { ticketVerified: value })
      .where(eq(schema.profiles.userId, userId));
    await logAction(db, user.id, `${flag}_${value ? "on" : "off"}`, "user", userId);
    done();
    revalidatePath("/");
  });
}

export async function adminMeetupStatusAction(meetupId: string, status: "proposed" | "confirmed" | "cancelled"): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await admin();
    await setMeetupStatus(db, user, meetupId, status);
    await logAction(db, user.id, `meetup_${status}`, "meetup", meetupId);
    done();
  });
}
