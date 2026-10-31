import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { eventPhase, listEvents, type EventSpace, type Phase } from "@/lib/events";
import { Notice, Sunburst, cx } from "@/components/ui";

export const metadata = { title: "Event Connect — meet the right people at events, and relive the moments" };

const PHASE: Record<Phase, { label: string; className: string }> = {
  before: { label: "Coming up", className: "bg-sun-100 text-[#7a4b00]" },
  live: { label: "Happening now", className: "bg-emerald-100 text-emerald-800" },
  after: { label: "Past event", className: "bg-black/5 text-muted" },
};

/** People, moments and a cover photo for each event. */
async function eventStats(ids: string[]) {
  const db = await getDb();
  if (!ids.length) return new Map<string, { people: number; moments: number; cover: string | null }>();
  const [people, moments, covers] = await Promise.all([
    db.select({ id: schema.people.eventId, n: sql<number>`count(*)::int` }).from(schema.people).where(and(inArray(schema.people.eventId, ids), eq(schema.people.hidden, false))).groupBy(schema.people.eventId),
    db.select({ id: schema.moments.eventId, n: sql<number>`count(*)::int` }).from(schema.moments).where(and(inArray(schema.moments.eventId, ids), eq(schema.moments.hidden, false))).groupBy(schema.moments.eventId),
    // The newest photo moment per event (an uploaded photo, else an image from an X post).
    db
      .selectDistinctOn([schema.moments.eventId], { id: schema.moments.eventId, momentId: schema.moments.id, uploaded: schema.moments.hasPhoto, xMedia: schema.moments.xMedia })
      .from(schema.moments)
      .where(and(inArray(schema.moments.eventId, ids), eq(schema.moments.hidden, false), sql`(${schema.moments.hasPhoto} or cardinality(${schema.moments.xMedia}) > 0)`))
      .orderBy(schema.moments.eventId, desc(schema.moments.createdAt)),
  ]);
  const out = new Map<string, { people: number; moments: number; cover: string | null }>();
  for (const id of ids) out.set(id, { people: 0, moments: 0, cover: null });
  for (const r of people) out.get(r.id)!.people = r.n;
  for (const r of moments) out.get(r.id)!.moments = r.n;
  for (const r of covers) out.get(r.id)!.cover = r.uploaded ? `/moment-photo/${r.momentId}` : (r.xMedia[0] ?? null);
  return out;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ bad?: string }> }) {
  const { bad } = await searchParams;
  const events = await listEvents(await getDb());
  const stats = await eventStats(events.map((e) => e.id));
  // Happening now first, then what's coming, then past events (each in the order set in admin).
  const rank: Record<Phase, number> = { live: 0, before: 1, after: 2 };
  const sorted = [...events].sort((a, b) => rank[eventPhase(a)] - rank[eventPhase(b)] || a.position - b.position);

  return (
    <div>
      <section className="relative overflow-hidden bg-flame text-white">
        <Sunburst className="absolute inset-x-0 bottom-0 h-full w-full" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.25em]">Event Connect</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">Meet the right people at events</h1>
          <p className="mx-auto mt-4 max-w-lg font-medium">Find who&apos;s going, reach them directly, and relive the moments afterwards. No sign-up.</p>
          <a href="#events" className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-semibold text-white hover:bg-black">
            Pick your event <ArrowRight size={18} aria-hidden />
          </a>
        </div>
      </section>

      <section id="events" aria-labelledby="events-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        {/* An edit link that didn't match a card lands here. */}
        {bad && (
          <div className="mb-6">
            <Notice tone="danger">That edit link isn&apos;t valid. Pick your event below and add yourself again if you need to.</Notice>
          </div>
        )}
        <h2 id="events-h" className="mb-5 text-lg font-extrabold uppercase">Events</h2>
        {sorted.length === 0 ? (
          <p className="text-muted">No events yet.</p>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((e) => (
              <li key={e.id}>
                <EventCard event={e} phase={eventPhase(e)} stats={stats.get(e.id)!} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventCard({ event: e, phase, stats }: { event: EventSpace; phase: Phase; stats: { people: number; moments: number; cover: string | null } }) {
  const base = `/${e.slug}`;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={base} className="relative block aspect-[16/9] overflow-hidden bg-gradient-to-br from-flame to-sun" data-track="hub_event" aria-label={`${e.name}: Connect`}>
        {stats.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stats.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover object-[center_30%]" />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className={cx("absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold", PHASE[phase].className)}>{PHASE[phase].label}</span>
        <span className="absolute inset-x-0 bottom-0 p-4 text-white">
          <span className="block text-xl font-extrabold leading-tight [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]">{e.name}</span>
          {e.tagline && <span className="mt-0.5 line-clamp-1 block text-sm text-white/85">{e.tagline}</span>}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1 text-sm text-muted">
          {e.dates && (
            <p className="flex items-center gap-1.5">
              <CalendarDays size={15} aria-hidden /> {e.dates}
            </p>
          )}
          {e.venue && (
            <p className="flex items-start gap-1.5">
              <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden /> {e.venue}
            </p>
          )}
        </div>
        <p className="text-sm">
          <span className="font-semibold">{stats.people.toLocaleString()}</span> <span className="text-muted">{stats.people === 1 ? "person" : "people"}</span>
          <span className="text-muted"> · </span>
          <span className="font-semibold">{stats.moments.toLocaleString()}</span> <span className="text-muted">{stats.moments === 1 ? "moment" : "moments"}</span>
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Link href={base} data-track="hub_connect" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-semibold text-white hover:bg-black">
            {phase === "after" ? "Find people" : "Connect"}
          </Link>
          <Link href={`${base}/moments`} data-track="hub_moments" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-flame-700 text-sm font-semibold text-white hover:bg-flame">
            📸 Moments
          </Link>
        </div>
      </div>
    </article>
  );
}
