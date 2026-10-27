import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { adminLogoutAction, resolveReportAction, setHiddenAction } from "@/lib/actions";
import { timeAgo } from "@/lib/time";
import { AdminLogin, ImportForm } from "@/components/forms";
import { ActionButton } from "@/components/client";
import { Button, Card, PageTitle, Tag } from "@/components/ui";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <PageTitle title="Admin" />
        <AdminLogin />
      </div>
    );
  }
  const db = await getDb();
  const [reports, people, posts] = await Promise.all([
    db.select().from(schema.reports).where(eq(schema.reports.resolved, false)).orderBy(desc(schema.reports.createdAt)).limit(100),
    db.select().from(schema.people).orderBy(desc(schema.people.createdAt)).limit(500),
    db.select().from(schema.socialPosts).orderBy(desc(schema.socialPosts.importedAt)).limit(500),
  ]);
  const label = new Map<string, string>([...people.map((p) => [p.id, p.name] as const), ...posts.map((p) => [p.id, `@${p.authorHandle}`] as const)]);

  const Row = ({ kind, id, title, sub, hidden }: { kind: "person" | "post"; id: string; title: string; sub: string; hidden: boolean }) => (
    <li>
      <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{title}</span> <span className="text-muted">{sub}</span>
        </span>
        {hidden && <Tag>hidden</Tag>}
        <ActionButton action={setHiddenAction.bind(null, kind, id, !hidden)} variant={hidden ? "secondary" : "danger"}>
          {hidden ? "Unhide" : "Hide"}
        </ActionButton>
      </Card>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageTitle
        title="Admin"
        sub={`${people.length} cards · ${posts.length} X posts`}
        action={
          <form action={adminLogoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        }
      />
      <section>
        <h2 className="mb-3 font-bold">Reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">Nothing to review.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="flex-1">
                    <strong>{label.get(r.targetId) ?? r.targetType}</strong> — “{r.reason}” · {timeAgo(r.createdAt)}
                  </span>
                  <ActionButton action={setHiddenAction.bind(null, r.targetType === "post" ? "post" : "person", r.targetId, true)} variant="danger">
                    Hide
                  </ActionButton>
                  <ActionButton action={resolveReportAction.bind(null, r.id)} variant="ghost">
                    Dismiss
                  </ActionButton>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card className="p-5">
        <h2 className="mb-3 font-bold">Add X posts</h2>
        <ImportForm />
      </Card>
      <section>
        <h2 className="mb-3 font-bold">Cards</h2>
        <ul className="space-y-2">
          {people.map((p) => (
            <Row key={p.id} kind="person" id={p.id} title={p.name} sub={`${p.headline} · ${timeAgo(p.createdAt)}`} hidden={p.hidden} />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-bold">X posts</h2>
        <ul className="space-y-2">
          {posts.map((p) => (
            <Row key={p.id} kind="post" id={p.id} title={`@${p.authorHandle}`} sub={p.content?.slice(0, 100) ?? ""} hidden={p.hidden} />
          ))}
        </ul>
      </section>
    </div>
  );
}
