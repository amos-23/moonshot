"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, Compass, MessageCircle, MessagesSquare, Store, UserRound } from "lucide-react";
import { cx } from "./ui";

export const NAV = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/conversation", label: "Conversation", icon: MessagesSquare },
  { href: "/my", label: "My Moonshot", icon: CalendarHeart, badge: "requests" as const },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: "unread" as const },
  { href: "/explore", label: "Explore", icon: Store },
  { href: "/profile", label: "Profile", icon: UserRound },
];

type Counts = { requests: number; unread: number };

function Dot({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-5 text-white">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> new</span>
    </span>
  );
}

export function DesktopNav({ counts }: { counts: Counts }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.map((item) => {
        const active = path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent-50 text-accent" : "text-muted hover:bg-black/5 hover:text-ink",
            )}
          >
            {item.label}
            {item.badge && <Dot n={counts[item.badge]} />}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ counts }: { counts: Counts }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-6">
        {NAV.map((item) => {
          const active = path.startsWith(item.href);
          const Icon = item.icon;
          const n = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium", active ? "text-accent" : "text-muted")}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                <span className="truncate">{item.label === "My Moonshot" ? "My" : item.label === "Conversation" ? "Posts" : item.label}</span>
                {n > 0 && (
                  <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-accent">
                    <span className="sr-only">{n} new</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
