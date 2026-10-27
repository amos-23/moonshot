import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { blockedList } from "@/lib/services/people";
import { profileCompleteness } from "@/lib/services/profiles";
import { signOutAction } from "@/lib/actions/auth";
import { unblockAction } from "@/lib/actions/people";
import { ProfileForm } from "@/components/profile-form";
import { ActionButton } from "@/components/action-button";
import { Avatar, Button, Card, PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await requireProfile("/profile");
  const db = await getDb();
  const blocked = await blockedList(db, user.id);
  const completeness = profileCompleteness(profile);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Your profile"
        subtitle={<>Signed in as {user.email}. <Link className="text-accent underline-offset-2 hover:underline" href={`/people/${user.id}`}>See how others see you</Link></>}
        action={
          <form action={signOutAction}>
            <Button variant="secondary" size="sm" type="submit">
              <LogOut size={16} aria-hidden /> Sign out
            </Button>
          </form>
        }
      />
      {!completeness.complete && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-medium">Profile {completeness.percent}% complete</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${completeness.percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Still to do: {completeness.checks.filter((c) => !c.done).map((c) => c.label.toLowerCase()).join(", ")}.
          </p>
        </Card>
      )}
      <ProfileForm profile={profile} />

      <section className="mt-8" aria-labelledby="blocked">
        <SectionTitle id="blocked">Blocked people</SectionTitle>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t blocked anyone. Blocked people can&apos;t see you, contact you or appear in your recommendations.</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map(({ profile: b }) => (
              <li key={b.userId}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={b.name} src={b.avatarUrl} size={36} />
                    <span className="text-sm font-medium">{b.name}</span>
                  </span>
                  <ActionButton action={unblockAction.bind(null, b.userId)} variant="secondary" size="sm">
                    Unblock
                  </ActionButton>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
