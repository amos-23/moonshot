import { NextResponse, type NextRequest } from "next/server";
import { cardCookieName, findByToken } from "@/lib/me";
import { getDb } from "@/lib/db";
import { getEventById } from "@/lib/events";

// Opening a private edit link remembers the card on this device.
function origin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await findByToken(token);
  const event = person ? await getEventById(await getDb(), person.eventId) : null;
  if (!person || !event) return NextResponse.redirect(new URL("/?bad=1", origin(req)));
  const res = NextResponse.redirect(new URL(`/${event.slug}/card?claimed=1`, origin(req)));
  res.cookies.set(cardCookieName(event.id), token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return res;
}
