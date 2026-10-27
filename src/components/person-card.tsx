import Link from "next/link";
import { Bookmark, BookmarkCheck, Check, Clock, Sparkles, UserPlus } from "lucide-react";
import type { Profile } from "@/lib/db/schema";
import type { MatchReason } from "@/lib/matching";
import { ATTENDANCE, GOALS, OFFERS, labelFor } from "@/lib/constants";
import { toggleSaveAction } from "@/lib/actions/people";
import { ActionButton } from "./action-button";
import { Avatar, Badge, Card, DemoBadge, LinkButton } from "./ui";

export function AttendanceBadge({ value }: { value: string }) {
  const tone = value === "in_person" ? "success" : value === "remote" ? "info" : "neutral";
  return <Badge tone={tone}>{labelFor(ATTENDANCE, value)}</Badge>;
}

export function ConnectionStatusBadge({ status }: { status: string | null }) {
  if (status === "connected")
    return (
      <Badge tone="success">
        <Check size={12} aria-hidden /> Connected
      </Badge>
    );
  if (status === "sent")
    return (
      <Badge tone="pending">
        <Clock size={12} aria-hidden /> Request pending
      </Badge>
    );
  if (status === "received")
    return (
      <Badge tone="accent">
        <UserPlus size={12} aria-hidden /> Wants to connect
      </Badge>
    );
  return null;
}

function TagLine({ label, values, options }: { label: string; values: string[]; options: typeof GOALS }) {
  if (!values.length) return null;
  const shown = values.slice(0, 3).map((v) => labelFor(options, v));
  return (
    <p className="text-sm">
      <span className="font-medium text-ink">{label}: </span>
      <span className="text-muted">
        {shown.join(" · ")}
        {values.length > 3 ? ` +${values.length - 3}` : ""}
      </span>
    </p>
  );
}

export function PersonCard({
  profile: p,
  reasons,
  saved,
  status,
  showActions = true,
}: {
  profile: Profile;
  reasons?: MatchReason[];
  saved?: boolean;
  status?: string | null;
  showActions?: boolean;
}) {
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} src={p.avatarUrl} size={52} />
        <div className="min-w-0 flex-1">
          <Link href={`/people/${p.userId}`} className="font-semibold hover:underline">
            {p.name}
          </Link>
          <p className="truncate text-sm text-muted">
            {p.headline}
            {p.company ? ` · ${p.company}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <AttendanceBadge value={p.attendance} />
            {p.isDemo && <DemoBadge />}
            <ConnectionStatusBadge status={status ?? null} />
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <TagLine label="Wants" values={p.goals} options={GOALS} />
        <TagLine label="Offers" values={p.offers} options={OFFERS} />
        {!p.offers.length && p.canOffer && (
          <p className="line-clamp-2 text-sm">
            <span className="font-medium">Offers: </span>
            <span className="text-muted">{p.canOffer}</span>
          </p>
        )}
      </div>
      {reasons && reasons.length > 0 && (
        <div className="mt-3 rounded-xl bg-accent-50 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-accent">
            <Sparkles size={12} aria-hidden /> Why you might meet
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink">
            {reasons.slice(0, 3).map((r) => (
              <li key={r.text}>• {r.text}</li>
            ))}
          </ul>
        </div>
      )}
      {showActions && (
        <div className="mt-auto flex items-center gap-2 pt-4">
          <LinkButton href={`/people/${p.userId}`} size="sm" variant={status ? "secondary" : "primary"} className="flex-1">
            {status === "connected" ? "View & message" : status === "received" ? "Respond" : status === "sent" ? "View profile" : "Connect"}
          </LinkButton>
          <ActionButton
            action={toggleSaveAction.bind(null, p.userId, !saved)}
            ariaLabel={saved ? `Remove ${p.name} from saved` : `Save ${p.name}`}
            variant="secondary"
          >
            {saved ? <BookmarkCheck size={16} className="text-accent" aria-hidden /> : <Bookmark size={16} aria-hidden />}
            <span className="sr-only sm:not-sr-only">{saved ? "Saved" : "Save"}</span>
          </ActionButton>
        </div>
      )}
    </Card>
  );
}
