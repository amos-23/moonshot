"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validation";
import { sendMessage } from "@/lib/services/messaging";
import { track } from "@/lib/services/analytics";
import { AppError } from "@/lib/services/errors";
import { attempt, type ActionResult } from "./result";

export async function sendMessageAction(conversationId: string, body: string): Promise<ActionResult> {
  return attempt(async () => {
    const parsed = messageSchema.safeParse({ conversationId, body });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in again.", "forbidden");
    const db = await getDb();
    const msg = await sendMessage(db, user.id, parsed.data.conversationId, parsed.data.body);
    await track(db, "message_sent", user.id, { conversationId });
    revalidatePath("/messages");
    return { ok: true, data: { id: msg.id, senderId: msg.senderId, body: msg.body, createdAt: msg.createdAt.toISOString() } };
  });
}
