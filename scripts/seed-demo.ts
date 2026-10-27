// Seeds clearly-labelled DEMO data so the app can be explored before real users join.
// Demo profiles and exhibitors are fictional and flagged with is_demo = true (shown with a "Demo data" badge).
// No social posts are seeded: we never fabricate X posts.
//   npm run db:seed          add demo data
//   npm run db:unseed        remove all demo data
import { eq, like } from "drizzle-orm";
import * as s from "../src/lib/db/schema";
import { profileSchema } from "../src/lib/validation";
import { connect, MIGRATIONS } from "./db";

const DEMO_DOMAIN = "demo.moonshot-connect.invalid";

const people = [
  { name: "Amara Okafor", headline: "Co-founder, payments startup", roleCategory: "founder", company: "Demo Pay", industry: "fintech", location: "Lagos", interests: ["fintech", "payments", "growth", "african_markets"], goals: ["find_partners", "meet_investors", "find_customers"], offers: ["product_feedback", "community"], lookingFor: "Distribution partners for SME payments in West Africa.", canOffer: "Lessons from launching in three markets.", bio: "Fictional demo profile. Building merchant payments for small businesses.", attendance: "in_person", visibility: "public" },
  { name: "Tunde Bakare", headline: "Growth marketing lead", roleCategory: "marketing", company: "Demo Agency", industry: "media", location: "Lagos", interests: ["growth", "product_marketing", "fintech", "creator_economy"], goals: ["discover_startups", "find_collaborators"], offers: ["marketing", "distribution"], lookingFor: "Early-stage teams that need help with customer acquisition.", canOffer: "Acquisition playbooks and channel partnerships.", bio: "Fictional demo profile. Helps startups grow from 0 to 100k users.", attendance: "in_person", visibility: "public" },
  { name: "Wanjiru Mwangi", headline: "Partner, early-stage fund", roleCategory: "investor", company: "Demo Ventures", industry: "investment", location: "Nairobi", interests: ["venture", "fundraising", "fintech", "ai"], goals: ["meet_founders", "discover_startups"], offers: ["investment", "mentorship"], lookingFor: "Pre-seed and seed founders in fintech and AI.", canOffer: "Feedback on fundraising and investor intros.", bio: "Fictional demo profile. Invests in pre-seed teams across Africa.", attendance: "in_person", visibility: "public" },
  { name: "Kofi Mensah", headline: "ML engineer", roleCategory: "ai_builder", company: "Demo Labs", industry: "ai", location: "Accra", interests: ["ai", "ai_agents", "devtools", "infrastructure"], goals: ["meet_ai_builders", "find_collaborators", "explore_jobs"], offers: ["ai_expertise", "engineering"], lookingFor: "Teams shipping AI agents to production.", canOffer: "LLM evaluation and agent tooling know-how.", bio: "Fictional demo profile. Builds speech and language models for African languages.", attendance: "remote", visibility: "members" },
  { name: "Zainab Bello", headline: "Product manager", roleCategory: "product", company: "Demo Health", industry: "healthtech", location: "Abuja", interests: ["healthtech", "product", "design", "ai"], goals: ["meet_interesting_people", "join_conversations", "explore_jobs"], offers: ["product_feedback", "mentorship"], lookingFor: "Peers working on health products and AI.", canOffer: "Product reviews and user-research help.", bio: "Fictional demo profile. Leads product for a telehealth app.", attendance: "undecided", visibility: "members" },
  { name: "Chinedu Eze", headline: "Head of talent", roleCategory: "operator", company: "Demo Scale", industry: "software", location: "Lagos", interests: ["careers", "saas", "african_markets"], goals: ["meet_founders", "find_partners"], offers: ["hiring", "community"], lookingFor: "Engineers and PMs open to new roles.", canOffer: "Open roles across engineering and product.", bio: "Fictional demo profile. Hiring for a fast-growing B2B software company.", attendance: "in_person", visibility: "public" },
];

const exhibitors = [
  { name: "Demo Pay", tagline: "Merchant payments for small businesses (fictional)", category: "startup", industry: "fintech", description: "A fictional exhibitor used to demonstrate the directory." },
  { name: "Demo Cloud", tagline: "Hosting for African developers (fictional)", category: "enterprise", industry: "software", description: "A fictional exhibitor used to demonstrate the directory." },
  { name: "Demo Ventures", tagline: "Pre-seed fund (fictional)", category: "investor", industry: "investment", description: "A fictional exhibitor used to demonstrate the directory." },
];

async function main() {
  const remove = process.argv.includes("--remove");
  const { db, close, kind } = await connect();
  if (kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: MIGRATIONS });
  }

  // Deleting demo users cascades to their profiles, requests, messages and meetups.
  await db.delete(s.users).where(like(s.users.email, `%@${DEMO_DOMAIN}`));
  await db.delete(s.exhibitors).where(eq(s.exhibitors.isDemo, true));
  if (remove) {
    console.log("Demo data removed.");
    return close();
  }

  for (const [i, p] of people.entries()) {
    const [user] = await db.insert(s.users).values({ email: `demo${i + 1}@${DEMO_DOMAIN}` }).returning();
    const input = profileSchema.parse({ networkingStyle: "both", contactPreference: "everyone", ...p });
    await db.insert(s.profiles).values({ userId: user.id, ...input, isDemo: true, featured: i < 3 });
  }
  for (const e of exhibitors) await db.insert(s.exhibitors).values({ ...e, isDemo: true, published: true });

  const organiser = await db.query.users.findFirst({ where: eq(s.users.email, `demo1@${DEMO_DOMAIN}`) });
  if (organiser) {
    const [m] = await db
      .insert(s.meetups)
      .values({
        organiserId: organiser.id,
        title: "[Demo] Fintech founders coffee",
        description: "A fictional demo meetup to show how topic meetups work.",
        topic: "fintech",
        startsAt: new Date("2026-10-28T10:30:00+01:00"),
        location: "Meeting point to be agreed",
        capacity: 8,
      })
      .returning();
    await db.insert(s.meetupParticipants).values({ meetupId: m.id, userId: organiser.id });
  }
  console.log(`Seeded ${people.length} demo profiles, ${exhibitors.length} demo exhibitors and 1 demo meetup (${kind}).`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
