import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Bookmark, BookmarkCheck, Calendar, Globe, MapPin, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canViewProfile, explainMatch, getNote, getProfile, relationship } from "@/lib/services/people";
import { ensureConversation } from "@/lib/services/connections";
import { GOALS, INDUSTRIES, INTERESTS, NETWORKING_STYLES, OFFERS, ROLES, labelFor } from "@/lib/constants";
import { blockAction, cancelRequestAction, removeConnectionAction, respondRequestAction, toggleSaveAction } from "@/lib/actions/people";
import { toLagosInput } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { AttendanceBadge, ConnectionStatusBadge } from "@/components/person-card";
import { ConnectForm, MeetingForm, NoteForm, ReportForm } from "@/components/people-forms";
import { Avatar, Badge, Card, Chip, DemoBadge, LinkButton, Notice, SectionTitle } from "@/components/ui";

export const metadata = { title: "Profile" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const viewer = await getViewer();
  const person = await getProfile(db, id);
  if (!person || !(await canViewProfile(db, viewer?.user.id ?? null, person))) notFound();

  const isSelf = viewer?.user.id === person.userId;
  const me = viewer?.profile ?? null;
  const rel = me && !isSelf ? await relationship(db, me.userId, person.userId) : null;
  const match = me && !isSelf ? explainMatch(me, person) : null;
  const note = me && !isSelf ? await getNote(db, me.userId, person.userId) : "";
  const conversation = rel?.connected ? await ensureConversation(db, me!.userId, person.userId) : null;
  const status = rel?.connection
    ? rel.connected
      ? "connected"
      : rel.connection.requesterId === me!.userId
        ? "sent"
        : "received"
    : null;
  const first = person.name.split(" ")[0];
  const showLinks = isSelf || (rel?.connected && person.shareLinksWithConnections);
  const defaultStart = toLagosInput(new Date(Math.max(Date.now() + 3600_000, Date.UTC(2026, 9, 28, 9, 0))));

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar name={person.name} src={person.avatarUrl} size={88} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{person.name}</h1>
                {person.isDemo && <DemoBadge />}
              </div>
              <p className="text-muted">
                {person.headline}
                {person.company ? ` · ${person.company}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <AttendanceBadge value={person.attendance} />
                <Badge>{labelFor(ROLES, person.roleCategory)}</Badge>
                {person.industry && <Badge>{labelFor(INDUSTRIES, person.industry)}</Badge>}
                {person.location && (
                  <Badge>
                    <MapPin size={12} aria-hidden /> {person.location}
                  </Badge>
                )}
                {person.ticketVerified && (
                  <Badge tone="success">
                    <ShieldCheck size={12} aria-hidden /> Ticket verified by organisers of this app
                  </Badge>
                )}
                <ConnectionStatusBadge status={status} />
              </div>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-line">{person.bio}</p>
        </Card>

        {match && match.reasons.length > 0 && (
          <Card className="border-accent-100 bg-accent-50 p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Sparkles size={16} aria-hidden /> Why you might meet
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {match.reasons.map((r) => (
                <li key={r.text}>• {r.text}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <SectionTitle>Looking for</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {person.goals.map((g) => (
                <Chip key={g}>{labelFor(GOALS, g)}</Chip>
              ))}
            </div>
            {person.lookingFor && <p className="mt-2 text-sm text-muted">{person.lookingFor}</p>}
          </div>
          {(person.offers.length > 0 || person.canOffer) && (
            <div>
              <SectionTitle>Can offer</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {person.offers.map((o) => (
                  <Chip key={o}>{labelFor(OFFERS, o)}</Chip>
                ))}
              </div>
              {person.canOffer && <p className="mt-2 text-sm text-muted">{person.canOffer}</p>}
            </div>
          )}
          <div>
            <SectionTitle>Interests</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {person.interests.map((i) => (
                <Chip key={i} active={me?.interests.includes(i) && !isSelf}>
                  {labelFor(INTERESTS, i)}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted">Prefers: {labelFor(NETWORKING_STYLES, person.networkingStyle)}</p>
        </Card>
      </div>

      <aside className="space-y-4">
        {!viewer && (
          <Card className="p-5">
            <p className="font-semibold">Want to meet {first}?</p>
            <p className="mt-1 text-sm text-muted">Create a free profile to connect, message and arrange meetings.</p>
            <LinkButton href={`/login?next=/people/${person.userId}`} className="mt-3 w-full">
              Find your people
            </LinkButton>
          </Card>
        )}
        {viewer && !me && !isSelf && (
          <Notice tone="pending">
            <Link href="/onboarding" className="font-medium underline">
              Finish your profile
            </Link>{" "}
            to connect with {first}.
          </Notice>
        )}
        {isSelf && (
          <Card className="p-5">
            <p className="font-semibold">This is your profile</p>
            <p className="mt-1 text-sm text-muted">This is how other members see you.</p>
            <LinkButton href="/profile" variant="secondary" className="mt-3 w-full">
              Edit profile
            </LinkButton>
          </Card>
        )}

        {me && rel && !isSelf && (
          <>
            <Card className="space-y-3 p-5">
              {rel.blockedByMe ? (
                <Notice tone="danger">You&apos;ve blocked {first}. Unblock them from your Profile page.</Notice>
              ) : rel.connected ? (
                <>
                  <p className="font-semibold">You&apos;re connected</p>
                  {conversation && (
                    <LinkButton href={`/messages/${conversation.id}`} className="w-full">
                      <MessageCircle size={16} aria-hidden /> Message {first}
                    </LinkButton>
                  )}
                  {showLinks && (person.linkedinUrl || person.websiteUrl || person.xHandle) && (
                    <ul className="space-y-1 text-sm">
                      {person.xHandle && (
                        <li>
                          <a className="text-accent hover:underline" href={`https://x.com/${person.xHandle}`} target="_blank" rel="noopener noreferrer nofollow">
                            @{person.xHandle} on X
                          </a>
                        </li>
                      )}
                      {person.linkedinUrl && (
                        <li>
                          <a className="text-accent hover:underline" href={person.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">
                            LinkedIn
                          </a>
                        </li>
                      )}
                      {person.websiteUrl && (
                        <li>
                          <a className="inline-flex items-center gap-1 text-accent hover:underline" href={person.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">
                            <Globe size={14} aria-hidden /> Website
                          </a>
                        </li>
                      )}
                    </ul>
                  )}
                </>
              ) : status === "received" ? (
                <>
                  <p className="font-semibold">{first} wants to connect</p>
                  {rel.connection?.message && <blockquote className="rounded-xl bg-canvas p-3 text-sm">“{rel.connection.message}”</blockquote>}
                  <div className="flex gap-2">
                    <ActionButton action={respondRequestAction.bind(null, rel.connection!.id, true)} variant="primary" size="md">
                      Accept
                    </ActionButton>
                    <ActionButton action={respondRequestAction.bind(null, rel.connection!.id, false)} size="md">
                      Decline
                    </ActionButton>
                  </div>
                </>
              ) : status === "sent" ? (
                <>
                  <p className="font-semibold">Request sent</p>
                  <p className="text-sm text-muted">We&apos;ll let you know in My Moonshot when {first} responds.</p>
                  <ActionButton action={cancelRequestAction.bind(null, rel.connection!.id)} confirm="Withdraw this connection request?">
                    Withdraw request
                  </ActionButton>
                </>
              ) : person.contactPreference === "nobody" ? (
                <p className="text-sm text-muted">{first} isn&apos;t accepting connection requests right now. You can still save their profile.</p>
              ) : person.contactPreference === "shared_interests" && !person.interests.some((i) => me.interests.includes(i)) ? (
                <p className="text-sm text-muted">{first} only accepts requests from people who share at least one interest.</p>
              ) : (
                <ConnectForm recipientId={person.userId} name={person.name} />
              )}
              <div className="border-t border-line pt-3">
                <ActionButton action={toggleSaveAction.bind(null, person.userId, !rel.saved)} variant="secondary" size="sm">
                  {rel.saved ? <BookmarkCheck size={16} className="text-accent" aria-hidden /> : <Bookmark size={16} aria-hidden />}
                  {rel.saved ? "Saved to your list" : "Save to my list"}
                </ActionButton>
              </div>
            </Card>

            {rel.connected && (
              <Card className="p-5">
                <p className="mb-3 flex items-center gap-2 font-semibold">
                  <Calendar size={16} aria-hidden /> Suggest a meeting
                </p>
                <MeetingForm inviteeId={person.userId} defaultStart={defaultStart} />
              </Card>
            )}

            <Card className="p-5">
              <p className="mb-2 font-semibold">Private notes</p>
              <NoteForm subjectId={person.userId} initial={note} />
            </Card>

            <div className="flex flex-wrap items-start gap-4 px-1">
              {rel.connected && (
                <ActionButton action={removeConnectionAction.bind(null, person.userId)} variant="ghost" confirm={`Remove ${first} from your connections? You won't be able to message each other.`}>
                  Remove connection
                </ActionButton>
              )}
              {!rel.blockedByMe && (
                <ActionButton action={blockAction.bind(null, person.userId)} variant="ghost" confirm={`Block ${first}? They won't be able to see or contact you.`}>
                  <Ban size={14} aria-hidden /> Block
                </ActionButton>
              )}
              <div className="pt-1.5">
                <ReportForm targetType="user" targetId={person.userId} allowBlock={!rel.blockedByMe} />
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
