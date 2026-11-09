import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { MIN_PASSWORD, resetPassword, validPassword } from "@/lib/ads";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { rateLimit } from "@/lib/me";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// Sets a new password with the token from the emailed link. It works once, for an hour. Signs every device out,
// then signs this one in and returns the saved progress, like sign-in.
export async function POST(req: NextRequest) {
  if (!(await rateLimit("ads-reset", Number(process.env.RATE_LIMIT_ADS_RESET_PER_HOUR ?? 10), 60))) return reply(req, { error: "Too many attempts. Try again later." }, 429);
  const body = (await readJson(req, 2_000)) as { token?: unknown; password?: unknown } | undefined;
  if (!body || typeof body.token !== "string") return reply(req, { error: "This reset link isn't valid. Ask for a new one." }, 400);
  if (!validPassword(body.password)) return reply(req, { error: `Use a password of at least ${MIN_PASSWORD} characters.` }, 400);
  const result = await resetPassword(await getDb(), body.token, body.password);
  if ("error" in result) return reply(req, { error: "This reset link has expired or was already used. Ask for a new one." }, 400);
  return reply(req, { token: result.token, user: result.user, progress: result.state });
}
