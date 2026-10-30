import { describe, expect, it } from "vitest";
import { eventOver } from "@/lib/constants";
import { cleanPostText, momentPost, withUtm, xIntent } from "@/lib/share";
import { momentScore, parseHandles, rotationIndex, ROTATE_MS } from "@/lib/featured";
import { scoreMatch, type MatchCard } from "@/lib/matching";
import { cardSchema, signupSchema } from "@/lib/validation";
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
    ).toMatchObject({ media: ["https://pbs.twimg.com/media/A.jpg"], avatarUrl: "https://pbs.twimg.com/profile_images/1/me_bigger.jpg" });
    expect(
      parseSyndication({ card: { binding_values: { photo_image_full_size_large: { image_value: { url: "https://pbs.twimg.com/card_img/2/x?format=jpg&name=800x419" } } } } }).media,
    ).toEqual(["https://pbs.twimg.com/card_img/2/x?format=jpg&name=800x419"]);
    expect(parseSyndication({ user: { profile_image_url_https: "javascript:alert(1)" } })).toMatchObject({ media: [], avatarUrl: null });
    expect(parseSyndication(null)).toEqual({ media: [], avatarUrl: null, likes: 0, replies: 0, verified: false, video: null });
  });
  it("computes the embed token like X's widget", () => {
    expect(syndicationToken("2114706863631572995")).toMatch(/^[0-9a-z]+$/);
  });
});

describe("eventOver", () => {
  it("switches to the after-Moonshot site at midnight in Lagos after day 2, unless EVENT_MODE says otherwise", () => {
    const prev = process.env.EVENT_MODE;
    delete process.env.EVENT_MODE;
    expect(eventOver(new Date("2026-10-29T22:59:00Z"))).toBe(false);
    expect(eventOver(new Date("2026-10-29T23:00:00Z"))).toBe(true);
    process.env.EVENT_MODE = "live";
    expect(eventOver(new Date("2026-11-05T12:00:00Z"))).toBe(false);
    process.env.EVENT_MODE = "after";
    expect(eventOver(new Date("2026-10-28T12:00:00Z"))).toBe(true);
    if (prev === undefined) delete process.env.EVENT_MODE;
    else process.env.EVENT_MODE = prev;
  });
});

