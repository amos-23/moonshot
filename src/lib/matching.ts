// Transparent, deterministic matching. No AI, no hidden signals: every point awarded
// produces a human-readable reason that is shown on the recommendation card.

import { INTERESTS, OFFERS, labelFor } from "./constants";

export type MatchProfile = {
  userId: string;
  name: string;
  roleCategory: string;
  industry: string | null;
  location: string | null;
  interests: string[];
  goals: string[];
  offers: string[];
  attendance: string;
  networkingStyle: string;
};

export type MatchReason = { points: number; text: string };
export type MatchResult = { score: number; reasons: MatchReason[] };

type Rule = {
  goal: string;
  // What in the other person satisfies this goal.
  offers?: string[];
  roles?: string[];
  theirGoals?: string[];
  interests?: string[];
  describe: string; // "{them}" is replaced with "they" / the person's first name
};

// "If A wants X, B is a good fit when B offers / is / wants Y."
export const GOAL_RULES: Rule[] = [
  { goal: "find_customers", offers: ["buying", "customer_intros"], describe: "can help with customers" },
  { goal: "find_customers", theirGoals: ["discover_startups"], describe: "is looking for startups and products" },
  { goal: "find_partners", offers: ["distribution", "customer_intros"], describe: "offers distribution & partnerships" },
  { goal: "find_customers", offers: ["marketing"], describe: "offers marketing & customer acquisition expertise" },
  { goal: "find_partners", theirGoals: ["find_partners"], describe: "is also looking for business partners" },
  { goal: "find_partners", offers: ["marketing"], describe: "offers marketing & growth expertise" },
  { goal: "meet_investors", offers: ["investment"], roles: ["investor"], describe: "invests in startups" },
  { goal: "meet_founders", roles: ["founder"], describe: "is a founder" },
  { goal: "explore_jobs", offers: ["hiring"], describe: "is hiring" },
  { goal: "discover_startups", roles: ["founder"], theirGoals: ["find_customers"], describe: "is building a startup" },
  { goal: "meet_ai_builders", roles: ["ai_builder"], offers: ["ai_expertise"], describe: "builds with AI" },
  { goal: "find_collaborators", theirGoals: ["find_collaborators"], describe: "is also looking for collaborators" },
];

const RULE_POINTS = 12;
const INTEREST_POINTS = 6;
const MAX_INTEREST_POINTS = 30;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "They";
}

function ruleMatches(rule: Rule, other: MatchProfile): boolean {
  return Boolean(
    rule.offers?.some((o) => other.offers.includes(o)) ||
      rule.roles?.includes(other.roleCategory) ||
      rule.theirGoals?.some((g) => other.goals.includes(g)) ||
      rule.interests?.some((i) => other.interests.includes(i)),
  );
}

/** Points for how well `other` serves `seeker`'s goals. Each goal counts at most once. */
function goalFit(seeker: MatchProfile, other: MatchProfile, subject: string): MatchReason[] {
  const reasons: MatchReason[] = [];
  for (const goal of seeker.goals) {
    const rule = GOAL_RULES.find((r) => r.goal === goal && ruleMatches(r, other));
    if (rule) reasons.push({ points: RULE_POINTS, text: subject.replace("{desc}", rule.describe) });
  }
  return reasons;
}

function listLabels(values: string[], options = INTERESTS, max = 3): string {
  const labels = values.slice(0, max).map((v) => labelFor(options, v));
  const rest = values.length - labels.length;
  if (labels.length === 1) return labels[0];
  const head = labels.slice(0, -1).join(", ");
  return `${head} and ${labels[labels.length - 1]}${rest > 0 ? ` (+${rest} more)` : ""}`;
}

export function scoreMatch(viewer: MatchProfile, other: MatchProfile): MatchResult {
  const reasons: MatchReason[] = [];
  const them = firstName(other.name);

  const shared = viewer.interests.filter((i) => other.interests.includes(i));
  if (shared.length) {
    reasons.push({
      points: Math.min(shared.length * INTEREST_POINTS, MAX_INTEREST_POINTS),
      text: `You both care about ${listLabels(shared)}`,
    });
  }

  // What they bring to your goals…
  reasons.push(...goalFit(viewer, other, `${them} {desc}`));

  // …and what you bring to theirs (complementary offerings).
  const youHelp = goalFit(other, viewer, "");
  if (youHelp.length) {
    const theirGoals = other.goals.filter((g) =>
      GOAL_RULES.some((r) => r.goal === g && ruleMatches(r, viewer)),
    );
    reasons.push({
      points: Math.round(youHelp.length * RULE_POINTS * 0.75),
      text: `You can help with what ${them} wants: ${theirGoals.map((g) => goalPhrase(g)).join(", ")}`,
    });
  }

  const sharedOffers = viewer.offers.filter((o) => other.offers.includes(o));
  if (!youHelp.length && sharedOffers.length && viewer.goals.includes("find_collaborators")) {
    reasons.push({ points: 4, text: `You both offer ${listLabels(sharedOffers, OFFERS, 2)}` });
  }

  if (viewer.industry && viewer.industry === other.industry) {
    reasons.push({ points: 5, text: "You work in the same industry" });
  }

  if (viewer.attendance === "in_person" && other.attendance === "in_person") {
    reasons.push({ points: 5, text: "You're both attending in person" });
  }

  if (
    viewer.location &&
    other.location &&
    viewer.location.trim().toLowerCase() === other.location.trim().toLowerCase()
  ) {
    reasons.push({ points: 3, text: `You're both based in ${other.location.trim()}` });
  }

  if (
    viewer.networkingStyle !== "both" &&
    other.networkingStyle !== "both" &&
    viewer.networkingStyle !== other.networkingStyle
  ) {
    reasons.push({ points: -3, text: "Different preferred networking styles" });
  }

  const score = Math.max(0, reasons.reduce((s, r) => s + r.points, 0));
  reasons.sort((a, b) => b.points - a.points);
  return { score, reasons: reasons.filter((r) => r.points > 0) };
}

function goalPhrase(goal: string): string {
  const map: Record<string, string> = {
    find_customers: "customers",
    find_partners: "partners",
    meet_investors: "investors",
    meet_founders: "meeting founders",
    explore_jobs: "career opportunities",
    discover_startups: "discovering startups",
    meet_ai_builders: "meeting AI builders",
    find_collaborators: "collaborators",
  };
  return map[goal] ?? goal;
}

export function rankMatches<T extends MatchProfile>(viewer: MatchProfile, others: T[]) {
  return others
    .filter((o) => o.userId !== viewer.userId)
    .map((o) => ({ profile: o, ...scoreMatch(viewer, o) }))
    .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name));
}
