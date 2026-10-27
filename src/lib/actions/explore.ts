"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { inquirySchema, meetupSchema } from "@/lib/validation";
import { createInquiry, setExhibitorSaved } from "@/lib/services/exhibitors";
import { createMeetup, joinMeetup, leaveMeetup, setMeetupStatus } from "@/lib/services/meetups";
import { getProfile } from "@/lib/services/people";
import { track } from "@/lib/services/analytics";
import { AppError } from "@/lib/services/errors";
import { parseLagosLocal } from "@/lib/time";
import { attempt, type ActionResult } from "./result";

async function actor(needProfile = true) {
  const user = await getSessionUser();
  if (!user) throw new AppError("Please sign in first.", "forbidden");
  const db = await getDb();
  if (needProfile && !(await getProfile(db, user.id))) throw new AppError("Create your profile first.", "forbidden");
  return { user, db };
}

export async function toggleExhibitorSaveAction(exhibitorId: string, save: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor(false);
    await setExhibitorSaved(db, user.id, exhibitorId, save);
    if (save) await track(db, "exhibitor_saved", user.id, { exhibitorId });
    revalidatePath("/explore", "layout");
    revalidatePath("/my");
  });
}

export async function inquiryAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const parsed = inquirySchema.safeParse({ exhibitorId: form.get("exhibitorId"), kind: form.get("kind"), body: form.get("body") });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { user, db } = await actor();
    await createInquiry(db, user.id, parsed.data.exhibitorId, parsed.data.kind, parsed.data.body);
    return { ok: true, message: "Sent. The Moonshot Connect team will pass this on where possible — we can't guarantee a reply." };
  });
}

export async function createMeetupAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await attempt(async () => {
    const parsed = meetupSchema.safeParse({
      title: form.get("title"),
      description: form.get("description") ?? "",
      topic: form.get("topic"),
      startsAt: parseLagosLocal(String(form.get("startsAt") ?? "")) ?? "invalid",
      location: form.get("location") ?? "",
      onlineUrl: form.get("onlineUrl") ?? "",
      capacity: form.get("capacity"),
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0] ?? "_form")] ??= i.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fe };
    }
    const { user, db } = await actor();
    const m = await createMeetup(db, user.id, parsed.data);
    await track(db, "meetup_joined", user.id, { meetupId: m.id, organiser: true });
    return { ok: true, data: m.id };
  });
  if (result.ok) redirect(`/explore/meetups/${result.data}`);
  return result;
}

export async function joinMeetupAction(meetupId: string, join: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    if (join) {
      await joinMeetup(db, user.id, meetupId);
      await track(db, "meetup_joined", user.id, { meetupId });
    } else await leaveMeetup(db, user.id, meetupId);
    revalidatePath("/explore", "layout");
  });
}

export async function meetupStatusAction(meetupId: string, status: "proposed" | "confirmed" | "cancelled"): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor(false);
    await setMeetupStatus(db, user, meetupId, status);
    revalidatePath("/explore", "layout");
  });
}