describe("signupSchema", () => {
  it("needs only a valid email; name and what you do are optional", () => {
    expect(signupSchema.parse({ email: "  Ada@Example.COM ", name: "", about: "" })).toEqual({ email: "ada@example.com", name: null, about: null });
    expect(signupSchema.safeParse({ email: "nope", name: "", about: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", name: "x".repeat(61), about: "" }).success).toBe(false);
  });
});

describe("parseSyndication: engagement and video", () => {
  it("reads likes, replies, the verified badge and picks safe MP4s", () => {
    const d = parseSyndication({
      favorite_count: 51,
      conversation_count: 8,
      user: { is_blue_verified: true },
      mediaDetails: [
        {
          type: "video",
          media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/a.jpg",
          video_info: {
            variants: [
              { content_type: "application/x-mpegURL", url: "https://video.twimg.com/ext_tw_video/1/pu/pl/a.m3u8" },
              { bitrate: 256000, content_type: "video/mp4", url: "https://video.twimg.com/ext_tw_video/1/pu/vid/320x568/a.mp4" },
              { bitrate: 832000, content_type: "video/mp4", url: "https://video.twimg.com/ext_tw_video/1/pu/vid/480x852/a.mp4" },
              { bitrate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/ext_tw_video/1/pu/vid/720x1280/a.mp4" },
              { bitrate: 10368000, content_type: "video/mp4", url: "https://video.twimg.com/ext_tw_video/1/pu/vid/1080x1920/a.mp4" },
              { bitrate: 900000, content_type: "video/mp4", url: "https://evil.example/a.mp4" },
            ],
          },
        },
      ],
    });
    expect(d).toMatchObject({ likes: 51, replies: 8, verified: true, media: ["https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/a.jpg"] });
    expect(d.video).toEqual({ src: "https://video.twimg.com/ext_tw_video/1/pu/vid/720x1280/a.mp4", small: "https://video.twimg.com/ext_tw_video/1/pu/vid/480x852/a.mp4", gif: false });
    const gif = parseSyndication({ mediaDetails: [{ type: "animated_gif", video_info: { variants: [{ bitrate: 0, content_type: "video/mp4", url: "https://video.twimg.com/tweet_video/a.mp4" }] } }] });
    expect(gif.video).toEqual({ src: "https://video.twimg.com/tweet_video/a.mp4", small: "https://video.twimg.com/tweet_video/a.mp4", gif: true });
    expect(parseSyndication({ favorite_count: -3, conversation_count: "9" })).toMatchObject({ likes: 0, replies: 0 });
  });
});

describe("Featured scoring", () => {
  const NOW = Date.parse("2026-11-10T12:00:00Z");
  const old = new Date(NOW - 10 * 86_400_000);
  const m = (o: Partial<{ xLikes: number; xReplies: number; xVerified: boolean; xAuthorHandle: string | null; xHandle: string | null; createdAt: Date }> = {}) => ({ xLikes: 0, xReplies: 0, xVerified: false, xAuthorHandle: null, xHandle: null, createdAt: old, ...o });
  it("weighs likes, replies and opens here, and boosts your top accounts most", () => {
    expect(momentScore(m({ xLikes: 10, xReplies: 2 }), 1, new Set(), NOW)).toBe(10 + 4 + 5 + 1);
    expect(momentScore(m({ xLikes: 10, xAuthorHandle: "TechCabal" }), 0, new Set(["techcabal"]), NOW)).toBe(11 * 4);
    expect(momentScore(m({ xLikes: 10, xVerified: true }), 0, new Set(), NOW)).toBeCloseTo(11 * 1.25);
    expect(momentScore(m(), 3, new Set(), NOW)).toBe(16); // an uploaded photo competes on opens
    expect(momentScore(m(), 0, new Set(), NOW, 5)).toBe(16); // and on reactions
  });
  it("counts moments added in the last 48 hours double", () => {
    expect(momentScore(m({ xLikes: 9, createdAt: new Date(NOW - 47 * 3600_000) }), 0, new Set(), NOW)).toBe(20);
    expect(momentScore(m({ xLikes: 9, createdAt: new Date(NOW - 49 * 3600_000) }), 0, new Set(), NOW)).toBe(10);
  });
  it("reads handles from any list", () => {
    expect(parseHandles("@TechCabal, ada\n@Ada  bola_x")).toEqual(["techcabal", "ada", "bola_x"]);
  });
  it("rotates every 30 minutes, the same for everyone in a window", () => {
    const t = 1_800_000_000_000;
    expect(rotationIndex(5, t)).toBe(rotationIndex(5, t + 1000));
    const picks = new Set(Array.from({ length: 20 }, (_, i) => rotationIndex(10, t + i * ROTATE_MS)));
    expect(picks.size).toBeGreaterThan(2);
    expect(rotationIndex(1, t)).toBe(0);
  });
});

describe("share links", () => {
  it("tags links with where they were shared and keeps the #hash", () => {
    expect(withUtm("https://s.io/m/1", "x", "moment")).toBe("https://s.io/m/1?utm_source=x&utm_campaign=moment");
    expect(withUtm("https://s.io/?q=ada#top", "whatsapp", "card")).toBe("https://s.io/?q=ada&utm_source=whatsapp&utm_campaign=card#top");
    expect(xIntent("Hi #Moonshot2026", "https://s.io/m/1")).toBe("https://x.com/intent/post?text=Hi+%23Moonshot2026&url=https%3A%2F%2Fs.io%2Fm%2F1");
  });
  it("writes a short post about a moment", () => {
    expect(momentPost({ text: "Main stage  was packed", who: "Ada", fromX: false })).toBe("“Main stage was packed” — a moment from #Moonshot2026 📸");
    expect(momentPost({ text: "Great day", who: "@tola", fromX: true })).toBe("“Great day” — @tola from #Moonshot2026 📸");
    expect(momentPost({ text: null, who: "x", fromX: false })).toBe("A moment from #Moonshot2026 📸");
    expect(momentPost({ text: "x".repeat(200), who: "x", fromX: false }).length).toBeLessThan(170);
  });
});

describe("cleanPostText", () => {
  it("drops X's leftover photo and t.co links and tidies spacing", () => {
    expect(cleanPostText("Building @vatarHQ.  AI: @Thedanieloreofe pic.twitter.com/Q9KnSTnwnG")).toBe("Building @vatarHQ. AI: @Thedanieloreofe");
    expect(cleanPostText("Read this https://t.co/abc123 now\n\n\n\nok")).toBe("Read this now\n\nok");
    expect(cleanPostText(null)).toBe("");
    expect(cleanPostText("keep https://moonshot.techcabal.com links")).toBe("keep https://moonshot.techcabal.com links");
  });
});
