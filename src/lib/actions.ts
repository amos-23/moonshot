"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cardSchema, fieldErrors } from "@/lib/validation";
import { clearCardCookie, getMe, hashToken, isAdmin, isAdminKey, newToken, rateLimit, setCardCookie } from "@/lib/me";
import { UserError, attachDetails, importPosts, parseImport } from "@/lib/data";
import { fetchOEmbed, fetchPostDetails } from "@/lib/social/providers";
import { parseXPostUrl } from "@/lib/social/x-url";
import { parsePhoto } from "@/lib/photo";

export type Result = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fields?: Record<string, string> };

async function guard(fn: () => Promise<Result | void>): Promise<Result> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong — please try again." };
  }
}

const refresh = () => revalidatePath("/", "layout");

export async function saveCardAction(_: Result | null, form: FormData): Promise<Result> {
  const parsed = cardSchema.safeParse({
    name: form.get("name") ?? "",
    headline: form.get("headline") ?? "",
    wants: form.getAll("wants").filter(Boolean),
    offers: form.getAll("offers").filter(Boolean),
    company: form.get("company") ?? "",
    contact: form.get("contact") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Almost there — check the highlighted field.", fields: fieldErrors(parsed.error) };

  let created = false;
  const result = await guard(async () => {
    const db = await getDb();
    const me = await getMe();
    if (me) {
      await db.update(schema.people).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.people.id, me.id));
      return { ok: true, message: "Saved." };
    }
    if (!(await rateLimit("card", Number(process.env.RATE_LIMIT_CARDS_PER_HOUR ?? 60), 60))) {
      return { ok: false, error: "Lots of cards are being made from this network — try again in a few minutes." };
    }
    const token = newToken();
    await db.insert(schema.people).values({ ...parsed.data, editTokenHash: hashToken(token) });
    await setCardCookie(token);
    created = true;
  });
  refresh();
  if (created) redirect("/?added=card");
  return result;
}

/** The "Update" page: a photo from today and/or a "Catch me at…" note. */
export async function saveUpdateAction(_: Result | null, form: FormData): Promise<Result> {
  const rawPhoto = String(form.get("photo") ?? "");
  const photo = rawPhoto ? parsePhoto(rawPhoto) : null;
  if (photo && "error" in photo) return { ok: false, error: photo.error, fields: { photo: photo.error } };
  const removePhoto = form.get("removePhoto") === "on";
  const where = String(form.get("where") ?? "").trim().slice(0, 100);

  const result = await guard(async () => {
    const me = await getMe();
    if (!me) return { ok: false, error: "Add yourself first." };
    if (!(await rateLimit("update", 60, 60))) return { ok: false, error: "Too many updates — try again in a few minutes." };
    const db = await getDb();
    const now = new Date();
    // "Catch me at" is time-stamped only when it changes, so its "20m ago" stays honest.
    const whereFields = where !== (me.whereNote ?? "") ? { whereNote: where || null, whereUpdatedAt: where ? now : null } : {};
    const photoFields = photo ? { photoUpdatedAt: now } : removePhoto ? { photoUpdatedAt: null } : {};
    if (photo) {
      await db
        .insert(schema.photos)
        .values({ personId: me.id, ...photo, updatedAt: now })
        .onConflictDoUpdate({ target: schema.photos.personId, set: { ...photo, updatedAt: now } });
    } else if (removePhoto) {
      await db.delete(schema.photos).where(eq(schema.photos.personId, me.id));
    }
    await db.update(schema.people).set({ ...whereFields, ...photoFields, updatedAt: now }).where(eq(schema.people.id, me.id));
  });
  refresh();
  if (result.ok) redirect("/?added=update");
  return result;
}

/** Anyone can add a public X post about Moonshot; it must load via X's official embed. */
export async function addXPostAction(_: Result | null, form: FormData): Promise<Result> {
  const url = String(form.get("url") ?? "").trim();
  const parsed = parseXPostUrl(url);
  if (!parsed) return { ok: false, error: "Paste a link to a post, like x.com/name/status/123…" };
  const result = await guard(async () => {
    if (!(await rateLimit("xpost", 30, 60))) return { ok: false, error: "Too many posts from this network — try again shortly." };
    const embed = await fetchOEmbed(parsed.url);
    if (!embed?.text) return { ok: false, error: "We couldn't load that post. Is it public?" };
    const db = await getDb();
    const [r] = await importPosts(db, [{ url: parsed.url, content: embed.text, authorName: embed.authorName }]);
    if (r.status === "duplicate") return { ok: false, error: "That post is already here." };
    if (r.id) await attachDetails(db, { id: r.id, externalId: parsed.id }, fetchPostDetails);
  });
  if (result.ok) {
    refresh();
    redirect("/?added=x");
  }
  return result;
}

