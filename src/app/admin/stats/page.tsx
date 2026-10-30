import Link from "next/link";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/me";
import { siteStats } from "@/lib/stats";
import { AdminLogin } from "@/components/forms";
import { Card, PageTitle, cx } from "@/components/ui";

export const metadata = { title: "Stats", robots: { index: false } };

const RANGES = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

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
  meet_header: "📍 Meet up (header)",
  meet_hero: "Meet someone now (home)",
  meet_chip: "Around now (home)",
  meet_mycard: "Meet up (My card)",
  meet_after_signup: "Meet up (after sign-up)",
  checkin: "Checked in",
  checkin_contact: "Contacted someone on Meet up",
  checkin_end: "I've left",
  admin_post_moment: "Admin added a moment",
  filter_x: "Filter: From X",
  sort_match: "View: For you",
  sort_new: "View: Newest",
  photo_pick: "Picked a photo",
  post_moment: "Post a moment",
  moments_header: "📸 Moments (header)",
  moments_see_all: "Moments: see all (home)",
  moments_strip: "Moments strip (home)",
  moment_person: "Moment → person (follow up)",
  highlights_tile: "Highlights: opened a photo (home)",
  highlights_all: "Highlights: see all (home)",
  highlights_add: "Highlights: add yours (home)",
  highlights_empty: "Highlights: share yours (home, empty)",
  search_hero: "Find (home search)",
  signup_header: "Sign up (header)",
  signup_submit: "Sign up (submitted)",
  moments_strip_add: "Moments: add yours (home)",
  moments_empty_cta: "Moments: be the first (home)",
  moment_photo: "Opened a moment photo",
  moment_author: "Moment → author's card",
  post_update: "Saved a card photo",
  update_header: "📸 Update (header)",
  update_mycard: "Card photo (My card)",
  update_after_signup: "Card photo (after sign-up)",
};

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-3xl font-extrabold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-sm font-semibold">{label}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function Ranked({ title, rows, empty }: { title: string; rows: { label: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{r.label}</span>
                <span className="font-semibold tabular-nums">{r.n.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-canvas" aria-hidden>
                <div className="h-full rounded-full bg-flame-700" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
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
  const days = RANGES.some((r) => String(r.days) === d) ? Number(d) : 7;
  const st = await siteStats(await getDb(), days);
  const max = Math.max(1, ...st.series.map((x) => x.views));
  const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <PageTitle
        title="Stats"
        sub="Visits and clicks on the public site (admin pages and bots aren't counted)."
        action={
          <Link href="/admin" className="text-sm font-semibold text-flame-700 hover:underline">
            ← Admin
          </Link>
        }
      />
      <nav aria-label="Time range" className="flex gap-2">
        {RANGES.map((r) => (
          <Link key={r.days} href={`/admin/stats?days=${r.days}`} aria-current={r.days === days ? "page" : undefined} className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", r.days === days ? "bg-ink text-white" : "border border-line bg-white")}>
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Visits" value={st.totals.views} sub="page views" />
        <Tile label="Visitors" value={st.totals.visitors} sub={days > 1 ? "unique per day, added up" : "unique"} />
        <Tile label="Clicks" value={st.totals.clicks} sub="buttons people pressed" />
        <Tile label="Searches" value={st.totals.searches} sub={`${st.emptySearches.reduce((a, r) => a + r.n, 0)} found nothing`} />
        <Tile label="Moments" value={st.added.moments} sub={`${st.added.momentPhotos} with photos`} />
        <Tile label="New cards" value={st.added.cards} sub={`${st.added.posts} X post${st.added.posts === 1 ? "" : "s"} · ${st.added.comments} comment${st.added.comments === 1 ? "" : "s"} · ${st.added.signups} sign-up${st.added.signups === 1 ? "" : "s"}`} />
      </div>

      <Card className="p-5">
        <h2 className="font-bold">From visit to connection</h2>
        <p className="text-sm text-muted">How many visitors take each step. Contacting someone is the goal.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Visited", n: st.totals.visitors },
            { label: "Opened the form", n: st.funnel.formVisitors },
            { label: "Made a card", n: st.added.cards },
            { label: "Contacted someone", n: st.funnel.contacters, sub: `${st.funnel.contactClicks} contact clicks` },
          ].map((step, i) => (
            <li key={step.label} className="rounded-2xl bg-canvas p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Step {i + 1}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{step.n.toLocaleString()}</p>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="text-xs text-muted">
                {i === 0 ? "unique visitors" : `${st.totals.visitors ? Math.min(100, Math.round((step.n / st.totals.visitors) * 100)) : 0}% of visitors`}
                {step.sub ? ` · ${step.sub}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      {days > 1 && (
        <Card className="p-5">
          <h2 className="font-bold">Visits per day</h2>
          <div className="mt-4 flex h-40 items-end gap-0.5" role="img" aria-label={`Visits per day for the last ${days} days`}>
            {st.series.map((x) => (
              <div key={x.day} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
                <div className="w-full max-w-6 rounded-t bg-flame-700 group-hover:bg-flame group-focus:bg-flame" style={{ height: `${Math.max((x.views / max) * 100, x.views ? 2 : 0)}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block group-focus:block">
                  {fmtDay(x.day)}: {x.views} visits · {x.visitors} visitors
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{fmtDay(st.series[0].day)}</span>
            <span>{fmtDay(st.series[st.series.length - 1].day)}</span>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Show as table</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Day</th>
                  <th className="py-1 text-right font-medium">Visits</th>
                  <th className="py-1 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {st.series.map((x) => (
                  <tr key={x.day} className="border-t border-line">
                    <td className="py-1">{fmtDay(x.day)}</td>
                    <td className="py-1 text-right tabular-nums">{x.views}</td>
                    <td className="py-1 text-right tabular-nums">{x.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Ranked title="Clicks by button" rows={st.clicks.map((c) => ({ label: CLICK_LABELS[c.key ?? ""] ?? c.key ?? "", n: c.n }))} empty="No clicks yet." />
        <Ranked title="Most-clicked people & posts" rows={st.topTargets.map((t) => ({ label: t.name ?? "(removed)", n: t.n }))} empty="No clicks on cards yet." />
        <Ranked title="Top searches" rows={st.searches.map((r) => ({ label: `“${r.key}”${r.results === 0 ? " · no results" : ""}`, n: r.n }))} empty="No searches yet." />
        <Ranked title="Searches that found nothing" rows={st.emptySearches.map((r) => ({ label: `“${r.key}”`, n: r.n }))} empty="Every search found someone." />
        <Ranked title="Top pages" rows={st.pages.map((p) => ({ label: p.key ?? "", n: p.n }))} empty="No visits yet." />
        <Ranked title="Where visitors came from" rows={st.referrers.map((r) => ({ label: r.key ?? "", n: r.n }))} empty="No referring sites yet (direct visits aren't listed)." />
      </div>
    </div>
  );
}
