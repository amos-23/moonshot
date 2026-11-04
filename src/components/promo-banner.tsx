import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import type { EventSpace } from "@/lib/db/schema";

// A featured ad (an event marked "Featured ad" in admin): the first card in the homepage list, the same size as
// the events, in its own colour. It links straight to its site; the homepage drops it once it has ended.

export function PromoCard({ event: e }: { event: EventSpace }) {
  // Tagged so the advertiser can see visits came from here.
  const href = e.url ? `${e.url}${e.url.includes("?") ? "&" : "?"}utm_source=eventconnect&utm_medium=featured&utm_campaign=homepage` : `/${e.slug}`;
  const color = e.brandColor ?? "#f6a821";
  const [when, time] = (e.dates ?? "").split(" · ");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener sponsored"
      data-track="promo_click"
      aria-label={`${e.name}${e.dates ? `, ${e.dates}` : ""}: learn more`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="relative block aspect-[16/9] overflow-hidden bg-[#0b0b0b] text-white">
        <span aria-hidden className="absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-90" style={{ background: color }} />
        {e.logo && (
          <span className="absolute right-4 top-4 rounded-xl px-2.5 py-2" style={{ background: e.logoBg ?? "#ffffff" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.logo} alt="" className="h-9 w-auto max-w-[150px] object-contain" />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink">Featured</span>
        <span className="absolute inset-x-0 bottom-0 p-4">
          <span className="block text-xl font-extrabold leading-tight">{e.name}</span>
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
        <span className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-ink transition group-hover:gap-2.5" style={{ background: color }}>
          Learn more <ArrowRight size={16} aria-hidden />
        </span>
      </span>
    </a>
  );
}
