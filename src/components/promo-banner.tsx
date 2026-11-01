import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import type { EventSpace } from "@/lib/db/schema";

// A featured ad at the top of the homepage (an event marked "promo" in admin). It wears the advertiser's own
// look and links straight to their site. The homepage stops showing it once the event has ended.

const oswald = { fontFamily: "Oswald, 'Arial Narrow', Impact, sans-serif" } as const;

export function PromoBanner({ event: e }: { event: EventSpace }) {
  // Tagged so the advertiser can see visits came from here.
  const href = e.url ? `${e.url}${e.url.includes("?") ? "&" : "?"}utm_source=eventconnect&utm_medium=featured&utm_campaign=homepage` : `/${e.slug}`;
  const yellow = e.brandColor ?? "#ffd84d";
  const [when, time] = (e.dates ?? "").split(" · ");
  const isWorkshop = e.slug === "growth-workshop";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener sponsored"
      data-track="promo_click"
      aria-label={`${e.name}${e.dates ? `, ${e.dates}` : ""}: reserve your spot`}
      className="group relative mb-8 block overflow-hidden rounded-3xl bg-[#0b0b0b] text-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* The workshop's magenta circles. */}
      <span aria-hidden className="absolute -right-12 -top-14 h-28 w-28 rounded-full bg-[#e0115f] sm:-right-16 sm:-top-20 sm:h-56 sm:w-56" />
      <span aria-hidden className="absolute -bottom-28 -left-24 hidden h-40 w-40 rounded-full bg-[#e0115f] sm:block" />
      <span className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/15">Featured</span>
      <div className="relative grid items-center gap-6 px-5 pb-6 pt-14 sm:grid-cols-[1fr_auto] sm:px-8 sm:py-8 sm:pt-14">
        <div className="min-w-0">
          <p className="inline-block border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ ...oswald, borderColor: yellow, color: yellow }}>
            {e.name}
          </p>
          {e.tagline && (
            <p className="mt-3 max-w-2xl text-3xl font-bold uppercase leading-[1.05] sm:text-4xl" style={oswald}>
              {isWorkshop ? (
                <>
                  If your marketing isn&apos;t driving{" "}
                  <span className="px-1 text-[#0b0b0b]" style={{ background: yellow }}>
                    revenue
                  </span>
                  , what exactly is it driving?
                </>
              ) : (
                e.tagline
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {when && (
              <span className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1">
                <CalendarDays size={14} aria-hidden style={{ color: yellow }} /> {when}
              </span>
            )}
            {(time || e.venue) && (
              <span className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1">
                <Clock size={14} aria-hidden style={{ color: yellow }} /> {[time, e.venue].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          <span className="mt-5 inline-flex h-12 items-center gap-2 rounded-md px-6 text-sm font-bold uppercase tracking-[0.12em] text-[#0b0b0b] transition group-hover:gap-3" style={{ ...oswald, background: yellow }}>
            Reserve your spot <ArrowRight size={16} aria-hidden />
          </span>
          {isWorkshop && (
            <p className="mt-3 text-sm text-white/70">
              Standard <b style={{ color: yellow }}>₦40,000</b> · Growth Intensive <b style={{ color: yellow }}>₦100,000</b>
            </p>
          )}
        </div>
        {isWorkshop && (
          <figure className="relative mx-auto hidden w-44 shrink-0 sm:block lg:w-52">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/growth-workshop-host.webp" alt="Amos Feranmi" className="aspect-[422/438] w-full object-cover" style={{ background: yellow }} loading="lazy" />
            <figcaption className="bg-white px-3 py-2 text-sm font-semibold uppercase tracking-wide text-[#0b0b0b]" style={oswald}>
              Amos Feranmi
            </figcaption>
          </figure>
        )}
      </div>
    </a>
  );
}
