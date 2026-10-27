import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ChevronLeft, MapPin, Video } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMeetup } from "@/lib/services/meetups";
import { joinMeetupAction, meetupStatusAction } from "@/lib/actions/explore";
import { MEETUP_TOPICS, labelFor } from "@/lib/constants";
import { formatWhen } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { ReportForm } from "@/components/people-forms";
import { Avatar, Badge, Card, LinkButton, Notice } from "@/components/ui";

export const metadata = { title: "Meetup" };

export default async function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  const db = await getDb();
  const data = await getMeetup(db, viewer?.user.id ?? null, id);
  if (!data) notFound();
  const { meetup: m, organiser, visible, total, joined } = data;
  const isOrganiser = viewer?.user.id === m.organiserId;
  const canManage = isOrganiser || viewer?.user.role === "admin";
  const full = total >= m.capacity;
  const organiserVisible = organiser && (organiser.visibility === "public" || (viewer && organiser.visibility === "members") || isOrganiser);
  const hiddenCount = total - visible.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/explore?tab=meetups" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> All meetups
      </Link>
      {m.status === "cancelled" && (
        <div className="mb-4">
          <Notice tone="danger">This meetup has been cancelled.</Notice>
        </div>
      )}
      <Card className={`p-5 sm:p-6 ${m.status === "proposed" ? "border-dashed" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={m.status === "confirmed" ? "success" : m.status === "cancelled" ? "danger" : "pending"}>
            {m.status === "confirmed" ? "Confirmed" : m.status === "cancelled" ? "Cancelled" : "Proposed — details may change"}
          </Badge>
          <Badge tone="accent">{labelFor(MEETUP_TOPICS, m.topic)}</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{m.title}</h1>
        <div className="mt-3 space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <Calendar size={16} className="text-muted" aria-hidden /> {formatWhen(m.startsAt)}
          </p>
          {m.location && (
            <p className="flex items-center gap-2">
              <MapPin size={16} className="text-muted" aria-hidden /> {m.location}
            </p>
          )}
          {m.onlineUrl && (
            <p className="flex items-center gap-2">
              <Video size={16} className="text-muted" aria-hidden />
              {joined ? (
                <a href={m.onlineUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent hover:underline">
                  {m.onlineUrl}
                </a>
              ) : (
                <span className="text-muted">Online link shown to participants</span>
              )}
            </p>
          )}
        </div>
        {m.description && <p className="mt-4 whitespace-pre-line">{m.description}</p>}
        <p className="mt-4 text-sm text-muted">
          Organised by{" "}
          {organiserVisible ? (
            <Link href={`/people/${organiser!.userId}`} className="font-medium text-ink hover:underline">
              {organiser!.name}
            </Link>
          ) : (
            "a member"
          )}
        </p>

        {m.status !== "cancelled" && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {!viewer ? (
              <LinkButton href={`/login?next=/explore/meetups/${m.id}`}>Sign in to join</LinkButton>
            ) : !viewer.profile ? (
              <LinkButton href="/onboarding">Create your profile to join</LinkButton>
            ) : isOrganiser ? null : joined ? (
              <ActionButton action={joinMeetupAction.bind(null, m.id, false)} size="md">
                Leave meetup
              </ActionButton>
            ) : (
              <ActionButton action={joinMeetupAction.bind(null, m.id, true)} variant="primary" size="md">
                {full ? "Full" : "Join meetup"}
              </ActionButton>
            )}
            {canManage && m.status === "proposed" && (
              <ActionButton action={meetupStatusAction.bind(null, m.id, "confirmed")} variant="primary" size="md">
                Mark as confirmed
              </ActionButton>
            )}
            {canManage && m.status === "confirmed" && (
              <ActionButton action={meetupStatusAction.bind(null, m.id, "proposed")} size="md">
                Back to proposed
              </ActionButton>
            )}
            {canManage && (
              <ActionButton action={meetupStatusAction.bind(null, m.id, "cancelled")} variant="danger" size="md" confirm="Cancel this meetup for everyone?">
                Cancel meetup
              </ActionButton>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="font-semibold">
          Who&apos;s going <span className="font-normal text-muted">({total}/{m.capacity})</span>
        </h2>
        {viewer ? (
          <>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {visible.map((p) => (
                <li key={p.userId}>
                  <Link href={`/people/${p.userId}`} className="flex items-center gap-2 rounded-xl p-2 hover:bg-canvas">
                    <Avatar name={p.name} src={p.avatarUrl} size={32} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{p.headline}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && <p className="mt-2 text-sm text-muted">+ {hiddenCount} more with private profiles</p>}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Sign in to see participants.</p>
        )}
      </Card>
      {viewer && !isOrganiser && (
        <div className="mt-4 px-1">
          <ReportForm targetType="meetup" targetId={m.id} />
        </div>
      )}
    </div>
  );
}
