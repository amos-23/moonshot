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

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageTitle title={me ? "My card" : "Add yourself"} sub={me ? undefined : "Takes a few seconds. No sign-up."} />
      {claimed && <div className="mb-4"><Notice tone="success">Card unlocked on this device.</Notice></div>}
      {bad && <div className="mb-4"><Notice tone="danger">That edit link isn&apos;t valid.</Notice></div>}

      <Card className="p-5 sm:p-6">
        <CardForm person={me} />
      </Card>

      {me && token ? (
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
      ) : (
        <>
          <p className="my-6 text-center text-sm font-semibold text-muted">— or —</p>
          <Card className="p-5 sm:p-6">
            <p className="mb-3 text-sm text-muted">Already posted about Moonshot on X? Add the post and people can find you from it.</p>
            <XPostForm />
          </Card>
        </>
      )}
    </div>
  );
}
