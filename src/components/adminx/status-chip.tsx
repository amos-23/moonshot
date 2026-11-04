import { STATUS_LABEL, type EventStatus } from "@/lib/admin-data";
import { cx } from "@/components/ui";

const TONE: Record<EventStatus, string> = {
  live: "bg-emerald-100 text-emerald-800",
  before: "bg-sky-100 text-sky-800",
  after: "bg-black/5 text-muted",
  waiting: "bg-amber-100 text-amber-800",
  hidden: "bg-black/10 text-ink",
  featured: "bg-fuchsia-100 text-fuchsia-800",
};

export function StatusChip({ status }: { status: EventStatus }) {
  return <span className={cx("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[status])}>{STATUS_LABEL[status]}</span>;
}
