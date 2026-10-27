import { describe, expect, it } from "vitest";
import { scoreMatch, type MatchCard } from "@/lib/matching";
import { cardSchema } from "@/lib/validation";
import { parseXPostUrl, snowflakeToDate } from "@/lib/social/x-url";
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
  const ok = { name: "Ada", headline: "Founder", wants: [], offers: [], interests: [], attendance: "in_person", whatsapp: "+234 803 000 0000" };
  it("normalises contact details", () => {
    const c = cardSchema.parse({ ...ok, xHandle: "https://x.com/ada_builds?s=1", linkedinUrl: "linkedin.com/in/ada", websiteUrl: "ada.dev" });
    expect(c.xHandle).toBe("ada_builds");
    expect(c.whatsapp).toBe("+2348030000000");
    expect(c.linkedinUrl).toBe("https://linkedin.com/in/ada");
    expect(c.websiteUrl).toBe("https://ada.dev/");
  });
  it("requires a way to be reached and rejects bad links", () => {
    expect(cardSchema.safeParse({ ...ok, whatsapp: "" }).success).toBe(false);
    expect(cardSchema.safeParse({ ...ok, linkedinUrl: "evil.com/in/x" }).success).toBe(false);
    expect(cardSchema.safeParse({ ...ok, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
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
});
