import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { fetchVisitorThread, isProject, validToken } from "@/lib/support";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// The visitor's own chat, newer than `after`. POST (not GET) so the token never lands in a URL or a log.
export async function POST(req: NextRequest) {
  const b = (await readJson(req, 1_000)) as Record<string, unknown> | undefined;
  if (!b || !isProject(b.project) || !validToken(b.token)) return reply(req, { error: "That didn't work." }, 400);
  const after = typeof b.after === "number" && Number.isFinite(b.after) && b.after > 0 ? Math.floor(b.after) : 0;
  return reply(req, await fetchVisitorThread(await getDb(), b.project, b.token, after));
}
