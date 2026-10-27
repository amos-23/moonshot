import { NextResponse, type NextRequest } from "next/server";
import { findByToken } from "@/lib/me";

// Opening a private edit link remembers the card on this device.
function origin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await findByToken(token);
  if (!person) return NextResponse.redirect(new URL("/card?bad=1", origin(req)));
  const res = NextResponse.redirect(new URL("/card?claimed=1", origin(req)));
  res.cookies.set("mc_card", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return res;
}
