import Link from "next/link";
import { ArrowRight, CalendarHeart, Compass, ExternalLink, Handshake, MapPin, MessagesSquare, Sparkles } from "lucide-react";
import { sql } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { featuredProfiles } from "@/lib/services/people";
import { listPosts } from "@/lib/services/social";
import { getEventInfo } from "@/lib/services/settings";
import { GOALS, INTERESTS, labelFor } from "@/lib/constants";
import { timeAgo } from "@/lib/time";
import { PersonCard } from "@/components/person-card";
import { Card, LinkButton, SectionTitle } from "@/components/ui";

export default async function LandingPage() {
  const viewer = await getViewer();
  const db = await getDb();
  const [people, posts, event, interestRows] = await Promise.all([
    featuredProfiles(db, 3),
    listPosts(db, null, {}).then((r) => r.slice(0, 3)),
    getEventInfo(db),
    db.execute(sql`select i as interest, count(*)::int as n from profiles, unnest(interests) i where visibility <> 'hidden' group by i order by n desc limit 12`),
  ]);
  const rows = (Array.isArray(interestRows) ? interestRows : (interestRows as { rows: unknown[] }).rows) as { interest: string; n: number }[];
  const popular = rows.length >= 4 ? rows.map((r) => ({ value: r.interest, n: r.n })) : INTERESTS.slice(0, 12).map((i) => ({ value: i.value, n: 0 }));
  const findHref = viewer ? (viewer.profile ? "/discover" : "/onboarding") : "/login?next=/onboarding";

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent-100 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-muted">
            <MapPin size={12} aria-hidden /> {event.name} · {event.city} · {event.dates}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Moonshot is better when you meet <span className="text-accent">the right people.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Discover people talking about Moonshot, meet founders and builders with shared interests, find interesting companies, and turn
            conversations into meaningful connections.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href={findHref} size="lg">
              Find Your People <ArrowRight size={18} aria-hidden />
            </LinkButton>
            <LinkButton href="/conversation" size="lg" variant="secondary">
              Explore the Conversation
            </LinkButton>
          </div>
          <p className="mt-4 text-xs text-muted">Free · For attendees, people planning to go, and anyone following remotely.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: Compass, title: "Tell us what you're after", body: "Pick your interests, what you want from Moonshot and what you can offer. Two minutes, tops." },
            { icon: Sparkles, title: "See who to meet — and why", body: "Recommendations come with plain-English reasons: shared interests, compatible goals, complementary skills." },
            { icon: Handshake, title: "Make it happen", body: "Send a personal request, chat once accepted, and agree a time and place. Nothing's confirmed until both of you say yes." },
          ].map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent">
                    <s.icon size={20} aria-hidden />
                  </span>
                  <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
                </div>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {people.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-14" aria-labelledby="featured">
          <SectionTitle id="featured" action={<Link href={findHref} className="text-sm font-medium text-accent hover:underline">See your matches →</Link>}>
            People on Moonshot Connect
          </SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <li key={p.userId}>
                <PersonCard profile={p} showActions={false} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Only people who chose a public profile are shown here.</p>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-14" aria-labelledby="convo">
        <SectionTitle id="convo" action={<Link href="/conversation" className="text-sm font-medium text-accent hover:underline">Explore the conversation →</Link>}>
          The conversation around Moonshot
        </SectionTitle>
        {posts.length === 0 ? (
          <Card className="flex items-start gap-3 p-5">
            <MessagesSquare className="mt-0.5 shrink-0 text-muted" size={20} aria-hidden />
            <p className="text-sm text-muted">
              We collect public posts about Moonshot from X — with links back to the originals — so you can find people worth meeting. Posts appear
              here once they&apos;ve been added.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {posts.map(({ post }) => (
              <li key={post.id}>
                <Card className="flex h-full flex-col p-4">
                  <p className="text-sm font-medium">
                    {post.authorName ?? ""} {post.authorHandle && <span className="text-muted">@{post.authorHandle}</span>}
                  </p>
                  <p className="mt-2 line-clamp-4 flex-1 text-sm">{post.content ?? <span className="italic text-muted">Open on X to read this post.</span>}</p>
                  <a href={`/go/post/${post.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                    {post.postedAt ? timeAgo(post.postedAt) : "View"} on X <ExternalLink size={12} aria-hidden />
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14" aria-labelledby="interests">
        <SectionTitle id="interests">Popular networking interests</SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {popular.map((i) => (
            <li key={i.value} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">
              {labelFor(INTERESTS, i.value)}
              {i.n > 0 && <span className="ml-1 text-muted">· {i.n}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          People come to meet for many reasons: {GOALS.slice(0, 6).map((g) => g.label.toLowerCase()).join(", ")} and more.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14" aria-labelledby="event">
        <Card className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
              <CalendarHeart size={14} aria-hidden /> The event
            </p>
            <h2 id="event" className="mt-2 text-2xl font-semibold tracking-tight">
              {event.name}
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Dates</dt>
              <dd>{event.dates}</dd>
              <dt className="text-muted">City</dt>
              <dd>{event.city}</dd>
              <dt className="text-muted">Venue</dt>
              <dd>{event.venue || "See the official website"}</dd>
            </dl>
            {event.summary && <p className="mt-3 max-w-2xl text-sm text-muted">{event.summary}</p>}
          </div>
          {event.officialUrl && (
            <a href={event.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Official event website <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note">
          <strong>Independent prototype.</strong> Moonshot Connect is not affiliated with, endorsed by, or operated by TechCabal or the Moonshot
          conference. Attendance shown on profiles is self-reported unless marked as verified.
        </div>
      </section>
    </div>
  );
}
