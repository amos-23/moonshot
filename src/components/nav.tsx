"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, IdCard, MessagesSquare, Users } from "lucide-react";
import { cx } from "./ui";

const ITEMS = [
  { href: "/people", label: "People", icon: Users },
  { href: "/hangouts", label: "Hangouts", icon: CalendarDays },
  { href: "/conversation", label: "On X", icon: MessagesSquare },
  { href: "/card", label: "My card", icon: IdCard },
];

export function TopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={path.startsWith(i.href) ? "page" : undefined}
          className={cx("rounded-full px-4 py-2 text-sm font-semibold", path.startsWith(i.href) ? "bg-ink text-white" : "text-ink hover:bg-black/5")}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {ITEMS.map((i) => {
          const on = path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", on ? "text-flame-700" : "text-muted")}>
                <i.icon size={21} strokeWidth={on ? 2.5 : 1.8} aria-hidden />
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
