import Link from "next/link";
import { ExternalLink, Search, UserPlus } from "lucide-react";
import { getDb } from "@/lib/db";
import { listPosts } from "@/lib/data";
import { refreshLive } from "@/lib/social/live";
import { replyIntentUrl } from "@/lib/social/x-url";
import { POST_THEMES, SEARCH_PHRASES, labelFor } from "@/lib/constants";
import { timeAgo } from "@/lib/time";
import { ReportLink } from "@/components/client";
import { Avatar, Button, Card, Empty, Notice, PageTitle, Tag, cx, inputClass } from "@/components/ui";

export const metadata = { title: "On X" };

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")).replace(/\/$/, "");
}

export default async function ConversationPage({ searchParams }: { searchParams: Promise<{ q?: string; theme?: string }> }) {
  const sp = await searchParams;
  const theme = POST_THEMES.some((t) => t.value === sp.theme) ? sp.theme : undefined;
  const db = await getDb();
  const live = await refreshLive(db).catch(() => ({ provider: null }));
  const posts = await listPosts(db, { q: sp.q, theme });
  const link = (patch: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries({ q: sp.q, theme, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
    return `/conversation${qs ? `?${qs}` : ""}`;
  };
  const invite = `I'm using Moonshot Connect to find people to meet at Moonshot — make a card and let's connect: ${siteUrl() || ""}`.trim();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageTitle title="On X" sub="Public posts about Moonshot. Spot someone interesting? Invite them to make a card." />
      {!live.provider && (
        <div className="mb-5">
          <Notice>Showing public posts added by the organisers of this site, each linked to the original. We never invent or scrape posts.</Notice>
        </div>
      )}
      <form role="search" method="get" className="mb-3 flex gap-2">
        {theme && <input type="hidden" name="theme" value={theme} />}
        <label className="relative flex-1">
          <span className="sr-only">Search posts</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder="Search posts or @handles" className={`${inputClass} pl-11`} />
        </label>
        <Button type="submit" variant="dark">
          Search
        </Button>
      </form>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {SEARCH_PHRASES.map((p) => (
          <Link key={p} href={link({ q: p })} className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink">
            “{p}”
          </Link>
        ))}
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Link href={link({ theme: undefined })} className={cx("shrink-0 rounded-full px-3 py-1.5 text-sm", !theme ? "bg-ink text-white" : "border border-line bg-white")}>
          All
        </Link>
        {POST_THEMES.map((t) => (
          <Link key={t.value} href={link({ theme: t.value })} className={cx("shrink-0 rounded-full px-3 py-1.5 text-sm", theme === t.value ? "bg-ink text-white" : "border border-line bg-white")}>
            {t.label}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <Empty title={sp.q || theme ? "No posts match" : "No posts yet"}>{sp.q || theme ? "Try another search." : "Posts about Moonshot will show up here once they're added."}</Empty>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={p.authorName ?? p.authorHandle ?? "?"} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      {p.authorName && <span className="font-bold">{p.authorName}</span>}
                      {p.authorHandle && <span className="text-sm text-muted">@{p.authorHandle}</span>}
                      {p.postedAt && <span className="text-xs text-muted">· {timeAgo(p.postedAt)}</span>}
                    </p>
                    {p.content ? <p className="mt-1 whitespace-pre-line break-words">{p.content}</p> : <p className="mt-1 text-sm italic text-muted">Open on X to read this post.</p>}
                    {p.themes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.themes.map((t) => (
                          <Tag key={t} tone="sun">{labelFor(POST_THEMES, t)}</Tag>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a href={`/go/${p.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">
                        Open on X <ExternalLink size={13} aria-hidden />
                      </a>
                      <a
                        href={replyIntentUrl(p.externalId, `${p.authorHandle ? `@${p.authorHandle} ` : ""}${invite}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-white px-4 text-sm font-semibold"
                        title="Opens X with a reply you can edit before posting"
                      >
                        <UserPlus size={14} aria-hidden /> Invite to connect
                      </a>
                      <span className="ml-auto">
                        <ReportLink type="post" id={p.id} />
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">Source: {p.source === "x_api" ? "X API search" : "added by the site's organisers"} · {p.url.replace("https://", "")}</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
