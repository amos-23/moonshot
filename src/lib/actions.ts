"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cardSchema, fieldErrors, hangoutSchema } from "@/lib/validation";
import { clearCardCookie, getMe, hashToken, isAdmin, isAdminKey, newToken, rateLimit, setCardCookie } from "@/lib/me";
import { UserError, importPosts, joinHangout, parseImport } from "@/lib/data";
import { fetchOEmbed } from "@/lib/social/providers";
import { refreshLive } from "@/lib/social/live";
import { parseLagosLocal } from "@/lib/time";

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

function refresh() {
  revalidatePath("/", "layout");
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export async function saveCardAction(_: Result | null, form: FormData): Promise<Result> {
  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : undefined);
  const parsed = cardSchema.safeParse({
    name: str("name"),
    headline: str("headline"),
    company: str("company"),
    bio: str("bio") ?? "",
    wants: form.getAll("wants"),
    offers: form.getAll("offers"),
    interests: form.getAll("interests"),
    attendance: str("attendance") ?? "in_person",
    xHandle: str("xHandle"),
    linkedinUrl: str("linkedinUrl"),
    whatsapp: str("whatsapp"),
    email: str("email"),
    websiteUrl: str("websiteUrl"),
  });
  if (!parsed.success) return { ok: false, error: "A couple of things need fixing.", fields: fieldErrors(parsed.error) };

  let created = false;
  const result = await guard(async () => {
    const db = await getDb();
    const me = await getMe();
    if (me) {
      await db.update(schema.people).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.people.id, me.id));
      return { ok: true, message: "Saved." };
    }
    if (!(await rateLimit("card", Number(process.env.RATE_LIMIT_CARDS_PER_HOUR ?? 60), 60))) return { ok: false, error: "Lots of cards are being made from this network right now — please try again in a few minutes." };
    const token = newToken();
    await db.insert(schema.people).values({ ...parsed.data, editTokenHash: hashToken(token) });
    await setCardCookie(token);
    created = true;
  });
  if (created) {
    refresh();
    redirect("/people?welcome=1");
  }
  refresh();
  return result;
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
    redirect("/?deleted=1");
  }
  return result;
}

export async function forgetDeviceAction(): Promise<Result> {
  await clearCardCookie();
  refresh();
  redirect("/");
}

export async function setWhereAction(_: Result | null, form: FormData): Promise<Result> {
  return guard(async () => {
    const me = await getMe();
    if (!me) return { ok: false, error: "Make your card first." };
    const note = String(form.get("where") ?? "").trim().slice(0, 100);
    await (await getDb())
      .update(schema.people)
      .set({ whereNote: note || null, whereUpdatedAt: note ? new Date() : null })
      .where(eq(schema.people.id, me.id));
    refresh();
    return { ok: true, message: note ? "Updated — people can find you for the next 3 hours." : "Cleared." };
  });
}

// ─── Hangouts ────────────────────────────────────────────────────────────────

export async function createHangoutAction(_: Result | null, form: FormData): Promise<Result> {
  const me = await getMe();
  if (!me) return { ok: false, error: "Make your card first so people know who's hosting." };
  const parsed = hangoutSchema.safeParse({
    title: form.get("title"),
    details: form.get("details") ?? "",
    startsAt: parseLagosLocal(String(form.get("startsAt") ?? "")) ?? undefined,
    place: form.get("place"),
    capacity: form.get("capacity"),
  });
  if (!parsed.success) return { ok: false, error: "A couple of things need fixing.", fields: fieldErrors(parsed.error) };
  const result = await guard(async () => {
    if (!(await rateLimit("hangout", Number(process.env.RATE_LIMIT_HANGOUTS_PER_HOUR ?? 30), 60))) return { ok: false, error: "You've created a lot of hangouts — try again later." };
    const db = await getDb();
    const [h] = await db.insert(schema.hangouts).values({ ...parsed.data, hostId: me.id }).returning();
    await db.insert(schema.hangoutMembers).values({ hangoutId: h.id, personId: me.id });
  });
  if (result.ok) {
    refresh();
    redirect("/hangouts?created=1");
  }
  return result;
}

export async function joinHangoutAction(hangoutId: string, join: boolean): Promise<Result> {
  return guard(async () => {
    const me = await getMe();
    if (!me) return { ok: false, error: "Make your card first (30 seconds) so the host knows who's coming." };
    const db = await getDb();
    if (join) await joinHangout(db, me.id, hangoutId);
    else
      await db
        .delete(schema.hangoutMembers)
        .where(and(eq(schema.hangoutMembers.hangoutId, hangoutId), eq(schema.hangoutMembers.personId, me.id)));
    refresh();
  });
}

export async function cancelHangoutAction(hangoutId: string): Promise<Result> {
  return guard(async () => {
    const me = await getMe();
    const admin = await isAdmin();
    const db = await getDb();
    const h = await db.query.hangouts.findFirst({ where: eq(schema.hangouts.id, hangoutId) });
    if (!h || (h.hostId !== me?.id && !admin)) return { ok: false, error: "Only the host can cancel this." };
    await db.update(schema.hangouts).set({ cancelled: true }).where(eq(schema.hangouts.id, hangoutId));
    refresh();
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function reportAction(targetType: "person" | "hangout" | "post", targetId: string, reason: string): Promise<Result> {
  return guard(async () => {
    if (!(await rateLimit("report", 60, 60))) return { ok: false, error: "Too many reports — try again later." };
    const me = await getMe();
    await (await getDb()).insert(schema.reports).values({ targetType, targetId, reason: reason.slice(0, 300) || "unspecified", reporterId: me?.id ?? null });
    return { ok: true, message: "Thanks — we'll take a look." };
  });
}

// ─── Admin (protected by ADMIN_KEY) ─────────────────────────────────────────

async function requireAdmin() {
  if (!(await isAdmin())) throw new UserError("Admins only.");
  return getDb();
}

export async function adminLoginAction(_: Result | null, form: FormData): Promise<Result> {
  const key = String(form.get("key") ?? "");
  if (!process.env.ADMIN_KEY) return { ok: false, error: "Set the ADMIN_KEY environment variable (12+ characters) to enable admin." };
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
    const results = [...errors, ...(await importPosts(db, records, form.get("enrich") === "on" ? fetchOEmbed : undefined))];
    const n = (st: string) => results.filter((r) => r.status === st).length;
    refresh();
    return { ok: true, message: `${n("added")} added, ${n("duplicate")} already there, ${n("invalid")} invalid.`, data: results };
  });
}

export async function refreshLiveAction(): Promise<Result> {
  return guard(async () => {
    const r = await refreshLive(await requireAdmin(), true);
    if (!r.provider) return { ok: false, error: "Set X_BEARER_TOKEN to enable live search." };
    if (r.error) return { ok: false, error: r.error };
    refresh();
    return { ok: true, message: `Added ${r.added ?? 0} new posts.` };
  });
}

export async function setHiddenAction(kind: "person" | "post", id: string, hidden: boolean): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    if (kind === "person") await db.update(schema.people).set({ hidden }).where(eq(schema.people.id, id));
    else await db.update(schema.socialPosts).set({ hidden }).where(eq(schema.socialPosts.id, id));
    refresh();
  });
}

export async function resolveReportAction(id: string): Promise<Result> {
  return guard(async () => {
    const db = await requireAdmin();
    await db.update(schema.reports).set({ resolved: true }).where(eq(schema.reports.id, id));
    refresh();
  });
}
