import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { adminLogoutAction, removePhotoAction, resolveReportAction, setHiddenAction } from "@/lib/actions";
import { formatTime, timeAgo } from "@/lib/time";
import { AdminLogin, AdminMomentForm, ImportForm } from "@/components/forms";
import { ActionButton } from "@/components/client";
import { Button, Card, Notice, PageTitle, Tag } from "@/components/ui";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ moment?: string }> }) {
  const { moment } = await searchParams;
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <PageTitle title="Admin" />
        <AdminLogin />
      </div>
    );
  }
  const db = await getDb();
  const [reports, people, posts, comments, momentRows, liveCheckins, signups] = await Promise.all([
    db.select().from(schema.reports).where(eq(schema.reports.resolved, false)).orderBy(desc(schema.reports.createdAt)).limit(100),
    db.select().from(schema.people).orderBy(desc(schema.people.createdAt)).limit(500),
    db.select().from(schema.socialPosts).orderBy(desc(schema.socialPosts.importedAt)).limit(500),
    db.select().from(schema.comments).orderBy(desc(schema.comments.createdAt)).limit(300),
    db.select().from(schema.moments).orderBy(desc(schema.moments.createdAt)).limit(300),
    db.select().from(schema.checkins).where(sql`${schema.checkins.endedAt} is null and ${schema.checkins.expiresAt} > now()`).orderBy(desc(schema.checkins.createdAt)).limit(300),
    db.select().from(schema.signups).orderBy(desc(schema.signups.createdAt)),
  ]);
  const label = new Map<string, string>([
    ...people.map((p) => [p.id, p.name] as const),
    ...posts.map((p) => [p.id, `@${p.authorHandle}`] as const),
    ...comments.map((c) => [c.id, `Comment by ${c.name}: “${c.body.slice(0, 60)}”`] as const),
    ...momentRows.map((m) => [m.id, `Moment: “${(m.body || m.xText || "photo").slice(0, 60)}”`] as const),
    ...liveCheckins.map((c) => [c.id, `Check-in: ${c.name} at ${c.place}`] as const),
  ]);

  const Row = ({ kind, id, title, sub, hidden, photo }: { kind: "person" | "post" | "comment" | "moment" | "checkin"; id: string; title: string; sub: string; hidden: boolean; photo?: string | null }) => (
    <li>
      <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
        {photo && (
          <a href={photo} target="_blank" rel="noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
          </a>
        )}
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{title}</span> <span className="text-muted">{sub}</span>
        </span>
        {hidden && <Tag>hidden</Tag>}
        {photo && kind === "person" && (
          <ActionButton action={removePhotoAction.bind(null, id)} variant="ghost" confirm="Remove this photo?">
            Remove photo
          </ActionButton>
        )}
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
        sub={`${people.length} cards · ${posts.length} X posts · ${momentRows.length} moments · ${comments.length} comments · ${signups.length} sign-ups`}
        action={
          <div className="flex items-center gap-2">
          <Link href="/admin/stats" className="inline-flex h-9 items-center rounded-full bg-flame-700 px-4 text-sm font-semibold text-white">
            Stats
          </Link>
          <form action={adminLogoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
          </div>
        }
      />
      {moment && <Notice tone="success">Moment added.</Notice>}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold">📸 Add moments</h2>
        <p className="mb-3 text-sm text-muted">Paste an X post link (a recap, photos, a highlight) and it&apos;s added straight away. Keep pasting: one after another, or many at once.</p>
        <AdminMomentForm />
      </Card>
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
                  <ActionButton action={setHiddenAction.bind(null, (["post", "comment", "moment", "checkin"].includes(r.targetType) ? r.targetType : "person") as "post" | "comment" | "moment" | "checkin" | "person", r.targetId, true)} variant="danger">
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
        <h2 className="font-bold">Add people from X posts</h2>
        <p className="mb-3 text-xs text-muted">Each post becomes a “From X” card in the People list.</p>
        <ImportForm />
      </Card>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-bold">Sign-ups · {signups.length}</h2>
          {signups.length > 0 && (
            <a href="/admin/signups.csv" className="text-sm font-semibold text-flame-700 underline">
              Download CSV
            </a>
          )}
        </div>
        {signups.length === 0 ? (
          <p className="text-sm text-muted">No sign-ups yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white text-sm">
            {signups.slice(0, 20).map((u) => (
              <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2">
                <span className="min-w-0 break-all">
                  <span className="font-semibold">{u.name ?? "—"}</span> · {u.email}
                  {u.about && <span className="text-muted"> · {u.about}</span>}
                </span>
                <span className="text-xs text-muted">{timeAgo(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {signups.length > 20 && <p className="mt-2 text-xs text-muted">Showing the latest 20. The CSV has everyone.</p>}
      </section>
      <section>
        <h2 className="mb-3 font-bold">Meet up check-ins (live)</h2>
        <p className="mb-2 text-xs text-muted">Check-ins hide automatically after 3 reports.</p>
        {liveCheckins.length === 0 ? (
          <p className="text-sm text-muted">No one is checked in right now.</p>
        ) : (
          <ul className="space-y-2">
            {liveCheckins.map((c) => (
              <Row key={c.id} kind="checkin" id={c.id} title={c.name} sub={`📍 ${c.place}${c.note ? ` · ${c.note}` : ""} · until ${formatTime(c.expiresAt)}`} hidden={c.hidden} />
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-bold">Cards</h2>
        <ul className="space-y-2">
          {people.map((p) => (
            <Row key={p.id} kind="person" id={p.id} title={p.name} sub={`${p.headline} · ${timeAgo(p.createdAt)}${p.whereNote ? ` · 📍 ${p.whereNote}` : ""}`} hidden={p.hidden} photo={p.photoUpdatedAt ? `/photo/${p.id}?v=${p.photoUpdatedAt.getTime()}` : null} />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-bold">Moments</h2>
        <p className="mb-2 text-xs text-muted">Moments hide automatically after 3 reports. Unhide here if a report was wrong.</p>
        <ul className="space-y-2">
          {momentRows.map((m) => (
            <Row
              key={m.id}
              kind="moment"
              id={m.id}
              title={m.name ?? (m.xHandle ? `@${m.xHandle}` : m.personId ? (label.get(m.personId) ?? "Card holder") : "Anonymous")}
              sub={`${m.xPostUrl ? "𝕏 " : ""}${(m.body || m.xText || "").slice(0, 100)}${m.place ? ` · 📍 ${m.place}` : ""} · ${timeAgo(m.createdAt)}`}
              hidden={m.hidden}
              photo={m.hasPhoto ? `/admin/moment-photo/${m.id}` : (m.xMedia[0] ?? null)}
            />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-bold">Comments</h2>
        <ul className="space-y-2">
          {comments.map((c) => (
            <Row key={c.id} kind="comment" id={c.id} title={c.name} sub={`on ${label.get(c.postId) ?? "a post"}: ${c.body.slice(0, 100)}`} hidden={c.hidden} />
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
