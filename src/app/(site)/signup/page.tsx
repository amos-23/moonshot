import { getMe } from "@/lib/me";
import { getDb } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { SignupForm } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";

export const metadata = { title: "Sign up · Event Connect", description: "Optional: leave your email for future Event Connect updates." };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  // Coming from an event's header: link the sign-up to your card there, if you have one.
  const { e } = await searchParams;
  const event = e ? await getEvent(await getDb(), e) : null;
  const me = event ? await getMe(event.id) : null;
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageTitle title="Sign up" sub="Optional. Leave your email to hear about what's next from Event Connect: new events, and features for the ones you went to. Everything on the site works without it." />
      <Card className="p-5 sm:p-6">
        <SignupForm name={me?.name ?? ""} about={me?.headline ?? ""} event={event?.slug} />
      </Card>
      <p className="mt-4 text-xs text-muted">We only use your email for Event Connect updates. It&apos;s never shown on the site or shared. Reply to any email to be removed.</p>
    </div>
  );
}
