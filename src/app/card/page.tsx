import { getMe, myToken } from "@/lib/me";
import { deleteCardAction } from "@/lib/actions";
import { CardForm, XPostForm } from "@/components/forms";
import { ActionButton, CopyButton } from "@/components/client";
import { Card, Notice, PageTitle } from "@/components/ui";

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
        <Card className="p-5 sm:p-6">
          <CardForm person={me} />
        </Card>
        <div className="mt-6 space-y-4">
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

  // Two ways in, side by side on wider screens (stacked on phones).
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageTitle title="Add yourself" sub="Pick one. Takes a few seconds, no sign-up." />
      {notices}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 text-lg font-bold">Make a card</h2>
          <p className="mb-5 text-sm text-muted">Say who you are and how to reach you.</p>
          <CardForm person={null} />
        </Card>
        <Card className="p-5 sm:p-6 md:sticky md:top-24">
          <h2 className="mb-1 text-lg font-bold">Add your X post</h2>
          <p className="mb-5 text-sm text-muted">Already posted about Moonshot on X? Paste the link and people can find you from it.</p>
          <XPostForm />
        </Card>
      </div>
    </div>
  );
}
