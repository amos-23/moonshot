import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminList, AdminSearch, AdminSection, AdminShell, StatTile } from "@/components/adminx/shell";
import { ModRow } from "@/components/adminx/rows";
import { StatusChip } from "@/components/adminx/status-chip";
import { ActionButton } from "@/components/client";
import { AdminMomentForm, EventForm, ImportForm, TopAccountsForm } from "@/components/forms";
import { momentWho } from "@/components/moment";
import { Card, Notice, Tag, cx } from "@/components/ui";
import { approveEventAction } from "@/lib/actions";
import { eventRows, openReports } from "@/lib/admin-data";
import { getTopAccounts, pickFeatured } from "@/lib/featured";
import { siteOrigin } from "@/lib/site";
import { formatTime, timeAgo } from "@/lib/time";

export const metadata = { title: "Event · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "moments", label: "Moments" },
  { id: "people", label: "People" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// One event: how it's doing, its details (with the form), its Moments (Featured too) and its people.
export default async function EventAdmin({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; q?: string; added?: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.find((t) => t.id === sp.tab)?.id ?? "overview";
  const db = await getDb();
  const [rows, reports, origin] = await Promise.all([eventRows(db), openReports(db), siteOrigin()]);
  const event = rows.find((e) => e.slug === slug);
  if (!event) notFound();
  const waitingCount = rows.filter((e) => e.status === "waiting").length;
  const needle = (sp.q ?? "").trim().toLowerCase();
  const match = (...parts: (string | null | undefined)[]) => !needle || parts.some((x) => x?.toLowerCase().includes(needle));
  const base = `/adminx/connect/events/${event.slug}`;
  const publicUrl = `${origin}/${event.slug}`;
  const eventReports = reports.filter((r) => r.eventSlug === event.slug);

  const tabBar = (
    <nav aria-label="Event sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <Link key={t.id} href={t.id === "overview" ? base : `${base}?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined} className={cx("-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold", tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );

  let body: React.ReactNode = null;

  if (tab === "overview") {
    body = (
      <div className="space-y-6">
        {event.status === "waiting" && (
          <Card className="flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4">
            <p className="min-w-0 flex-1 text-sm">
              <b>Waiting for approval.</b> It works at its own link but isn&apos;t on the homepage yet. {event.gaps.length > 0 && <>Missing: {event.gaps.join(", ")}.</>}
            </p>
            <Link href={`${base}?tab=details`} className="text-sm font-semibold text-muted hover:text-ink">
              Edit details
            </Link>
            <ActionButton action={approveEventAction.bind(null, event.id)} variant="dark">
              Approve
            </ActionButton>
          </Card>
        )}
        {event.status !== "waiting" && event.gaps.length > 0 && (
          <Notice tone="warn">
            Missing: {event.gaps.join(", ")}.{" "}
            <Link href={`${base}?tab=details`} className="font-semibold underline">
              Add them
            </Link>
          </Notice>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="People" value={event.people} href={`${base}?tab=people`} />
          <StatTile label="Visits" value={event.visits} />
          <StatTile label="Moments" value={event.moments} href={`${base}?tab=moments`} />
          <StatTile label="Open reports" value={eventReports.length} href="/adminx/connect/moderation" alert={eventReports.length > 0} />
        </div>
        <Card className="space-y-1 p-5 text-sm">
          {[
            ["Address", publicUrl],
            ["Dates", event.dates],
            ["Venue", event.venue],
            ["Organiser", event.organiser],
            ["Website", event.url],
            ["Hashtag", event.hashtag],
          ].map(([k, v]) => (
            <p key={k} className="flex gap-3">
              <span className="w-24 shrink-0 text-muted">{k}</span>
              <span className={cx("min-w-0 break-words", !v && "text-amber-700")}>{v ?? "Not set"}</span>
            </p>
          ))}
        </Card>
      </div>
    );
  }

  if (tab === "details") {
    body = (
      <Card className="p-5 sm:p-6">
        <EventForm event={event} />
      </Card>
    );
  }

  if (tab === "moments") {
    const [moments, featured, topAccounts] = await Promise.all([
      db.select().from(schema.moments).where(eq(schema.moments.eventId, event.id)).orderBy(desc(schema.moments.createdAt)).limit(300),
      pickFeatured(db, event.id),
      getTopAccounts(db, event.id),
    ]);
    const people = new Map((await db.select({ id: schema.people.id, name: schema.people.name }).from(schema.people).where(eq(schema.people.eventId, event.id))).map((p) => [p.id, p.name]));
    const who = (m: (typeof moments)[number]) => (m.xPostUrl ? (m.xAuthorName ?? `@${m.xAuthorHandle}`) : (m.name ?? (m.xHandle ? `@${m.xHandle}` : m.personId ? (people.get(m.personId) ?? "Card holder") : "Anonymous")));
    const text = (m: (typeof moments)[number]) => m.body || m.xText || "";
    const shown = moments.filter((m) => match(who(m), text(m), m.place, m.xAuthorHandle));
    body = (
      <div className="space-y-6">
        {sp.added && <Notice tone="success">Moment added.</Notice>}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">📸 Add moments</h2>
          <p className="mb-3 text-sm text-muted">Paste an X post link (a recap, photos, a highlight) and it&apos;s added straight away. Keep pasting: one after another, or many at once.</p>
          <AdminMomentForm event={event.slug} />
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">★ Featured on Moments</h2>
          {featured ? (
            <p className="mt-1 text-sm">
              <span className="font-semibold">Now: {momentWho(featured.item)}</span>
              <span className="text-muted"> — “{(featured.item.moment.body || featured.item.moment.xText || "photo").slice(0, 80)}” · </span>
              {featured.reason === "pinned" ? (
                <span className="font-semibold text-flame-700">pinned by you (unpin it in the list below)</span>
              ) : (
                <span className="text-muted">auto: rotates every 30 minutes among the top {featured.candidates} by likes, replies and opens (anything added in the last 48 hours counts double)</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Nothing yet. Featured picks from moments with a photo.</p>
          )}
          <div className="mt-4">
            <TopAccountsForm current={topAccounts.map((h) => `@${h}`).join(" ")} event={event.slug} />
          </div>
        </Card>
        <AdminSection title={`Moments · ${moments.length}`} note="Moments hide themselves after 3 reports. Unhide here if a report was wrong." action={<AdminSearch action={base} params={{ tab: "moments" }} placeholder="Search moments" value={sp.q} />}>
          <AdminList count={shown.length} empty={needle ? `Nothing matches “${sp.q}”.` : "No moments yet."}>
            {shown.map((m) => (
              <ModRow
                key={m.id}
                kind="moment"
                id={m.id}
                title={who(m)}
                sub={`${m.xPostUrl ? `𝕏 ❤ ${m.xLikes} · 💬 ${m.xReplies}${m.xVideo ? " · ▶ video" : ""} · ` : ""}${text(m).slice(0, 120)}${m.place ? ` · 📍 ${m.place}` : ""} · ${timeAgo(m.createdAt)}`}
                hidden={m.hidden}
                photo={m.hasPhoto ? `/admin/moment-photo/${m.id}` : (m.xMedia[0] ?? null)}
                featured={!!m.featuredAt}
                canFeature
              />
            ))}
          </AdminList>
        </AdminSection>
      </div>
    );
  }

  if (tab === "people") {
    const [people, posts, comments, checkins] = await Promise.all([
      db.select().from(schema.people).where(eq(schema.people.eventId, event.id)).orderBy(desc(schema.people.createdAt)).limit(500),
      db.select().from(schema.socialPosts).where(eq(schema.socialPosts.eventId, event.id)).orderBy(desc(schema.socialPosts.importedAt)).limit(500),
      db
        .select({ c: schema.comments, handle: schema.socialPosts.authorHandle })
        .from(schema.comments)
        .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
        .where(eq(schema.socialPosts.eventId, event.id))
        .orderBy(desc(schema.comments.createdAt))
        .limit(300),
      db
        .select()
        .from(schema.checkins)
        .where(sql`${schema.checkins.eventId} = ${event.id} and ${schema.checkins.endedAt} is null and ${schema.checkins.expiresAt} > now()`)
        .orderBy(desc(schema.checkins.createdAt))
        .limit(300),
    ]);
    const shownPeople = people.filter((p) => match(p.name, p.headline, p.company, p.xHandle, p.whereNote));
    const shownPosts = posts.filter((p) => match(p.authorHandle, p.authorName, p.content));
    const shownComments = comments.filter(({ c }) => match(c.name, c.body));
    body = (
      <div className="space-y-8">
        <div className="sm:ml-auto sm:w-80">
          <AdminSearch action={base} params={{ tab: "people" }} placeholder="Search people, X cards, comments" value={sp.q} />
        </div>
        {checkins.length > 0 && (
          <AdminSection title={`Here now · ${checkins.length}`} note="Meet up check-ins. They hide themselves after 3 reports.">
            <AdminList count={checkins.length} empty="">
              {checkins.map((c) => (
                <ModRow key={c.id} kind="checkin" id={c.id} title={c.name} sub={`📍 ${c.place}${c.note ? ` · ${c.note}` : ""} · until ${formatTime(c.expiresAt)}`} hidden={c.hidden} />
              ))}
            </AdminList>
          </AdminSection>
        )}
        <AdminSection title={`Cards · ${people.length}`}>
          <AdminList count={shownPeople.length} empty={needle ? `Nothing matches “${sp.q}”.` : "No one has added themselves yet."}>
            {shownPeople.map((p) => (
              <ModRow
                key={p.id}
                kind="person"
                id={p.id}
                title={p.name}
                sub={`${p.headline} · ${timeAgo(p.createdAt)}${p.whereNote ? ` · 📍 ${p.whereNote}` : ""}`}
                hidden={p.hidden}
                photo={p.photoUpdatedAt ? `${origin}/photo/${p.id}?v=${p.photoUpdatedAt.getTime()}` : null}
                removablePhoto
                tags={p.accountId ? <Tag tone="green">account</Tag> : null}
              />
            ))}
          </AdminList>
        </AdminSection>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Add people from X posts</h2>
          <p className="mb-3 text-sm text-muted">Each post becomes a “From X” card in the list.</p>
          <ImportForm event={event.slug} />
        </Card>
        <AdminSection title={`X cards · ${posts.length}`}>
          <AdminList count={shownPosts.length} empty={needle ? `Nothing matches “${sp.q}”.` : "No X cards yet."}>
            {shownPosts.map((p) => (
              <ModRow key={p.id} kind="post" id={p.id} title={`@${p.authorHandle}`} sub={p.content?.slice(0, 120) ?? ""} hidden={p.hidden} />
            ))}
          </AdminList>
        </AdminSection>
        <AdminSection title={`Comments · ${comments.length}`}>
          <AdminList count={shownComments.length} empty={needle ? `Nothing matches “${sp.q}”.` : "No comments yet."}>
            {shownComments.map(({ c, handle }) => (
              <ModRow key={c.id} kind="comment" id={c.id} title={c.name} sub={`on @${handle}: ${c.body.slice(0, 120)}`} hidden={c.hidden} />
            ))}
          </AdminList>
        </AdminSection>
      </div>
    );
  }

  return (
    <AdminShell project="connect" section="events" badges={{ inbox: reports.length + waitingCount, moderation: reports.length, events: waitingCount }}>
      <Link href="/adminx/connect/events" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> All events
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {event.name} <StatusChip status={event.status} />
          </h1>
          <p className="mt-1 text-sm text-muted">{[event.dates, event.venue].filter(Boolean).join(" · ") || `/${event.slug}`}</p>
        </div>
        <a href={publicUrl} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink/40">
          View page <ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
      {tabBar}
      {body}
    </AdminShell>
  );
}
