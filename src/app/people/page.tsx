import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { listPeople } from "@/lib/data";
import { INTERESTS, OFFERS, WANTS, labelFor, type Option } from "@/lib/constants";
import { PersonCard } from "@/components/person";
import { SavedOnly } from "@/components/client";
import { Button, Empty, LinkButton, Notice, PageTitle, cx, inputClass } from "@/components/ui";

export const metadata = { title: "People" };

type SP = Record<string, string | undefined>;

function href(sp: SP, patch: SP) {
  const next: SP = { ...sp, ...patch, welcome: undefined };
  const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return `/people${qs ? `?${qs}` : ""}`;
}

function FilterRow({ label, param, options, sp }: { label: string; param: string; options: Option[]; sp: SP }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {options.map((o) => {
        const on = sp[param] === o.value;
        return (
          <Link key={o.value} href={href(sp, { [param]: on ? undefined : o.value })} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40")}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const valid = (opts: Option[], v?: string) => (opts.some((o) => o.value === v) ? v : undefined);
  const filters = { q: sp.q, want: valid(WANTS, sp.want), offer: valid(OFFERS, sp.offer), interest: valid(INTERESTS, sp.interest), here: sp.here === "1" };
  const db = await getDb();
  const me = await getMe();
  const results = await listPeople(db, me, filters);
  const filtering = Boolean(filters.q || filters.want || filters.offer || filters.interest || filters.here);
  const savedView = sp.view === "saved";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {sp.welcome && (
        <div className="mb-6 space-y-2">
          <Notice tone="success">
            <strong>Your card is live!</strong> {results.some((r) => r.score > 0) ? "People who fit what you're looking for are at the top." : "Check back as more people join."} You can edit it any time from{" "}
            <Link href="/card" className="font-semibold underline">
              My card
            </Link>
            .
          </Notice>
        </div>
      )}
      <PageTitle
        title="People"
        sub={me ? "Sorted by how well you fit — reasons on each card." : "Make your card to see who fits you best."}
        action={!me && <LinkButton href="/card">Make my card</LinkButton>}
      />

      <form role="search" method="get" className="mb-4 flex gap-2">
        {Object.entries({ want: filters.want, offer: filters.offer, interest: filters.interest, here: filters.here ? "1" : undefined }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <label className="relative flex-1">
          <span className="sr-only">Search people</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={filters.q} placeholder="Search name, company or role" className={`${inputClass} pl-11`} />
        </label>
        <Button type="submit" variant="dark">
          Search
        </Button>
      </form>

      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Link href={href(sp, { view: undefined })} className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", !savedView ? "bg-flame-700 text-white" : "border border-line bg-white")}>
            Everyone
          </Link>
          <Link href={href(sp, { view: "saved" })} className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", savedView ? "bg-flame-700 text-white" : "border border-line bg-white")}>
            Saved
          </Link>
          <Link href={href(sp, { here: filters.here ? undefined : "1" })} className={cx("inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold", filters.here ? "bg-sun text-ink" : "border border-line bg-white")}>
            <MapPin size={14} aria-hidden /> Findable now
          </Link>
          {filtering && (
            <Link href="/people" className="px-2 py-1.5 text-sm text-flame-700 underline">
              Clear
            </Link>
          )}
        </div>
        <FilterRow label="Looking for" param="want" options={WANTS} sp={sp} />
        <FilterRow label="Offers" param="offer" options={OFFERS} sp={sp} />
        <FilterRow label="Topic" param="interest" options={INTERESTS} sp={sp} />
      </div>

      {savedView ? (
        <SavedOnly
          items={results.map((r) => ({ id: r.person.id, node: <PersonCard person={r.person} reasons={r.reasons} here={r.here} /> }))}
          empty={<Empty title="Nothing saved yet">Tap the bookmark on any card. Saved people stay on this device.</Empty>}
        />
      ) : results.length === 0 ? (
        <Empty title={filtering ? "No one matches that yet" : "Be one of the first"} action={filtering ? <LinkButton href="/people" variant="secondary">Clear filters</LinkButton> : <LinkButton href="/card">Make my card</LinkButton>}>
          {filtering ? "Try fewer filters." : "No cards yet. Make yours and share the link with people going to Moonshot."}
        </Empty>
      ) : (
        <>
          {filtering && <p className="mb-3 text-sm text-muted">{results.length} found</p>}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <li key={r.person.id}>
                <PersonCard person={r.person} reasons={r.reasons} here={r.here} />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="sr-only">{filters.want && `Filtered by ${labelFor(WANTS, filters.want)}`}</p>
    </div>
  );
}
