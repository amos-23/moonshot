"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cardSchema, fieldErrors, parseContact, signupSchema, type Contact } from "@/lib/validation";
import { clearCardCookie, getMe, hashToken, isAdmin, isAdminKey, newToken, rateLimit, setCardCookie } from "@/lib/me";
import { UserError, attachDetails, importPosts, momentDetailFields, parseImport, type ImportResult } from "@/lib/data";
import { fetchOEmbed, fetchPostDetails } from "@/lib/social/providers";
import { parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";
import { parsePhoto } from "@/lib/photo";
import { clientIp, visitorHash } from "@/lib/track";
import { MAX_MOMENT_PHOTOS, SIGNUP_COOKIE, eventOver } from "@/lib/constants";
import { TOP_ACCOUNTS_KEY, parseHandles } from "@/lib/featured";

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

/** The card "Update" page: your card photo from today. */
export async function saveUpdateAction(_: Result | null, form: FormData): Promise<Result> {
  const rawPhoto = String(form.get("photo") ?? "");
  const photo = rawPhoto ? parsePhoto(rawPhoto) : null;
  if (photo && "error" in photo) return { ok: false, error: photo.error, fields: { photo: photo.error } };
  const removePhoto = form.get("removePhoto") === "on";
  if (!photo && !removePhoto) return { ok: false, error: "Pick a photo first." };

  const result = await guard(async () => {
    const me = await getMe();
    if (!me) return { ok: false, error: "Add yourself first." };
    if (!(await rateLimit("update", 60, 60))) return { ok: false, error: "Too many updates — try again in a few minutes." };
    const db = await getDb();
    const now = new Date();
    if (photo) {
      await db
        .insert(schema.photos)
        .values({ personId: me.id, ...photo, updatedAt: now })
        .onConflictDoUpdate({ target: schema.photos.personId, set: { ...photo, updatedAt: now } });
    } else {
      await db.delete(schema.photos).where(eq(schema.photos.personId, me.id));
    }
    await db.update(schema.people).set({ photoUpdatedAt: photo ? now : null, updatedAt: now }).where(eq(schema.people.id, me.id));
  });
  refresh();
  if (result.ok) redirect("/?added=update");
  return result;
}

/** Copies an X post's text, images and author from X (it must be public). Null when it can't be loaded. */
async function xMomentFields(xPost: NonNullable<ReturnType<typeof parseXPostUrl>>) {
  const [embed, details] = await Promise.all([fetchOEmbed(xPost.url), fetchPostDetails(xPost.id)]);
  if (!embed?.text && !details?.media.length) return null;
  return {
    xPostUrl: xPost.url,
    xAuthorHandle: xPost.handle,
    xAuthorName: embed?.authorName ?? null,
    xText: embed?.text?.slice(0, 1000) ?? null,
    xMedia: details?.media ?? [],
    xAvatarUrl: details?.avatarUrl ?? null,
    xPostedAt: snowflakeToDate(xPost.id),
    ...(details ? momentDetailFields(details) : {}),
  };
}

/** Admin: add many X posts as moments at once (one link per line). Posts already in Moments are skipped. */
export async function importMomentsAction(_: Result | null, form: FormData): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    const lines = Array.from(new Set(String(form.get("links") ?? "").split(/[\s,]+/).map((l) => l.trim()).filter(Boolean))).slice(0, 50);
    if (!lines.length) return { ok: false, error: "Paste at least one X post link." };
    const existing = new Set((await db.select({ url: schema.moments.xPostUrl }).from(schema.moments).where(sql`${schema.moments.xPostUrl} is not null`)).map((r) => r.url));
    const results: ImportResult[] = [];
    const h = await headers();
    const visitor = visitorHash(clientIp(h), h.get("user-agent") ?? "");
    // A few at a time, oldest first, so the newest post ends up on top of Moments.
    const todo: { input: string; post: NonNullable<ReturnType<typeof parseXPostUrl>> }[] = [];
    for (const input of lines) {
      const post = parseXPostUrl(input);
      if (!post) results.push({ input, status: "invalid", message: "Not an X post link" });
      else if (existing.has(post.url)) results.push({ input, status: "duplicate" });
      else {
        existing.add(post.url);
        todo.push({ input, post });
      }
    }
    todo.sort((a, b) => (BigInt(a.post.id) < BigInt(b.post.id) ? -1 : 1));
    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      const fetched = await Promise.all(batch.map((t) => xMomentFields(t.post)));
      for (const [j, t] of batch.entries()) {
        const fields = fetched[j];
        if (!fields) {
          results.push({ input: t.input, status: "invalid", message: "Couldn't load it (is it public?)" });
          continue;
        }
        await db.insert(schema.moments).values({ ...fields, body: "", visitor });
        results.push({ input: t.input, status: "added" });
      }
    }
    const n = (st: string) => results.filter((r) => r.status === st).length;
    refresh();
    return { ok: true, message: `${n("added")} added, ${n("duplicate")} already there, ${n("invalid")} couldn't be added.`, data: results };
  });
}

