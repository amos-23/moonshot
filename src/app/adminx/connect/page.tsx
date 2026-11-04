import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminList, AdminSection, AdminShell, AdminTitle, StatTile } from "@/components/adminx/shell";
import { ReportRow } from "@/components/adminx/report-row";
import { ActionButton } from "@/components/client";
import { ImportSiteForm } from "@/components/forms";
import { Card } from "@/components/ui";
import { approveEventAction } from "@/lib/actions";
import { connectTotals, eventRows, latestActivity, openReports } from "@/lib/admin-data";
import { siteOrigin } from "@/lib/site";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Event Connect · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Event Connect's inbox: what needs an admin, first. Then quick adds, the numbers and what people did lately.
export default async function ConnectInbox() {
  const gate = await adminGate();
  if (gate) return gate;
  const db = await getDb();
  const [events, reports, totals, activity, origin] = await Promise.all([eventRows(db), openReports(db), connectTotals(db), latestActivity(db), siteOrigin()]);
  const waiting = events.filter((e) => e.status === "waiting");
  const owners = waiting.some((e) => e.ownerId) ? new Map((await db.select({ id: schema.accounts.id, email: schema.accounts.email }).from(schema.accounts).where(inArray(schema.accounts.id, waiting.flatMap((e) => (e.ownerId ? [e.ownerId] : []))))).map((a) => [a.id, a.email])) : new Map<string, string>();
  // Events people can see now (live or coming up) that are missing details.
  const incomplete = events.filter((e) => (e.status === "live" || e.status === "before") && e.gaps.length > 0);
  const needs = reports.length + waiting.length + incomplete.length;

  return (
    <AdminShell project="connect" section="inbox" badges={{ inbox: reports.length + waiting.length, moderation: reports.length, events: waiting.length }}>
      <AdminTitle title="Event Connect" sub="events.latars.xyz" />

      <div className="space-y-8">
        <AdminSection title={needs ? `Needs you · ${needs}` : "Needs you"} note={needs ? "Reports, events waiting for approval, and live or upcoming events missing details." : undefined}>
          {needs === 0 ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-6 text-center text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">All clear. Nothing needs you right now. 🎉</p>
          ) : (
            <div className="space-y-4">
              {reports.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Reports</h3>
                  <AdminList count={reports.length} empty="" tone="alert">
                    {reports.slice(0, 5).map((r) => (
                      <ReportRow key={r.id} report={r} />
                    ))}
                  </AdminList>
                  {reports.length > 5 && (
                    <Link href="/adminx/connect/moderation" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-flame-700 hover:underline">
                      All {reports.length} reports <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </div>
              )}
              {waiting.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Waiting for approval</h3>
                  <AdminList count={waiting.length} empty="">
                    {waiting.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <span className="min-w-0 flex-1">
                          <Link href={`/adminx/connect/events/${e.slug}`} className="font-semibold hover:underline">
                            {e.name}
                          </Link>
                          <span className="block text-muted">
                            {[e.dates, e.venue, e.ownerId ? `created by ${owners.get(e.ownerId) ?? "an organiser"}` : "added by an admin", timeAgo(e.createdAt)].filter(Boolean).join(" · ")}
                          </span>
                          {e.gaps.length > 0 && <span className="text-xs font-semibold text-amber-700">Missing: {e.gaps.join(", ")}</span>}
                        </span>
                        <Link href={`/adminx/connect/events/${e.slug}?tab=details`} className="text-sm font-semibold text-muted hover:text-ink">
                          Review
                        </Link>
                        <ActionButton action={approveEventAction.bind(null, e.id)} variant="secondary">
                          Approve
                        </ActionButton>
                      </li>
                    ))}
                  </AdminList>
                </div>
              )}
              {incomplete.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Missing details</h3>
                  <AdminList count={incomplete.length} empty="">
                    {incomplete.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold">{e.name}</span>
                          <span className="block text-amber-700">No {e.gaps.join(", ")}</span>
                        </span>
                        <Link href={`/adminx/connect/events/${e.slug}?tab=details`} className="inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink/40">
                          Fix
                        </Link>
                      </li>
                    ))}
                  </AdminList>
                </div>
              )}
            </div>
          )}
        </AdminSection>

        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">＋ Add an event from its website</h2>
          <p className="mb-3 text-sm text-muted">Paste the event&apos;s site: its name, dates, venue, logo and colour are read from the page. It waits for approval above so you can check it first.</p>
          <ImportSiteForm id="site-home" />
          <p className="mt-3 text-sm text-muted">
            No website?{" "}
            <Link href="/adminx/connect/events#new" className="font-semibold text-ink underline-offset-4 hover:underline">
              Add one by hand
            </Link>
            . To add moments, open the event.
          </p>
        </Card>

        <AdminSection title="All events">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="People" value={totals.people} hint="cards" href="/adminx/connect/events" />
            <StatTile label="Moments" value={totals.moments} />
            <StatTile label="Here now" value={totals.here} hint="Meet up check-ins" />
            <StatTile label="Visits" value={totals.views30} hint="last 30 days" href="/adminx/connect/stats" />
            <StatTile label="Comments" value={totals.comments} />
            <StatTile label="Open reports" value={reports.length} href="/adminx/connect/moderation" alert={reports.length > 0} />
            <StatTile label="Accounts" value={totals.accounts} href="/adminx/connect/people" />
            <StatTile label="Mailing list" value={totals.mailing} href="/adminx/connect/people" />
          </div>
        </AdminSection>

        <AdminSection title="Latest activity">
          <AdminList count={activity.length} empty="Nothing yet.">
            {activity.map((a, i) => (
              <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                <span aria-hidden className="w-5 shrink-0 text-center">
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <a href={`${origin}/${a.slug}`} target="_blank" rel="noopener" className="block truncate font-medium hover:underline">
                    {a.text}
                  </a>
                  {a.sub && <span className="block truncate text-xs text-muted">{a.sub}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</span>
              </li>
            ))}
          </AdminList>
        </AdminSection>
      </div>
    </AdminShell>
  );
}
