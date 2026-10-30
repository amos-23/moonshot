import Link from "next/link";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { RANGES, siteStats, type Range, type Totals } from "@/lib/stats";
import { AdminLogin } from "@/components/forms";
import { Card, PageTitle, cx } from "@/components/ui";

export const metadata = { title: "Stats", robots: { index: false } };

const CLICK_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp button",
  x_profile: "X profile button",
  linkedin: "LinkedIn button",
  email: "Email button",
  website: "Website button",
  view_post: "View post (X)",
  view_post_image: "Tapped an X post's image",
  comment: "Post comment",
  add_me: "Add me (card)",
  add_x_post: "Add X post",
  save_card: "Save card",
  add_yourself_header: "Add yourself (header)",
  add_yourself_hero: "Add yourself (home)",
  share_card_x: "Share my card on X",
  share_card_whatsapp: "Share my card on WhatsApp",
  share_card_copy: "Copy my card link",
  invite_x: "Invite (not found) on X",
  invite_whatsapp: "Invite (not found) on WhatsApp",
  invite_copy: "Invite (not found) copy link",
  filter_investors: "Filter: Investors",
  filter_hiring: "Filter: Hiring",
  filter_founders: "Filter: Founders",
  filter_engineers: "Filter: Engineers",
  filter_marketing: "Filter: Marketing",
  filter_design: "Filter: Design",
  filter_x: "Filter: From X",
  sort_match: "View: For you",
  sort_new: "View: Newest",
  search_hero: "Find (home search)",
  meet_header: "📍 Meet up (header)",
  meet_hero: "Meet someone now (home)",
  meet_chip: "Around now (home)",
  meet_mycard: "Meet up (My card)",
  meet_after_signup: "Meet up (after sign-up)",
  checkin: "Checked in",
  checkin_contact: "Contacted someone on Meet up",
  checkin_end: "I've left",
  photo_pick: "Picked a photo",
  post_moment: "Posted a moment",
  moments_header: "📸 Moments (header)",
  moments_see_all: "Moments: see all (home)",
  moments_strip: "Moments strip (home)",
  moments_strip_add: "Moments: add yours (home)",
  moments_empty_cta: "Moments: be the first (home)",
  moments_share_open: "Add your moment (Moments)",
  moments_share_fab: "Add your moment (floating +)",
  moment_open: "Opened a moment (wall)",
  moments_featured: "Opened Featured",
  moments_strip_open: "Opened a moment (film strip)",
  moment_browse: "Swiped to the next moment",
  video_play: "Played a video",
  gif_play: "Played a GIF",
  moment_photo: "Opened a moment photo",
  moment_author: "Moment → author's card",
  moment_person: "Moment → person (follow up)",
  moment_x_open: "Moment → View on X",
  highlights_tile: "Highlights: opened a photo (home)",
  highlights_all: "Highlights: see all (home)",
  highlights_add: "Highlights: add yours (home)",
  highlights_empty: "Highlights: share yours (home, empty)",
  signup_header: "Sign up (header)",
  signup_submit: "Sign up (submitted)",
  post_update: "Saved a card photo",
  update_header: "📸 Update (header)",
  update_mycard: "Card photo (My card)",
  update_after_signup: "Card photo (after sign-up)",
};

