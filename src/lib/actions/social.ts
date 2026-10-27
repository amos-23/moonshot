"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { markPost, recordInvite } from "@/lib/services/social";
import { AppError } from "@/lib/services/errors";
import { siteUrl } from "@/lib/env";
import { replyIntentUrl } from "@/lib/social/x-url";
import { attempt, type ActionResult } from "./result";

async function user() {
  const u = await getSessionUser();
  if (!u) throw new AppError("Sign in to curate posts.", "forbidden");
  return u;
}

export async function markPostAction(postId: string, mark: "relevant" | "dismissed" | "clear"): Promise<ActionResult> {
  return attempt(async () => {
    const u = await user();
    await markPost(await getDb(), u.id, postId, mark);
    revalidatePath("/conversation");
  });
}

/** Records the invite and returns an official X web-intent URL; the user reviews and posts it themselves. */
export async function inviteAuthorAction(postId: string): Promise<ActionResult> {
  return attempt(async () => {
    const u = await user();
    const post = await recordInvite(await getDb(), u.id, postId);
    const greeting = post.authorHandle ? `Hi @${post.authorHandle} — ` : "Hi — ";
    const text = `${greeting}saw your post about Moonshot. I'm using Moonshot Connect (an independent attendee networking app) to find people to meet. Join if you'd like to connect: ${siteUrl()}/join?ref=x`;
    return { ok: true, data: { url: replyIntentUrl(post.externalId, text) } };
  });
}
