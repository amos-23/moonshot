import { getMe, myToken } from "@/lib/me";
import { deleteCardAction } from "@/lib/actions";
import { CardForm, XPostForm } from "@/components/forms";
import { ActionButton, CopyButton } from "@/components/client";
import { Card, LinkButton, Notice, PageTitle } from "@/components/ui";
import { ShareButtons } from "@/components/share";
import { siteOrigin } from "@/lib/site";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { eventPhase, eventTag, getEvent } from "@/lib/events";

export const metadata = { title: "Add yourself" };

export default async function CardPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<{ claimed?: string; bad?: string }> }) {
  const { claimed, bad } = await searchParams;
  const event = await getEvent(await getDb(), (await params).event);
  if (!event) notFound();
  const base = `/${event.slug}`;
  const me = await getMe(event.id);
  const token = me ? await myToken(event.id) : null;
  const live = eventPhase(event) === "live";
  const tag = eventTag(event) || event.short;

  const notices = (
    <>
      {claimed && <div className="mb-4"><Notice tone="success">Card unlocked on this device.</Notice></div>}
      {bad && <div className="mb-4"><Notice tone="danger">That edit link isn&apos;t valid.</Notice></div>}
    </>
  );

  if (me && token) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <PageTitle title="My card" />
        {notices}
        {live && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">At the event?</p>
            <p className="text-sm text-muted">Check in so people can come and meet you, or add a photo from today to your card.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`${base}/meet`} data-track="meet_mycard">
              📍 Meet up
            </LinkButton>
            <LinkButton href={`${base}/update`} variant="secondary" data-track="update_mycard">
              📸 Card photo
            </LinkButton>
          </div>
        </Card>
        )}
        <Card className="p-5 sm:p-6">
          <CardForm person={me} event={event.slug} />
        </Card>
        <div className="mt-6 space-y-4">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold">Share your card</p>
            <ShareButtons track="share_card" campaign="card" text={`I'm on ${event.short} Connect — here's my card from ${tag} 👋`} url={`${await siteOrigin()}/p/${me.id}`} />
          </Card>
          <Card className="space-y-2 p-5">
            <p className="text-sm font-semibold">Edit from another device</p>
            <p className="text-xs text-muted">There&apos;s no password. Keep this private link to edit your card elsewhere.</p>
            <CopyButton text={`/card/claim/${token}`} label="Copy edit link" />
          </Card>
          {!live && (
            <p className="text-sm">
              <a href={`${base}/update`} className="font-semibold text-flame-700 underline" data-track="update_mycard">
                📸 Add a photo to your card
              </a>
            </p>
          )}
          <ActionButton action={deleteCardAction.bind(null, event.slug)} variant="ghost" confirm="Delete your card?">
            Delete my card
          </ActionButton>
        </div>
      </div>
    );
  }

  // Two ways in, side by side with an "Or" between them (stacked on phones).
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageTitle title="Add yourself" sub="Pick one. Takes a few seconds, no sign-up." />
      {notices}
      <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 text-lg font-bold">Add your X post</h2>
          <p className="mb-5 text-sm text-muted">Already posted about {event.short} on X? Paste the link and people can find you from it.</p>
          <XPostForm event={event.slug} />
        </Card>
        <div className="flex items-center justify-center gap-3 md:h-full md:flex-col" aria-hidden>
          <span className="h-px flex-1 bg-line md:h-auto md:w-px" />
          <span className="text-sm font-bold uppercase tracking-wide text-muted">Or</span>
          <span className="h-px flex-1 bg-line md:h-auto md:w-px" />
        </div>
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 text-lg font-bold">Make a card</h2>
          <p className="mb-5 text-sm text-muted">Say who you are and how to reach you.</p>
          <CardForm person={null} event={event.slug} />
        </Card>
      </div>
    </div>
  );
}
