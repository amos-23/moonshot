import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getProgress, MAX_STATE_BYTES, saveProgress, userForToken } from "@/lib/ads";
import { bearer, preflight, readJson, reply } from "@/lib/ads-route";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  const db = await getDb();
  const user = await userForToken(db, bearer(req));
  if (!user) return reply(req, { error: "Signed out." }, 401);
  return reply(req, { user, progress: await getProgress(db, user.id) });
}

// Saves the whole progress object (last write wins).
export async function PUT(req: NextRequest) {
  const db = await getDb();
  const user = await userForToken(db, bearer(req));
  if (!user) return reply(req, { error: "Signed out." }, 401);
  const body = (await readJson(req, MAX_STATE_BYTES + 10_000)) as { state?: unknown } | undefined;
  if (!body || !body.state || typeof body.state !== "object" || Array.isArray(body.state)) return reply(req, { error: "Nothing to save." }, 400);
  await saveProgress(db, user.id, body.state);
  return reply(req, { ok: true, updatedAt: new Date().toISOString() });
}