/** Moments: anyone can post photos and/or a short update. A card is optional. */
export async function postMomentAction(_: Result | null, form: FormData): Promise<Result> {
  const body = String(form.get("body") ?? "").trim();
  const place = String(form.get("place") ?? "").trim();
  const rawName = String(form.get("name") ?? "").trim();
  if (body.length > 280) return { ok: false, error: "Keep it under 280 characters.", fields: { body: "Keep it under 280 characters." } };
  if (place.length > 100) return { ok: false, error: "Keep the place short.", fields: { place: "Keep it under 100 characters." } };
  const rawPhotos = form.getAll("photo").map(String).filter(Boolean);
  if (rawPhotos.length > MAX_MOMENT_PHOTOS) return { ok: false, error: `Up to ${MAX_MOMENT_PHOTOS} photos.`, fields: { photo: `Up to ${MAX_MOMENT_PHOTOS} photos.` } };
  const photos: { mime: string; data: string }[] = [];
  for (const raw of rawPhotos) {
    const photo = parsePhoto(raw);
    if ("error" in photo) return { ok: false, error: photo.error, fields: { photo: photo.error } };
    photos.push(photo);
  }
  const rawX = String(form.get("xUrl") ?? "").trim();
  const xPost = rawX ? parseXPostUrl(rawX) : null;
  if (rawX && !xPost) return { ok: false, error: "That isn't an X post link.", fields: { xUrl: "Paste a link like x.com/name/status/123…" } };
  if (!photos.length && !body && !xPost) return { ok: false, error: "Add a photo, an X post link, or write something." };
  // "@handle" credits an X account; anything else is shown as a plain name.
  const handle = rawName.match(/^@?([A-Za-z0-9_]{1,15})$/) && rawName.startsWith("@") ? rawName.slice(1) : null;
  const name = handle ? null : rawName.slice(0, 40) || null;

  let newId = "";
  const result = await guard(async () => {
    const admin = await isAdmin();
    if (!admin && !(await rateLimit("moment", Number(process.env.RATE_LIMIT_MOMENTS_PER_HOUR ?? 40), 60))) {
      return { ok: false, error: "Lots of moments from this network right now — try again in a few minutes." };
    }
    const db = await getDb();
    // Moments added from the admin page are credited to the name typed there, not an admin's own card.
    const me = admin && form.get("from") === "admin" ? null : await getMe();
    const h = await headers();
    // An X post moment copies the post's text, images and author from X (it must be public).
    let x = {};
    if (xPost) {
      const fields = await xMomentFields(xPost);
      if (!fields) return { ok: false, error: "We couldn't load that X post. Is it public?", fields: { xUrl: "We couldn't load that post." } };
      x = fields;
    }
    const [m] = await db
      .insert(schema.moments)
      .values({
        ...x,
        personId: me?.id ?? null,
        name: me ? null : name,
        xHandle: me ? null : handle,
        body,
        place: place || null,
        hasPhoto: photos.length > 0,
        photoCount: photos.length,
        visitor: visitorHash(clientIp(h), h.get("user-agent") ?? ""),
      })
      .returning({ id: schema.moments.id });
    if (photos.length) await db.insert(schema.momentPhotos).values(photos.map((p, position) => ({ momentId: m.id, position, ...p })));
    newId = m.id;
  });
  refresh();
  // Back to Moments with the new one's id, so the "Posted" note can offer to share it on X.
  if (result.ok) redirect(form.get("from") === "admin" ? "/admin?moment=1" : `/moments?posted=${Date.now()}&m=${newId}`);
  return result;
}

