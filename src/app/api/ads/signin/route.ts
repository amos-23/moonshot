import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { normaliseEmail, signIn } from "@/lib/ads";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { rateLimit } from "@/lib/me";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// Email and password. Returns a token for this device and the saved progress.
export async function POST(req: NextRequest) {
  if (!(await rateLimit("ads-signin", Number(process.env.RATE_LIMIT_ADS_SIGNIN_PER_HOUR ?? 20), 60))) return reply(req, { error: "Too many attempts. Try again later." }, 429);
  const body = (await readJson(req, 2_000)) as { email?: unknown; password?: unknown } | undefined;
  const email = normaliseEmail(body?.email);
  if (!body || !email || typeof body.password !== "string" || !body.password || body.password.length > 200) return reply(req, { error: "Enter your email and password." }, 400);
  const result = await signIn(await getDb(), email, body.password);
  if ("error" in result) {
    if (result.error === "no_password") return reply(req, { error: "This account was made before passwords. Use Sign up with the same email to set one." }, 401);
    return reply(req, { error: "Email or password is incorrect." }, 401);
  }
  return reply(req, { token: result.token, user: result.user, progress: result.state });
}
