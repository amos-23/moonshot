import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { canManageEvent } from "@/lib/event-access";
import { ownerSetHiddenAction } from "@/lib/event-actions";
import { siteOrigin } from "@/lib/site";
import { timeAgo } from "@/lib/time";
import { OrganiserEventForm } from "@/components/event-forms";
import { ActionButton, CopyButton } from "@/components/client";
import { Card, Notice, Tag, cx } from "@/components/ui";

export const metadata = { title: "Manage event", robots: { index: false } };

type Kind = "person" | "moment" | "comment" | "checkin";

// For the event's organiser (and admins): edit the details and keep what's posted tidy.
export default async function ManageEventPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ event: slug }, { created }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const event = await getEvent(db, slug);
  if (!event || !(await canManageEvent(event))) notFound();
  const origin = await siteOrigin();
  const link = `${origin}/${event.slug}`;
  const [people, moments, comments, checkins] = await Promise.all([
    db.select().from(schema.people).where(eq(schema.people.eventId, event.id)).orderBy(desc(schema.people.createdAt)).limit(300),
    db.select().from(schema.moments).where(eq(schema.moments.eventId, event.id)).orderBy(desc(schema.moments.createdAt)).limit(300),
    db
      .select({ c: schema.comments })
      .from(schema.comments)
      .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
      .where(eq(schema.socialPosts.eventId, event.id))
      .orderBy(desc(schema.comments.createdAt))
      .limit(200)
      .then((r) => r.map((x) => x.c)),
    db.select().from(schema.checkins).where(sql`${schema.checkins.eventId} = ${event.id} and ${schema.checkins.endedAt} is null and ${schema.checkins.expiresAt} > now()`).orderBy(desc(schema.checkins.createdAt)).limit(200),
  ]);

  const Row = ({ kind, id, title, sub, hidden }: { kind: Kind; id: string; title: string; sub: string; hidden: boolean }) => (
    <li className={cx("flex items-center gap-3 px-4 py-3 text-sm", hidden && "bg-canvas/70")}>
      <span className={cx("min-w-0 flex-1", hidden && "opacity-60")}>
        <span className="block truncate font-semibold">{title}</span>
        <span className="line-clamp-2 text-muted">{sub}</span>
      </span>
      {hidden && <Tag>hidden</Tag>}
      <ActionButton action={ownerSetHiddenAction.bind(null, kind, id, !hidden)} variant={hidden ? "secondary" : "danger"}>
        {hidden ? "Unhide" : "Hide"}
      </ActionButton>
    </li>
  );
  const List = ({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) => (
    <section>
      <h2 className="mb-3 text-lg font-bold">
        {title} · {count}
      </h2>
      {count === 0 ? <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{empty}</p> : <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</ul>}
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {created && <Notice tone="success">Your event is ready 🎉 Share the link below so your guests can add themselves.</Notice>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Manage</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{event.name}</h1>
        </div>
        <Link href={`/${event.slug}`} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink/40">
          View event page
        </Link>
      </div>

      <Card className="space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Share your event</h2>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 break-all rounded-2xl bg-canvas px-4 py-3 font-mono text-sm">{link}</p>
          <CopyButton text={link} label="Copy link" />
        </div>
        <p className="text-sm text-muted">
          {event.listed ? (
            <>It&apos;s on the Event Connect homepage too.</>
          ) : (
            <>
              <Tag tone="sun">Waiting for approval</Tag> Anyone with the link can use it now. It joins the homepage once an admin has had a quick look.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href={`/${event.slug}/card`} className="text-flame-700 underline">
            Add yourself
          </Link>
          <span className="text-muted">·</span>
          <Link href={`/${event.slug}/moments`} className="text-flame-700 underline">
            Moments
          </Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Event details</h2>
        <OrganiserEventForm event={event} origin={origin} />
      </Card>

      <p className="text-sm text-muted">Anything with 3 reports hides itself. You can hide or bring back anything posted in your event here.</p>
      {checkins.length > 0 && (
        <List title="Here now" count={checkins.length} empty="">
          {checkins.map((c) => (
            <Row key={c.id} kind="checkin" id={c.id} title={c.name} sub={`📍 ${c.place}${c.note ? ` · ${c.note}` : ""}`} hidden={c.hidden} />
          ))}
        </List>
      )}
      <List title="Cards" count={people.length} empty="No one has added themselves yet. Share the link!">
        {people.map((p) => (
          <Row key={p.id} kind="person" id={p.id} title={p.name} sub={`${p.headline} · ${timeAgo(p.createdAt)}`} hidden={p.hidden} />
        ))}
      </List>
      <List title="Moments" count={moments.length} empty="No moments yet.">
        {moments.map((m) => (
          <Row key={m.id} kind="moment" id={m.id} title={m.xPostUrl ? (m.xAuthorName ?? `@${m.xAuthorHandle}`) : (m.name ?? "Someone at the event")} sub={`${(m.body || m.xText || "Photo").slice(0, 120)} · ${timeAgo(m.createdAt)}`} hidden={m.hidden} />
        ))}
      </List>
      {comments.length > 0 && (
        <List title="Comments" count={comments.length} empty="">
          {comments.map((c) => (
            <Row key={c.id} kind="comment" id={c.id} title={c.name} sub={c.body.slice(0, 120)} hidden={c.hidden} />
          ))}
        </List>
      )}
    </div>
  );
}
