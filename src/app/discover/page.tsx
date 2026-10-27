import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { discover, type DiscoverFilters } from "@/lib/services/people";
import { track } from "@/lib/services/analytics";
import { ATTENDANCE, GOALS, INDUSTRIES, INTERESTS, ROLES, type Option } from "@/lib/constants";
import { PersonCard } from "@/components/person-card";
import { Button, EmptyState, LinkButton, Notice, PageHeader, inputClass } from "@/components/ui";

export const metadata = { title: "Discover people" };

function Select({ name, label, options, value }: { name: string; label: string; options: Option[]; value?: string }) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={inputClass} aria-label={label}>
        <option value="">{label}: any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { profile, user } = await requireProfile("/discover");
  const sp = await searchParams;
  const filters: DiscoverFilters = {
    q: sp.q?.slice(0, 100),
    role: sp.role,
    industry: sp.industry,
    attendance: sp.attendance,
    interest: sp.interest,
    goal: sp.goal,
  };
  const filtering = Object.values(filters).some(Boolean);
  const db = await getDb();
  const results = await discover(db, profile, filters);
  if (filtering) await track(db, "search_performed", user.id, { ...filters, results: results.length });
  else if (results.length) await track(db, "recommendation_viewed", user.id, { count: Math.min(results.length, 24) });

  const recommended = filtering ? results : results.filter((r) => r.score > 0);
  const others = filtering ? [] : results.filter((r) => r.score === 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {(sp.notice === "blocked" || sp.notice === "reported") && (
        <div className="mb-6">
          <Notice tone="success">
            {sp.notice === "reported" ? "Thanks for your report — our moderators will review it. " : ""}That person is blocked: you won&apos;t see each other or be able to make contact. You can unblock from your Profile page.
          </Notice>
        </div>
      )}
      {sp.welcome && (
        <div className="mb-6">
          <Notice tone="success" title={`Welcome, ${profile.name.split(" ")[0]}!`}>
            Your profile is live. Here are people we think you should meet — each card explains why.
          </Notice>
        </div>
      )}
      <PageHeader title="Discover people" subtitle="Recommendations are based on shared interests, compatible goals and what people can offer." />

      <form method="get" className="mb-6 space-y-3" role="search">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search people</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={filters.q} placeholder="Search name, company, role, interest or goal" className={`${inputClass} pl-10`} />
          </label>
          <Button type="submit">Search</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select name="role" label="Role" options={ROLES} value={filters.role} />
          <Select name="industry" label="Industry" options={INDUSTRIES} value={filters.industry} />
          <Select name="attendance" label="Attendance" options={ATTENDANCE} value={filters.attendance} />
          <Select name="interest" label="Interest" options={INTERESTS} value={filters.interest} />
          <Select name="goal" label="Goal" options={GOALS} value={filters.goal} />
        </div>
        {filtering && (
          <p className="text-sm text-muted">
            {results.length} {results.length === 1 ? "person" : "people"} found ·{" "}
            <Link href="/discover" className="text-accent hover:underline">
              Clear filters
            </Link>
          </p>
        )}
      </form>

      {results.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title={filtering ? "No one matches those filters yet" : "You're early!"}
          action={filtering ? <LinkButton href="/discover" variant="secondary">Clear filters</LinkButton> : <LinkButton href="/conversation" variant="secondary">See who&apos;s talking about Moonshot</LinkButton>}
        >
          {filtering
            ? "Try a broader search or remove a filter."
            : "No other profiles are visible yet. Invite people you'd like to meet, or check back as more attendees join."}
        </EmptyState>
      ) : (
        <>
          {recommended.length > 0 && (
            <section aria-labelledby="rec">
              <h2 id="rec" className="mb-3 text-lg font-semibold">
                {filtering ? "Results" : "Recommended for you"}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((r) => (
                  <li key={r.profile.userId}>
                    <PersonCard profile={r.profile} reasons={r.reasons} saved={r.saved} status={r.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {others.length > 0 && (
            <section aria-labelledby="more" className="mt-10">
              <h2 id="more" className="mb-1 text-lg font-semibold">
                More people
              </h2>
              <p className="mb-3 text-sm text-muted">No obvious overlap yet — but you never know.</p>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((r) => (
                  <li key={r.profile.userId}>
                    <PersonCard profile={r.profile} saved={r.saved} status={r.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