const DEVICE_LABELS: Record<string, string> = { mobile: "📱 Phone", tablet: "📲 Tablet", desktop: "💻 Computer" };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
function duration(ms: number) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}m ${sec % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Change against the period before, e.g. "▲ 12%". */
function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  if (!before) return now ? <span className="text-xs font-semibold text-emerald-700">new</span> : null;
  const d = (now - before) / before;
  if (Math.abs(d) < 0.005) return <span className="text-xs text-muted">±0%</span>;
  return (
    <span className={cx("text-xs font-semibold", d > 0 ? "text-emerald-700" : "text-red-700")} title={`Before: ${before.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(Math.round(d * 100))}%
    </span>
  );
}

function Tile({ label, value, sub, now, before }: { label: string; value: string; sub?: string; now: number; before?: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
        <Delta now={now} before={before} />
      </div>
      <p className="text-sm font-semibold">{label}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

type Row = { label: string; n: number; value?: string; note?: string };
function Ranked({ title, hint, rows, empty, show = 8 }: { title: string; hint?: string; rows: Row[]; empty: string; show?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const item = (r: Row, i: number) => (
    <li key={`${r.label}-${i}`} className="text-sm">
      <div className="flex justify-between gap-3">
        <span className="truncate">{r.label}</span>
        <span className="shrink-0 font-semibold tabular-nums">
          {r.value ?? r.n.toLocaleString()}
          {r.note && <span className="ml-1 font-normal text-muted">{r.note}</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-canvas" aria-hidden>
        <div className="h-full rounded-full bg-flame-700" style={{ width: `${(r.n / max) * 100}%` }} />
      </div>
    </li>
  );
  return (
    <Card className="p-5">
      <h2 className="font-bold">{title}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">{rows.slice(0, show).map(item)}</ul>
          {rows.length > show && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-muted">Show all {rows.length}</summary>
              <ul className="mt-2 space-y-2">{rows.slice(show).map((r, i) => item(r, i + show))}</ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function Funnel({ title, sub, steps, base }: { title: string; sub: string; steps: { label: string; n: number; sub?: string }[]; base: number }) {
  return (
    <Card className="p-5">
      <h2 className="font-bold">{title}</h2>
      <p className="text-sm text-muted">{sub}</p>
      <ol className="mt-4 grid grid-cols-2 gap-3">
        {steps.map((step, i) => (
          <li key={step.label} className="rounded-2xl bg-canvas p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Step {i + 1}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{step.n.toLocaleString()}</p>
            <p className="text-sm font-semibold">{step.label}</p>
            <p className="text-xs text-muted">
              {i === 0 ? "unique visitors" : `${base ? pct(Math.min(1, step.n / base)) : "0%"} of step 1`}
              {step.sub ? ` · ${step.sub}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <PageTitle title="Admin" />
        <AdminLogin />
      </div>
    );
  }
  const { days: d } = await searchParams;
  const days = (RANGES.find((r) => String(r.days) === d)?.days ?? 7) as Range;
  const st = await siteStats(await getDb(), days);
  const t = st.totals;
  const p: Partial<Totals> = st.prev ?? {};
  const max = Math.max(1, ...st.chart.map((x) => x.views));
  const maxHour = Math.max(1, ...st.hours.map((h) => h.n));
  const fmtKey = (k: string) =>
    st.hourly ? `${k.slice(11)}:00` : new Date(`${k}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const rangeLabel = RANGES.find((r) => r.days === days)!.label.toLowerCase();
  const compare = days ? `vs the ${rangeLabel} before` : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageTitle
        title="Stats"
        sub="Visits and clicks on the public site. Admin pages and bots aren't counted; nothing identifies a person."
        action={
          <div className="flex items-center gap-4 text-sm font-semibold">
            <a href={`/admin/stats.csv?days=${days}`} className="text-flame-700 hover:underline">
              Download CSV
            </a>
            <Link href="/admin" className="text-flame-700 hover:underline">
              ← Admin
            </Link>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Time range" className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link key={r.days} href={`/admin/stats?days=${r.days}`} aria-current={r.days === days ? "page" : undefined} className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", r.days === days ? "bg-ink text-white" : "border border-line bg-white")}>
              {r.label}
            </Link>
          ))}
        </nav>
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {st.live} on the site now
        </p>
      </div>
      {compare && <p className="-mt-3 text-xs text-muted">Arrows compare with the {rangeLabel} before.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Visitors" value={t.visitors.toLocaleString()} sub={days === 1 ? "unique" : "unique per day, added up"} now={t.visitors} before={p.visitors} />
        <Tile label="Visits" value={t.views.toLocaleString()} sub="page views" now={t.views} before={p.views} />
        <Tile label="Contacted someone" value={t.contacters.toLocaleString()} sub={`${pct(t.contactRate)} of visitors · ${plural(t.contactClicks, "click")}`} now={t.contacters} before={p.contacters} />
        <Tile label="Avg. time on site" value={t.timedVisitors ? duration(t.avgTimeMs) : "—"} sub={t.timedVisitors ? `measured for ${plural(t.timedVisitors, "visitor")}` : "measured from now on"} now={t.avgTimeMs} before={p.timedVisitors ? p.avgTimeMs : undefined} />
        <Tile label="Pages per visitor" value={t.pagesPerVisitor.toFixed(1)} now={t.pagesPerVisitor} before={p.pagesPerVisitor} />
        <Tile label="Returning visitors" value={t.visitors ? pct(t.returning / t.visitors) : "—"} sub={`${t.returning.toLocaleString()} had been here before`} now={t.returning} before={p.returning} />
        <Tile label="Clicks" value={t.clicks.toLocaleString()} sub="buttons people pressed" now={t.clicks} before={p.clicks} />
        <Tile label="Searches" value={t.searches.toLocaleString()} sub={`${st.emptySearches.reduce((a, r) => a + r.n, 0)} found nothing`} now={t.searches} before={p.searches} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">{st.hourly ? "Visits per hour (Lagos time)" : "Visits per day"}</h2>
          <p className="flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-flame-700" /> visits
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-sun" /> visitors
            </span>
          </p>
        </div>
        <div className="mt-4 flex h-44 items-end gap-px" role="img" aria-label={`${st.hourly ? "Visits per hour" : "Visits per day"}, ${rangeLabel}`}>
          {st.chart.map((x) => (
            <div key={x.key} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
              <div className="relative w-full max-w-7 rounded-t bg-flame-700 group-hover:bg-flame group-focus:bg-flame" style={{ height: `${Math.max((x.views / max) * 100, x.views ? 2 : 0)}%` }}>
                <div className="absolute inset-x-[25%] bottom-0 rounded-t bg-sun" style={{ height: `${x.views ? (x.visitors / x.views) * 100 : 0}%` }} />
              </div>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block group-focus:block">
                {fmtKey(x.key)}: {x.views} visits · {x.visitors} visitors
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{fmtKey(st.chart[0].key)}</span>
          <span>{fmtKey(st.chart[st.chart.length - 1].key)}</span>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Show as table</summary>
          <div className="max-h-72 overflow-y-auto">
            <table className="mt-2 w-full text-left">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">{st.hourly ? "Hour" : "Day"}</th>
                  <th className="py-1 text-right font-medium">Visits</th>
                  <th className="py-1 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {[...st.chart].reverse().map((x) => (
                  <tr key={x.key} className="border-t border-line">
                    <td className="py-1">{fmtKey(x.key)}</td>
                    <td className="py-1 text-right tabular-nums">{x.views}</td>
                    <td className="py-1 text-right tabular-nums">{x.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Funnel
          title="From visit to connection"
          sub="How many visitors take each step. Contacting someone is the goal."
          base={st.funnel.visitors}
          steps={[
            { label: "Visited", n: st.funnel.visitors },
            { label: "Opened the form", n: st.funnel.formVisitors },
            { label: "Made a card", n: st.funnel.cards },
            { label: "Contacted someone", n: st.funnel.contacters, sub: plural(st.funnel.contactClicks, "click") },
          ]}
        />
        <Funnel
          title="📸 Moments"
          sub={`What people do on Moments.${st.momentFunnel.avgMs ? ` Avg. time there: ${duration(st.momentFunnel.avgMs)}.` : ""} ${plural(st.momentFunnel.plays, "video play")}.`}
          base={st.momentFunnel.visitors}
          steps={[
            { label: "Visited Moments", n: st.momentFunnel.visitors },
            { label: "Opened a moment", n: st.momentFunnel.openers, sub: plural(st.momentFunnel.opens, "open") },
            { label: "Followed up with someone", n: st.momentFunnel.followUps },
            { label: "Went to the post on X", n: st.momentFunnel.toX },
          ]}
        />
      </div>

      <Card className="p-5">
        <h2 className="font-bold">Top moments</h2>
        <p className="text-xs text-muted">Most opened in this period, with what people did next.</p>
        {st.topMoments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No moments opened yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Moment</th>
                  <th className="py-1 text-right font-medium">Opens</th>
                  <th className="py-1 text-right font-medium">Plays</th>
                  <th className="py-1 text-right font-medium">Follow-ups</th>
                  <th className="py-1 text-right font-medium">❤ on X</th>
                </tr>
              </thead>
              <tbody>
                {st.topMoments.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="max-w-0 py-1.5 pr-3">
                      <a href={`/moments#m-${m.id}`} className="block truncate hover:underline" target="_blank" rel="noopener">
                        <span className="font-semibold">{m.who}</span> <span className="text-muted">— {m.text}</span>
                      </a>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{m.opens}</td>
                    <td className="py-1.5 text-right tabular-nums">{m.plays || "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{m.followUps || "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{m.likes ? m.likes.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Ranked title="Devices" rows={st.devices.map((r) => ({ label: DEVICE_LABELS[r.key] ?? r.key, n: r.n }))} empty="Measured from now on." />
        <Ranked
          title="Campaign links"
          hint="Add ?utm_source=x&utm_campaign=recap (or ?ref=…) to links you share, to see which ones bring people."
          rows={st.campaigns.map((r) => ({ label: r.key, n: r.n }))}
          empty="No campaign links used yet."
        />
        <Ranked title="Where visitors came from" rows={st.referrers.map((r) => ({ label: r.key, n: r.n }))} empty="No referring sites yet (direct visits aren't listed)." />
        <Ranked title="Top pages" rows={st.pages.map((r) => ({ label: r.key, n: r.n }))} empty="No visits yet." />
        <Ranked title="Time on page" hint="Average per visitor, counting only time the page was on screen." rows={st.timeByPage.map((r) => ({ label: r.key ?? "", n: r.avgMs, value: duration(r.avgMs), note: `· ${plural(r.visitors, "visitor")}` }))} empty="Measured from now on." />
        <Card className="p-5">
          <h2 className="font-bold">Busiest hours (Lagos time)</h2>
          <div className="mt-4 flex h-28 items-end gap-0.5" role="img" aria-label="Visits by hour of day">
            {st.hours.map((h) => (
              <div key={h.hour} className="group relative flex h-full flex-1 items-end" tabIndex={0}>
                <div className="w-full rounded-t bg-sun group-hover:bg-flame" style={{ height: `${Math.max((h.n / maxHour) * 100, h.n ? 3 : 0)}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block group-focus:block">
                  {String(h.hour).padStart(2, "0")}:00 · {h.n} visits
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </Card>
        <Ranked title="Clicks by button" rows={st.clicks.map((c) => ({ label: CLICK_LABELS[c.key] ?? c.key, n: c.n }))} empty="No clicks yet." />
        <Ranked title="Most-clicked people, posts & moments" rows={st.topTargets.map((r) => ({ label: r.name ?? "(removed)", n: r.n }))} empty="No clicks on cards yet." />
        <Ranked title="Top searches" rows={st.searches.map((r) => ({ label: `“${r.key}”${r.results === 0 ? " · no results" : ""}`, n: r.n }))} empty="No searches yet." />
        <Ranked title="Searches that found nothing" hint="Often people who haven't added themselves yet: worth inviting." rows={st.emptySearches.map((r) => ({ label: `“${r.key}”`, n: r.n }))} empty="Every search found someone." />
      </div>

      <Card className="p-5">
        <h2 className="font-bold">What&apos;s on the site</h2>
        <p className="text-xs text-muted">Added {days ? `in the last ${rangeLabel}` : "so far"}, and the total.</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Cards", st.added.cards, st.allTime.cards],
            ["X cards", st.added.posts, st.allTime.posts],
            ["Moments", st.added.moments, st.allTime.moments],
            ["Photo moments", st.added.momentPhotos, st.allTime.momentPhotos],
            ["Comments", st.added.comments, st.allTime.comments],
            ["Sign-ups", st.added.signups, st.allTime.signups],
          ].map(([label, n, total]) => (
            <div key={label} className="rounded-2xl bg-canvas p-4">
              <dt className="text-sm font-semibold">{label}</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums">{(total as number).toLocaleString()}</dd>
              {days ? <dd className="text-xs text-muted">+{(n as number).toLocaleString()} in this period</dd> : null}
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
