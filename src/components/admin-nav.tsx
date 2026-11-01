import Link from "next/link";
import { BarChart3, CalendarDays, ExternalLink, LayoutDashboard, LogOut, Sparkles, UserRound, Users } from "lucide-react";
import { adminLogoutAction } from "@/lib/actions";
import type { EventSpace } from "@/lib/db/schema";
import { cx } from "./ui";

export const ADMIN_TABS = [
  { id: "home", label: "Overview", icon: LayoutDashboard },
  { id: "moments", label: "Moments", icon: Sparkles },
  { id: "people", label: "People", icon: Users },
  { id: "accounts", label: "Accounts", icon: UserRound },
  { id: "events", label: "Events", icon: CalendarDays },
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number]["id"] | "stats";

export const adminHref = (tab: string, event?: string, extra = "") => {
  const q = new URLSearchParams();
  if (event) q.set("event", event);
  if (tab !== "home") q.set("tab", tab);
  const s = q.toString();
  return `/admin${s ? `?${s}` : ""}${extra}`;
};

/** The dark admin bar: which event you're managing, the sections, and a way out. Shared by Admin and Stats. */
export function AdminNav({ events, current, tab, badges = {} }: { events: EventSpace[]; current?: EventSpace; tab: AdminTab; badges?: Partial<Record<AdminTab, number>> }) {
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sun">Admin</span>
            {current && (
              <Link href={`/${current.slug}`} target="_blank" className="hidden items-center gap-1 truncate text-sm text-white/60 hover:text-white sm:inline-flex">
                events.latars.xyz/{current.slug} <ExternalLink size={13} aria-hidden />
              </Link>
            )}
          </div>
          <form action={adminLogoutAction}>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">
              <LogOut size={15} aria-hidden /> Log out
            </button>
          </form>
        </div>
        {tab !== "stats" && (
          <nav aria-label="Event" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {events.map((e) => (
              <Link
                key={e.id}
                href={adminHref(tab, e.slug)}
                aria-current={e.id === current?.id ? "page" : undefined}
                className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold", e.id === current?.id ? "bg-white text-ink" : "bg-white/10 text-white/80 hover:bg-white/20")}
              >
                {e.short}
                {e.hidden ? " · hidden" : ""}
              </Link>
            ))}
          </nav>
        )}
        <nav aria-label="Admin sections" className="mt-4 flex gap-1 overflow-x-auto">
          {[...ADMIN_TABS, { id: "stats" as const, label: "Stats", icon: BarChart3 }].map((t) => {
            const active = t.id === tab;
            const n = badges[t.id];
            return (
              <Link
                key={t.id}
                href={t.id === "stats" ? "/admin/stats" : adminHref(t.id, current?.slug)}
                aria-current={active ? "page" : undefined}
                className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-t-2xl px-4 py-2.5 text-sm font-semibold", active ? "bg-canvas text-ink" : "text-white/70 hover:text-white")}
              >
                <t.icon size={15} aria-hidden />
                {t.label}
                {!!n && <span className="rounded-full bg-flame px-1.5 text-[11px] leading-5 text-white">{n}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
