import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps Supabase sign-in cookies fresh on each request. Does nothing when Supabase isn't set up.
// (The old-domain 301 lives in next.config.ts and runs before this.)
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();
  const landing = authLanding(request);
  if (landing) return landing;
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

/**
 * When an email link fails, or the redirect address isn't on Supabase's allow list, Supabase sends people to
 * the Site URL with `?error_code=…` or `?code=…` attached, i.e. to whatever page that is. Catch both anywhere:
 * errors go to sign-in with a clear message, and a stray code is finished off at /auth/callback.
 */
function authLanding(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/auth/") || request.method !== "GET") return null;
  const errorCode = searchParams.get("error_code") ?? (searchParams.get("error_description") ? searchParams.get("error") : null);
  if (errorCode && pathname !== "/signin") {
    const to = new URL("/signin", request.url);
    to.search = "";
    to.searchParams.set("error", errorCode === "otp_expired" ? "expired" : "link");
    return NextResponse.redirect(to);
  }
  const code = searchParams.get("code");
  if (code && /^[\w-]{8,}$/.test(code)) {
    const to = new URL("/auth/callback", request.url);
    to.search = "";
    to.searchParams.set("code", code);
    to.searchParams.set("next", pathname === "/" || pathname === "/moonshot" ? "/account" : pathname);
    return NextResponse.redirect(to);
  }
  return null;
}

export const config = {
  // Pages and actions only: not static files, images, previews or the health check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|moonshot-icon.svg|og/|photo/|moment-photo/|api/health|api/track).*)"],
};