// ─── Sign up ─────────────────────────────────────────────────────────────────

/** Optional sign-up for future updates. Nothing on the site needs it. Signing up again updates your details. */
export async function signUpAction(_: Result | null, form: FormData): Promise<Result> {
  const parsed = signupSchema.safeParse({ email: form.get("email") ?? "", name: form.get("name") ?? "", about: form.get("about") ?? "" });
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(fields)[0] ?? "Check the form.", fields };
  }
  const { email, name, about } = parsed.data;
  return guard(async () => {
    if (!(await rateLimit("signup", 10, 60))) return { ok: false, error: "Too many sign-ups from this network — try again later." };
    const db = await getDb();
    const me = await getMe();
    const now = new Date();
    // Only fill in what was given, so a repeat sign-up never blanks earlier details.
    const set = { updatedAt: now, ...(name && { name }), ...(about && { about }), ...(me && { personId: me.id }) };
    await db
      .insert(schema.signups)
      .values({ email, name, about, personId: me?.id ?? null })
      .onConflictDoUpdate({ target: schema.signups.email, set });
    (await cookies()).set(SIGNUP_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return { ok: true, message: "You're signed up. Thanks!" };
  });
}

// ─── Meet up ─────────────────────────────────────────────────────────────────

const CHECKIN_COOKIE = "mc_checkin";

/** When a check-in ends: in 1, 2 or 4 hours, or at the end of the day in Lagos. */
export async function checkinExpiry(choice: string, now = new Date()): Promise<Date> {
  const hours = { "1": 1, "2": 2, "4": 4 }[choice];
  if (hours) return new Date(now.getTime() + hours * 3600_000);
  // End of today in Lagos (UTC+1, no daylight saving): 23:59 local = 22:59 UTC.
  const lagos = new Date(now.getTime() + 3600_000);
  const end = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate(), 22, 59));
  return end.getTime() - now.getTime() < 30 * 60_000 ? new Date(now.getTime() + 2 * 3600_000) : end;
}

