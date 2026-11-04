import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminSearch, AdminShell, AdminTitle } from "@/components/adminx/shell";
import { StatusChip } from "@/components/adminx/status-chip";
import { EventForm, ImportSiteForm } from "@/components/forms";
import { Card, cx } from "@/components/ui";
import { eventRows, openReports, type EventRow, type EventStatus } from "@/lib/admin-data";
import { eventTheme } from "@/lib/theme";

export const metadata = { title: "Events · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FILTERS: { id: "all" | EventStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Happening now" },
  { id: "before", label: "Upcoming" },
  { id: "waiting", label: "Waiting" },
  { id: "after", label: "Past" },
  { id: "featured", label: "Featured ads" },
  { id: "hidden", label: "Hidden" },
];
// Live first, then upcoming by date, then the rest; past events newest first.
const ORDER: Record<EventStatus, number> = { waiting: 0, live: 1, before: 2, featured: 3, after: 4, hidden: 5 };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

function Mark({ e }: { e: EventRow }) {
  if (e.logo)
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line" style={{ background: e.logoBg ?? "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.logo} alt="" className="max-h-8 max-w-9 object-contain" />
      </span>
    );
  const t = eventTheme(e);
  return (
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-extrabold" style={{ background: t.momentsBtn[0], color: t.momentsBtn[1] }}>
      {e.short.charAt(0).toUpperCase()}
    </span>
  );
}

export default async function EventsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const { status: s, q } = await searchParams;
  const filter = FILTERS.find((f) => f.id === s)?.id ?? "all";
  const db = await getDb();
  const [all, reports] = await Promise.all([eventRows(db), openReports(db)]);
  const needle = (q ?? "").trim().toLowerCase();
  const day = (e: EventRow) => e.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rows = all
    .filter((e) => filter === "all" || e.status === filter)
    .filter((e) => !needle || [e.name, e.short, e.slug, e.venue, e.organiser].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === "after" ? day(b) - day(a) : day(a) - day(b)));
  const count = (id: "all" | EventStatus) => (id === "all" ? all.length : all.filter((e) => e.status === id).length);
  const waiting = count("waiting");

  return (
    <AdminShell project="connect" section="events" badges={{ inbox: reports.length + waiting, moderation: reports.length, events: waiting }}>
      <AdminTitle title="Events" sub={`${all.length} events on Event Connect`} />
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="font-bold">＋ Add an event from its website</h2>
          <p className="mb-3 text-sm text-muted">Its details are read from the page; it waits for approval so you can check them.</p>
          <ImportSiteForm id="site-events" />
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Filter events" className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.filter((f) => f.id === "all" || count(f.id) > 0).map((f) => (
              <Link
                key={f.id}
                href={`/adminx/connect/events${f.id === "all" ? "" : `?status=${f.id}`}`}
                aria-current={filter === f.id ? "page" : undefined}
                className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold", filter === f.id ? "bg-ink text-white" : "border border-line bg-white hover:border-ink/40")}
              >
                {f.label} <span className={filter === f.id ? "text-white/60" : "text-muted"}>{count(f.id)}</span>
              </Link>
            ))}
          </nav>
          <div className="sm:w-72">
            <AdminSearch action="/adminx/connect/events" params={filter === "all" ? {} : { status: filter }} placeholder="Search events" value={q} />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{needle ? `No events match “${q}”.` : "No events here."}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {rows.map((e) => (
              <li key={e.id}>
                <Link href={`/adminx/connect/events/${e.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60">
                  <Mark e={e} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-semibold">{e.name}</span>
                      <StatusChip status={e.status} />
                    </span>
                    <span className="block truncate text-sm text-muted">{[e.dates, e.venue].filter(Boolean).join(" · ") || `/${e.slug}`}</span>
                    {e.gaps.length > 0 && e.status !== "after" && <span className="block text-xs font-semibold text-amber-700">Missing: {e.gaps.join(", ")}</span>}
                  </span>
                  <span className="hidden shrink-0 text-right text-sm sm:block">
                    <span className="block font-semibold tabular-nums">{plural(e.people, "person", "people")}</span>
                    <span className="block text-xs text-muted">
                      {plural(e.visits, "visit", "visits")} · {plural(e.moments, "moment", "moments")}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <details id="new" className="rounded-2xl border border-dashed border-line bg-surface p-4">
          <summary className="cursor-pointer font-semibold text-flame-700">＋ Add an event by hand</summary>
          <div className="mt-4">
            <EventForm event={null} />
          </div>
        </details>
      </div>
    </AdminShell>
  );
}
