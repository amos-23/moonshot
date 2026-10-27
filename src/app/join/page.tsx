import { ArrowRight } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { Card, LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export const metadata = { title: "You're invited" };

export default async function JoinPage() {
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <Card className="p-6 sm:p-8">
        <LogoMark size={40} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Someone at Moonshot would like to connect</h1>
        <p className="mt-2 text-muted">
          You were invited because you posted publicly about Moonshot. Moonshot Connect is an independent, free app for finding the right people to
          meet at the event — whether you&apos;re attending in person or following remotely.
        </p>
        <p className="mt-3 text-sm text-muted">
          We haven&apos;t created a profile for you. Nothing about you is listed unless you choose to sign up, and you control your visibility.
        </p>
        <LinkButton href={viewer ? "/discover" : "/login?next=/onboarding"} size="lg" className="mt-6 w-full">
          Create my profile <ArrowRight size={18} aria-hidden />
        </LinkButton>
      </Card>
    </div>
  );
}
