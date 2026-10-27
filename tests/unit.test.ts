import { describe, expect, it } from "vitest";
import { scoreMatch, type MatchProfile } from "@/lib/matching";
import { detectThemes, parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";
import { extractOEmbedText } from "@/lib/social/providers";
import { parseImportText } from "@/lib/services/social";
import { profileSchema } from "@/lib/validation";

const base: MatchProfile = {
  userId: "a",
  name: "Ada",
  roleCategory: "founder",
  industry: "fintech",
  location: "Lagos",
  interests: [],
  goals: [],
  offers: [],
  attendance: "in_person",
  networkingStyle: "both",
};

describe("matching", () => {
  it("rewards complementary goals and offers in both directions", () => {
    const founder = { ...base, goals: ["find_partners"], interests: ["fintech"] };
    const marketer = { ...base, userId: "b", name: "Bola Ade", roleCategory: "marketing", offers: ["marketing"], goals: ["discover_startups"], interests: ["fintech"] };
    const r = scoreMatch(founder, marketer);
    const texts = r.reasons.map((x) => x.text);
    expect(texts).toContain("You both care about Fintech");
    expect(texts.some((t) => t.startsWith("Bola offers marketing"))).toBe(true);
    expect(texts.some((t) => t.includes("You can help with what Bola wants"))).toBe(true);
    expect(r.score).toBeGreaterThan(20);
  });

  it("is deterministic and zero for unrelated remote people", () => {
    const a = { ...base, interests: ["ai"], industry: null, location: null };
    const b = { ...base, userId: "b", interests: ["climate"], industry: null, location: null, attendance: "remote", roleCategory: "other" };
    expect(scoreMatch(a, b)).toEqual(scoreMatch(a, b));
    expect(scoreMatch(a, b).score).toBe(0);
  });
});

describe("X post URLs", () => {
  it("parses and canonicalises public post URLs", () => {
    expect(parseXPostUrl("https://twitter.com/TechCabal/status/1849000000000000000?s=20")).toEqual({
      handle: "TechCabal",
      id: "1849000000000000000",
      url: "https://x.com/TechCabal/status/1849000000000000000",
    });
    expect(parseXPostUrl("https://x.com/someone/status/123456789012345678/photo/1")?.id).toBe("123456789012345678");
    expect(parseXPostUrl("https://example.com/a/status/1234567")).toBeNull();
    expect(parseXPostUrl("https://x.com/search?q=moonshot")).toBeNull();
    expect(parseXPostUrl("javascript:alert(1)")).toBeNull();
  });

  it("derives creation time from the snowflake ID", () => {
    // Snowflake 1288834974657 + (id >> 22): this ID decodes to 2024-10-23T…Z
    const d = snowflakeToDate("1849000000000000000");
    expect(d?.getUTCFullYear()).toBe(2024);
    expect(snowflakeToDate("12345")).toBeNull();
  });

  it("detects themes from text", () => {
    expect(detectThemes("Who's going to Moonshot? Looking to meet founders and investors building AI agents")).toEqual(
      expect.arrayContaining(["attendance", "networking", "startups", "investors", "ai"]),
    );
    expect(detectThemes(null)).toEqual([]);
  });

  it("parses import text in both formats", () => {
    expect(parseImportText("https://x.com/a/status/1849000000000000000\n# comment\n\nhttps://x.com/b/status/1849000000000000001").records).toHaveLength(2);
    const json = parseImportText('[{"url":"https://x.com/a/status/1849000000000000000","text":"hi","themes":["ai"]},{"nope":1}]');
    expect(json.records[0]).toMatchObject({ content: "hi", themes: ["ai"] });
    expect(json.errors).toHaveLength(1);
    expect(parseImportText("[broken").errors[0].message).toMatch(/JSON/);
  });

  it("extracts text from oEmbed HTML", () => {
    const html = '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">See you at <a href="#">#Moonshot</a> &amp; more<br>soon</p>&mdash; X</blockquote>';
    expect(extractOEmbedText(html)).toBe("See you at #Moonshot & more\nsoon");
  });
});

describe("validation", () => {
  const valid = {
    name: "Ada",
    headline: "Founder",
    roleCategory: "founder",
    bio: "Building payments infra.",
    interests: ["fintech", "fintech"],
    goals: ["meet_investors"],
    offers: [],
    attendance: "in_person",
    networkingStyle: "both",
    visibility: "public",
    contactPreference: "everyone",
    xHandle: "@ada_builds",
    websiteUrl: "",
  };
  it("normalises input", () => {
    const p = profileSchema.parse(valid);
    expect(p.interests).toEqual(["fintech"]);
    expect(p.xHandle).toBe("ada_builds");
    expect(p.websiteUrl).toBeNull();
  });
  it("rejects unknown vocab and unsafe URLs", () => {
    expect(profileSchema.safeParse({ ...valid, interests: ["hacking"] }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, goals: [] }).success).toBe(false);
  });
});
