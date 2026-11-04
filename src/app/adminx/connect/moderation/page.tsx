import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { adminGate } from "@/components/admin-gate";
import { AdminList, AdminSection, AdminShell, AdminTitle } from "@/components/adminx/shell";
import { ReportRow } from "@/components/adminx/report-row";
import { ModRow } from "@/components/adminx/rows";
import { openReports, recentlyHidden } from "@/lib/admin-data";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Moderation · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Every open report across the events, and what's hidden lately (by reports or by hand) so it can be undone.
export default async function Moderation() {
  const gate = await adminGate();
  if (gate) return gate;
  const db = await getDb();
  const [reports, hidden, [{ n: waiting }]] = await Promise.all([
    openReports(db, 300),
    recentlyHidden(db),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.eventSpaces).where(sql`${schema.eventSpaces.listed} = false and ${schema.eventSpaces.hidden} = false`),
  ]);
  return (
    <AdminShell project="connect" section="moderation" badges={{ inbox: reports.length + waiting, moderation: reports.length, events: waiting }}>
      <AdminTitle title="Moderation" sub="Anything with 3 reports hides itself. Hiding something here closes its reports." />
      <div className="space-y-8">
        <AdminSection title={`Open reports · ${reports.length}`}>
          <AdminList count={reports.length} empty="Nothing to review. 🎉" tone="alert">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} />
            ))}
          </AdminList>
        </AdminSection>
        <AdminSection title="Recently hidden" note="Cards, moments and comments that are hidden now, newest first. Unhide one if it was a wrong call.">
          <AdminList count={hidden.length} empty="Nothing is hidden.">
            {hidden.map((h) => (
              <ModRow key={`${h.kind}-${h.id}`} kind={h.kind} id={h.id} title={h.title} sub={`${h.short} · ${h.sub ?? ""} · ${timeAgo(h.at)}`} hidden />
            ))}
          </AdminList>
        </AdminSection>
      </div>
    </AdminShell>
  );
}
