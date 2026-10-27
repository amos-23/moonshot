import { Search } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { commentsFor, listPeople, listXCards } from "@/lib/data";
import { refreshLive } from "@/lib/social/live";
import { recordSearch } from "@/lib/track";
import { EVENT } from "@/lib/constants";
import { PersonCard, XCard } from "@/components/person";
import { Button, Empty, LinkButton, Notice, Sunburst, inputClass } from "@/components/ui";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; added?: string }> }) {
  const { q, added } = await searchParams;
  const db = await getDb();
  const me = await getMe();
  await refreshLive(db).catch(() => null); // no-op unless X_BEARER_TOKEN is set
  const [people, xCards] = await Promise.all([listPeople(db, me, q), listXCards(db, q)]);
  const comments = await commentsFor(db, xCards.map((p) => p.id));
  const total = people.length + xCards.length;
  if (q?.trim()) await recordSearch(q, total);

  return (
    <div>
      <section className="relative overflow-hidden bg-flame text-white">
        <Sunburst className="absolute inset-x-0 bottom-0 h-full w-full" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 text-center sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">
            {EVENT.dates} · {EVENT.venue}
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">Who&apos;s at Moonshot</h1>
          <p className="mx-auto mt-3 max-w-md font-medium">Find people worth meeting and reach them directly. No sign-up.</p>
          {!me && (
            <LinkButton href="/card" variant="dark" size="lg" className="mt-6" data-track="add_yourself_hero">
              Add yourself
            </LinkButton>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {added && (
          <div className="mb-6">
            <Notice tone="success">{added === "x" ? "Your post is on the list." : "You're on the list. People who fit what you want are at the top."}</Notice>
          </div>
        )}
        <form role="search" method="get" className="mb-6 flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search</span>
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Search names, roles, companies, posts" className={`${inputClass} pl-11`} />
          </label>
          <Button type="submit" variant="dark">
            Search
          </Button>
        </form>

        {total === 0 ? (
          <Empty title={q ? "No one matches that" : "No one here yet"} action={!q && <LinkButton href="/card">Add yourself</LinkButton>}>
            {q ? "Try another search." : "Be the first — it takes a few seconds."}
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((r) => (
              <li key={r.person.id}>
                <PersonCard person={r.person} reasons={r.reasons} />
              </li>
            ))}
            {xCards.map((p) => (
              <li key={p.id}>
                <XCard post={p} comments={comments.get(p.id)} myName={me?.name ?? null} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
