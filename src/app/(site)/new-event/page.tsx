import { redirect } from "next/navigation";
import { authMode, getAccount } from "@/lib/auth";
import { siteOrigin } from "@/lib/site";
import { OrganiserEventForm } from "@/components/event-forms";
import { AuthOff } from "@/components/auth-shell";
import { Card } from "@/components/ui";

export const metadata = { title: "Create an event · Event Connect", robots: { index: false } };

export default async function NewEventPage() {
  if (authMode() === "off")
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <AuthOff />
      </div>
    );
  if (!(await getAccount())) redirect("/signup?next=/new-event");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-flame-700">For organisers</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Create your event</h1>
      <p className="mt-2 text-muted">
        Your guests get a page to find each other and reach out directly, plus Moments for photos and highlights. It works as soon as you create it: share the link. It joins the Event Connect homepage once we&apos;ve had a quick look.
      </p>
      <Card className="mt-6 p-5 sm:p-6">
        <OrganiserEventForm origin={await siteOrigin()} />
      </Card>
    </div>
  );
}
