"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { profileSchema, fieldErrors } from "@/lib/validation";
import { profileCompleteness, saveProfile } from "@/lib/services/profiles";
import { track } from "@/lib/services/analytics";
import { storeAvatar } from "@/lib/storage";
import { AppError } from "@/lib/services/errors";
import type { ActionResult } from "./result";

export async function saveProfileAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = profileSchema.safeParse({
    name: str("name"),
    headline: str("headline"),
    roleCategory: str("roleCategory"),
    company: str("company"),
    industry: str("industry"),
    bio: str("bio"),
    location: str("location"),
    interests: form.getAll("interests"),
    goals: form.getAll("goals"),
    offers: form.getAll("offers"),
    lookingFor: str("lookingFor") ?? "",
    canOffer: str("canOffer") ?? "",
    attendance: str("attendance"),
    networkingStyle: str("networkingStyle"),
    visibility: str("visibility"),
    contactPreference: str("contactPreference"),
    xHandle: str("xHandle"),
    linkedinUrl: str("linkedinUrl"),
    websiteUrl: str("websiteUrl"),
    shareLinksWithConnections: form.get("shareLinksWithConnections") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  let avatarUrl: string | null | undefined;
  const photo = form.get("photo");
  try {
    if (form.get("removePhoto") === "on") avatarUrl = null;
    else if (photo instanceof File && photo.size > 0) avatarUrl = await storeAvatar(user.id, photo);
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message, fieldErrors: { photo: err.message } };
    throw err;
  }

  const db = await getDb();
  const { profile, created, wasComplete } = await saveProfile(db, user.id, parsed.data, avatarUrl);
  if (created) await track(db, "profile_created", user.id);
  if (!wasComplete && profileCompleteness(profile).complete) await track(db, "profile_completed", user.id);

  revalidatePath("/", "layout");
  if (created) redirect("/discover?welcome=1");
  return { ok: true, message: "Profile saved." };
}
