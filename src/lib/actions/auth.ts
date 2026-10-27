"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, startDemoSession } from "@/lib/auth";
import { authMode, siteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "./result";

const emailSchema = z.object({ email: z.email("Enter a valid email address").max(200), next: z.string().optional() });

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/discover";
}

export async function signInAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse({ email: form.get("email"), next: form.get("next") ?? undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email } = parsed.data;
  const next = safeNext(parsed.data.next);
  const mode = authMode();

  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    if (error) {
      console.error("Supabase OTP error", error.message);
      return { ok: false, error: error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "We couldn't send the sign-in email. Please try again." };
    }
    return { ok: true, message: `We've emailed a sign-in link to ${email}. Open it on this device to continue.` };
  }

  if (mode === "demo") {
    await startDemoSession(email);
    redirect(next);
  }

  return { ok: false, error: "Sign-in isn't configured on this deployment yet." };
}

export async function signOutAction() {
  await endSession();
  redirect("/");
}
