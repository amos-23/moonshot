"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { cleanBody, notifyVisitorOfReply, postAdminReply, setThreadStatus } from "@/lib/support";

export type SupportResult = { ok: true } | { ok: false; error: string };

/** The admin's reply to a visitor. Emails the visitor too when they left an address and aren't in the chat. */
export async function replySupportAction(threadId: string, text: string): Promise<SupportResult> {
  if (!(await isAdmin())) return { ok: false, error: "Admins only." };
  const body = cleanBody(text);
  if (!body) return { ok: false, error: "Write a reply first." };
  const saved = await postAdminReply(await getDb(), threadId, body);
  if (!saved) return { ok: false, error: "That chat no longer exists." };
  if (saved.emailVisitor && saved.email) await notifyVisitorOfReply({ project: saved.project, name: saved.name, email: saved.email, body });
  revalidatePath("/adminx/support", "layout");
  return { ok: true };
}

export async function setSupportStatusAction(threadId: string, status: "open" | "closed"): Promise<SupportResult> {
  if (!(await isAdmin())) return { ok: false, error: "Admins only." };
  await setThreadStatus(await getDb(), threadId, status === "closed" ? "closed" : "open");
  revalidatePath("/adminx/support", "layout");
  return { ok: true };
}
