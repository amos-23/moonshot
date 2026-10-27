import Link from "next/link";
import { Bookmark, BookmarkCheck, Building2, Calendar, MapPin, Plus, Search, Users, Video } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listExhibitors } from "@/lib/services/exhibitors";
import { listMeetups } from "@/lib/services/meetups";
import { EXHIBITOR_CATEGORIES, INDUSTRIES, MEETUP_TOPICS, labelFor } from "@/lib/constants";
import { toggleExhibitorSaveAction } from "@/lib/actions/explore";
import { formatWhen } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { Badge, Button, Card, DemoBadge, EmptyState, LinkButton, PageHeader, cx, inputClass } from "@/components/ui";

export const metadata = { title: "Explore" };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.tab === "meetups" ? "meetups" : "exhibitors";
  const viewer = await getViewer();
  const db = await getDb();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Explore" subtitle="Companies and products to check out, and informal topic meetups to join." />
      <div role="tablist" className="mb-6 inline-flex rounded-xl border border-line bg-white p-1">
        {(["exhibitors", "meetups"] as const).map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={tab === t}
            href={`/explore?tab=${t}`}
            className={cx("rounded-lg px-4 py-1.5 text-sm font-medium", tab === t ? "bg-accent text-white" : "text-muted hover:text-ink")}
          >
            {t === "exhibitors" ? "Exhibitors" : "Topic meetups"}
          </Link>
        ))}
      </div>
      {tab === "exhibitors" ? <Exhibitors sp={sp} viewerId={viewer?.user.id ?? null} db={db} /> : <Meetups sp={sp} viewer={viewer} db={db} />}
    </div>
  );
}

type Db = Awaited<ReturnType<typeof getDb>>;

async function Exhibitors({ sp, viewerId, db }: { sp: Record<string, string | undefined>; viewerId: string | null; db: Db }) {
  const filters = { q: sp.q?.slice(0, 100), industry: sp.industry, category: sp.category };
  const rows = await listExhibitors(db, viewerId, filters);
  const filtering = Object.values(filters).some(Boolean);
  return (
    <>
      <form method="get" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_200px_200px_auto]">
        <input type="hidden" name="tab" value="exhibitors" />
        <label className="relative">
          <span className="sr-only">Search exhibitors</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={filters.q} placeholder="Search companies and products" className={`${inputClass} pl-10`} />
        </label>
        <select name="industry" defaultValue={filters.industry ?? ""} className={inputClass} aria-label="Industry">
          <option value="">Industry: any</option>
          {INDUSTRIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={filters.category ?? ""} className={inputClass} aria-label="Category">
          <option value="">Category: any</option>
          {EXHIBITOR_CATEGORIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>
      {rows.some((r) => r.exhibitor.isDemo) && (
        <p className="mb-4 text-sm text-muted">Entries marked “Demo data” are fictional examples, not real Moonshot exhibitors.</p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<Building2 size={32} />} title={filtering ? "No exhibitors match" : "Exhibitor list coming soon"}>
          {filtering ? "Try a different search." : "We only list exhibitors once their details have been verified. Check back closer to the event."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ exhibitor: e, saved }) => (
            <li key={e.id}>
              <Card className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/explore/exhibitors/${e.id}`} className="font-semibold hover:underline">
                    {e.name}
                  </Link>
                  {e.isDemo && <DemoBadge />}
                </div>
                {e.tagline && <p className="mt-1 text-sm text-muted">{e.tagline}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{labelFor(EXHIBITOR_CATEGORIES, e.category)}</Badge>
                  {e.industry && <Badge>{labelFor(INDUSTRIES, e.industry)}</Badge>}
                  {e.boothLocation && e.boothVerified ? (
                    <Badge tone="success">
                      <MapPin size={12} aria-hidden /> Booth {e.boothLocation}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Booth TBC</Badge>
                  )}
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  <LinkButton href={`/explore/exhibitors/${e.id}`} size="sm" variant="secondary" className="flex-1">
                    Details
                  </LinkButton>
                  {viewerId && (
                    <ActionButton action={toggleExhibitorSaveAction.bind(null, e.id, !saved)} ariaLabel={saved ? `Unsave ${e.name}` : `Save ${e.name}`}>
                      {saved ? <BookmarkCheck size={16} className="text-accent" aria-hidden /> : <Bookmark size={16} aria-hidden />}
                      {saved ? "Saved" : "Save"}
                    </ActionButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function Meetups({ sp, viewer, db }: { sp: Record<string, string | undefined>; viewer: Awaited<ReturnType<typeof getViewer>>; db: Db }) {
  const topic = MEETUP_TOPICS.some((t) => t.value === sp.topic) ? sp.topic : undefined;
  const rows = await listMeetups(db, viewer?.user.id ?? null, { topic });
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/explore?tab=meetups" className={cx("rounded-full px-3 py-1 text-sm", !topic ? "bg-ink text-white" : "border border-line bg-white")}>
            All topics
          </Link>
          {MEETUP_TOPICS.filter((t) => t.value !== "other").map((t) => (
            <Link key={t.value} href={`/explore?tab=meetups&topic=${t.value}`} className={cx("rounded-full px-3 py-1 text-sm", topic === t.value ? "bg-ink text-white" : "border border-line bg-white")}>
              {t.label}
            </Link>
          ))}
        </div>
        {viewer?.profile && (
          <LinkButton href="/explore/meetups/new" size="sm">
            <Plus size={16} aria-hidden /> Propose a meetup
          </LinkButton>
        )}
      </div>
      {!viewer && <p className="mb-4 text-sm text-muted">Sign in to see who&apos;s going, join meetups, or propose your own.</p>}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="No meetups yet"
          action={viewer?.profile ? <LinkButton href="/explore/meetups/new">Propose the first one</LinkButton> : <LinkButton href="/login?next=/explore?tab=meetups">Sign in to propose one</LinkButton>}
        >
          Meetups are informal conversations organised by attendees around shared topics.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map(({ meetup: m, organiser, count, joined }) => (
            <li key={m.id}>
              <Link href={`/explore/meetups/${m.id}`} className="block h-full">
                <Card className={cx("h-full p-4 transition-colors hover:border-accent/40", m.status === "proposed" && "border-dashed")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={m.status === "confirmed" ? "success" : "pending"}>{m.status === "confirmed" ? "Confirmed" : "Proposed"}</Badge>
                    <Badge tone="accent">{labelFor(MEETUP_TOPICS, m.topic)}</Badge>
                    {joined && <Badge tone="success">You&apos;re going</Badge>}
                  </div>
                  <p className="mt-2 font-semibold">{m.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Calendar size={14} aria-hidden /> {formatWhen(m.startsAt)}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    {m.location ? <MapPin size={14} aria-hidden /> : <Video size={14} aria-hidden />} {m.location ?? "Online"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Organised by {organiser.visibility === "public" || (viewer && organiser.visibility === "members") || organiser.userId === viewer?.user.id ? organiser.name : "a member"} · {count}/{m.capacity} spots taken
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
