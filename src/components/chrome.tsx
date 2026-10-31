import Link from "next/link";
import { UserRound } from "lucide-react";
import type { EventSpace, Phase } from "@/lib/events";

/** The logo: a sunrise in Moonshot colours, then e.g. "MOONSHOT CONNECT" or "EVENT CONNECT". */
export function Wordmark({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#e8502a" />
        <circle cx="16" cy="24" r="11" fill="#f6a821" />
      </svg>
      <span className={`text-[15px] font-extrabold uppercase tracking-[0.12em] ${compact ? "hidden min-[440px]:inline" : ""}`}>
        {label} <span className="text-flame-700">Connect</span>
      </span>
    </span>
  );
}

const headerClass = "site-header sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur";

function SignUpLink({ signedUp, eventSlug }: { signedUp: boolean; eventSlug?: string }) {
  if (signedUp) return null;
  return (
    <Link href={eventSlug ? `/signup?e=${eventSlug}` : "/signup"} data-track="signup_header" className="px-1.5 text-sm font-semibold text-muted hover:text-ink">
      Sign up
    </Link>
  );
}

/** Header for the homepage, sign-up and admin: the platform, not one event. */
export function SiteHeader({ signedUp }: { signedUp: boolean }) {
  return (
    <header className={headerClass}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="Event Connect home">
          <Wordmark label="Event" />
        </Link>
        <div className="flex items-center gap-2">
          <SignUpLink signedUp={signedUp} />
          <Link href="/#events" className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black">
            Events
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
      <p className="border-t border-line pt-6">Event Connect is an independent, community-made tool for finding the people worth meeting at events, and the moments that made them. It isn&apos;t run or endorsed by the events listed here.</p>
    </footer>
  );
}

/** Header inside an event: that event's Connect (people), Moments, Meet up while it's on, and your card. */
export function EventHeader({ event, phase, hasCard, signedUp }: { event: EventSpace; phase: Phase; hasCard: boolean; signedUp: boolean }) {
  const base = `/${event.slug}`;
  return (
    <header className={headerClass}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href={base} aria-label={`${event.short} Connect home`} className="min-w-0">
          <Wordmark label={event.short} compact />
        </Link>
        <div className="flex items-center gap-2">
          <SignUpLink signedUp={signedUp} eventSlug={event.slug} />
          {phase === "live" && (
            <Link href={`${base}/meet`} data-track="meet_header" className="inline-flex h-10 items-center rounded-full bg-sun px-3.5 text-sm font-semibold text-ink hover:bg-[#ffb93d]">
              📍 Meet up
            </Link>
          )}
          <Link href={`${base}/moments`} data-track="moments_header" className="inline-flex h-10 items-center rounded-full bg-flame-700 px-3.5 text-sm font-semibold text-white hover:bg-flame">
            📸 Moments
          </Link>
          <Link
            href={`${base}/card`}
            data-track="add_yourself_header"
            aria-label={hasCard ? "My card" : "Add yourself"}
            title={hasCard ? "My card" : "Add yourself"}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-sm font-semibold text-white hover:bg-black"
          >
            <UserRound size={18} aria-hidden />
            <span className="hidden sm:inline">{hasCard ? "My card" : "Add yourself"}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function EventFooter({ event }: { event: EventSpace }) {
  const host = event.url ? event.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : null;
  return (
    <footer className="site-footer mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
      <p className="border-t border-line pt-6">
        {event.short} Connect is an independent, community-made tool. It isn&apos;t run or endorsed by {event.organiser ?? `the ${event.name} organisers`}.
        {event.url && host && (
          <>
            {" "}
            For tickets, schedule and official info visit{" "}
            <a className="underline" href={event.url} target="_blank" rel="noopener noreferrer">
              {host}
            </a>
            .
          </>
        )}{" "}
        <Link href="/" className="underline">
          Other events
        </Link>
      </p>
    </footer>
  );
}
