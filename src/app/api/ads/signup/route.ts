import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { cleanName, MAX_STATE_BYTES, MIN_PASSWORD, normaliseEmail, saveProgress, signUp, validPassword } from "@/lib/ads";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { rateLimit } from "@/lib/me";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// Creates an account with an email and password. If the browser sent its guest progress, it becomes the saved progress.
export async function POST(req: NextRequest) {
  if (!(await rateLimit("ads-signup", Number(process.env.RATE_LIMIT_ADS_SIGNUP_PER_HOUR ?? 10), 60))) return reply(req, { error: "Too many attempts. Try again later." }, 429);
  const body = (await readJson(req, MAX_STATE_BYTES + 10_000)) as { email?: unknown; password?: unknown; name?: unknown; state?: unknown } | undefined;
  const email = normaliseEmail(body?.email);
  if (!body || !email) return reply(req, { error: "Enter a valid email address." }, 400);
  if (!validPassword(body.password)) return reply(req, { error: `Use a password of at least ${MIN_PASSWORD} characters.` }, 400);
  const db = await getDb();
  const result = await signUp(db, email, body.password, cleanName(body.name));
  if ("error" in result) return reply(req, { error: "An account with this email already exists. Sign in instead." }, 409);
  let progress = result.state;
  if (!progress && body.state && typeof body.state === "object") {
    await saveProgress(db, result.user.id, body.state);
    progress = { state: body.state, updatedAt: new Date().toISOString() };
  }
  return reply(req, { token: result.token, user: result.user, progress, adopted: !result.state && Boolean(progress) });
}
