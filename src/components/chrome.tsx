import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Settings, UserRound } from "lucide-react";
import type { EventSpace, Phase } from "@/lib/events";

export { ConnectMark, SunriseMark } from "./chrome-marks";
import { ConnectMark, SunriseMark } from "./chrome-marks";
import { EventWordmark } from "./event-brand";
import { eventTheme } from "@/lib/theme";
import { cx } from "./ui";

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
/** Signed out: "Sign up" (most people are new), with a quiet "Sign in" beside it on wider screens. Signed in: your initial. */
function AccountLink({ account, next }: { account: { email: string; name: string | null } | null; next: string }) {
  if (!account)
    return (
      <span className="inline-flex items-center gap-1">
        <Link href={`/signin?next=${encodeURIComponent(next)}`} data-track="signin_header" className="hidden px-2 text-sm font-semibold text-muted hover:text-ink md:inline">
          Sign in
        </Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} data-track="signup_header" className="inline-flex h-10 items-center whitespace-nowrap rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-ink hover:border-ink/40">
          Sign up
        </Link>
      </span>
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
export function EventHeader({ event, phase, hasCard, account, manage = false }: { event: EventSpace; phase: Phase; hasCard: boolean; account: HeaderAccount; manage?: boolean }) {
  const base = `/${event.slug}`;
  const t = eventTheme(event);
  const pill = "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-ink shadow-sm hover:border-ink/40";
  return (
    <header className={headerClass}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href={base} aria-label={`${event.short} Connect home`} className="min-w-0">
          <EventWordmark event={event} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <AccountLink account={account} next={base} />
          </span>
          {phase === "live" && (
            <Link href={`${base}/meet`} data-track="meet_header" style={{ background: t.meetBtn[0], color: t.meetBtn[1] }} className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold hover:opacity-90">
              📍 Meet up
            </Link>
          )}
          <Link href={`${base}/moments`} data-track="moments_header" style={{ background: t.momentsBtn[0], color: t.momentsBtn[1] }} className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold hover:opacity-90">
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
      <nav aria-label="Event links" className="border-t border-line/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
          <Link href="/" data-track="all_events" className={pill}>
            <ArrowLeft size={16} aria-hidden /> All events
          </Link>
          <span className="flex min-w-0 items-center gap-2">
            {manage && (
              <Link href={`${base}/manage`} data-track="manage_event" aria-label="Manage event" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-black">
                <Settings size={15} aria-hidden /> <span className="hidden sm:inline">Manage</span>
              </Link>
            )}
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" data-track="official_site" className={cx(pill, "min-w-0")}>
                <span className="truncate">
                  <span className="hidden sm:inline">{event.short} </span>Official site
                </span>
                <ArrowUpRight size={16} aria-hidden className="shrink-0" />
              </a>
            )}
            <Link href={account ? "/account" : `/signup?next=${encodeURIComponent(base)}`} data-track={account ? "account_header" : "signup_header"} aria-label={account ? "Your account" : undefined} className="shrink-0 px-1 text-sm font-semibold text-ink hover:underline sm:hidden">
              {account ? "Account" : "Sign up"}
            </Link>
          </span>
        </div>
      </nav>
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