export async function addCommentAction(_: Result | null, form: FormData): Promise<Result> {
  const postId = String(form.get("postId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return { ok: false, error: "Post not found." };
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > 280) return { ok: false, error: "Keep it under 280 characters." };
  return guard(async () => {
    const me = await getMe();
    const name = me?.name ?? String(form.get("name") ?? "").trim().slice(0, 40);
    if (!name) return { ok: false, error: "Add your name so they know who's commenting." };
    if (!(await rateLimit("comment", 60, 60))) return { ok: false, error: "Too many comments from this network — try again shortly." };
    const db = await getDb();
    const post = await db.query.socialPosts.findFirst({ where: eq(schema.socialPosts.id, postId) });
    if (!post || post.hidden) return { ok: false, error: "Post not found." };
    await db.insert(schema.comments).values({ postId, personId: me?.id ?? null, name, body });
    refresh();
    return { ok: true, message: "Posted." };
  });
}

export async function deleteCardAction(): Promise<Result> {
  const result = await guard(async () => {
    const me = await getMe();
    if (!me) return { ok: false, error: "No card on this device." };
    await (await getDb()).delete(schema.people).where(eq(schema.people.id, me.id));
    await clearCardCookie();
  });
  if (result.ok) {
    refresh();
    redirect("/");
  }
  return result;
}

export async function reportAction(targetType: "person" | "post" | "comment", targetId: string, reason: string): Promise<Result> {
  return guard(async () => {
    if (!(await rateLimit("report", 60, 60))) return { ok: false, error: "Too many reports — try again later." };
    const me = await getMe();
    await (await getDb()).insert(schema.reports).values({ targetType, targetId, reason: reason.slice(0, 300) || "unspecified", reporterId: me?.id ?? null });
    return { ok: true, message: "Thanks — we'll take a look." };
  });
}

// ─── Admin (ADMIN_KEY) ───────────────────────────────────────────────────────

async function requireAdmin() {
  if (!(await isAdmin())) throw new UserError("Admins only.");
  return getDb();
}

export async function adminLoginAction(_: Result | null, form: FormData): Promise<Result> {
  if (!process.env.ADMIN_KEY) return { ok: false, error: "Set the ADMIN_KEY variable (12+ characters) to enable admin." };
  const key = String(form.get("key") ?? "");
  if (!isAdminKey(key)) return { ok: false, error: "That key isn't right." };
  (await cookies()).set("mc_admin", key, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  redirect("/admin");
}

export async function adminLogoutAction() {
  (await cookies()).delete("mc_admin");
  redirect("/");
}

export async function importPostsAction(_: Result | null, form: FormData): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    const { records, errors } = parseImport(String(form.get("records") ?? "").slice(0, 200_000));
    if (!records.length && !errors.length) return { ok: false, error: "Paste at least one X post link." };
    const results = [...errors, ...(await importPosts(db, records, fetchOEmbed))];
    const n = (st: string) => results.filter((r) => r.status === st).length;
    refresh();
    return { ok: true, message: `${n("added")} added, ${n("duplicate")} already there, ${n("invalid")} invalid.`, data: results };
  });
}

export async function setHiddenAction(kind: "person" | "post" | "comment", id: string, hidden: boolean): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    if (kind === "person") await db.update(schema.people).set({ hidden }).where(eq(schema.people.id, id));
    else if (kind === "comment") await db.update(schema.comments).set({ hidden }).where(eq(schema.comments.id, id));
    else await db.update(schema.socialPosts).set({ hidden }).where(eq(schema.socialPosts.id, id));
    refresh();
  });
}

export async function removePhotoAction(personId: string): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    await db.delete(schema.photos).where(eq(schema.photos.personId, personId));
    await db.update(schema.people).set({ photoUpdatedAt: null }).where(eq(schema.people.id, personId));
    refresh();
  });
}

export async function resolveReportAction(id: string): Promise<Result> {
  return guard(async () => {
    await (await requireAdmin()).update(schema.reports).set({ resolved: true }).where(eq(schema.reports.id, id));
    refresh();
  });
}
