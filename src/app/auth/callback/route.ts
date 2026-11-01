import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { authMode, markEmailVerified, supabaseServer, upsertAccount } from "@/lib/auth";
import { claimDeviceCards } from "@/lib/me";

// Where Supabase's email links land (confirm your account, magic link, reset password): turns the link
// into a session, makes sure there's an account row, and claims the cards on this device.
function origin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const base = origin(req);
  const q = req.nextUrl.searchParams;
  const nextParam = q.get("next") ?? "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";
  if (authMode() !== "supabase") return NextResponse.redirect(new URL("/signin", base));

  const supabase = await supabaseServer();
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("missing code") };
  if (error || !data.user?.email) return NextResponse.redirect(new URL("/signin?error=link", base));
  await upsertAccount(data.user.id, data.user.email, { name: (data.user.user_metadata?.name as string | undefined) ?? null });
  // Every way here (confirm, sign-in link, password reset) came from an email, so they own the inbox.
  await markEmailVerified(data.user.id);
  await claimDeviceCards(data.user.id);
  return NextResponse.redirect(new URL(next, base));
}
