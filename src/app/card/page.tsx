import { getMe, myToken } from "@/lib/me";
import { deleteCardAction } from "@/lib/actions";
import { CardForm, XPostForm } from "@/components/forms";
import { ActionButton, CopyButton } from "@/components/client";
import { Card, LinkButton, Notice, PageTitle } from "@/components/ui";
import { ShareButtons } from "@/components/share";
import { siteOrigin } from "@/lib/site";

export const metadata = { title: "Add yourself" };

export default async function CardPage({ searchParams }: { searchParams: Promise<{ claimed?: string; bad?: string }> }) {
  const { claimed, bad } = await searchParams;
  const me = await getMe();
  const token = me ? await myToken() : null;

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
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">At the event?</p>
            <p className="text-sm text-muted">Add a photo from today and where people can catch you.</p>
          </div>
          <LinkButton href="/update" data-track="update_mycard">
            📸 Post an update
          </LinkButton>
        </Card>
        <Card className="p-5 sm:p-6">
          <CardForm person={me} />
        </Card>
        <div className="mt-6 space-y-4">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold">Share your card</p>
            <ShareButtons track="share_card" text="I'm on Moonshot Connect — find me and see who else is at Moonshot:" url={`${await siteOrigin()}/?q=${encodeURIComponent(me.name)}`} />
          </Card>
          <Card className="space-y-2 p-5">
            <p className="text-sm font-semibold">Edit from another device</p>
            <p className="text-xs text-muted">There&apos;s no password. Keep this private link to edit your card elsewhere.</p>
            <CopyButton text={`/card/claim/${token}`} label="Copy edit link" />
          </Card>
          <ActionButton action={deleteCardAction} variant="ghost" confirm="Delete your card?">
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
          <p className="mb-5 text-sm text-muted">Already posted about Moonshot on X? Paste the link and people can find you from it.</p>
          <XPostForm />
        </Card>
        <div className="flex items-center justify-center gap-3 md:h-full md:flex-col" aria-hidden>
          <span className="h-px flex-1 bg-line md:h-auto md:w-px" />
          <span className="text-sm font-bold uppercase tracking-wide text-muted">Or</span>
          <span className="h-px flex-1 bg-line md:h-auto md:w-px" />
        </div>
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 text-lg font-bold">Make a card</h2>
          <p className="mb-5 text-sm text-muted">Say who you are and how to reach you.</p>
          <CardForm person={null} />
        </Card>
      </div>
    </div>
  );
}
