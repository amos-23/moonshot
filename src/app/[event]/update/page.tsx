import { notFound } from "next/navigation";
import { getMe } from "@/lib/me";
import { getDb } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { UpdateForm } from "@/components/forms";
import { Card, LinkButton, PageTitle } from "@/components/ui";

export const metadata = { title: "Your card photo" };

export default async function UpdatePage({ params }: { params: Promise<{ event: string }> }) {
  const event = await getEvent(await getDb(), (await params).event);
  if (!event) notFound();
  const me = await getMe(event.id);
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageTitle title="Your card photo" sub="Add a photo of you from today to your card." />
      {me ? (
        <Card className="p-5 sm:p-6">
          <UpdateForm person={me} event={event.slug} />
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="font-semibold">Add yourself first</p>
          <p className="mt-1 text-sm text-muted">Your photo goes on your card, so make one first. It takes a few seconds.</p>
          <LinkButton href={`/${event.slug}/card`} className="mt-4">
            Add yourself
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
