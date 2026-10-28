import { describe, expect, it } from "vitest";
import { scoreMatch, type MatchCard } from "@/lib/matching";
import { cardSchema } from "@/lib/validation";
import { detectMentions, parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";
import { parseImport } from "@/lib/data";

const base: MatchCard = { id: "a", name: "Ada Obi", headline: "Builder", wants: [], offers: [], interests: [], attendance: "in_person" };

describe("matching", () => {
  it("explains complementary wants and offers in both directions", () => {
    const founder = { ...base, headline: "Founder, payments startup", wants: ["partners", "investors"], interests: ["fintech"] };
    const marketer = { ...base, id: "b", name: "Bola Ade", offers: ["distribution", "growth"], wants: ["founders"], interests: ["fintech"] };
    const m = scoreMatch(founder, marketer);
    expect(m.reasons[0]).toBe("You want business partners — Bola offers distribution & partnerships");
    expect(m.reasons).toContain("Bola wants founders — you offer founder experience");
    expect(m.reasons).toContain("You're both into Fintech");
    expect(m.score).toBeGreaterThan(20);
  });
  it("scores unrelated people zero", () => {
    expect(scoreMatch({ ...base, interests: ["ai"] }, { ...base, id: "b", interests: ["health"] }).score).toBe(0);
  });
});

describe("card validation", () => {
  const ok = { name: "Ada", headline: "Founder", wants: [], offers: [], contact: "+234 803 000 0000" };
  it("works out the contact type from one box", () => {
    expect(cardSchema.parse(ok).whatsapp).toBe("+2348030000000");
    expect(cardSchema.parse({ ...ok, contact: "@ada_builds" }).xHandle).toBe("ada_builds");
    expect(cardSchema.parse({ ...ok, contact: "ada_builds" }).xHandle).toBe("ada_builds");
    expect(cardSchema.parse({ ...ok, contact: "08030000000" }).whatsapp).toBe("08030000000");
    expect(cardSchema.parse({ ...ok, contact: "https://x.com/ada_builds" }).xHandle).toBe("ada_builds");
    expect(cardSchema.parse({ ...ok, contact: "Ada@Example.com" }).email).toBe("ada@example.com");
    expect(cardSchema.parse({ ...ok, contact: "linkedin.com/in/ada" }).linkedinUrl).toBe("https://linkedin.com/in/ada");
    expect(cardSchema.parse({ ...ok, contact: "ada.dev" }).websiteUrl).toBe("https://ada.dev/");
  });
  it("requires a usable contact and limits choices", () => {
    expect(cardSchema.safeParse({ ...ok, contact: "" }).success).toBe(false);
    expect(cardSchema.safeParse({ ...ok, contact: "javascript:alert(1)" }).success).toBe(false);
    expect(cardSchema.safeParse({ ...ok, wants: ["investors", "partners", "customers", "job"] }).success).toBe(false);
  });
});

describe("X posts", () => {
  it("parses public post links and derives time from the ID", () => {
    expect(parseXPostUrl("https://twitter.com/TechCabal/status/1849000000000000000?s=20")?.url).toBe("https://x.com/TechCabal/status/1849000000000000000");
    expect(parseXPostUrl("https://example.com/a/status/123")).toBeNull();
    expect(snowflakeToDate("1849000000000000000")?.getUTCFullYear()).toBe(2024);
  });
  it("reads URL lists and JSON", () => {
    expect(parseImport("https://x.com/a/status/1849000000000000000\n\n# note").records).toHaveLength(1);
    const j = parseImport('[{"url":"https://x.com/a/status/1849000000000000000","text":"hi"},{"x":1}]');
    expect(j.records[0].content).toBe("hi");
    expect(j.errors).toHaveLength(1);
  });
  it("picks out who an author wants to meet from their own words", () => {
    expect(detectMentions("Founders building difficult things. Operators who understand distribution. Engineers working on problems")).toEqual(["Founders", "Engineers", "Operators", "Distribution"]);
  });
});

import { FILTERS, matches, personText, searchWords } from "@/lib/search";

describe("search", () => {
  const person = (over: Record<string, unknown>) =>
    ({ id: "x", name: "Moses Oluwaseun Ejidokun", headline: "Recruiter", company: "Acme", bio: "", xHandle: null, wants: [], offers: [], ...over }) as never;
  it("matches every word, in any order, across names and tags", () => {
    const p = person({ offers: ["hiring"], wants: ["investors"] });
    expect(matches(personText(p), searchWords("ejidokun moses"))).toBe(true);
    expect(matches(personText(p), searchWords("I'm hiring"))).toBe(true);
    expect(matches(personText(p), searchWords("looking for investors"))).toBe(true);
    expect(matches(personText(p), searchWords("moses designer"))).toBe(false);
  });
  it("finds investors and hiring people by tag or job title", () => {
    expect(FILTERS.investors.test(person({ headline: "Partner, Demo Ventures", offers: ["investment"] }))).toBe(true);
    expect(FILTERS.investors.test(person({ headline: "Angel investor" }))).toBe(true);
    expect(FILTERS.hiring.test(person({ headline: "Head of Talent", bio: "We're hiring engineers" }))).toBe(true);
    expect(FILTERS.hiring.test(person({ headline: "Head of Talent, fintech" }))).toBe(true);
    expect(FILTERS.engineers.test(person({ headline: "Mobile developer" }))).toBe(true);
    expect(FILTERS.founders.test(person({ headline: "Growth lead" }))).toBe(false);
  });
});

import { parsePhoto } from "@/lib/photo";
import { isHereNow } from "@/lib/search";

describe("photos and 'catch me at'", () => {
  it("accepts real images and rejects anything else", () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
    expect(parsePhoto(`data:image/png;base64,${png}`)).toMatchObject({ mime: "image/png" });
    expect(parsePhoto(`data:image/jpeg;base64,${png}`)).toEqual({ error: "That file isn't a photo." });
    expect("error" in parsePhoto("data:text/html;base64,PGgxPg==")).toBe(true);
    expect("error" in parsePhoto(`data:image/png;base64,${Buffer.alloc(700 * 1024).toString("base64")}`)).toBe(true);
  });
  it("treats a note as current for 8 hours", () => {
    const now = Date.now();
    expect(isHereNow({ whereNote: "Booth 14", whereUpdatedAt: new Date(now - 7 * 3600_000) }, now)).toBe(true);
    expect(isHereNow({ whereNote: "Booth 14", whereUpdatedAt: new Date(now - 9 * 3600_000) }, now)).toBe(false);
    expect(isHereNow({ whereNote: null, whereUpdatedAt: new Date(now) }, now)).toBe(false);
  });
});

