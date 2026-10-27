// Transparent matching: every point comes with a reason people can read. No AI.
import { INTERESTS, OFFERS, WANTS, WANT_MATCHES, labelFor } from "./constants";

export type MatchCard = {
  id: string;
  name: string;
  headline: string;
  wants: string[];
  offers: string[];
  interests: string[];
  attendance: string;
};

export type Match = { score: number; reasons: string[] };

const FOUNDER = /\b(founder|co-?founder|ceo)\b/i;
const INVESTOR = /\b(investor|vc|venture|angel|partner at)\b/i;

function fits(want: string, other: MatchCard): string | null {
  const offer = WANT_MATCHES[want]?.find((o) => other.offers.includes(o));
  if (offer) return labelFor(OFFERS, offer).toLowerCase();
  if (want === "founders" && FOUNDER.test(other.headline)) return "founder experience";
  if (want === "investors" && INVESTOR.test(other.headline)) return "investing";
  return null;
}

export function scoreMatch(me: MatchCard, other: MatchCard): Match {
  const reasons: { points: number; text: string }[] = [];
  const first = other.name.trim().split(/\s+/)[0] || "They";

  for (const want of me.wants) {
    const what = fits(want, other);
    if (what) reasons.push({ points: 12, text: `You want ${labelFor(WANTS, want).toLowerCase()} — ${first} offers ${what}` });
  }
  for (const want of other.wants) {
    const what = fits(want, me);
    if (what) reasons.push({ points: 8, text: `${first} wants ${labelFor(WANTS, want).toLowerCase()} — you offer ${what}` });
  }
  const shared = me.interests.filter((i) => other.interests.includes(i));
  if (shared.length) {
    reasons.push({
      points: Math.min(shared.length * 5, 20),
      text: `You're both into ${shared.slice(0, 3).map((i) => labelFor(INTERESTS, i)).join(", ")}`,
    });
  }
  if (me.wants.includes("cofounder") && other.wants.includes("cofounder")) {
    reasons.push({ points: 6, text: "You're both looking for a co-founder" });
  }
  if (me.attendance === "in_person" && other.attendance === "in_person" && reasons.length) {
    reasons.push({ points: 3, text: "You're both at the venue" });
  }
  reasons.sort((a, b) => b.points - a.points);
  return { score: reasons.reduce((s, r) => s + r.points, 0), reasons: reasons.map((r) => r.text) };
}
