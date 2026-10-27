import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { BOT_UA, clientIp, visitorHash } from "@/lib/track";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Records a page view or click. No cookies: visitors are counted with a hash of IP + browser
// that changes every day, so nobody can be followed across days.
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const type = body.type === "click" ? "click" : body.type === "view" ? "view" : null;
  const path = typeof body.path === "string" ? body.path.split("?")[0].slice(0, 200) : null;
  if (!type || !path?.startsWith("/") || path.startsWith("/admin")) return new NextResponse(null, { status: 204 });

  const target = typeof body.target === "string" ? body.target.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || null : null;
  const targetId = typeof body.targetId === "string" && UUID.test(body.targetId) ? body.targetId : null;
  let referrer: string | null = null;
  if (typeof body.ref === "string" && body.ref) {
    try {
      const host = new URL(body.ref).hostname.replace(/^www\./, "");
      if (host && host !== req.nextUrl.hostname && host !== (req.headers.get("x-forwarded-host") ?? "")) referrer = host.slice(0, 100);
    } catch {}
  }
  const visitor = visitorHash(clientIp(req.headers), ua);

  try {
    await (await getDb()).insert(schema.events).values({ type, path, target, targetId, referrer, visitor });
  } catch (err) {
    console.error("track failed", err);
  }
  return new NextResponse(null, { status: 204 });
}
