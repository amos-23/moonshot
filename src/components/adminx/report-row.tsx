import { decideReportAction, resolveReportAction } from "@/lib/actions";
import type { Report } from "@/lib/admin-data";
import { ActionButton } from "@/components/client";
import { Tag } from "@/components/ui";
import { timeAgo } from "@/lib/time";

/**
 * Something that was reported (all its reports in one row): what it is, a peek at it, where, why. If it's still up:
 * Hide or Dismiss (keep it up). If it already hid itself after 3 reports: Keep hidden or Unhide.
 */
export function ReportRow({ report: r }: { report: Report }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{r.what}</span>
        {r.eventName && <span className="text-muted"> · {r.eventName}</span>}
        {r.preview && <span className="block truncate text-muted">“{r.preview}”</span>}
        <span className="block text-xs text-muted">
          {r.count > 1 ? `${r.count} reports` : "Reported"}: {r.reasons.map((x) => `“${x}”`).join(", ")} · {timeAgo(r.createdAt)}
        </span>
      </span>
      {r.hidden ? (
        <>
          <Tag>hidden</Tag>
          <ActionButton action={decideReportAction.bind(null, r.id, true)} variant="secondary">
            Keep hidden
          </ActionButton>
          <ActionButton action={decideReportAction.bind(null, r.id, false)} variant="ghost">
            Unhide
          </ActionButton>
        </>
      ) : (
        <>
          <ActionButton action={decideReportAction.bind(null, r.id, true)} variant="danger">
            Hide
          </ActionButton>
          <ActionButton action={resolveReportAction.bind(null, r.id)} variant="ghost">
            Dismiss
          </ActionButton>
        </>
      )}
    </li>
  );
}
