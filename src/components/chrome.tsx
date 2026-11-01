import Link from "next/link";
import { UserRound } from "lucide-react";
import type { EventSpace, Phase } from "@/lib/events";
import { MOONSHOT_EVENT_ID } from "@/lib/db/schema";

/** Event Connect's mark: two linked rings (people meeting) on a dark tile. */
export function ConnectMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1e1f26" />
      <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="#e8502a" strokeWidth="3" />
      <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="#f6a821" strokeWidth="3" />
    </svg>
  );
}

/** Moonshot's own mark: a sunrise in its colours (used only inside the Moonshot event). */
export function SunriseMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#e8502a" />
      <circle cx="16" cy="24" r="11" fill="#f6a821" />
    </svg>
  );
}

/** The logo, then e.g. "EVENT CONNECT" or "MOONSHOT CONNECT". */
export function Wordmark({ label, compact, sunrise }: { label: string; compact?: boolean; sunrise?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {sunrise ? <SunriseMark /> : <ConnectMark />}
      <span className={`text-[15px] font-extrabold uppercase tracking-[0.12em] ${compact ? "hidden min-[440px]:inline" : ""}`}>
        {label} <span className="text-flame-700">Connect</span>
      </span>
    </span>
  );
}

const headerClass = "site-header sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur";

/** Signed out: a quiet "Sign in". Signed in: your initial, to your account. */
function AccountLink({ account, next }: { account: { email: string; name: string | null } | null; next: string }) {
  if (!account)
    return (
      <Link href={`/signin?next=${encodeURIComponent(next)}`} data-track="signin_header" className="px-1.5 text-sm font-semibold text-muted hover:text-ink">
        Sign in
      </Link>
    );
  const initial = (account.name || account.email).trim()[0]?.toUpperCase() ?? "•";
  return (
    <Link href="/account" aria-label="Your account" title={account.email} className="grid h-10 w-10 place-items-center rounded-full bg-sun text-sm font-extrabold text-ink ring-2 ring-white hover:bg-[#ffb93d]">
      {initial}
    </Link>
  );
}

export type HeaderAccount = { email: string; name: string | null } | null;

/** Header for the homepage, sign-up and admin: the platform, not one event. */
export function SiteHeader({ account }: { account: HeaderAccount }) {
  return (
    <header className={headerClass}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="Event Connect home">
          <Wordmark label="Event" />
        </Link>
        <div className="flex items-center gap-2">
          <AccountLink account={account} next="/" />
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
export function EventHeader({ event, phase, hasCard, account }: { event: EventSpace; phase: Phase; hasCard: boolean; account: HeaderAccount }) {
  const base = `/${event.slug}`;
  return (
    <header className={headerClass}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href={base} aria-label={`${event.short} Connect home`} className="min-w-0">
          <Wordmark label={event.short} compact sunrise={event.id === MOONSHOT_EVENT_ID} />
        </Link>
        <div className="flex items-center gap-2">
          <AccountLink account={account} next={base} />
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
