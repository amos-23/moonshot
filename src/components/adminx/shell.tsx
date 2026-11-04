import Link from "next/link";
import { ArrowUpRight, BarChart3, CalendarDays, Home, Inbox, LogOut, Megaphone, ShieldAlert, Sparkles, Users } from "lucide-react";
import { adminLogoutAction } from "@/lib/actions";
import { cx } from "@/components/ui";

// The one admin (/adminx) for everything on latars.xyz. Two projects live in it: Event Connect (events.latars.xyz)
// and AdsSim (ads.latars.xyz). The sidebar switches project; each project has its own sections.

export type Project = "home" | "connect" | "ads";
export type Section = "home" | "inbox" | "events" | "moderation" | "people" | "stats" | "ads";

const PROJECTS: { id: Exclude<Project, "home">; label: string; site: string; href: string; icon: typeof Sparkles }[] = [
  { id: "connect", label: "Event Connect", site: "https://events.latars.xyz", href: "/adminx/connect", icon: Sparkles },
  { id: "ads", label: "AdsSim", site: "https://ads.latars.xyz", href: "/adminx/ads", icon: Megaphone },
];

const SECTIONS: Record<Exclude<Project, "home">, { id: Section; label: string; href: string; icon: typeof Inbox }[]> = {
  connect: [
    { id: "inbox", label: "Inbox", href: "/adminx/connect", icon: Inbox },
    { id: "events", label: "Events", href: "/adminx/connect/events", icon: CalendarDays },
    { id: "moderation", label: "Moderation", href: "/adminx/connect/moderation", icon: ShieldAlert },
    { id: "people", label: "People", href: "/adminx/connect/people", icon: Users },
    { id: "stats", label: "Stats", href: "/adminx/connect/stats", icon: BarChart3 },
  ],
  ads: [{ id: "ads", label: "Overview", href: "/adminx/ads", icon: BarChart3 }],
};

export function AdminShell({ project, section, badges = {}, children }: { project: Project; section: Section; badges?: Partial<Record<Section, number>>; children: React.ReactNode }) {
  const current = PROJECTS.find((p) => p.id === project);
  const sections = project === "home" ? [] : SECTIONS[project];
  const badge = (id: Section) => (badges[id] ? <span className="ml-auto rounded-full bg-flame px-1.5 text-[11px] font-bold leading-5 text-white">{badges[id]}</span> : null);
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop: a sidebar. Phones: a bar on top with the same links. */}
      <aside className="bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 lg:block lg:px-5 lg:pt-6">
          <Link href="/adminx" className="flex items-center gap-2" aria-label="Admin home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sun">
              <Home size={16} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">Admin</span>
              <span className="block text-[11px] text-white/50">latars.xyz</span>
            </span>
          </Link>
          <form action={adminLogoutAction} className="lg:hidden">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10">
              <LogOut size={15} aria-hidden /> Log out
            </button>
          </form>
        </div>
        <nav aria-label="Projects" className="flex gap-2 overflow-x-auto px-4 pb-3 lg:mt-4 lg:flex-col lg:gap-1 lg:px-3">
          <p className="hidden px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 lg:block">Projects</p>
          {PROJECTS.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              aria-current={p.id === project ? "page" : undefined}
              className={cx("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", p.id === project ? "bg-white text-ink" : "bg-white/5 text-white/80 hover:bg-white/10 lg:bg-transparent")}
            >
              <p.icon size={16} aria-hidden /> {p.label}
            </Link>
          ))}
        </nav>
        {sections.length > 0 && (
          <nav aria-label={`${current?.label} sections`} className="flex gap-1 overflow-x-auto border-t border-white/10 px-4 py-2 lg:mt-3 lg:flex-col lg:border-t-0 lg:px-3 lg:py-0">
            <p className="hidden px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 lg:block">{current?.label}</p>
            {sections.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                aria-current={s.id === section ? "page" : undefined}
                className={cx("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", s.id === section ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")}
              >
                <s.icon size={16} aria-hidden /> {s.label}
                {badge(s.id)}
              </Link>
            ))}
          </nav>
        )}
        <div className="mt-auto hidden space-y-1 px-3 pb-5 lg:block">
          {current && (
            <a href={current.site} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white">
              <ArrowUpRight size={16} aria-hidden /> Open {current.site.replace("https://", "")}
            </a>
          )}
          <form action={adminLogoutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white">
              <LogOut size={16} aria-hidden /> Log out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Page heading inside the admin. */
export function AdminTitle({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** A number with a label; a link when it leads somewhere, red when it needs attention. */
export function StatTile({ label, value, hint, href, alert }: { label: string; value: number | string; hint?: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <p className={cx("text-2xl font-extrabold tabular-nums sm:text-3xl", alert && "text-red-700")}>{typeof value === "number" ? value.toLocaleString("en-GB") : value}</p>
      <p className="text-sm font-semibold">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = cx("block rounded-2xl border p-4", alert ? "border-red-200 bg-red-50" : "border-line bg-surface", href && "transition hover:-translate-y-0.5 hover:shadow-sm");
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A titled block of the page. */
export function AdminSection({ title, note, action, children, id }: { title: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {note && <p className="text-sm text-muted">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A bordered list, or a quiet note when it's empty. */
export function AdminList({ count, empty, children, tone }: { count: number; empty: React.ReactNode; children: React.ReactNode; tone?: "alert" }) {
  return count === 0 ? (
    <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{empty}</p>
  ) : (
    <ul className={cx("divide-y divide-line overflow-hidden rounded-2xl border bg-surface", tone === "alert" ? "border-red-200" : "border-line")}>{children}</ul>
  );
}

/** A search box that keeps the page's other settings (e.g. the tab). */
export function AdminSearch({ action, params = {}, placeholder, value }: { action: string; params?: Record<string, string>; placeholder: string; value?: string }) {
  return (
    <form action={action} className="flex gap-2">
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="admin-q" className="sr-only">
        Search
      </label>
      <input id="admin-q" name="q" type="search" defaultValue={value} placeholder={placeholder} className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm focus:border-flame focus:outline-none focus:ring-4 focus:ring-flame/15" />
      {value && (
        <Link href={`${action}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`} className="inline-flex items-center rounded-full px-3 text-sm font-semibold text-muted hover:text-ink">
          Clear
        </Link>
      )}
    </form>
  );
}
