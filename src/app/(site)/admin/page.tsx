import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { removePhotoAction, resolveReportAction, setFeaturedAction, setHiddenAction } from "@/lib/actions";
import { formatTime, timeAgo } from "@/lib/time";
import { AdminMomentForm, EventForm, ImportForm, TopAccountsForm } from "@/components/forms";
import { listEvents } from "@/lib/events";
import { momentWho } from "@/components/moment";
import { getTopAccounts, pickFeatured } from "@/lib/featured";
import { ActionButton } from "@/components/client";
import { Card, Notice, Tag, cx, inputClass } from "@/components/ui";
import { ADMIN_TABS, AdminNav, adminHref, type AdminTab } from "@/components/admin-nav";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    moment?: string;
    event?: string;
    tab?: string;
    q?: string;
  }>;
}) {
  const { moment, event: slug, tab: tabParam, q: query } = await searchParams;
  const tab: AdminTab = (ADMIN_TABS.find((t) => t.id === tabParam)?.id ?? "home") as AdminTab;
  const needle = (query ?? "").trim().toLowerCase();
  const match = (...parts: (string | null | undefined)[]) => !needle || parts.some((x) => x?.toLowerCase().includes(needle));
  const gate = await adminGate();
  if (gate) return gate;
  const db = await getDb();
  // Everything below is for one event at a time (pick it at the top); reports and sign-ups are site-wide.
  const events = await listEvents(db, { includeHidden: true });
  const event = events.find((e) => e.slug === slug) ?? events.find((e) => e.slug === "moonshot") ?? events[0];
  const [reports, people, posts, comments, momentRows, liveCheckins, signups, featured, topAccounts, accountRows] = await Promise.all([
    db.select().from(schema.reports).where(eq(schema.reports.resolved, false)).orderBy(desc(schema.reports.createdAt)).limit(100),
    db.select().from(schema.people).where(eq(schema.people.eventId, event.id)).orderBy(desc(schema.people.createdAt)).limit(500),
    db.select().from(schema.socialPosts).where(eq(schema.socialPosts.eventId, event.id)).orderBy(desc(schema.socialPosts.importedAt)).limit(500),
    db
      .select({ c: schema.comments })
      .from(schema.comments)
      .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
      .where(eq(schema.socialPosts.eventId, event.id))
      .orderBy(desc(schema.comments.createdAt))
      .limit(300)
      .then((r) => r.map((x) => x.c)),
    db.select().from(schema.moments).where(eq(schema.moments.eventId, event.id)).orderBy(desc(schema.moments.createdAt)).limit(300),
    db
      .select()
      .from(schema.checkins)
      .where(sql`${schema.checkins.eventId} = ${event.id} and ${schema.checkins.endedAt} is null and ${schema.checkins.expiresAt} > now()`)
      .orderBy(desc(schema.checkins.createdAt))
      .limit(300),
    db.select().from(schema.signups).orderBy(desc(schema.signups.createdAt)),
    pickFeatured(db, event.id),
    getTopAccounts(db, event.id),
    db.select().from(schema.accounts).orderBy(desc(schema.accounts.createdAt)).limit(200),
  ]);
  const label = new Map<string, string>([
    ...people.map((p) => [p.id, p.name] as const),
    ...posts.map((p) => [p.id, `@${p.authorHandle}`] as const),
    ...comments.map((c) => [c.id, `Comment by ${c.name}: “${c.body.slice(0, 60)}”`] as const),
    ...momentRows.map((m) => [m.id, `Moment: “${(m.body || m.xText || "photo").slice(0, 60)}”`] as const),
    ...liveCheckins.map((c) => [c.id, `Check-in: ${c.name} at ${c.place}`] as const),
  ]);

  const Row = ({
    kind,
    id,
    title,
    sub,
    hidden,
    photo,
    extra,
  }: {
    kind: "person" | "post" | "comment" | "moment" | "checkin";
    id: string;
    title: string;
    sub: string;
    hidden: boolean;
    photo?: string | null;
    extra?: React.ReactNode;
  }) => (
    <li className={cx("flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:flex-nowrap", hidden && "bg-canvas/70")}>
      {photo ? (
        <a href={photo} target="_blank" rel="noopener" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-11 w-11 rounded-xl object-cover" loading="lazy" />
        </a>
      ) : (
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-canvas text-base font-bold text-muted">
          {title.replace(/^@/, "").charAt(0).toUpperCase() || "·"}
        </span>
      )}
      <span className={cx("min-w-0 flex-1", hidden && "opacity-60")}>
        <span className="block truncate font-semibold">{title}</span>
        <span className="line-clamp-2 text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {hidden && <Tag>hidden</Tag>}
        {extra}
        {photo && kind === "person" && (
          <ActionButton action={removePhotoAction.bind(null, id)} variant="ghost" confirm="Remove this photo?">
            Remove photo
          </ActionButton>
        )}
        <ActionButton action={setHiddenAction.bind(null, kind, id, !hidden)} variant={hidden ? "secondary" : "danger"}>
          {hidden ? "Unhide" : "Hide"}
        </ActionButton>
      </span>
    </li>
  );
  const List = ({ children, empty, count }: { children: React.ReactNode; empty: string; count: number }) =>
    count === 0 ? (
      <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{needle ? `Nothing matches “${query}”.` : empty}</p>
    ) : (
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</ul>
    );
  const Section = ({ title, note, action, children, id }: { title: string; note?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string }) => (
    <section id={id} className="scroll-mt-28">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {note && <p className="text-sm text-muted">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
  const Search = ({ placeholder }: { placeholder: string }) => (
    <form action="/admin" className="flex gap-2">
      <input type="hidden" name="event" value={event.slug} />
      <input type="hidden" name="tab" value={tab} />
      <label htmlFor="admin-q" className="sr-only">
        Search
      </label>
      <input id="admin-q" name="q" type="search" defaultValue={query} placeholder={placeholder} className={cx(inputClass, "py-2")} />
      {needle && (
        <Link href={adminHref(tab, event.slug)} className="inline-flex items-center rounded-full px-3 text-sm font-semibold text-muted hover:text-ink">
          Clear
        </Link>
      )}
    </form>
  );

  const momentTitle = (m: (typeof momentRows)[number]) =>
    m.xPostUrl ? (m.xAuthorName ?? `@${m.xAuthorHandle}`) : (m.name ?? (m.xHandle ? `@${m.xHandle}` : m.personId ? (label.get(m.personId) ?? "Card holder") : "Anonymous"));
  const momentText = (m: (typeof momentRows)[number]) => m.body || m.xText || "";
  const shownPeople = people.filter((p) => match(p.name, p.headline, p.company, p.xHandle, p.whereNote));
  const shownMoments = momentRows.filter((m) => match(momentTitle(m), momentText(m), m.place, m.xAuthorHandle));
  const shownPosts = posts.filter((p) => match(p.authorHandle, p.authorName, p.content));
  const shownComments = comments.filter((c) => match(c.name, c.body));
  const shownAccounts = accountRows.filter((a) => match(a.name, a.email));
  const shownSignups = signups.filter((u) => match(u.name, u.email, u.about));
  const openReports = reports.length;

  const tiles: {
    label: string;
    value: number;
    tab: AdminTab;
    hint?: string;
    alert?: boolean;
  }[] = [
    {
      label: "Cards",
      value: people.filter((p) => !p.hidden).length,
      tab: "people",
    },
    {
      label: "From X cards",
      value: posts.filter((p) => !p.hidden).length,
      tab: "people",
    },
    {
      label: "Moments",
      value: momentRows.filter((m) => !m.hidden).length,
      tab: "moments",
    },
    {
      label: "Comments",
      value: comments.filter((c) => !c.hidden).length,
      tab: "people",
    },
    {
      label: "Here now",
      value: liveCheckins.filter((c) => !c.hidden).length,
      tab: "people",
      hint: "Meet up check-ins",
    },
    {
      label: "Open reports",
      value: openReports,
      tab: "home",
      alert: openReports > 0,
    },
    {
      label: "Accounts",
      value: accountRows.length,
      tab: "accounts",
      hint: "all events",
    },
    {
      label: "Mailing list",
      value: signups.length,
      tab: "accounts",
      hint: "all events",
    },
  ];
  const activity = [
    ...people.map((p) => ({
      at: p.createdAt,
      icon: "🪪",
      text: `${p.name} added a card`,
      sub: p.headline,
    })),
    ...momentRows.map((m) => ({
      at: m.createdAt,
      icon: m.xPostUrl ? "𝕏" : "📸",
      text: `${momentTitle(m)} ${m.xPostUrl ? "— X post added as a moment" : "posted a moment"}`,
      sub: momentText(m).slice(0, 90),
    })),
    ...comments.map((c) => ({
      at: c.createdAt,
      icon: "💬",
      text: `${c.name} commented`,
      sub: c.body.slice(0, 90),
    })),
    ...liveCheckins.map((c) => ({
      at: c.createdAt,
      icon: "📍",
      text: `${c.name} checked in`,
      sub: c.place,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  const featuredCard = (
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
  );

  return (
    <div>
      <AdminNav events={events} current={event} tab={tab} badges={{ home: openReports }} />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Admin · {event.short}</h1>
            <p className="mt-1 text-sm text-muted">
              {event.name}
              {event.dates ? ` · ${event.dates}` : ""}
              {event.venue ? ` · ${event.venue}` : ""}
            </p>
          </div>
          <Link href={`/${event.slug}`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink/40">
            View event ↗
          </Link>
        </div>

        {tab === "home" && (
          <>
            {moment && <Notice tone="success">Moment added.</Notice>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map((t) => (
                <Link
                  key={t.label}
                  href={adminHref(t.tab, event.slug, t.alert ? "#reports" : "")}
                  className={cx("rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm sm:rounded-3xl sm:p-4", t.alert ? "border-red-200 bg-red-50" : "border-line bg-surface")}
                >
                  <p className={cx("text-2xl font-extrabold tabular-nums sm:text-3xl", t.alert && "text-red-700")}>{t.value.toLocaleString()}</p>
                  <p className="text-sm font-semibold">{t.label}</p>
                  {t.hint && <p className="text-xs text-muted">{t.hint}</p>}
                </Link>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-bold">📸 Add moments</h2>
                <p className="mb-3 text-sm text-muted">Paste an X post link (a recap, photos, a highlight) and it&apos;s added straight away. Keep pasting: one after another, or many at once.</p>
                <AdminMomentForm event={event.slug} />
              </Card>
              <div>
                <h2 className="mb-3 text-lg font-bold">Latest activity</h2>
                {activity.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nothing yet for {event.short}.</p>
                ) : (
                  <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm">
                    {activity.map((a, i) => (
                      <li key={i} className="flex gap-3 px-4 py-2.5">
                        <span aria-hidden className="w-5 shrink-0 text-center">
                          {a.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.text}</span>
                          {a.sub && <span className="block truncate text-xs text-muted">{a.sub}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
            <Section id="reports" title={`Reports · ${openReports}`} note="From every event. Anything with 3 reports is already hidden.">
              {openReports === 0 ? (
                <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nothing to review. 🎉</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-red-200 bg-surface">
                  {reports.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <strong>{label.get(r.targetId) ?? r.targetType}</strong> — “{r.reason}” · <span className="text-muted">{timeAgo(r.createdAt)}</span>
                      </span>
                      <ActionButton
                        action={setHiddenAction.bind(
                          null,
                          (["post", "comment", "moment", "checkin"].includes(r.targetType) ? r.targetType : "person") as "post" | "comment" | "moment" | "checkin" | "person",
                          r.targetId,
                          true,
                        )}
                        variant="danger"
                      >
                        Hide
                      </ActionButton>
                      <ActionButton action={resolveReportAction.bind(null, r.id)} variant="ghost">
                        Dismiss
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}

        {tab === "moments" && (
          <>
            {featuredCard}
            <Section title={`Moments · ${momentRows.length}`} note="Moments hide automatically after 3 reports. Unhide here if a report was wrong." action={<Search placeholder="Search moments" />}>
              <List count={shownMoments.length} empty="No moments yet. Add some from the Overview.">
                {shownMoments.map((m) => (
                  <Row
                    key={m.id}
                    kind="moment"
                    id={m.id}
                    title={momentTitle(m)}
                    sub={`${m.xPostUrl ? `𝕏 ❤ ${m.xLikes} · 💬 ${m.xReplies}${m.xVideo ? " · ▶ video" : ""} · ` : ""}${momentText(m).slice(0, 120)}${m.place ? ` · 📍 ${m.place}` : ""} · ${timeAgo(m.createdAt)}`}
                    hidden={m.hidden}
                    photo={m.hasPhoto ? `/admin/moment-photo/${m.id}` : (m.xMedia[0] ?? null)}
                    extra={
                      m.hidden ? null : (
                        <>
                          {m.featuredAt && <Tag tone="sun">★ Featured</Tag>}
                          <ActionButton action={setFeaturedAction.bind(null, m.id, !m.featuredAt)} variant={m.featuredAt ? "secondary" : "ghost"}>
                            {m.featuredAt ? "Unpin" : "Feature this"}
                          </ActionButton>
                        </>
                      )
                    }
                  />
                ))}
              </List>
            </Section>
          </>
        )}

        {tab === "people" && (
          <>
            <div className="flex justify-end">
              <div className="w-full sm:w-80">
                <Search placeholder="Search people, posts, comments" />
              </div>
            </div>
            <Section title="Meet up check-ins (live)" note="Check-ins hide automatically after 3 reports.">
              <List count={liveCheckins.length} empty="No one is checked in right now.">
                {liveCheckins.map((c) => (
                  <Row key={c.id} kind="checkin" id={c.id} title={c.name} sub={`📍 ${c.place}${c.note ? ` · ${c.note}` : ""} · until ${formatTime(c.expiresAt)}`} hidden={c.hidden} />
                ))}
              </List>
            </Section>
            <Section title={`Cards · ${people.length}`}>
              <List count={shownPeople.length} empty="No cards yet.">
                {shownPeople.map((p) => (
                  <Row
                    key={p.id}
                    kind="person"
                    id={p.id}
                    title={p.name}
                    sub={`${p.headline} · ${timeAgo(p.createdAt)}${p.whereNote ? ` · 📍 ${p.whereNote}` : ""}`}
                    hidden={p.hidden}
                    photo={p.photoUpdatedAt ? `/photo/${p.id}?v=${p.photoUpdatedAt.getTime()}` : null}
                    extra={p.accountId ? <Tag tone="green">account</Tag> : null}
                  />
                ))}
              </List>
            </Section>
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold">Add people from X posts</h2>
              <p className="mb-3 text-sm text-muted">Each post becomes a “From X” card in the People list.</p>
              <ImportForm event={event.slug} />
            </Card>
            <Section title={`Comments · ${comments.length}`}>
              <List count={shownComments.length} empty="No comments yet.">
                {shownComments.map((c) => (
                  <Row key={c.id} kind="comment" id={c.id} title={c.name} sub={`on ${label.get(c.postId) ?? "a post"}: ${c.body.slice(0, 120)}`} hidden={c.hidden} />
                ))}
              </List>
            </Section>
            <Section title={`X posts · ${posts.length}`}>
              <List count={shownPosts.length} empty="No X posts yet.">
                {shownPosts.map((p) => (
                  <Row key={p.id} kind="post" id={p.id} title={`@${p.authorHandle}`} sub={p.content?.slice(0, 120) ?? ""} hidden={p.hidden} />
                ))}
              </List>
            </Section>
          </>
        )}

        {tab === "accounts" && (
          <>
            <div className="flex justify-end">
              <div className="w-full sm:w-80">
                <Search placeholder="Search by name or email" />
              </div>
            </div>
            <Section title={`Accounts · ${accountRows.length}`} note="Everyone who has signed up, across all events.">
              <List count={shownAccounts.length} empty="No accounts yet.">
                {shownAccounts.slice(0, 100).map((a) => (
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
              </List>
            </Section>
            <Section
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
              <List count={shownSignups.length} empty="No sign-ups yet.">
                {shownSignups.slice(0, 100).map((u) => (
                  <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 break-all">
                      <span className="font-semibold">{u.name ?? "—"}</span> · {u.email}
                      {u.about && <span className="text-muted"> · {u.about}</span>}
                    </span>
                    <span className="text-xs text-muted">{timeAgo(u.createdAt)}</span>
                  </li>
                ))}
              </List>
              {shownSignups.length > 100 && <p className="mt-2 text-xs text-muted">Showing the latest 100. The CSV has everyone.</p>}
            </Section>
          </>
        )}

        {tab === "events" && (
          <Section
            id="events"
            title="Events"
            note={<>Each event has its own Connect (people) and Moments at its own address. Dates set what the event page shows: before (“Who&apos;s going”), during (Meet up) and after (“Find the people you met”).</>}
          >
            <div className="space-y-3">
              {events.map((e) => (
                <details key={e.id} className="rounded-3xl border border-line bg-surface p-4">
                  <summary className="cursor-pointer font-semibold">
                    {e.name}{" "}
                    <span className="font-normal text-muted">
                      · /{e.slug}
                      {e.hidden ? " · hidden" : ""}
                      {e.dates ? ` · ${e.dates}` : ""}
                    </span>
                  </summary>
                  <div className="mt-4">
                    <EventForm event={e} />
                  </div>
                </details>
              ))}
              <details className="rounded-3xl border border-dashed border-line p-4">
                <summary className="cursor-pointer font-semibold text-flame-700">＋ Add an event</summary>
                <div className="mt-4">
                  <EventForm event={null} />
                </div>
              </details>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
