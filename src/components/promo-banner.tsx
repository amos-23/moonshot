import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import type { EventSpace } from "@/lib/db/schema";

// A featured ad (an event marked "promo" in admin): the first card in the homepage list, the same size as the
// events, in the advertiser's own look. It links straight to their site; the homepage drops it once it has ended.

const oswald = { fontFamily: "Oswald, 'Arial Narrow', Impact, sans-serif" } as const;

export function PromoCard({ event: e }: { event: EventSpace }) {
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
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="relative block aspect-[16/9] overflow-hidden bg-[#0b0b0b] text-white">
        {/* The workshop's magenta circle. */}
        <span aria-hidden className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[#e0115f]" />
        {isWorkshop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brands/growth-workshop-host.webp" alt="" className="absolute bottom-0 right-4 h-[78%] w-auto object-contain" style={{ background: yellow }} loading="lazy" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink">Featured</span>
        <span className="absolute inset-x-0 bottom-0 p-4 pr-[42%]">
          <span className="block text-[22px] font-bold uppercase leading-[1.05]" style={oswald}>
            {isWorkshop ? (
              <>
                Growth &amp; <span className="px-0.5 text-[#0b0b0b]" style={{ background: yellow }}>Acquisition</span> Workshop
              </>
            ) : (
              e.name
            )}
          </span>
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-3 p-4">
        {e.tagline && <span className="line-clamp-2 text-sm font-medium">{e.tagline}</span>}
        <span className="space-y-1 text-sm text-muted">
          {when && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={15} aria-hidden /> {when}
            </span>
          )}
          {(time || e.venue) && (
            <span className="flex items-center gap-1.5">
              <Clock size={15} aria-hidden /> {[time, e.venue].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        <span className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold uppercase tracking-[0.1em] text-[#0b0b0b] transition group-hover:gap-2.5" style={{ ...oswald, background: yellow }}>
          Reserve your spot <ArrowRight size={16} aria-hidden />
        </span>
      </span>
    </a>
  );
}
