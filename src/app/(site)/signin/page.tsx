import Link from "next/link";
import { redirect } from "next/navigation";
import { authMode, getAccount } from "@/lib/auth";
import { SignInForm } from "@/components/auth-forms";
import { AuthShell, AuthOff } from "@/components/auth-shell";
import { Notice } from "@/components/ui";

export const metadata = { title: "Sign in · Event Connect", robots: { index: false } };

const safe = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safe(sp.next);
  if (await getAccount()) redirect(next);
  const mode = authMode();
  return (
    <AuthShell title="Sign in" sub="Keep your cards across devices and events. Everything else works without an account.">
      {(sp.error === "link" || sp.error === "expired") && (
        <div className="mb-4">
          <Notice tone="danger">
            {sp.error === "expired" ? "That email link has expired or was already used (each link works once, and only the newest one). Send a new one below." : "That link didn't work. Try again below."}
          </Notice>
        </div>
      )}
      {mode === "off" ? <AuthOff /> : <SignInForm next={next} supabase={mode === "supabase"} start={sp.error ? "link" : "password"} />}
      <p className="mt-6 text-xs text-muted">
        No account needed to browse events, add yourself or post moments.{" "}
        <Link href="/" className="underline">
          Back to events
        </Link>
      </p>
    </AuthShell>
  );
}
