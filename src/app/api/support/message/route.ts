import { after, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { rateLimit } from "@/lib/me";
import { MAX_BODY, cleanBody, isProject, notifyAdminOfMessage, postVisitorMessage, validToken } from "@/lib/support";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// A visitor's message to support (AdsSim or Event Connect). No account needed: the browser's random token identifies the chat.
export async function POST(req: NextRequest) {
  if (!(await rateLimit("support-message", Number(process.env.RATE_LIMIT_SUPPORT_PER_HOUR ?? 30), 60))) return reply(req, { error: "You're sending a lot of messages. Please wait a little." }, 429);
  const b = (await readJson(req, 8_000)) as Record<string, unknown> | undefined;
  const body = cleanBody(b?.body);
  if (!b || !isProject(b.project) || !validToken(b.token)) return reply(req, { error: "That didn't work. Please refresh and try again." }, 400);
  if (!body) return reply(req, { error: `Write a message (up to ${MAX_BODY} characters).` }, 400);
  const db = await getDb();
  const saved = await postVisitorMessage(db, { project: b.project, token: b.token, body, name: b.name, email: b.email, page: b.page });
  if ("error" in saved) return reply(req, { error: "This chat is full. Please email us instead." }, 409);
  if (saved.notify) {
    const { project } = b;
    after(() => notifyAdminOfMessage({ project, ...saved.who, body, threadId: saved.threadId }));
  }
  return reply(req, { ok: true, message: saved.message });
}
