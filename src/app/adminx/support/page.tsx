import Link from "next/link";
import { getDb } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminShell, AdminTitle } from "@/components/adminx/shell";
import { LiveRefresh } from "@/components/adminx/support-client";
import { Card, cx } from "@/components/ui";
import { timeAgo } from "@/lib/time";
import { PROJECT_NAMES, isProject, listThreads, unreadCount } from "@/lib/support";

export const metadata = { title: "Support · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Everyone who wrote to support from AdsSim or Event Connect, newest first. Unread ones are marked.
export default async function SupportInbox({ searchParams }: { searchParams: Promise<{ project?: string; status?: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const q = await searchParams;
  const project = isProject(q.project) ? q.project : null;
  const status = q.status === "closed" ? "closed" : q.status === "all" ? null : "open";
  const db = await getDb();
  const [threads, unread] = await Promise.all([listThreads(db, { project, status }), unreadCount(db)]);

  const chip = (label: string, href: string, on: boolean) => (
    <Link href={href} className={cx("rounded-full border px-3 py-1.5 text-sm font-semibold", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30")}>
      {label}
    </Link>
  );
  const href = (p: string | null, s: string) => `/adminx/support?${[p && `project=${p}`, s !== "open" && `status=${s}`].filter(Boolean).join("&")}`;
  const s = status ?? "all";

  return (
    <AdminShell project="support" section="support">
      <LiveRefresh unread={unread} />
      <AdminTitle title="Support" sub="Messages from AdsSim and Event Connect. This page refreshes by itself." />
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("All projects", href(null, s), !project)}
        {chip("AdsSim", href("ads", s), project === "ads")}
        {chip("Event Connect", href("connect", s), project === "connect")}
        <span className="mx-1 hidden w-px bg-line sm:block" />
        {chip("Open", href(project, "open"), s === "open")}
        {chip("Done", href(project, "closed"), s === "closed")}
        {chip("Everything", href(project, "all"), s === "all")}
      </div>
      {threads.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">No messages here yet. When someone taps Help and writes to you, it shows up here.</Card>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/adminx/support/${t.id}`} className={cx("flex items-start gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm", t.unread ? "border-flame/40 bg-white" : "border-line bg-surface")}>
                <span aria-hidden className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", t.unread ? "bg-flame" : "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <b className={cx(t.unread && "text-ink")}>{t.name || t.email || "Anonymous visitor"}</b>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold">{PROJECT_NAMES[t.project]}</span>
                    {t.status === "closed" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Done</span>}
                    <span className="ml-auto text-xs text-muted">{timeAgo(new Date(t.lastAt))}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted">
                    {t.lastSender === "admin" ? "You: " : ""}
                    {t.preview}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
