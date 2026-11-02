import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { cleanName, MAX_STATE_BYTES, normaliseEmail, saveProgress, signIn } from "@/lib/ads";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { rateLimit } from "@/lib/me";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// Email only, no password and no verification. Returns a token for this device and any saved progress.
// If the email has none yet and the browser sent its guest progress, that becomes the saved progress.
export async function POST(req: NextRequest) {
  if (!(await rateLimit("ads-signin", Number(process.env.RATE_LIMIT_ADS_SIGNIN_PER_HOUR ?? 30), 60))) return reply(req, { error: "Too many attempts. Try again later." }, 429);
  const body = (await readJson(req, MAX_STATE_BYTES + 10_000)) as { email?: unknown; name?: unknown; state?: unknown } | undefined;
  const email = normaliseEmail(body?.email);
  if (!body || !email) return reply(req, { error: "Enter a valid email address." }, 400);
  const db = await getDb();
  const result = await signIn(db, email, cleanName(body.name));
  let progress = result.state;
  if (!progress && body.state && typeof body.state === "object") {
    await saveProgress(db, result.user.id, body.state);
    progress = { state: body.state, updatedAt: new Date().toISOString() };
  }
  return reply(req, { token: result.token, user: result.user, progress, adopted: !result.state && Boolean(progress) });
}
