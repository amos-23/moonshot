import { redirect } from "next/navigation";
import { authMode, getAccount } from "@/lib/auth";
import { SignUpForm } from "@/components/auth-forms";
import { AuthShell, AuthOff } from "@/components/auth-shell";

export const metadata = { title: "Create an account · Event Connect", robots: { index: false } };

const safe = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const sp = await searchParams;
  // Old links pointed here with ?e=<event>; send people back to that event afterwards.
  const next = safe(sp.next ?? (sp.e ? `/${sp.e}` : undefined));
  if (await getAccount()) redirect(next);
  return (
    <AuthShell title="Create an account" sub="Free. Your cards follow you across devices and events, and you can hear about new events.">
      {authMode() === "off" ? <AuthOff /> : <SignUpForm next={next} />}
      <p className="mt-6 text-xs text-muted">We only use your email to sign you in and, if you say yes, to tell you about new events. It&apos;s never shown on the site or shared.</p>
    </AuthShell>
  );
}
