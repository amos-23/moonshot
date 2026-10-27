import Link from "next/link";
import { ExternalLink, Hash, MessagesSquare, Search } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listPosts } from "@/lib/services/social";
import { getEventInfo, getSearchQueries } from "@/lib/services/settings";
import { track } from "@/lib/services/analytics";
import { refreshLive } from "@/lib/social/live";
import { POST_THEMES, labelFor } from "@/lib/constants";
import { formatWhen, timeAgo } from "@/lib/time";
import { PostActions } from "@/components/post-actions";
import { ReportForm } from "@/components/people-forms";
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, Notice, PageHeader, cx, inputClass } from "@/components/ui";

export const metadata = { title: "Explore the Conversation" };

const SOURCE_LABEL: Record<string, string> = {
  manual: "Added by an admin",
  import: "Imported by an admin",
  oembed: "Imported · text via X oEmbed",
  x_api: "Found via X API search",
};

export default async function ConversationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const db = await getDb();
  const live = await refreshLive(db).catch(() => null);
  const view = sp.view === "relevant" || sp.view === "dismissed" ? sp.view : "all";
  const theme = POST_THEMES.some((t) => t.value === sp.theme) ? sp.theme : undefined;
  const q = sp.q?.slice(0, 100);
  const [posts, queries, event] = await Promise.all([
    listPosts(db, viewer?.user.id ?? null, { q, theme, view: viewer ? view : "all" }),
    getSearchQueries(db),
    getEventInfo(db),
  ]);
  if (q && viewer) await track(db, "search_performed", viewer.user.id, { surface: "conversation", q, theme });
  const hashtags = event.hashtags.split(/[\s,]+/).filter((h) => h.startsWith("#"));

  const link = (params: Record<string, string | undefined>) => {
    const merged = { q, theme, view: view === "all" ? undefined : view, ...params };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return `/conversation${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Explore the Conversation" subtitle="Public posts about Moonshot — find people worth meeting and invite them to connect." />

      <div className="mb-6">
        {live?.provider ? (
          <Notice tone={live.lastError ? "pending" : "info"} title={`Live search: ${live.provider}`}>
            {live.lastError
              ? `The last refresh failed (${live.lastError}). Showing posts collected so far.`
              : `Refreshed ${live.lastRefreshAt ? timeAgo(live.lastRefreshAt) : "recently"}. New posts are fetched at most every 15 minutes.`}
          </Notice>
        ) : (
          <Notice tone="info" title="Live search isn't connected">
            This page shows public X posts that admins have added by URL, each linked to the original. Automatic search turns on when the
            official X API is configured. We never scrape X or invent posts.
          </Notice>
        )}
      </div>

      <form method="get" role="search" className="mb-3 flex gap-2">
        {theme && <input type="hidden" name="theme" value={theme} />}
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <label className="relative flex-1">
          <span className="sr-only">Search posts</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Search keywords, phrases or @handles" className={`${inputClass} pl-10`} />
        </label>
        <Button type="submit">Search</Button>
      </form>

      <div className="mb-3 flex flex-wrap gap-2" aria-label="Suggested searches">
        {queries.map((s) => {
          const term = s.replace(/^"|"$/g, "");
          return (
            <Link key={s} href={link({ q: term })} className={cx("rounded-full border px-3 py-1 text-xs", q === term ? "border-accent bg-accent-50 text-accent" : "border-line bg-white text-muted hover:text-ink")}>
              {s}
            </Link>
          );
        })}
        {hashtags.map((h) => (
          <Link key={h} href={link({ q: h })} className="inline-flex items-center gap-0.5 rounded-full border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink">
            <Hash size={12} aria-hidden />
            {h.slice(1)}
          </Link>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Themes</span>
        <Link href={link({ theme: undefined })} className={cx("rounded-full px-3 py-1 text-sm", !theme ? "bg-ink text-white" : "bg-white text-ink border border-line")}>
          All
        </Link>
        {POST_THEMES.map((t) => (
          <Link key={t.value} href={link({ theme: t.value })} className={cx("rounded-full px-3 py-1 text-sm", theme === t.value ? "bg-ink text-white" : "border border-line bg-white text-ink")}>
            {t.label}
          </Link>
        ))}
        {viewer && (
          <span className="ml-auto flex gap-1 text-sm">
            {(["all", "relevant", "dismissed"] as const).map((v) => (
              <Link key={v} href={link({ view: v === "all" ? undefined : v })} className={cx("rounded-lg px-2 py-1", view === v ? "bg-accent-50 font-medium text-accent" : "text-muted hover:text-ink")}>
                {v === "all" ? "Feed" : v === "relevant" ? "Relevant" : "Dismissed"}
              </Link>
            ))}
          </span>
        )}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare size={32} />}
          title={q || theme || view !== "all" ? "No posts match" : "No posts yet"}
          action={q || theme || view !== "all" ? <LinkButton href="/conversation" variant="secondary">Clear filters</LinkButton> : undefined}
        >
          {q || theme || view !== "all"
            ? "Try a different phrase or theme."
            : "Once admins import public posts about Moonshot (or live search is connected), they'll appear here."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {posts.map(({ post, mark, relevantCount }) => (
            <li key={post.id}>
              <Card className={cx("p-4", mark === "dismissed" && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <Avatar name={post.authorName ?? post.authorHandle ?? "?"} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {post.authorName && <span className="font-semibold">{post.authorName}</span>}
                      {post.authorHandle && (
                        <a href={`https://x.com/${post.authorHandle}`} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-muted hover:underline">
                          @{post.authorHandle}
                        </a>
                      )}
                      {post.postedAt && (
                        <time dateTime={post.postedAt.toISOString()} className="text-xs text-muted" title={formatWhen(post.postedAt)}>
                          · {timeAgo(post.postedAt)}
                        </time>
                      )}
                    </div>
                    {post.content ? (
                      <p className="mt-1 whitespace-pre-line break-words">{post.content}</p>
                    ) : (
                      <p className="mt-1 text-sm italic text-muted">Post text wasn&apos;t imported. Open it on X to read it.</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {post.themes.map((t) => (
                        <Badge key={t} tone="accent">
                          {labelFor(POST_THEMES, t)}
                        </Badge>
                      ))}
                      {relevantCount > 0 && <Badge>{relevantCount} marked relevant</Badge>}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <PostActions postId={post.id} mark={mark} signedIn={Boolean(viewer)} />
                      <a href={`/go/post/${post.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                        Open on X <ExternalLink size={14} aria-hidden />
                      </a>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        Source: {SOURCE_LABEL[post.source] ?? post.source} · <span className="break-all">{post.url.replace("https://", "")}</span>
                      </span>
                      {viewer && <ReportForm targetType="post" targetId={post.id} />}
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {!viewer && (
        <Card className="mt-8 p-5 text-center">
          <p className="font-semibold">Spotted someone you&apos;d like to meet?</p>
          <p className="mt-1 text-sm text-muted">Sign in to mark posts as relevant and invite authors to join Moonshot Connect.</p>
          <LinkButton href="/login?next=/conversation" className="mt-3">
            Find your people
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
