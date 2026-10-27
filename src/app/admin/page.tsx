import Link from "next/link";
import { getDb } from "@/lib/db";
import { metrics } from "@/lib/services/analytics";
import { listReports, recentActions } from "@/lib/services/moderation";
import { postCount } from "@/lib/services/social";
import { liveStatus } from "@/lib/social/live";
import { authMode } from "@/lib/env";
import { timeAgo } from "@/lib/time";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const db = await getDb();
  const [m, reports, posts, live, actions] = await Promise.all([metrics(db), listReports(db), postCount(db), liveStatus(db), recentActions(db)]);
  const config = [
    { label: "Authentication", value: authMode() === "supabase" ? "Supabase email" : authMode() === "demo" ? "Local demo sign-in (no verification)" : "Not configured", ok: authMode() === "supabase" },
    { label: "Database", value: process.env.DATABASE_URL ? "PostgreSQL (DATABASE_URL)" : "Embedded PGlite (local only)", ok: Boolean(process.env.DATABASE_URL) },
    { label: "Photo storage", value: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Supabase Storage" : "Inline (≤300 KB)", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: "X live search", value: live.provider ?? "Not configured — manual import only", ok: Boolean(live.provider) },
  ];
  return (
    <>
      <PageHeader title="Overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Accepted connections", m.totals.accepted],
          ["Two-way conversations", m.totals.conversationsBothWays],
          ["Confirmed meetings", m.totals.confirmedMeetings],
          ["Profiles", m.totals.profiles],
        ].map(([label, n]) => (
          <Card key={label} className="p-4">
            <p className="text-2xl font-semibold">{n}</p>
            <p className="text-xs text-muted">{label}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Needs attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/admin/reports" className="text-accent hover:underline">
                {reports.length} open report{reports.length === 1 ? "" : "s"}
              </Link>
            </li>
            <li>
              <Link href="/admin/posts" className="text-accent hover:underline">
                {posts} visible X post{posts === 1 ? "" : "s"}
              </Link>
            </li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Configuration</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {config.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2">
                <span className="text-muted">{c.label}</span>
                <Badge tone={c.ok ? "success" : "pending"}>{c.value}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {authMode() === "demo" && (
        <div className="mt-4">
          <Notice tone="pending">Demo sign-in is active: anyone can sign in as any email. Configure Supabase before sharing this deployment.</Notice>
        </div>
      )}
      <Card className="mt-6 p-5">
        <h2 className="font-semibold">Recent admin actions</h2>
        {actions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {actions.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 py-2">
                <span>
                  {a.action.replace(/_/g, " ")} <span className="text-muted">· {a.targetType}</span>
                  {a.note && <span className="text-muted"> · {a.note}</span>}
                </span>
                <span className="shrink-0 text-muted">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
