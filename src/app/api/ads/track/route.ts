import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { cleanEvent, recordEvent, userForToken } from "@/lib/ads";
import { bearer, preflight, readJson, reply } from "@/lib/ads-route";
import { BOT_UA, clientIp, visitorHash } from "@/lib/track";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// Anonymous usage events from AdsSim. No cookies and no email: visitors are a daily-changing hash of IP + browser.
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) return reply(req, null, 204);
  const event = cleanEvent(await readJson(req, 4_000));
  if (!event) return reply(req, null, 204);
  try {
    const db = await getDb();
    const signedIn = Boolean(await userForToken(db, bearer(req)));
    await recordEvent(db, event, visitorHash(`ads|${clientIp(req.headers)}`, ua), signedIn);
  } catch (err) {
    console.error("ads track failed", err);
  }
  return reply(req, null, 204);
}
