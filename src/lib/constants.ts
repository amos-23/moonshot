// Short, fixed lists keep the card fast to fill in and make matching predictable.

export type Option = { value: string; label: string };

export const WANTS: Option[] = [
  { value: "customers", label: "Customers" },
  { value: "partners", label: "Business partners" },
  { value: "investors", label: "Investors" },
  { value: "founders", label: "Founders" },
  { value: "job", label: "A new job" },
  { value: "talent", label: "People to hire" },
  { value: "cofounder", label: "A co-founder" },
  { value: "ai_builders", label: "AI builders" },
  { value: "mentors", label: "Mentors" },
  { value: "friends", label: "Interesting people" },
];

export const OFFERS: Option[] = [
  { value: "investment", label: "Investment" },
  { value: "intros", label: "Customer intros" },
  { value: "distribution", label: "Distribution & partnerships" },
  { value: "growth", label: "Marketing & growth" },
  { value: "engineering", label: "Engineering" },
  { value: "ai", label: "AI / ML know-how" },
  { value: "product", label: "Product & design feedback" },
  { value: "hiring", label: "Jobs — I'm hiring" },
  { value: "mentorship", label: "Mentorship" },
  { value: "buying", label: "I buy tools & services" },
  { value: "media", label: "Media & storytelling" },
];

export const INTERESTS: Option[] = [
  { value: "ai", label: "AI" },
  { value: "fintech", label: "Fintech" },
  { value: "payments", label: "Payments" },
  { value: "crypto", label: "Crypto" },
  { value: "health", label: "Health" },
  { value: "edtech", label: "Edtech" },
  { value: "agritech", label: "Agritech" },
  { value: "climate", label: "Climate & energy" },
  { value: "logistics", label: "Logistics & mobility" },
  { value: "commerce", label: "Commerce" },
  { value: "saas", label: "B2B SaaS" },
  { value: "devtools", label: "Developer tools" },
  { value: "creator", label: "Creator economy" },
  { value: "media", label: "Media" },
  { value: "fundraising", label: "Fundraising" },
  { value: "careers", label: "Careers" },
  { value: "policy", label: "Policy" },
];

// "If you want X, people who offer Y are a good fit."
export const WANT_MATCHES: Record<string, string[]> = {
  customers: ["intros", "buying", "distribution", "growth"],
  partners: ["distribution", "intros", "growth"],
  investors: ["investment"],
  job: ["hiring"],
  talent: ["engineering", "ai", "product", "growth"],
  cofounder: ["engineering", "product", "growth", "ai"],
  ai_builders: ["ai"],
  mentors: ["mentorship"],
};

export const ATTENDANCE: Option[] = [
  { value: "in_person", label: "At Moonshot in person" },
  { value: "remote", label: "Following online" },
];

export const POST_THEMES: Option[] = [
  { value: "attendance", label: "Who's going" },
  { value: "networking", label: "Networking" },
  { value: "startups", label: "Startups" },
  { value: "ai", label: "AI" },
  { value: "investors", label: "Investors" },
  { value: "exhibitors", label: "Booths & exhibitors" },
];

export const SEARCH_PHRASES = [
  "Moonshot by TechCabal",
  "Moonshot 2026",
  "Going to Moonshot",
  "Attending Moonshot",
  "Who is going to Moonshot?",
  "Looking to meet founders",
  "Moonshot networking",
];

// From the official site (moonshot.techcabal.com).
export const EVENT = {
  name: "Moonshot by TechCabal",
  theme: "Courage & Conviction",
  tagline: "Building for a new world.",
  dates: "28–29 October 2026",
  venue: "National Theatre, Lagos",
  url: "https://moonshot.techcabal.com",
  /** Midnight in Lagos after day 2. */
  endsAt: new Date("2026-10-29T23:00:00Z"),
};

/** After Moonshot the site switches to "find the people you met". EVENT_MODE=live|after overrides the date. */
export function eventOver(now = new Date()) {
  const mode = process.env.EVENT_MODE;
  if (mode === "live" || mode === "after") return mode === "after";
  return now >= EVENT.endsAt;
}

export function labelFor(options: Option[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

export const values = (options: Option[]) => options.map((o) => o.value) as [string, ...string[]];

/** Photos per moment. */
export const MAX_MOMENT_PHOTOS = 4;
