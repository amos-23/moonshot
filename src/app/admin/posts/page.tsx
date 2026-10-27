import { desc } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getSearchQueries } from "@/lib/services/settings";
import { liveStatus } from "@/lib/social/live";
import { deletePostAction, refreshLiveAction, setPostHiddenAction } from "@/lib/actions/admin";
import { formatWhen, timeAgo } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { EditPostForm, ImportPostsForm, SearchQueriesForm } from "@/components/admin-forms";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "X posts · Admin" };

export default async function AdminPostsPage() {
  const db = await getDb();
  const [posts, queries, live] = await Promise.all([
    db.select().from(schema.socialPosts).orderBy(desc(schema.socialPosts.importedAt)).limit(300),
    getSearchQueries(db),
    liveStatus(db),
  ]);
  return (
    <>
      <PageHeader title="X posts" subtitle="Add public posts by URL. Never paste private messages or content the author hasn't published publicly." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Import posts</h2>
          <ImportPostsForm />
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Live search</h2>
          {live.provider ? (
            <>
              <Notice tone={live.lastError ? "pending" : "success"} title={live.provider}>
                {live.lastRefreshAt ? `Last refreshed ${timeAgo(live.lastRefreshAt)}.` : "Not refreshed yet."} {live.lastError && `Last error: ${live.lastError}`}
              </Notice>
              <ActionButton action={refreshLiveAction} size="md" successText="Refreshed.">
                Refresh now
              </ActionButton>
            </>
          ) : (
            <Notice tone="info" title="Not configured">
              Set <code>X_BEARER_TOKEN</code> to enable the official X API recent-search endpoint. Until then, only imported posts are shown.
            </Notice>
          )}
          <SearchQueriesForm queries={queries} />
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Library ({posts.length})</h2>
      {posts.length === 0 ? (
        <EmptyState title="No posts yet">Import public post URLs above.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className={`p-4 ${p.hidden ? "opacity-60" : ""}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    @{p.authorHandle ?? "unknown"} <ExternalLink size={12} aria-hidden />
                  </a>
                  <Badge>{p.source}</Badge>
                  {p.hidden && <Badge tone="danger">hidden</Badge>}
                  <span className="text-xs text-muted">
                    {p.postedAt ? `posted ${formatWhen(p.postedAt)}` : "post time unknown"} · imported {timeAgo(p.importedAt)}
                  </span>
                  <span className="ml-auto flex gap-2">
                    <ActionButton action={setPostHiddenAction.bind(null, p.id, !p.hidden)} variant="ghost">
                      {p.hidden ? "Unhide" : "Hide"}
                    </ActionButton>
                    <ActionButton action={deletePostAction.bind(null, p.id)} variant="ghost" confirm="Delete this post from the library?">
                      Delete
                    </ActionButton>
                  </span>
                </div>
                <EditPostForm post={p} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
