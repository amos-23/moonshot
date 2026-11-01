import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { eventPhase, listEvents, type EventSpace, type Phase } from "@/lib/events";
import { Notice, cx } from "@/components/ui";
import { ConnectMark } from "@/components/chrome";

/** A cover colour for events without photos yet, different per event (picked from its address). */
const COVERS = ["from-[#2a1d4a] to-[#e8502a]", "from-[#0f3d3e] to-[#f6a821]", "from-[#1e1f26] to-[#7a5cff]", "from-[#3b0d2c] to-[#ff7a45]", "from-[#0b2a4a] to-[#2fb7a6]"];
const coverTone = (slug: string) => COVERS[[...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % COVERS.length];

/**
 * The hero's backdrop: people as dots, joined where they connect, drifting slowly (still for
 * people who prefer reduced motion). Fixed positions, so it looks the same on every load.
 */
function Constellation() {
  const pts = [
    [8, 22], [18, 60], [27, 30], [36, 78], [44, 14], [52, 52], [61, 24], [70, 70], [78, 36], [88, 18], [94, 62], [12, 86], [56, 88], [83, 86], [30, 50], [66, 46],
  ];
  const links = [[0, 2], [2, 4], [2, 14], [14, 1], [1, 11], [14, 5], [5, 6], [6, 4], [5, 15], [15, 8], [8, 9], [8, 10], [15, 7], [7, 13], [5, 12], [12, 3], [3, 1], [10, 13], [6, 8]];
  const tone = (i: number) => (i % 3 === 0 ? "#e8502a" : i % 3 === 1 ? "#f6a821" : "#ffffff");
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="ec-glow" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor="#e8502a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#121116" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#ec-glow)" />
        {links.map(([a, b], i) => (
          <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {/* Dots as their own elements so they stay round at any width. */}
      {pts.map(([x, y], i) => (
        <span
          key={i}
          className="constellation-dot absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, background: tone(i), opacity: tone(i) === "#ffffff" ? 0.5 : 0.9, boxShadow: `0 0 12px ${tone(i)}`, animationDelay: `${(i % 7) * 0.6}s` }}
        />
      ))}
    </div>
  );
}

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
      <section className="relative overflow-hidden bg-[#121116] text-white">
        <Constellation />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-white/80 ring-1 ring-white/15">
            <ConnectMark size={18} /> Event Connect
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Meet the right people{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] via-flame to-sun bg-clip-text text-transparent">at events</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-white/75">Find who&apos;s going, reach them directly, and relive the moments afterwards.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#events" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink hover:bg-white/90">
              Pick your event <ArrowRight size={18} aria-hidden />
            </a>
          </div>
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
      <Link href={base} className={cx("relative block aspect-[16/9] overflow-hidden bg-gradient-to-br", coverTone(e.slug))} data-track="hub_event" aria-label={`${e.name}: Connect`}>
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
