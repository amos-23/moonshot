import Link from "next/link";
import { Search } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { commentsFor, feed, listMoments } from "@/lib/data";
import { FILTERS, isFilter, searchWords } from "@/lib/search";
import { after } from "next/server";
import { backfillImages, refreshLive } from "@/lib/social/live";
import { recordSearch } from "@/lib/track";
import { siteOrigin } from "@/lib/site";
import { EVENT } from "@/lib/constants";
import { PersonCard, XCard } from "@/components/person";
import { ShareButtons } from "@/components/share";
import { ScrollIntoView } from "@/components/client";
import { Button, Card, Empty, LinkButton, Notice, Sunburst, cx, inputClass } from "@/components/ui";

type SP = { q?: string; added?: string; f?: string; sort?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const filter = isFilter(sp.f) ? sp.f : undefined;
  const db = await getDb();
  const me = await getMe();
  // "For you" needs a card to match against; without one, show the newest first.
  const sort = sp.sort === "new" || sp.sort === "match" ? sp.sort : me ? "match" : "new";
  await refreshLive(db).catch(() => null); // no-op unless X_BEARER_TOKEN is set
  // Fill in images for older X posts after the page has been sent, so it never slows it down.
  after(() => backfillImages(db).catch((err) => console.error("image backfill failed", err)));
  const { items, gaps, counts } = await feed(db, me, { q, filter, sort });
  const [comments, moments] = await Promise.all([
    commentsFor(db, items.flatMap((i) => (i.kind === "x" ? [i.post.id] : []))),
    q || filter ? Promise.resolve([]) : listMoments(db, { limit: 12 }),
  ]);
  if (q) await recordSearch(q, items.length);
  const origin = await siteOrigin();

  const href = (patch: Partial<SP>) => {
    const next = { q, f: filter, sort: sp.sort, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return `/${qs ? `?${qs}` : ""}`;
  };
  const chip = (on: boolean) => cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold", on ? "bg-ink text-white" : "border border-line bg-white hover:border-ink/40");
  const gap = filter && gaps[filter];
  // A search that looks like a person's name: invite them when they're not here.
  const looksLikeName = q && searchWords(q).length <= 3 && !/\d/.test(q);

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
          {me ? (
            <LinkButton href="/update" variant="dark" size="lg" className="mt-6" data-track="update_hero">
              📸 Post an update
            </LinkButton>
          ) : (
            <LinkButton href="/card" variant="dark" size="lg" className="mt-6" data-track="add_yourself_hero">
              Add yourself
            </LinkButton>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {sp.added && (
          <ScrollIntoView>
          <div className="mb-6 space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-900">
              {sp.added === "x" ? "Your post is on the list." : sp.added === "update" ? "Update posted — it's on your card now." : "You're on the list! Now tell people where to find you."}
            </p>
            {sp.added === "card" && me && (
              <LinkButton href="/update" size="sm" data-track="update_after_signup">
                📸 Add a photo &amp; where to catch you
              </LinkButton>
            )}
            {(sp.added === "card" || sp.added === "update") && me && (
              <ShareButtons
                track="share_card"
                text="I'm on Moonshot Connect — find me and see who else is at Moonshot:"
                url={`${origin}/?q=${encodeURIComponent(me.name)}`}
              />
            )}
          </div>
          </ScrollIntoView>
        )}

        {!q && !filter && (
          <section aria-labelledby="moments-h" className="mb-8">
            <div className="mb-3 flex items-end justify-between">
              <h2 id="moments-h" className="text-lg font-extrabold uppercase">
                📸 Moments
              </h2>
              <Link href="/moments" className="text-sm font-semibold text-flame-700 hover:underline" data-track="moments_see_all">
                {moments.length ? "See all →" : "Share one →"}
              </Link>
            </div>
            {moments.length === 0 ? (
              <Link href="/moments" className="block rounded-3xl border border-dashed border-line bg-white p-5 text-center text-sm text-muted hover:border-ink/30" data-track="moments_empty_cta">
                Be the first to share a photo or update from Moonshot →
              </Link>
            ) : (
              <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                <li className="shrink-0">
                  <Link href="/moments" data-track="moments_strip_add" className="flex h-40 w-28 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-flame/40 bg-flame-50 text-center text-sm font-semibold text-flame-700">
                    <span className="text-2xl" aria-hidden>
                      ＋
                    </span>
                    Add yours
                  </Link>
                </li>
                {moments.map(({ moment: m, author }) => (
                  <li key={m.id} className="shrink-0">
                    <Link href="/moments" data-track="moments_strip" className="relative block h-40 w-28 overflow-hidden rounded-2xl bg-ink text-white">
                      {m.hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/moment-photo/${m.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="line-clamp-6 p-3 text-sm font-medium">{m.body}</span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-xs font-semibold">
                        {author?.name ?? (m.xHandle ? `@${m.xHandle}` : m.name ?? "At Moonshot")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <form role="search" method="get" className="mb-4 flex gap-2">
          {filter && <input type="hidden" name="f" value={filter} />}
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
          <label className="relative flex-1">
            <span className="sr-only">Search</span>
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Search a name, role or what they do" className={`${inputClass} pl-11`} />
          </label>
          <Button type="submit" variant="dark">
            Search
          </Button>
        </form>

        <nav aria-label="Filters" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Link href={href({ f: undefined })} className={chip(!filter)} aria-current={!filter ? "page" : undefined}>
            All
          </Link>
          {Object.entries(FILTERS).map(([key, def]) => (
            <Link key={key} href={href({ f: filter === key ? undefined : key })} className={chip(filter === key)} aria-current={filter === key ? "page" : undefined} data-track={`filter_${key}`}>
              {def.label} <span className={filter === key ? "text-white/70" : "text-muted"}>{counts[key]}</span>
            </Link>
          ))}
          <Link href={href({ f: filter === "x" ? undefined : "x" })} className={chip(filter === "x")} aria-current={filter === "x" ? "page" : undefined} data-track="filter_x">
            From X <span className={filter === "x" ? "text-white/70" : "text-muted"}>{counts.x}</span>
          </Link>
        </nav>

        <div className="mb-6 flex items-center justify-between gap-3">
          <div role="tablist" aria-label="Order" className="inline-flex rounded-full border border-line bg-white p-1 text-sm font-semibold">
            {(
              [
                ["match", "For you"],
                ["new", "Newest"],
              ] as const
            ).map(([value, label]) => (
              <Link key={value} role="tab" aria-selected={sort === value} href={href({ sort: value })} data-track={`sort_${value}`} className={cx("rounded-full px-4 py-1.5", sort === value ? "bg-flame-700 text-white" : "text-muted hover:text-ink")}>
                {label}
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted">{items.length} {items.length === 1 ? "person" : "people"}</p>
        </div>
        {sort === "match" && !me && (
          <p className="-mt-3 mb-5 text-sm text-muted">
            <Link href="/card" className="font-semibold text-flame-700 underline">
              Add yourself
            </Link>{" "}
            to see who fits you best.
          </p>
        )}

        {gap && gap.want > gap.have && (
          <div className="mb-6">
            <Notice tone="warn">
              <strong>{gap.want} people</strong> want to meet {FILTERS[filter].wantLabel} — {gap.have === 0 ? "none" : `only ${gap.have}`} {gap.have === 1 ? "is" : "are"} here yet.{" "}
              {filter === "investors" ? "Investing?" : "Hiring?"}{" "}
              <Link href="/card" className="font-semibold underline">
                Add yourself
              </Link>{" "}
              or share this page with someone who is.
            </Notice>
          </div>
        )}

        {items.length === 0 ? (
          q && looksLikeName ? (
            <Card className="p-6 text-center">
              <p className="text-lg font-bold">“{q}” isn&apos;t here yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">Invite them, so you (and everyone else at Moonshot) can find them.</p>
              <div className="mt-4 flex justify-center">
                <ShareButtons track="invite" text={`${q}, I'm looking for you on Moonshot Connect. Add yourself so people at Moonshot can find you:`} url={`${origin}/card`} />
              </div>
            </Card>
          ) : (
            <Empty title={q || filter ? "No one matches that" : "No one here yet"} action={q || filter ? <LinkButton href="/" variant="secondary">Clear</LinkButton> : <LinkButton href="/card">Add yourself</LinkButton>}>
              {q || filter ? "Try another search or filter." : "Be the first — it takes a few seconds."}
            </Empty>
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) =>
              i.kind === "person" ? (
                <li key={i.person.id}>
                  <PersonCard person={i.person} reasons={i.reasons} showJoined={sort === "new"} />
                </li>
              ) : (
                <li key={i.post.id}>
                  <XCard post={i.post} comments={comments.get(i.post.id)} myName={me?.name ?? null} />
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
