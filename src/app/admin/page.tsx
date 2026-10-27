import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { counts } from "@/lib/data";
import { adminLogoutAction, cancelHangoutAction, refreshLiveAction, resolveReportAction, setHiddenAction } from "@/lib/actions";
import { timeAgo } from "@/lib/time";
import { AdminLogin, ImportForm } from "@/components/forms";
import { ActionButton } from "@/components/client";
import { Button, Card, PageTitle, Tag } from "@/components/ui";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <PageTitle title="Admin" sub="Enter the ADMIN_KEY set on the server." />
        <AdminLogin />
      </div>
    );
  }
  const db = await getDb();
  const [c, reports, people, posts] = await Promise.all([
    counts(db),
    db.select().from(schema.reports).where(eq(schema.reports.resolved, false)).orderBy(desc(schema.reports.createdAt)).limit(100),
    db.select().from(schema.people).orderBy(desc(schema.people.createdAt)).limit(300),
    db.select().from(schema.socialPosts).orderBy(desc(schema.socialPosts.importedAt)).limit(200),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <PageTitle
        title="Admin"
        sub={`${c.people} cards · ${c.inPerson} at the venue · ${c.here} findable now`}
        action={
          <form action={adminLogoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        }
      />

      <section>
        <h2 className="mb-3 text-lg font-bold">Reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">Nothing to review.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <Tag tone="flame">{r.targetType}</Tag>
                  <span className="flex-1">
                    {r.targetType === "person" ? (
                      <Link href={`/p/${r.targetId}`} className="font-semibold underline">
                        {nameOf.get(r.targetId) ?? r.targetId}
                      </Link>
                    ) : r.targetType === "hangout" ? (
                      <Link href={`/hangouts#${r.targetId}`} className="underline">hangout</Link>
                    ) : (
                      <Link href={`/go/${r.targetId}`} className="underline">post</Link>
                    )}{" "}
                    — “{r.reason}” · {timeAgo(r.createdAt)}
                  </span>
                  {r.targetType === "person" && <ActionButton action={setHiddenAction.bind(null, "person", r.targetId, true)} variant="danger">Hide card</ActionButton>}
                  {r.targetType === "post" && <ActionButton action={setHiddenAction.bind(null, "post", r.targetId, true)} variant="danger">Hide post</ActionButton>}
                  {r.targetType === "hangout" && <ActionButton action={cancelHangoutAction.bind(null, r.targetId)} variant="danger">Cancel hangout</ActionButton>}
                  <ActionButton action={resolveReportAction.bind(null, r.id)} variant="ghost">Dismiss</ActionButton>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">Add X posts</h2>
          <ImportForm />
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-bold">Live X search</h2>
          {process.env.X_BEARER_TOKEN ? (
            <ActionButton action={refreshLiveAction} size="md">Fetch new posts now</ActionButton>
          ) : (
            <p className="text-sm text-muted">Set X_BEARER_TOKEN (official X API) to pull posts automatically every 15 minutes.</p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Posts ({posts.length})</h2>
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">@{p.authorHandle}</a>{" "}
                  <span className="text-muted">{p.content?.slice(0, 120) ?? "(no text)"}</span>
                </span>
                {p.hidden && <Tag>hidden</Tag>}
                <ActionButton action={setHiddenAction.bind(null, "post", p.id, !p.hidden)} variant="ghost">{p.hidden ? "Unhide" : "Hide"}</ActionButton>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Cards ({people.length})</h2>
        <ul className="space-y-2">
          {people.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="flex-1">
                  <Link href={`/p/${p.id}`} className="font-semibold underline">{p.name}</Link> <span className="text-muted">{p.headline} · {timeAgo(p.createdAt)}</span>
                </span>
                {p.hidden && <Tag>hidden</Tag>}
                <ActionButton action={setHiddenAction.bind(null, "person", p.id, !p.hidden)} variant={p.hidden ? "secondary" : "danger"}>{p.hidden ? "Unhide" : "Hide"}</ActionButton>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
