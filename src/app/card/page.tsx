import Link from "next/link";
import { getMe, myToken } from "@/lib/me";
import { isHereNow } from "@/lib/data";
import { deleteCardAction, forgetDeviceAction } from "@/lib/actions";
import { CardForm, WhereForm } from "@/components/forms";
import { ActionButton, CopyButton } from "@/components/client";
import { Card, LinkButton, Notice, PageTitle } from "@/components/ui";

export const metadata = { title: "My card" };

export default async function CardPage({ searchParams }: { searchParams: Promise<{ claimed?: string; bad?: string }> }) {
  const { claimed, bad } = await searchParams;
  const me = await getMe();
  const token = me ? await myToken() : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageTitle
        title={me ? "My card" : "Make your card"}
        sub={me ? "This is what people see. Changes are live instantly." : "30 seconds. No sign-up — this device remembers your card."}
        action={me && <LinkButton href={`/p/${me.id}`} variant="secondary" size="sm">View my card</LinkButton>}
      />
      {claimed && <div className="mb-4"><Notice tone="success">Card unlocked on this device.</Notice></div>}
      {bad && <div className="mb-4"><Notice tone="danger">That edit link isn&apos;t valid.</Notice></div>}

      {me && token && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <WhereForm current={me.whereNote} fresh={isHereNow(me)} />
          </Card>
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold">Your private edit link</p>
            <p className="text-xs text-muted">There&apos;s no password. Keep this link to edit your card on another phone or laptop. Don&apos;t share it.</p>
            <CopyButton text={`/card/claim/${token}`} label="Copy edit link" />
          </Card>
        </div>
      )}

      <CardForm person={me} />

      {me && (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6">
          <ActionButton action={forgetDeviceAction} variant="ghost" confirm="Forget your card on this device? You'll need your edit link to get it back.">
            Forget on this device
          </ActionButton>
          <ActionButton action={deleteCardAction} variant="danger" confirm="Delete your card permanently?">
            Delete my card
          </ActionButton>
        </div>
      )}
      {!me && (
        <p className="mt-6 text-center text-sm text-muted">
          Already made one on another device? Open your private edit link there, or{" "}
          <Link href="/people" className="underline">
            just browse
          </Link>
          .
        </p>
      )}
    </div>
  );
}
