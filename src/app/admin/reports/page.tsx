import Link from "next/link";
import { getDb } from "@/lib/db";
import { listReports } from "@/lib/services/moderation";
import { adminMeetupStatusAction, resolveReportAction, setPostHiddenAction, suspendUserAction } from "@/lib/actions/admin";
import { timeAgo } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Reports · Admin" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const db = await getDb();
  const reports = await listReports(db, all ? "all" : "open");
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Reported users, messages, meetups and posts."
        action={
          <Link href={all ? "/admin/reports" : "/admin/reports?all=1"} className="text-sm text-accent hover:underline">
            {all ? "Show open only" : "Show all"}
          </Link>
        }
      />
      {reports.length === 0 ? (
        <EmptyState title="No reports to review" />
      ) : (
        <ul className="space-y-3">
          {reports.map(({ report: r, reporterEmail, targetEmail, excerpt }) => (
            <li key={r.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "open" ? "pending" : r.status === "actioned" ? "success" : "neutral"}>{r.status}</Badge>
                  <Badge>{r.targetType}</Badge>
                  <Badge tone="danger">{r.reason}</Badge>
                  <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-muted">Reported by</span> {reporterEmail}
                  {targetEmail && (
                    <>
                      {" "}
                      <span className="text-muted">about</span>{" "}
                      {r.targetUserId ? (
                        <Link href={`/people/${r.targetUserId}`} className="text-accent hover:underline">
                          {targetEmail}
                        </Link>
                      ) : (
                        targetEmail
                      )}
                    </>
                  )}
                </p>
                {excerpt && <blockquote className="mt-2 rounded-lg bg-canvas p-2 text-sm">{excerpt}</blockquote>}
                {r.details && <p className="mt-2 text-sm text-muted">“{r.details}”</p>}
                {r.status === "open" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.targetUserId && (
                      <ActionButton action={suspendUserAction.bind(null, r.targetUserId, true, r.id)} variant="danger" confirm="Suspend this user? They will be signed out and hidden everywhere.">
                        Suspend user
                      </ActionButton>
                    )}
                    {r.targetType === "post" && (
                      <ActionButton action={setPostHiddenAction.bind(null, r.targetId, true)} variant="danger">
                        Hide post
                      </ActionButton>
                    )}
                    {r.targetType === "meetup" && (
                      <ActionButton action={adminMeetupStatusAction.bind(null, r.targetId, "cancelled")} variant="danger">
                        Cancel meetup
                      </ActionButton>
                    )}
                    <ActionButton action={resolveReportAction.bind(null, r.id, "actioned")}>Mark actioned</ActionButton>
                    <ActionButton action={resolveReportAction.bind(null, r.id, "dismissed")} variant="ghost">
                      Dismiss
                    </ActionButton>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
