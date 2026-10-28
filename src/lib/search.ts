// Word-by-word search across what's written on a card and the tags people picked.
import { OFFERS, WANTS, labelFor } from "./constants";
import type { Person, SocialPost } from "./db/schema";

// Extra words people actually type for each tag.
const OFFER_WORDS: Record<string, string> = {
  investment: "investor investors investing vc angel funding fund capital",
  hiring: "hiring jobs job recruiting recruiter roles vacancy",
  engineering: "engineer engineers developer developers dev software",
  ai: "ai ml machine learning",
  growth: "marketing marketer growth",
  distribution: "partnerships partner distribution",
  product: "product design designer feedback",
  media: "media content storytelling journalist pr",
  mentorship: "mentor mentoring advice",
  intros: "customers introductions intros sales",
  buying: "buyer buying procurement",
};
const WANT_WORDS: Record<string, string> = {
  investors: "investors funding raising fundraising",
  job: "job jobs career opportunity",
  talent: "hiring recruiting talent",
  cofounder: "cofounder co-founder",
  ai_builders: "ai",
};

// Filler words that shouldn't have to appear on a card ("I'm hiring" → "hiring").
const STOP = new Set(["i", "im", "i'm", "a", "an", "the", "and", "or", "for", "to", "at", "in", "of", "on", "who", "is", "looking", "people", "someone", "with", "my", "me", "are"]);

export function searchWords(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9@+'#.-]+/)
    .map((w) => w.replace(/^[@#'.-]+|['.-]+$/g, ""))
    .filter((w) => w && !STOP.has(w))
    .slice(0, 8);
}

export function personText(p: Person): string {
  return [
    p.name,
    p.headline,
    p.company,
    p.bio,
    p.xHandle,
    isHereNow(p) ? p.whereNote : null,
    ...p.wants.map((w) => `${labelFor(WANTS, w)} ${WANT_WORDS[w] ?? ""}`),
    ...p.offers.map((o) => `${labelFor(OFFERS, o)} ${OFFER_WORDS[o] ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function postText(p: SocialPost): string {
  return [p.authorName, p.authorHandle, p.content].filter(Boolean).join(" ").toLowerCase();
}

/** Every word must appear somewhere (any order). No words = everything matches. */
export function matches(text: string, words: string[]): boolean {
  return words.every((w) => text.includes(w));
}

// ─── "Catch me at…" ──────────────────────────────────────────────────────────

export const HERE_NOW_HOURS = 8;

/** A "Catch me at" note counts as current for a few hours after it was written. */
export function isHereNow(p: Pick<Person, "whereNote" | "whereUpdatedAt">, now = Date.now()) {
  return Boolean(p.whereNote && p.whereUpdatedAt && now - p.whereUpdatedAt.getTime() < HERE_NOW_HOURS * 3600_000);
}

// ─── Filters ─────────────────────────────────────────────────────────────────

const INVESTOR = /\b(investor|investing|vc|venture|angel|partner at .*(capital|ventures|fund))\b/i;
const HIRING = /\b(hiring|recruit(er|ing)?|talent acquisition|head of talent|talent (lead|partner|manager)|people (ops|operations))\b/i;
const FOUNDER = /\b(founder|co-?founder|ceo)\b/i;
const ENGINEER = /\b(engineer|developer|dev|software|programmer|devrel|backend|frontend|full-?stack|mobile)\b/i;
const MARKETING = /\b(market(er|ing)?|growth|brand|content|social media|smm|communications|pr)\b/i;
const DESIGN = /\b(design(er)?|ux|ui|illustrat|motion|graphic)/i;

type Filter = { label: string; test: (p: Person) => boolean; wantedBy?: string; wantLabel?: string };

// Filters apply to cards people made (they have structured info); "From X" shows only posts.
export const FILTERS: Record<string, Filter> = {
  here: { label: "📍 Here now", test: (p) => isHereNow(p) },
  investors: { label: "Investors", test: (p) => p.offers.includes("investment") || INVESTOR.test(p.headline), wantedBy: "investors", wantLabel: "investors" },
  hiring: { label: "Hiring", test: (p) => p.offers.includes("hiring") || HIRING.test(`${p.headline} ${p.bio}`), wantedBy: "job", wantLabel: "a job" },
  founders: { label: "Founders", test: (p) => FOUNDER.test(p.headline) },
  engineers: { label: "Engineers", test: (p) => p.offers.includes("engineering") || ENGINEER.test(p.headline) },
  marketing: { label: "Marketing", test: (p) => p.offers.includes("growth") || MARKETING.test(p.headline) },
  design: { label: "Design", test: (p) => DESIGN.test(p.headline) },
};

export type FilterKey = keyof typeof FILTERS | "x";
export const isFilter = (v: string | undefined): v is FilterKey => v === "x" || (!!v && v in FILTERS);
