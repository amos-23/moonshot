import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminList, AdminSearch, AdminSection, AdminShell, AdminTitle } from "@/components/adminx/shell";
import { openReports } from "@/lib/admin-data";
import { listEvents } from "@/lib/events";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "People · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Accounts (people who signed up) and the mailing list (who said yes to hearing about new events).
export default async function PeopleAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const { q } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();
  const match = (...parts: (string | null | undefined)[]) => !needle || parts.some((x) => x?.toLowerCase().includes(needle));
  const db = await getDb();
  const [accounts, signups, reports, events] = await Promise.all([
    db.select().from(schema.accounts).orderBy(desc(schema.accounts.createdAt)).limit(500),
    db.select().from(schema.signups).orderBy(desc(schema.signups.createdAt)),
    openReports(db),
    listEvents(db, { includeHidden: true }),
  ]);
  const waiting = events.filter((e) => !e.listed && !e.hidden).length;
  const shownAccounts = accounts.filter((a) => match(a.name, a.email));
  const shownSignups = signups.filter((u) => match(u.name, u.email, u.about));
  return (
    <AdminShell project="connect" section="people" badges={{ inbox: reports.length + waiting, moderation: reports.length, events: waiting }}>
      <AdminTitle title="People" sub="Accounts and the mailing list, across all events. Cards live on each event's page." action={<div className="w-full sm:w-80"><AdminSearch action="/adminx/connect/people" placeholder="Search by name or email" value={q} /></div>} />
      <div className="space-y-8">
        <AdminSection title={`Accounts · ${accounts.length}`} note="Everyone who has signed up.">
          <AdminList count={shownAccounts.length} empty={needle ? `Nothing matches “${q}”.` : "No accounts yet."}>
            {shownAccounts.slice(0, 200).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 break-all">
                  <span className="font-semibold">{a.name ?? "—"}</span> · {a.email}
                  {a.emailOptIn && <span className="text-muted"> · wants updates</span>}
                </span>
                <span className="text-xs text-muted">
                  joined {timeAgo(a.createdAt)}
                  {a.lastSignInAt ? ` · last in ${timeAgo(a.lastSignInAt)}` : ""}
                </span>
              </li>
            ))}
          </AdminList>
        </AdminSection>
        <AdminSection
          title={`Mailing list · ${signups.length}`}
          note="People who said yes to hearing about new events."
          action={
            signups.length > 0 && (
              <a href="/admin/signups.csv" className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">
                Download CSV
              </a>
            )
          }
        >
          <AdminList count={shownSignups.length} empty={needle ? `Nothing matches “${q}”.` : "No sign-ups yet."}>
            {shownSignups.slice(0, 200).map((u) => (
              <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 break-all">
                  <span className="font-semibold">{u.name ?? "—"}</span> · {u.email}
                  {u.about && <span className="text-muted"> · {u.about}</span>}
                </span>
                <span className="text-xs text-muted">{timeAgo(u.createdAt)}</span>
              </li>
            ))}
          </AdminList>
          {shownSignups.length > 200 && <p className="mt-2 text-xs text-muted">Showing the latest 200. The CSV has everyone.</p>}
        </AdminSection>
      </div>
    </AdminShell>
  );
}
