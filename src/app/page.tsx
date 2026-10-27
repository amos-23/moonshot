import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { counts, listHangouts, listPeople } from "@/lib/data";
import { EVENT } from "@/lib/constants";
import { formatWhen } from "@/lib/time";
import { PersonCard } from "@/components/person";
import { Card, LinkButton, Notice, Sunburst } from "@/components/ui";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const db = await getDb();
  const me = await getMe();
  const [c, people, hangouts] = await Promise.all([counts(db), listPeople(db, me), listHangouts(db, me?.id ?? null)]);

  return (
    <div>
      <section className="relative overflow-hidden bg-flame text-white">
        <Sunburst className="absolute inset-x-0 bottom-0 h-[78%] w-full" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 text-center sm:pb-28 sm:pt-20">
          <p className="text-sm font-bold uppercase tracking-[0.2em]">
            {EVENT.dates} · {EVENT.venue}
          </p>
          <h1 className="mx-auto mt-4 max-w-4xl text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Meet the right people at Moonshot
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-medium text-white/95">
            Make a 30-second card. See who&apos;s here, what they&apos;re looking for, and how to reach them. No sign-up, no app to install.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href={me ? "/people" : "/card"} size="lg" variant="dark">
              {me ? "Find your people" : "Make my card"} <ArrowRight size={18} aria-hidden />
            </LinkButton>
            <LinkButton href="/people" size="lg" variant="secondary">
              Browse {c.people > 0 ? `${c.people} ${c.people === 1 ? "person" : "people"}` : "people"}
            </LinkButton>
          </div>
          {c.here > 0 && (
            <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-4 py-1.5 text-sm font-semibold">
              <MapPin size={14} aria-hidden /> {c.here} {c.here === 1 ? "person has" : "people have"} shared where to find them right now
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {deleted && <Notice tone="success">Your card has been deleted.</Notice>}

        <section aria-labelledby="how" className="grid gap-4 md:grid-cols-3">
          <h2 id="how" className="sr-only">
            How it works
          </h2>
          {[
            ["1", "Make your card", "Name, what you do, what you're looking for, how to reach you. That's it."],
            ["2", "Find your matches", "We highlight people whose offers fit what you want — and say why."],
            ["3", "Reach out & meet", "Message them on WhatsApp, X or LinkedIn, or join a hangout at the venue."],
          ].map(([n, t, b]) => (
            <Card key={n} className="p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sun text-lg font-black">{n}</span>
              <p className="mt-3 text-lg font-bold">{t}</p>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </Card>
          ))}
        </section>

        {people.length > 0 && (
          <section aria-labelledby="who">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="who" className="text-2xl font-extrabold uppercase">
                {me ? "People to meet" : "Who's here"}
              </h2>
              <Link href="/people" className="text-sm font-semibold text-flame-700 hover:underline">
                See everyone →
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {people.slice(0, 6).map((r) => (
                <li key={r.person.id}>
                  <PersonCard person={r.person} reasons={r.reasons} here={r.here} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {hangouts.length > 0 && (
          <section aria-labelledby="hang">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="hang" className="text-2xl font-extrabold uppercase">
                Hangouts
              </h2>
              <Link href="/hangouts" className="text-sm font-semibold text-flame-700 hover:underline">
                All hangouts →
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {hangouts.slice(0, 4).map(({ hangout: h, going }) => (
                <li key={h.id}>
                  <Link href="/hangouts" className="block">
                    <Card className="p-4 hover:border-ink/30">
                      <p className="font-bold">{h.title}</p>
                      <p className="text-sm text-muted">
                        {formatWhen(h.startsAt)} · {h.place} · {going}/{h.capacity} going
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid gap-6 rounded-3xl bg-ink p-6 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sun">The event</p>
            <h2 className="mt-2 text-3xl font-black uppercase">{EVENT.theme}</h2>
            <p className="mt-1 text-white/80">
              {EVENT.name} · {EVENT.dates} · {EVENT.venue}. {EVENT.tagline}
            </p>
          </div>
          <a href={EVENT.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center rounded-full bg-sun px-6 text-sm font-bold text-ink hover:bg-white">
            Official site & tickets ↗
          </a>
        </section>
      </div>
    </div>
  );
}
