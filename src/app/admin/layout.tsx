import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const TABS = [
  ["/admin", "Overview"],
  ["/admin/reports", "Reports"],
  ["/admin/users", "Users"],
  ["/admin/posts", "X posts"],
  ["/admin/exhibitors", "Exhibitors"],
  ["/admin/meetups", "Meetups"],
  ["/admin/event", "Event info"],
  ["/admin/metrics", "Metrics"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Admin</p>
      <nav aria-label="Admin" className="-mx-4 mb-6 mt-2 flex gap-1 overflow-x-auto border-b border-line px-4">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium text-muted hover:bg-black/5 hover:text-ink">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
