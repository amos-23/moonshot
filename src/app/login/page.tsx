import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { authMode } from "@/lib/env";
import { LoginForm } from "@/components/login-form";
import { Card, Notice } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getSessionUser()) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/discover");
  const mode = authMode();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6 sm:p-8">
        <LogoMark size={40} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Find your people at Moonshot</h1>
        <p className="mt-1 text-sm text-muted">Sign in or create an account with your email. No password needed.</p>
        <div className="mt-6 space-y-4">
          {error === "link" && <Notice tone="danger">That sign-in link was invalid or has expired. Request a new one below.</Notice>}
          {mode === "demo" && (
            <Notice tone="pending" title="Local demo sign-in">
              Supabase Auth isn&apos;t configured, so this instance signs you in without email verification. Use it for local development and
              demos only.
            </Notice>
          )}
          {mode === "none" && (
            <Notice tone="danger" title="Sign-in unavailable">
              Email authentication hasn&apos;t been configured for this deployment yet.
            </Notice>
          )}
          <LoginForm next={next} mode={mode} />
          <p className="text-xs text-muted">
            By continuing you agree to use Moonshot Connect respectfully. Your email is never shown to other users.
          </p>
        </div>
      </Card>
    </div>
  );
}
