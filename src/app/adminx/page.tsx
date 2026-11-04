import Link from "next/link";
import { ArrowRight, Megaphone, Sparkles } from "lucide-react";
import { getDb } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminShell, AdminTitle, StatTile } from "@/components/adminx/shell";
import { adsAdminStats } from "@/lib/ads-admin";
import { connectTotals, eventRows, openReports } from "@/lib/admin-data";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// The one admin for everything on latars.xyz. Each project has its own space; this page shows both at a glance.
export default async function AdminHome() {
  const gate = await adminGate();
  if (gate) return gate;
  const db = await getDb();
  const [events, reports, totals, ads] = await Promise.all([eventRows(db), openReports(db), connectTotals(db), adsAdminStats(db)]);
  const waiting = events.filter((e) => e.status === "waiting").length;
  const needs = reports.length + waiting;
  const live = events.filter((e) => e.status === "live").length;
  const upcoming = events.filter((e) => e.status === "before").length;

  const Project = ({ href, icon: Icon, name, site, note, children }: { href: string; icon: typeof Sparkles; name: string; site: string; note: React.ReactNode; children: React.ReactNode }) => (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-sun">
            <Icon size={18} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">{name}</h2>
            <p className="text-sm text-muted">{site}</p>
          </div>
        </div>
        <Link href={href} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black">
          Open <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      {note}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </section>
  );

  return (
    <AdminShell project="home" section="home">
      <AdminTitle title="Admin" sub="Everything on latars.xyz. Pick a project." />
      <div className="space-y-5">
        <Project
          href="/adminx/connect"
          icon={Sparkles}
          name="Event Connect"
          site="events.latars.xyz"
          note={
            needs > 0 ? (
              <Link href="/adminx/connect" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-100">
                <span>
                  {[reports.length && `${reports.length} report${reports.length === 1 ? "" : "s"}`, waiting && `${waiting} event${waiting === 1 ? "" : "s"} waiting for approval`].filter(Boolean).join(" · ")}
                </span>
                <ArrowRight size={16} aria-hidden />
              </Link>
            ) : (
              <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Nothing needs you right now.</p>
            )
          }
        >
          <StatTile label="Happening now" value={live} href="/adminx/connect/events?status=live" />
          <StatTile label="Upcoming events" value={upcoming} href="/adminx/connect/events?status=before" />
          <StatTile label="People" value={totals.people} hint="cards, all events" />
          <StatTile label="Visits" value={totals.views30} hint="last 30 days" href="/adminx/connect/stats" />
        </Project>
        <Project href="/adminx/ads" icon={Megaphone} name="AdsSim" site="ads.latars.xyz" note={null}>
          <StatTile label="Sign-ups" value={ads.users} />
          <StatTile label="New this week" value={ads.newUsers7} />
          <StatTile label="With saved progress" value={ads.withProgress} />
          <StatTile label="Visitors" value={ads.visitors30} hint="last 30 days" />
        </Project>
      </div>
    </AdminShell>
  );
}