export async function checkInAction(_: Result | null, form: FormData): Promise<Result> {
  if (eventOver()) return { ok: false, error: "Moonshot is over, so Meet up has closed." };
  const fail = (error: string, fields: Record<string, string>): Result => ({ ok: false, error, fields });
  const place = String(form.get("place") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (!place) return { ok: false, error: "Say where people can find you.", fields: { place: "Where are you? e.g. “Booth 14, Hall B”" } };
  if (place.length > 100) return { ok: false, error: "Keep the place short.", fields: { place: "Keep it under 100 characters." } };
  if (note.length > 140) return { ok: false, error: "Keep it under 140 characters.", fields: { note: "Keep it under 140 characters." } };

  const result = await guard(async () => {
    const me = await getMe();
    let who: { name: string; headline: string | null } & Contact;
    if (me) {
      who = { name: me.name, headline: me.headline, xHandle: me.xHandle, whatsapp: me.whatsapp, email: me.email, linkedinUrl: me.linkedinUrl, websiteUrl: me.websiteUrl };
    } else {
      const contact = parseContact(String(form.get("contact") ?? ""));
      if (!contact) return fail("Add your X handle so people can reach you.", { contact: "Add your X handle (or a WhatsApp number)" });
      // An X handle doubles as a name; a phone number or email needs a name to go with it.
      const name = String(form.get("name") ?? "").trim().slice(0, 60) || (contact.xHandle ? `@${contact.xHandle}` : "");
      if (!name) return fail("Add your name under “More options” so people know who to look for.", { name: "Add your name" });
      who = { name, headline: String(form.get("headline") ?? "").trim().slice(0, 80) || null, ...contact };
    }
    if (!(await rateLimit("checkin", 30, 60))) return { ok: false, error: "Too many check-ins from this network — try again shortly." };
    const db = await getDb();
    const h = await headers();
    const expiresAt = await checkinExpiry(String(form.get("for") ?? "2"));
    // One live check-in per person: a new one replaces the last.
    const previous = me ? undefined : (await cookies()).get(CHECKIN_COOKIE)?.value;
    if (me) await db.update(schema.checkins).set({ endedAt: new Date() }).where(and(eq(schema.checkins.personId, me.id), sql`${schema.checkins.endedAt} is null`));
    else if (previous && /^[0-9a-f-]{36}$/i.test(previous)) await db.update(schema.checkins).set({ endedAt: new Date() }).where(eq(schema.checkins.id, previous));
    const [c] = await db
      .insert(schema.checkins)
      .values({ personId: me?.id ?? null, ...who, place, note, expiresAt, visitor: visitorHash(clientIp(h), h.get("user-agent") ?? "") })
      .returning({ id: schema.checkins.id });
    // Card holders also show "Catch me at" on their card while checked in.
    if (me) await db.update(schema.people).set({ whereNote: place, whereUpdatedAt: new Date() }).where(eq(schema.people.id, me.id));
    else (await cookies()).set(CHECKIN_COOKIE, c.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  });
  refresh();
  if (result.ok) redirect("/meet?checked=1");
  return result;
}

/** "I've left": ends your current check-in. */
export async function endCheckinAction(): Promise<Result> {
  return guard(async () => {
    const db = await getDb();
    const me = await getMe();
    const jar = await cookies();
    const id = jar.get(CHECKIN_COOKIE)?.value;
    if (me) {
      await db.update(schema.checkins).set({ endedAt: new Date() }).where(and(eq(schema.checkins.personId, me.id), sql`${schema.checkins.endedAt} is null`));
      await db.update(schema.people).set({ whereNote: null, whereUpdatedAt: null }).where(eq(schema.people.id, me.id));
    } else if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      await db.update(schema.checkins).set({ endedAt: new Date() }).where(eq(schema.checkins.id, id));
      jar.delete(CHECKIN_COOKIE);
    } else return { ok: false, error: "No check-in on this device." };
    refresh();
  });
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

const AUTO_HIDE_REPORTS = 3;

export async function reportAction(targetType: "person" | "post" | "comment" | "moment" | "checkin", targetId: string, reason: string): Promise<Result> {
  return guard(async () => {
    if (!(await rateLimit("report", 60, 60))) return { ok: false, error: "Too many reports — try again later." };
    const me = await getMe();
    const db = await getDb();
    await db.insert(schema.reports).values({ targetType, targetId, reason: reason.slice(0, 300) || "unspecified", reporterId: me?.id ?? null });
    // Moments and check-ins are open to anyone, so enough reports hide one until an admin looks at it.
    if (targetType === "moment" || targetType === "checkin") {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.reports)
        .where(and(eq(schema.reports.targetId, targetId), eq(schema.reports.resolved, false)));
      if (n >= AUTO_HIDE_REPORTS) {
        if (targetType === "moment") await db.update(schema.moments).set({ hidden: true }).where(eq(schema.moments.id, targetId));
        else await db.update(schema.checkins).set({ hidden: true }).where(eq(schema.checkins.id, targetId));
        refresh();
      }
    }
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

/** Admin: pin a moment as Featured (one at a time), or unpin it so Featured rotates by engagement again. */
export async function setFeaturedAction(id: string, on: boolean): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    await db.update(schema.moments).set({ featuredAt: null }).where(sql`${schema.moments.featuredAt} is not null`);
    if (on) await db.update(schema.moments).set({ featuredAt: new Date() }).where(eq(schema.moments.id, id));
    refresh();
    return { ok: true, message: on ? "Pinned as Featured." : "Unpinned." };
  });
}

/** Admin: the X accounts whose posts get a strong boost for Featured. */
export async function saveTopAccountsAction(_: Result | null, form: FormData): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    const handles = parseHandles(String(form.get("handles") ?? "").slice(0, 5000));
    await db
      .insert(schema.settings)
      .values({ key: TOP_ACCOUNTS_KEY, value: handles.join(" ") })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: handles.join(" ") } });
    refresh();
    return { ok: true, message: handles.length ? `Saved ${handles.length} account${handles.length === 1 ? "" : "s"}.` : "Cleared." };
  });
}

export async function setHiddenAction(kind: "person" | "post" | "comment" | "moment" | "checkin", id: string, hidden: boolean): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    if (kind === "checkin") await db.update(schema.checkins).set({ hidden }).where(eq(schema.checkins.id, id));
    else if (kind === "moment") await db.update(schema.moments).set({ hidden }).where(eq(schema.moments.id, id));
    else if (kind === "person") await db.update(schema.people).set({ hidden }).where(eq(schema.people.id, id));
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
