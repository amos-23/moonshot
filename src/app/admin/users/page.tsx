import Link from "next/link";
import { desc, ilike, or } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { setProfileFlagAction, suspendUserAction } from "@/lib/actions/admin";
import { timeAgo } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { Avatar, Badge, Button, Card, DemoBadge, PageHeader, inputClass } from "@/components/ui";

export const metadata = { title: "Users · Admin" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users, profile: schema.profiles })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(q ? or(ilike(schema.users.email, `%${q}%`), ilike(schema.profiles.name, `%${q}%`)) : undefined)
    .orderBy(desc(schema.users.createdAt))
    .limit(200);
  return (
    <>
      <PageHeader title="Users" subtitle="Suspend accounts, feature public profiles and record ticket verification." />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="Search email or name" className={inputClass} aria-label="Search users" />
        <Button type="submit">Search</Button>
      </form>
      <ul className="space-y-2">
        {rows.map(({ user: u, profile: p }) => (
          <li key={u.id}>
            <Card className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-3">
                <Avatar name={p?.name ?? u.email} src={p?.avatarUrl} size={36} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {p ? <Link href={`/people/${u.id}`} className="hover:underline">{p.name}</Link> : <span className="text-muted">No profile yet</span>}
                    {u.role === "admin" && <Badge tone="accent">admin</Badge>}
                    {u.suspendedAt && <Badge tone="danger">suspended</Badge>}
                    {p?.featured && <Badge tone="success">featured</Badge>}
                    {p?.ticketVerified && <Badge tone="success">ticket verified</Badge>}
                    {p && <Badge>{p.visibility}</Badge>}
                    {p?.isDemo && <DemoBadge />}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {u.email} · joined {timeAgo(u.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p && (
                  <>
                    <ActionButton action={setProfileFlagAction.bind(null, u.id, "featured", !p.featured)} variant="ghost">
                      {p.featured ? "Unfeature" : "Feature"}
                    </ActionButton>
                    <ActionButton
                      action={setProfileFlagAction.bind(null, u.id, "ticketVerified", !p.ticketVerified)}
                      variant="ghost"
                      confirm={p.ticketVerified ? undefined : "Only mark as verified if you have actually checked this person's ticket."}
                    >
                      {p.ticketVerified ? "Unverify ticket" : "Verify ticket"}
                    </ActionButton>
                  </>
                )}
                {u.role !== "admin" && (
                  <ActionButton action={suspendUserAction.bind(null, u.id, !u.suspendedAt)} variant={u.suspendedAt ? "secondary" : "danger"} confirm={u.suspendedAt ? undefined : "Suspend this user?"}>
                    {u.suspendedAt ? "Unsuspend" : "Suspend"}
                  </ActionButton>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
