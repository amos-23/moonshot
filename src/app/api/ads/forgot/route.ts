import { after, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { adsSiteUrl, normaliseEmail, requestPasswordReset, resetEmail } from "@/lib/ads";
import { preflight, readJson, reply } from "@/lib/ads-route";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/me";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// "Forgot password": emails a one-time reset link if the email has an account. The answer is always the same,
// so this can't be used to find out who has an account (the email is sent after replying, so timing doesn't tell either).
export async function POST(req: NextRequest) {
  if (!(await rateLimit("ads-forgot", Number(process.env.RATE_LIMIT_ADS_FORGOT_PER_HOUR ?? 5), 60))) return reply(req, { error: "Too many attempts. Try again later." }, 429);
  const body = (await readJson(req, 2_000)) as { email?: unknown } | undefined;
  const email = normaliseEmail(body?.email);
  if (!body || !email) return reply(req, { error: "Enter a valid email address." }, 400);
  const site = adsSiteUrl(req.headers.get("origin"));
  after(async () => {
    try {
      const found = await requestPasswordReset(await getDb(), email);
      if (!found) return;
      const mail = resetEmail(`${site}/#/reset/${found.token}`, found.name);
      await sendMail({ to: found.email, ...mail });
    } catch (err) {
      console.error("password reset request failed", err);
    }
  });
  return reply(req, { ok: true });
}
