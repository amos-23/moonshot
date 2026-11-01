import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps Supabase sign-in cookies fresh on each request. Does nothing when Supabase isn't set up.
// (The old-domain 301 lives in next.config.ts and runs before this.)
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();
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

export const config = {
  // Pages and actions only: not static files, images, previews or the health check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|moonshot-icon.svg|og/|photo/|moment-photo/|api/health|api/track).*)"],
};
