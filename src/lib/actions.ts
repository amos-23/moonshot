"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cardSchema, fieldErrors } from "@/lib/validation";
import { clearCardCookie, getMe, hashToken, isAdmin, isAdminKey, newToken, rateLimit, setCardCookie } from "@/lib/me";
import { UserError, importPosts, parseImport } from "@/lib/data";
import { fetchOEmbed } from "@/lib/social/providers";
import { parseXPostUrl } from "@/lib/social/x-url";

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
    wants: form.getAll("wants"),
    offers: form.getAll("offers"),
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

/** Anyone can add a public X post about Moonshot; it must load via X's official embed. */
export async function addXPostAction(_: Result | null, form: FormData): Promise<Result> {
  const url = String(form.get("url") ?? "").trim();
  const parsed = parseXPostUrl(url);
  if (!parsed) return { ok: false, error: "Paste a link to a post, like x.com/name/status/123…" };
  const result = await guard(async () => {
    if (!(await rateLimit("xpost", 30, 60))) return { ok: false, error: "Too many posts from this network — try again shortly." };
    const embed = await fetchOEmbed(parsed.url);
    if (!embed?.text) return { ok: false, error: "We couldn't load that post. Is it public?" };
    const [r] = await importPosts(await getDb(), [{ url: parsed.url, content: embed.text, authorName: embed.authorName }]);
    if (r.status === "duplicate") return { ok: false, error: "That post is already here." };
  });
  if (result.ok) {
    refresh();
    redirect("/?added=x");
  }
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
    redirect("/");
  }
  return result;
}

export async function reportAction(targetType: "person" | "post", targetId: string, reason: string): Promise<Result> {
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
    await (await requireAdmin()).update(schema.reports).set({ resolved: true }).where(eq(schema.reports.id, id));
    refresh();
  });
}
