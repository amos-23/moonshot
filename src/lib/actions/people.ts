"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { connectionRequestSchema, meetingSchema, reportSchema } from "@/lib/validation";
import * as people from "@/lib/services/people";
import * as connections from "@/lib/services/connections";
import * as meetings from "@/lib/services/meetings";
import { createReport } from "@/lib/services/moderation";
import { track } from "@/lib/services/analytics";
import { attempt, type ActionResult } from "./result";
import { AppError } from "@/lib/services/errors";
import { parseLagosLocal } from "@/lib/time";

async function actor() {
  const user = await getSessionUser();
  if (!user) throw new AppError("Please sign in again.", "forbidden");
  const db = await getDb();
  if (!(await people.getProfile(db, user.id))) throw new AppError("Create your profile first.", "forbidden");
  return { user, db };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function toggleSaveAction(otherId: string, save: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await people.setSaved(db, user.id, otherId, save);
    if (save) await track(db, "profile_saved", user.id, { target: otherId });
    refresh();
  });
}

export async function sendRequestAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const parsed = connectionRequestSchema.safeParse({ recipientId: form.get("recipientId"), message: form.get("message") ?? "" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { user, db } = await actor();
    const res = await connections.sendConnectionRequest(db, user.id, parsed.data.recipientId, parsed.data.message);
    await track(db, res.status === "accepted" ? "connection_request_accepted" : "connection_request_sent", user.id, { target: parsed.data.recipientId });
    refresh();
    return { ok: true, message: res.status === "accepted" ? "They'd already asked to connect — you're now connected!" : "Request sent." };
  });
}

export async function respondRequestAction(requestId: string, accept: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await connections.respondToRequest(db, user.id, requestId, accept ? "accept" : "decline");
    if (accept) await track(db, "connection_request_accepted", user.id, { requestId });
    refresh();
  });
}

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await connections.cancelRequest(db, user.id, requestId);
    refresh();
  });
}

export async function removeConnectionAction(otherId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await connections.removeConnection(db, user.id, otherId);
    refresh();
  });
}

export async function blockAction(otherId: string): Promise<ActionResult> {
  const result = await attempt(async () => {
    const { user, db } = await actor();
    await people.block(db, user.id, otherId);
    refresh();
  });
  if (result.ok) redirect("/discover?notice=blocked");
  return result;
}

export async function unblockAction(otherId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await people.unblock(db, user.id, otherId);
    refresh();
  });
}

export async function reportAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await attempt(async () => {
    const parsed = reportSchema.safeParse({
      targetType: form.get("targetType"),
      targetId: form.get("targetId"),
      reason: form.get("reason"),
      details: form.get("details") ?? "",
    });
    if (!parsed.success) return { ok: false, error: "Choose a reason for your report." };
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in again.", "forbidden");
    const db = await getDb();
    await createReport(db, user.id, parsed.data);
    const blocked = form.get("alsoBlock") === "on" && parsed.data.targetType === "user";
    if (blocked) await people.block(db, user.id, parsed.data.targetId);
    refresh();
    return { ok: true, message: "Thanks — our moderators will review this.", data: blocked ? "blocked" : undefined };
  });
  // Once blocked, the profile is no longer visible to the reporter, so leave the page.
  if (result.ok && result.data === "blocked") redirect("/discover?notice=reported");
  return result;
}

export async function saveNoteAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const subjectId = String(form.get("subjectId") ?? "");
    const body = String(form.get("body") ?? "");
    if (body.length > 2000) return { ok: false, error: "Notes are limited to 2000 characters." };
    const { user, db } = await actor();
    await people.setNote(db, user.id, subjectId, body);
    revalidatePath("/my");
    return { ok: true, message: "Note saved." };
  });
}

export async function proposeMeetingAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const startsAt = parseLagosLocal(String(form.get("startsAt") ?? "")) ?? "invalid";
    const parsed = meetingSchema.safeParse({
      inviteeId: form.get("inviteeId"),
      startsAt,
      durationMinutes: form.get("durationMinutes"),
      location: form.get("location"),
      note: form.get("note") ?? "",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { user, db } = await actor();
    await meetings.proposeMeeting(db, user.id, parsed.data);
    await track(db, "meeting_proposed", user.id, { target: parsed.data.inviteeId });
    refresh();
    return { ok: true, message: "Meeting proposed. It's confirmed once they accept." };
  });
}

export async function respondMeetingAction(meetingId: string, confirm: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await meetings.respondToMeeting(db, user.id, meetingId, confirm ? "confirm" : "decline");
    if (confirm) await track(db, "meeting_confirmed", user.id, { meetingId });
    refresh();
  });
}

export async function cancelMeetingAction(meetingId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { user, db } = await actor();
    await meetings.cancelMeeting(db, user.id, meetingId);
    refresh();
  });
}
