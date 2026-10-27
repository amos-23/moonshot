import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertAccount } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next") ?? "/discover";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/discover";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("Missing code") };

  if (error || !data.user?.email) {
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  await upsertAccount(data.user.email, data.user.id);
  return NextResponse.redirect(new URL(next, url.origin));
}