import { parseSyndication, syndicationToken } from "@/lib/social/x-url";

describe("X post images", () => {
  it("uses attached photos first, then the link-preview image, and the author's picture", () => {
    expect(
      parseSyndication({
        mediaDetails: [{ media_url_https: "https://pbs.twimg.com/media/A.jpg" }, { media_url_https: "https://evil.example/x.jpg" }],
        user: { profile_image_url_https: "https://pbs.twimg.com/profile_images/1/me_normal.jpg" },
      }),
    ).toEqual({ media: ["https://pbs.twimg.com/media/A.jpg"], avatarUrl: "https://pbs.twimg.com/profile_images/1/me_bigger.jpg" });
    expect(
      parseSyndication({ card: { binding_values: { photo_image_full_size_large: { image_value: { url: "https://pbs.twimg.com/card_img/2/x?format=jpg&name=800x419" } } } } }).media,
    ).toEqual(["https://pbs.twimg.com/card_img/2/x?format=jpg&name=800x419"]);
    expect(parseSyndication({ user: { profile_image_url_https: "javascript:alert(1)" } })).toEqual({ media: [], avatarUrl: null });
    expect(parseSyndication(null)).toEqual({ media: [], avatarUrl: null });
  });
  it("computes the embed token like X's widget", () => {
    expect(syndicationToken("2114706863631572995")).toMatch(/^[0-9a-z]+$/);
  });
});
