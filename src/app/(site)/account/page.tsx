import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { authMode, getAccount, isAdminEmail } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";
import { AccountForm, PasswordForm } from "@/components/auth-forms";
import { Button, Card, PageTitle } from "@/components/ui";

export const metadata = { title: "Your account · Event Connect", robots: { index: false } };

export default async function AccountPage() {
  const account = await getAccount();
  if (!account) redirect("/signin?next=/account");
  const db = await getDb();
  // Your cards, at every event.
  const cards = await db
    .select({ id: schema.people.id, name: schema.people.name, headline: schema.people.headline, slug: schema.eventSpaces.slug, event: schema.eventSpaces.name })
    .from(schema.people)
    .innerJoin(schema.eventSpaces, eq(schema.eventSpaces.id, schema.people.eventId))
    .where(eq(schema.people.accountId, account.id))
    .orderBy(desc(schema.people.updatedAt));
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <PageTitle
        title="Your account"
        sub={account.email}
        action={
          <div className="flex items-center gap-2">
            {isAdminEmail(account.email) && (
              <Link href="/admin" className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">
                Admin
              </Link>
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        }
      />
      <Card className="p-5 sm:p-6">
        <h2 className="mb-3 font-bold">Your cards</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">
            No cards yet. Pick an event and add yourself:{" "}
            <Link href="/#events" className="font-semibold text-flame-700 underline">
              events
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {cards.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{c.event}</span>
                  <span className="block truncate text-sm text-muted">
                    {c.name} · {c.headline}
                  </span>
                </span>
                <Link href={`/${c.slug}/card`} className="text-sm font-semibold text-flame-700 underline">
                  Edit card
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-5 sm:p-6">
        <h2 className="mb-3 font-bold">Details</h2>
        <AccountForm name={account.name ?? ""} optIn={account.emailOptIn} />
      </Card>
      {(authMode() === "local" || authMode() === "supabase") && (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 font-bold">Password</h2>
          <PasswordForm />
        </Card>
      )}
    </div>
  );
}
