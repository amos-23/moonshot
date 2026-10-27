// Controlled vocabularies. Stored as slugs in the database; labels are for display only.

export type Option = { value: string; label: string };

export const INTERESTS: Option[] = [
  { value: "ai", label: "AI & machine learning" },
  { value: "ai_agents", label: "AI agents" },
  { value: "fintech", label: "Fintech" },
  { value: "payments", label: "Payments" },
  { value: "crypto", label: "Crypto & web3" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "agritech", label: "Agritech" },
  { value: "climate", label: "Climate & energy" },
  { value: "mobility", label: "Mobility & logistics" },
  { value: "ecommerce", label: "E-commerce & retail" },
  { value: "saas", label: "B2B SaaS" },
  { value: "devtools", label: "Developer tools" },
  { value: "infrastructure", label: "Cloud & infrastructure" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "product", label: "Product management" },
  { value: "design", label: "Design" },
  { value: "product_marketing", label: "Product marketing" },
  { value: "growth", label: "Growth & customer acquisition" },
  { value: "fundraising", label: "Startup fundraising" },
  { value: "venture", label: "Venture capital" },
  { value: "creator_economy", label: "Creator businesses" },
  { value: "media", label: "Media & storytelling" },
  { value: "careers", label: "Technology careers" },
  { value: "policy", label: "Policy & regulation" },
  { value: "african_markets", label: "Building for African markets" },
];

export const GOALS: Option[] = [
  { value: "find_customers", label: "Find customers" },
  { value: "find_partners", label: "Find business partners" },
  { value: "meet_investors", label: "Meet investors" },
  { value: "meet_founders", label: "Meet founders" },
  { value: "explore_jobs", label: "Explore jobs and career opportunities" },
  { value: "discover_startups", label: "Discover startups and products" },
  { value: "meet_ai_builders", label: "Meet AI builders" },
  { value: "find_collaborators", label: "Find collaborators" },
  { value: "join_conversations", label: "Join conversations around shared interests" },
  { value: "meet_interesting_people", label: "Meet interesting people" },
];

export const OFFERS: Option[] = [
  { value: "investment", label: "Investment or funding" },
  { value: "customer_intros", label: "Customer introductions" },
  { value: "distribution", label: "Distribution & partnerships" },
  { value: "marketing", label: "Marketing & growth expertise" },
  { value: "engineering", label: "Engineering expertise" },
  { value: "ai_expertise", label: "AI / ML expertise" },
  { value: "product_feedback", label: "Product & design feedback" },
  { value: "hiring", label: "Jobs / hiring" },
  { value: "mentorship", label: "Mentorship & advice" },
  { value: "legal_regulatory", label: "Legal & regulatory know-how" },
  { value: "media_coverage", label: "Media & press" },
  { value: "community", label: "Community access" },
  { value: "buying", label: "Buying products & services" },
];

export const ROLES: Option[] = [
  { value: "founder", label: "Founder / co-founder" },
  { value: "investor", label: "Investor" },
  { value: "engineer", label: "Engineer / developer" },
  { value: "ai_builder", label: "AI / ML builder" },
  { value: "product", label: "Product" },
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing & growth" },
  { value: "sales", label: "Sales & partnerships" },
  { value: "operator", label: "Operations / executive" },
  { value: "creator", label: "Creator" },
  { value: "media", label: "Media / journalist" },
  { value: "student", label: "Student / early career" },
  { value: "policy", label: "Policy / government" },
  { value: "other", label: "Other" },
];

export const INDUSTRIES: Option[] = [
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "agritech", label: "Agritech" },
  { value: "climate", label: "Climate & energy" },
  { value: "logistics", label: "Mobility & logistics" },
  { value: "commerce", label: "Commerce & retail" },
  { value: "software", label: "Software & SaaS" },
  { value: "ai", label: "AI" },
  { value: "media", label: "Media & entertainment" },
  { value: "telecom", label: "Telecoms" },
  { value: "investment", label: "Investment" },
  { value: "public_sector", label: "Public sector & NGOs" },
  { value: "other", label: "Other" },
];

export const ATTENDANCE: Option[] = [
  { value: "in_person", label: "Attending in person" },
  { value: "remote", label: "Following remotely" },
  { value: "undecided", label: "Undecided" },
];

export const NETWORKING_STYLES: Option[] = [
  { value: "one_to_one", label: "One-to-one meetings" },
  { value: "group", label: "Group conversations" },
  { value: "both", label: "Both" },
];

export const VISIBILITY: Option[] = [
  { value: "public", label: "Public — anyone can see my profile" },
  { value: "members", label: "Members — only signed-in Moonshot Connect users" },
  { value: "hidden", label: "Hidden — not shown in discovery" },
];

export const CONTACT_PREFS: Option[] = [
  { value: "everyone", label: "Anyone signed in can send me a request" },
  { value: "shared_interests", label: "Only people who share an interest with me" },
  { value: "nobody", label: "Nobody — I'll reach out myself" },
];

export const POST_THEMES: Option[] = [
  { value: "attendance", label: "Attendance" },
  { value: "networking", label: "Networking" },
  { value: "startups", label: "Startups" },
  { value: "ai", label: "AI" },
  { value: "investors", label: "Investors" },
  { value: "exhibitors", label: "Exhibitors" },
];

export const MEETUP_TOPICS: Option[] = [
  { value: "ai_agents", label: "AI and AI agents" },
  { value: "fintech", label: "Fintech" },
  { value: "product_marketing", label: "Product marketing" },
  { value: "customer_acquisition", label: "Customer acquisition" },
  { value: "fundraising", label: "Startup fundraising" },
  { value: "creator_businesses", label: "Creator businesses" },
  { value: "careers", label: "Technology careers" },
  { value: "african_markets", label: "Building for African markets" },
  { value: "other", label: "Other" },
];

export const EXHIBITOR_CATEGORIES: Option[] = [
  { value: "startup", label: "Startup" },
  { value: "enterprise", label: "Enterprise" },
  { value: "investor", label: "Investor / VC" },
  { value: "community", label: "Community / non-profit" },
  { value: "government", label: "Government" },
  { value: "media", label: "Media" },
  { value: "other", label: "Other" },
];

export const SUGGESTED_SEARCHES = [
  '"Moonshot by TechCabal"',
  '"Moonshot 2026"',
  '"Going to Moonshot"',
  '"Attending Moonshot"',
  '"Who is going to Moonshot?"',
  '"Looking to meet founders"',
  '"Moonshot networking"',
];

export const EVENT_HASHTAGS = ["#Moonshot2026", "#MoonshotByTechCabal", "#TCMoonshot"];

export function labelFor(options: Option[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

export const values = (options: Option[]) => options.map((o) => o.value) as [string, ...string[]];
