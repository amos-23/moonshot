import Link from "next/link";
import { Bookmark, Calendar, Inbox, MapPin, StickyNote, Store, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectionOverview, ensureConversation } from "@/lib/services/connections";
import { meetingsFor } from "@/lib/services/meetings";
import { meetupsJoinedBy } from "@/lib/services/meetups";
import { notesFor, savedProfilesFor } from "@/lib/services/people";
import { savedExhibitorsFor } from "@/lib/services/exhibitors";
import { profileCompleteness } from "@/lib/services/profiles";
import { cancelMeetingAction, cancelRequestAction, respondMeetingAction, respondRequestAction } from "@/lib/actions/people";
import { formatWhen, timeAgo } from "@/lib/time";
import { MEETUP_TOPICS, labelFor } from "@/lib/constants";
import { ActionButton } from "@/components/action-button";
import { PersonCard } from "@/components/person-card";
import { Avatar, Badge, Card, DemoBadge, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "My Moonshot" };

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-sm font-normal text-muted">({n})</span>;
}

export default async function MyMoonshotPage() {
  const { user, profile } = await requireProfile("/my");
  const db = await getDb();
  const [overview, meetings, meetups, saved, exhibitors, notes] = await Promise.all([
    connectionOverview(db, user.id),
    meetingsFor(db, user.id),
    meetupsJoinedBy(db, user.id),
    savedProfilesFor(db, user.id),
    savedExhibitorsFor(db, user.id),
    notesFor(db, user.id),
  ]);
  const conversations = new Map<string, string>();
  for (const c of overview.connections) {
    conversations.set(c.profile.userId, (await ensureConversation(db, user.id, c.profile.userId)).id);
  }
  const completeness = profileCompleteness(profile);
  const confirmed = meetings.filter((m) => m.meeting.status === "confirmed");
  const proposed = meetings.filter((m) => m.meeting.status === "proposed");
  const upcomingMeetups = meetups.filter((m) => m.meetup.startsAt.getTime() > Date.now() - 3 * 3600_000);

  const jump = [
    { href: "#requests", label: "Requests", n: overview.incoming.length },
    { href: "#meetings", label: "Meetings", n: proposed.filter((m) => !m.mine).length },
    { href: "#connections", label: "Connections", n: 0 },
    { href: "#saved", label: "Saved", n: 0 },
    { href: "#notes", label: "Notes", n: 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="My Moonshot" subtitle={`Your connections, meetings and plans, ${profile.name.split(" ")[0]}.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Connections", value: overview.connections.length },
          { label: "Pending requests", value: overview.incoming.length + overview.outgoing.length },
          { label: "Confirmed meetings", value: confirmed.length },
          { label: "Meetups joined", value: upcomingMeetups.length },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <nav aria-label="Sections" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {jump.map((j) => (
          <a key={j.href} href={j.href} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-accent/40">
            {j.label}
            {j.n > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-white">{j.n}</span>}
          </a>
        ))}
      </nav>

      {!completeness.complete && (
        <Card className="mb-8 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">Your profile is {completeness.percent}% complete</p>
            <p className="text-sm text-muted">Complete profiles get better recommendations and more accepted requests.</p>
          </div>
          <LinkButton href="/profile" variant="secondary" size="sm">
            Complete profile
          </LinkButton>
        </Card>
      )}

      <div className="space-y-10">
        <section id="requests" aria-labelledby="requests-h" className="scroll-mt-20">
          <SectionTitle id="requests-h">
            Connection requests <Count n={overview.incoming.length} />
          </SectionTitle>
          {overview.incoming.length === 0 && overview.outgoing.length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title="No pending requests" action={<LinkButton href="/discover" size="sm">Discover people</LinkButton>} />
          ) : (
            <div className="space-y-2">
              {overview.incoming.map(({ req, profile: p }) => (
                <Card key={req.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link href={`/people/${p.userId}`} className="flex flex-1 items-center gap-3">
                    <Avatar name={p.name} src={p.avatarUrl} size={44} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        {p.name} <Badge tone="accent">Wants to connect</Badge>
                      </span>
                      <span className="block truncate text-sm text-muted">{p.headline}</span>
                      {req.message && <span className="mt-1 block text-sm">“{req.message}”</span>}
                    </span>
                  </Link>
                  <div className="flex gap-2">
                    <ActionButton action={respondRequestAction.bind(null, req.id, true)} variant="primary">
                      Accept
                    </ActionButton>
                    <ActionButton action={respondRequestAction.bind(null, req.id, false)}>Decline</ActionButton>
                  </div>
                </Card>
              ))}
              {overview.outgoing.map(({ req, profile: p }) => (
                <Card key={req.id} className="flex items-center gap-3 p-4">
                  <Link href={`/people/${p.userId}`} className="flex flex-1 items-center gap-3">
                    <Avatar name={p.name} src={p.avatarUrl} size={44} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        {p.name} <Badge tone="pending">Awaiting reply</Badge>
                      </span>
                      <span className="block text-xs text-muted">Sent {timeAgo(req.createdAt)}</span>
                    </span>
                  </Link>
                  <ActionButton action={cancelRequestAction.bind(null, req.id)} variant="ghost">
                    Withdraw
                  </ActionButton>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section id="meetings" aria-labelledby="meetings-h" className="scroll-mt-20">
          <SectionTitle id="meetings-h">
            Upcoming meetings <Count n={meetings.length} />
          </SectionTitle>
          {meetings.length === 0 ? (
            <EmptyState icon={<Calendar size={28} />} title="No meetings yet">
              Open a connection&apos;s profile to suggest a time and place. Meetings are only confirmed once both of you agree.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {[...confirmed, ...proposed].map(({ meeting: m, profile: p, mine }) => (
                <Card key={m.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${m.status === "confirmed" ? "border-emerald-200" : "border-dashed"}`}>
                  <div className="flex flex-1 items-start gap-3">
                    <Avatar name={p.name} src={p.avatarUrl} size={40} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/people/${p.userId}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        {m.status === "confirmed" ? (
                          <Badge tone="success">Confirmed</Badge>
                        ) : (
                          <Badge tone="pending">{mine ? "Proposed · awaiting their reply" : "Proposed · needs your reply"}</Badge>
                        )}
                      </div>
                      <p className="text-sm">
                        {formatWhen(m.startsAt)} · {m.durationMinutes} min
                      </p>
                      <p className="flex items-center gap-1 text-sm text-muted">
                        <MapPin size={14} aria-hidden /> {m.location}
                      </p>
                      {m.note && <p className="mt-1 text-sm text-muted">“{m.note}”</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {m.status === "proposed" && !mine && (
                      <>
                        <ActionButton action={respondMeetingAction.bind(null, m.id, true)} variant="primary">
                          Confirm
                        </ActionButton>
                        <ActionButton action={respondMeetingAction.bind(null, m.id, false)}>Decline</ActionButton>
                      </>
                    )}
                    {(mine || m.status === "confirmed") && (
                      <ActionButton action={cancelMeetingAction.bind(null, m.id)} variant="ghost" confirm="Cancel this meeting?">
                        Cancel
                      </ActionButton>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {upcomingMeetups.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-muted">Meetups you&apos;ve joined</h3>
              <ul className="space-y-2">
                {upcomingMeetups.map(({ meetup: m }) => (
                  <li key={m.id}>
                    <Link href={`/explore/meetups/${m.id}`}>
                      <Card className="flex items-center justify-between gap-3 p-3 hover:border-accent/40">
                        <span>
                          <span className="font-medium">{m.title}</span>
                          <span className="block text-xs text-muted">
                            {labelFor(MEETUP_TOPICS, m.topic)} · {formatWhen(m.startsAt)}
                          </span>
                        </span>
                        <Badge tone={m.status === "confirmed" ? "success" : "pending"}>{m.status === "confirmed" ? "Confirmed" : "Proposed"}</Badge>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section id="connections" aria-labelledby="connections-h" className="scroll-mt-20">
          <SectionTitle id="connections-h">
            Connections <Count n={overview.connections.length} />
          </SectionTitle>
          {overview.connections.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title="No connections yet">
              Accepted connection requests appear here.
            </EmptyState>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {overview.connections.map(({ profile: p }) => (
                <li key={p.userId}>
                  <Card className="flex items-center gap-3 p-3">
                    <Avatar name={p.name} src={p.avatarUrl} size={40} />
                    <Link href={`/people/${p.userId}`} className="min-w-0 flex-1">
                      <span className="block font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{p.headline}</span>
                    </Link>
                    <LinkButton href={`/messages/${conversations.get(p.userId)}`} size="sm" variant="secondary">
                      Message
                    </LinkButton>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="saved" aria-labelledby="saved-h" className="scroll-mt-20">
          <SectionTitle id="saved-h">
            Saved profiles <Count n={saved.length} />
          </SectionTitle>
          {saved.length === 0 ? (
            <EmptyState icon={<Bookmark size={28} />} title="Nothing saved yet">
              Tap Save on anyone you&apos;d like to remember.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map(({ profile: p }) => (
                <li key={p.userId}>
                  <PersonCard profile={p} saved />
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-6 font-semibold">
            Saved exhibitors <Count n={exhibitors.length} />
          </h3>
          {exhibitors.length === 0 ? (
            <EmptyState icon={<Store size={28} />} title="No saved exhibitors" action={<LinkButton href="/explore" size="sm" variant="secondary">Browse exhibitors</LinkButton>} />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {exhibitors.map(({ exhibitor: e }) => (
                <li key={e.id}>
                  <Link href={`/explore/exhibitors/${e.id}`}>
                    <Card className="p-3 hover:border-accent/40">
                      <span className="flex items-center gap-2 font-medium">
                        {e.name} {e.isDemo && <DemoBadge />}
                      </span>
                      <span className="block text-xs text-muted">
                        {e.boothLocation && e.boothVerified ? `Booth ${e.boothLocation}` : "Booth location not yet confirmed"}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="notes" aria-labelledby="notes-h" className="scroll-mt-20">
          <SectionTitle id="notes-h">
            Follow-up notes <Count n={notes.length} />
          </SectionTitle>
          {notes.length === 0 ? (
            <EmptyState icon={<StickyNote size={28} />} title="No notes yet">
              Add private notes on anyone&apos;s profile to remember what to follow up on after Moonshot.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {notes.map(({ note, profile: p }) => (
                <li key={p.userId}>
                  <Card className="p-4">
                    <Link href={`/people/${p.userId}`} className="flex items-center gap-2 font-medium hover:underline">
                      <Avatar name={p.name} src={p.avatarUrl} size={28} /> {p.name}
                    </Link>
                    <p className="mt-2 whitespace-pre-line text-sm">{note.body}</p>
                    <p className="mt-1 text-xs text-muted">Updated {timeAgo(note.updatedAt)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
