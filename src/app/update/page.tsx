import { getMe } from "@/lib/me";
import { isHereNow } from "@/lib/search";
import { UpdateForm } from "@/components/forms";
import { Card, LinkButton, PageTitle } from "@/components/ui";

export const metadata = { title: "Post an update" };

export default async function UpdatePage() {
  const me = await getMe();
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageTitle title="Post an update" sub="Add a photo from today and tell people where to catch you." />
      {me ? (
        <Card className="p-5 sm:p-6">
          <UpdateForm person={me} currentWhere={isHereNow(me) ? (me.whereNote ?? "") : ""} />
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="font-semibold">Add yourself first</p>
          <p className="mt-1 text-sm text-muted">Updates go on your card, so make one first. It takes a few seconds.</p>
          <LinkButton href="/card" className="mt-4">
            Add yourself
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
