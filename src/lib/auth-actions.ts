"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { rateLimit, claimDeviceCards } from "@/lib/me";
import { siteOrigin } from "@/lib/site";
import { LOCAL_SESSION_COOKIE, authMode, checkPassword, getAccount, hashPassword, setLocalSession, supabaseServer, upsertAccount } from "@/lib/auth";
import type { Result } from "@/lib/actions";

/** Only same-site paths, so a sign-in link can't bounce anyone elsewhere. */
const safeNext = (v: FormDataEntryValue | null) => {
  const n = String(v ?? "");
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/account";
};
const email = z.string().trim().toLowerCase().pipe(z.email("That email doesn't look right"));
const password = z.string().min(8, "Use at least 8 characters").max(72, "Keep it under 72 characters");
const offMessage = "Sign-in isn't set up on this site yet.";

/** The mailing list admins see (Sign-ups) keeps everyone who said yes to updates. */
async function addToMailingList(mail: string, name: string | null) {
  await (await getDb())
    .insert(schema.signups)
    .values({ email: mail, name })
    .onConflictDoUpdate({ target: schema.signups.email, set: { updatedAt: new Date(), ...(name ? { name } : {}) } });
}

/** What Supabase's errors mean, in plain words. */
function friendly(message: string): string {
  if (/already registered|already exists/i.test(message)) return "There's already an account with that email. Sign in instead.";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: we sent you a link when you signed up.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a minute and try again.";
  if (/password/i.test(message)) return message;
  return "That didn't work. Please try again.";
}

export async function signUpAction(_: Result | null, form: FormData): Promise<Result> {
  const mode = authMode();
  if (mode === "off") return { ok: false, error: offMessage };
  const parsed = z.object({ email, password, name: z.string().trim().max(60).optional() }).safeParse({ email: form.get("email") ?? "", password: form.get("password") ?? "", name: form.get("name") ?? "" });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { ok: false, error: Object.values(fields)[0], fields };
  }
  const { email: mail, password: pass } = parsed.data;
  const name = parsed.data.name || null;
  const optIn = form.get("optIn") === "on";
  const next = safeNext(form.get("next"));
  if (!(await rateLimit("signup", 10, 60))) return { ok: false, error: "Too many sign-ups from this network. Try again later." };

  if (mode === "local") {
    const db = await getDb();
    if (await db.query.accounts.findFirst({ where: eq(schema.accounts.email, mail) })) return { ok: false, error: "There's already an account with that email. Sign in instead.", fields: { email: "Already has an account" } };
    const [acc] = await db.insert(schema.accounts).values({ id: crypto.randomUUID(), email: mail, name, passwordHash: hashPassword(pass), emailOptIn: optIn, lastSignInAt: new Date() }).returning();
    await setLocalSession(acc.id);
    await claimDeviceCards(acc.id);
  } else {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password: pass,
      options: { data: { name }, emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) return { ok: false, error: friendly(error.message) };
    // Supabase returns a user with no identities when the email is already taken (it doesn't say so, for privacy).
    if (data.user && data.user.identities?.length === 0) return { ok: false, error: "There's already an account with that email. Sign in instead.", fields: { email: "Already has an account" } };
    if (data.user) await upsertAccount(data.user.id, mail, { name, emailOptIn: optIn });
    if (!data.session) {
      if (optIn) await addToMailingList(mail, name);
      return { ok: true, message: "Check your email: we sent a link to confirm your account." };
    }
    await claimDeviceCards(data.user!.id);
  }
  if (optIn) await addToMailingList(mail, name);
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signInAction(_: Result | null, form: FormData): Promise<Result> {
  const mode = authMode();
  if (mode === "off") return { ok: false, error: offMessage };
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse({ email: form.get("email") ?? "", password: form.get("password") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fields: { [String(parsed.error.issues[0].path[0])]: parsed.error.issues[0].message } };
  const next = safeNext(form.get("next"));
  if (!(await rateLimit("signin", 20, 15))) return { ok: false, error: "Too many tries. Wait a few minutes and try again." };

  if (mode === "local") {
    const acc = await (await getDb()).query.accounts.findFirst({ where: eq(schema.accounts.email, parsed.data.email) });
    if (!acc || !checkPassword(parsed.data.password, acc.passwordHash)) return { ok: false, error: "That email and password don't match." };
    await setLocalSession(acc.id);
    await claimDeviceCards(acc.id);
  } else {
    const { data, error } = await (await supabaseServer()).auth.signInWithPassword(parsed.data);
    if (error || !data.user?.email) return { ok: false, error: friendly(error?.message ?? "") };
    await upsertAccount(data.user.id, data.user.email);
    await claimDeviceCards(data.user.id);
  }
  revalidatePath("/", "layout");
  redirect(next);
}

/** Supabase only: a one-time sign-in link by email (no password needed). */
export async function magicLinkAction(_: Result | null, form: FormData): Promise<Result> {
  if (authMode() !== "supabase") return { ok: false, error: "Email links aren't available here. Use your password." };
  const parsed = email.safeParse(form.get("email") ?? "");
  if (!parsed.success) return { ok: false, error: "That email doesn't look right", fields: { email: "That email doesn't look right" } };
  if (!(await rateLimit("magic", 5, 15))) return { ok: false, error: "Too many links sent. Wait a few minutes." };
  const next = safeNext(form.get("next"));
  const { error } = await (await supabaseServer()).auth.signInWithOtp({ email: parsed.data, options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` } });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, message: "Check your email for a sign-in link." };
}

/** Supabase only: emails a link to set a new password. */
export async function forgotPasswordAction(_: Result | null, form: FormData): Promise<Result> {
  if (authMode() !== "supabase") return { ok: false, error: "Password reset isn't available here." };
  const parsed = email.safeParse(form.get("email") ?? "");
  if (!parsed.success) return { ok: false, error: "That email doesn't look right", fields: { email: "That email doesn't look right" } };
  if (!(await rateLimit("reset", 5, 15))) return { ok: false, error: "Too many tries. Wait a few minutes." };
  await (await supabaseServer()).auth.resetPasswordForEmail(parsed.data, { redirectTo: `${await siteOrigin()}/auth/callback?next=/account/password` });
  // Same answer whether or not the email has an account, so it can't be used to check who's signed up.
  return { ok: true, message: "If there's an account with that email, a link to set a new password is on its way." };
}

export async function updatePasswordAction(_: Result | null, form: FormData): Promise<Result> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Sign in first." };
  const parsed = password.safeParse(form.get("password") ?? "");
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fields: { password: parsed.error.issues[0].message } };
  if (authMode() === "local") await (await getDb()).update(schema.accounts).set({ passwordHash: hashPassword(parsed.data) }).where(eq(schema.accounts.id, account.id));
  else {
    const { error } = await (await supabaseServer()).auth.updateUser({ password: parsed.data });
    if (error) return { ok: false, error: friendly(error.message) };
  }
  return { ok: true, message: "Password saved." };
}

export async function updateAccountAction(_: Result | null, form: FormData): Promise<Result> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Sign in first." };
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || null;
  const optIn = form.get("optIn") === "on";
  await (await getDb()).update(schema.accounts).set({ name, emailOptIn: optIn }).where(eq(schema.accounts.id, account.id));
  if (optIn) await addToMailingList(account.email, name);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function signOutAction() {
  if (authMode() === "supabase") await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(LOCAL_SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
