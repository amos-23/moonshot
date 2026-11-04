import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Admin: add an event from just its website. The server reads the page (safely: public addresses only, few
// redirects, small and quick) and picks out the details from, in order: schema.org Event data, the page's share
// tags, and date patterns in its text. Pages that only build themselves in the browser give less; the admin can
// fill in the rest.

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;

export class ImportError extends Error {}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("Use a website address starting with https://");
  if (url.username || url.password) throw new ImportError("That address can't be used.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) throw new ImportError("That isn't a public website.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new ImportError("Couldn't find that website. Check the address.");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new ImportError("That isn't a public website.");
}

/** Fetches a public web page's HTML, following up to 3 redirects (each one checked again). */
export async function fetchPublicPage(raw: string): Promise<{ html: string; url: string }> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new ImportError("That doesn't look like a website address.");
  }
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; EventConnect/1.0; +https://events.latars.xyz)", accept: "text/html,application/xhtml+xml" },
    }).catch(() => {
      throw new ImportError("Couldn't reach that website. Try again, or check the address.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new ImportError(`That website answered with an error (${res.status}).`);
    if (!/html/i.test(res.headers.get("content-type") ?? "text/html")) throw new ImportError("That address isn't a web page.");
    const reader = res.body?.getReader();
    if (!reader) throw new ImportError("That page was empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      chunks.push(value);
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return { html: Buffer.concat(chunks).toString("utf8"), url: url.toString() };
  }
  throw new ImportError("That website redirects too many times.");
}

// ─── Reading the page ────────────────────────────────────────────────────────

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&(?:rsquo|lsquo);/g, "'")
    .replace(/&(?:rdquo|ldquo);/g, '"')
    .replace(/&hellip;/g, "…");
const clean = (s: string | null | undefined, max = 200) => {
  const t = decode(String(s ?? "")).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"))?.slice(2).find((v) => v !== undefined) ?? null;

function metaTags(html: string) {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !out.has(key)) out.set(key, content);
  }
  return out;
}

type LdEvent = { name?: string; startDate?: string; endDate?: string; description?: string; location?: unknown; organizer?: unknown; image?: unknown };

function ldEvents(html: string): LdEvent[] {
  const found: LdEvent[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const type = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (type.some((t) => /Event$/.test(t))) found.push(o as LdEvent);
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      // Not valid JSON: skip it.
    }
  }
  return found;
}

const nameOf = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return nameOf(v[0]);
  const o = v as Record<string, unknown>;
  return (o.name as string) ?? null;
};
const placeOf = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return placeOf(v[0]);
  const o = v as Record<string, unknown>;
  if (o["@type"] === "VirtualLocation") return "Online";
  const a = o.address;
  const addr = typeof a === "string" ? a : a && typeof a === "object" ? [(a as Record<string, string>).streetAddress, (a as Record<string, string>).addressLocality].filter(Boolean).join(", ") : "";
  // "Lagos, Nigeria" + "Lagos" → "Lagos, Nigeria": no part twice.
  const parts: string[] = [];
  for (const p of [o.name, addr].filter(Boolean).join(", ").split(/\s*,\s*/)) if (p && !parts.some((q) => q.toLowerCase() === p.toLowerCase())) parts.push(p);
  return parts.join(", ") || null;
};

/** Visible text of the page, roughly: scripts, styles and tags removed. */
export function pageText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|section|header|footer|span|a|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*/g, "\n");
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const M = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const D = "(\\d{1,2})(?:st|nd|rd|th)?";
const SEP = "\\s*(?:-|–|—|to|&|and|through)\\s*";
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const mon = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase());

/**
 * The first date (or day range) in the text from this year on, e.g. "7th & 8th November 2026",
 * "17 to 22 Nov 2026", "Nov 13–14, 2026", "Saturday, 7 November 2026", "30 October – 2 November 2026".
 */
export function findDates(text: string, now = new Date()): { startDay: string; endDay: string } | null {
  const year = now.getUTCFullYear();
  const t = text.replace(/\s+/g, " ");
  const patterns: [RegExp, (m: RegExpMatchArray) => [number, number, number, number, number, number] | null][] = [
    [new RegExp(`${D}\\s+(?:of\\s+)?${M}${SEP}${D}\\s+(?:of\\s+)?${M},?\\s*(\\d{4})`, "i"), (m) => [+m[5], mon(m[2]), +m[1], +m[5], mon(m[4]), +m[3]]],
    [new RegExp(`${D}${SEP}${D}\\s+(?:of\\s+)?${M},?\\s*(\\d{4})`, "i"), (m) => [+m[4], mon(m[3]), +m[1], +m[4], mon(m[3]), +m[2]]],
    [new RegExp(`${M}\\s+${D}${SEP}${D},?\\s*(\\d{4})`, "i"), (m) => [+m[4], mon(m[1]), +m[2], +m[4], mon(m[1]), +m[3]]],
    [new RegExp(`${D}\\s+(?:of\\s+)?${M},?\\s*(\\d{4})`, "i"), (m) => [+m[3], mon(m[2]), +m[1], +m[3], mon(m[2]), +m[1]]],
    [new RegExp(`${M}\\s+${D},?\\s*(\\d{4})`, "i"), (m) => [+m[3], mon(m[1]), +m[2], +m[3], mon(m[1]), +m[2]]],
  ];
  let best: { at: number; startDay: string; endDay: string } | null = null;
  for (const [re, read] of patterns) {
    const g = new RegExp(re.source, "gi");
    for (const m of t.matchAll(g)) {
      const v = read(m);
      if (!v) continue;
      const [y1, m1, d1, y2, m2, d2] = v;
      if (y1 < year || m1 < 0 || m2 < 0 || d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) continue;
      const startDay = iso(y1, m1, d1);
      const endDay = iso(y2, m2, d2);
      if (endDay < startDay) continue;
      // The earliest mention wins; at the same spot, the longer (range) pattern listed first wins.
      if (!best || m.index! < best.at) best = { at: m.index!, startDay, endDay };
      break;
    }
  }
  return best && { startDay: best.startDay, endDay: best.endDay };
}

/** A "Venue: …" or "Location: …" line in the text. */
function findVenue(text: string): string | null {
  const m = text.match(/\b(?:venue|location|where)\s*[:\-–]\s*([^\n]{4,120})/i);
  return m ? clean(m[1], 160) : null;
}

function findLogo(html: string, base: string): string | null {
  const abs = (u: string | null) => {
    if (!u || u.startsWith("data:")) return null;
    try {
      const v = new URL(decode(u), base);
      return v.protocol === "https:" ? v.toString() : null;
    } catch {
      return null;
    }
  };
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hay = `${attr(tag, "alt") ?? ""} ${attr(tag, "class") ?? ""} ${attr(tag, "src") ?? ""}`;
    if (/logo/i.test(hay)) {
      const u = abs(attr(tag, "src"));
      if (u) return u;
    }
  }
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const icon = (re: RegExp) => links.map((l) => (re.test(attr(l, "rel") ?? "") ? abs(attr(l, "href")) : null)).find(Boolean) ?? null;
  return icon(/apple-touch-icon/i) ?? icon(/^icon$|\bicon\b/i);
}

export type ImportedEvent = {
  url: string;
  name: string | null;
  organiser: string | null;
  tagline: string | null;
  venue: string | null;
  startDay: string | null;
  endDay: string | null;
  logo: string | null;
  brandColor: string | null;
  xHandle: string | null;
  image: string | null;
};

/** Picks the event's details out of a page's HTML. */
export function readEventPage(html: string, url: string, now = new Date()): ImportedEvent {
  const meta = metaTags(html);
  const ld = ldEvents(html)[0];
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const ogTitle = clean(meta.get("og:title")) ?? title;
  // "GTCO Fashion Weekend | Guaranty Trust Bank" → name "GTCO Fashion Weekend", organiser "Guaranty Trust Bank".
  const [titleName, titleRest] = (ogTitle ?? "").split(/\s+[|·•—–-]\s+/);
  const text = pageText(html);
  const ldDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
  const textDates = findDates(text, now);
  const startDay = ldDay(ld?.startDate) ?? textDates?.startDay ?? null;
  const endDay = ldDay(ld?.endDate) ?? (ldDay(ld?.startDate) ? null : textDates?.endDay) ?? null;
  const description = clean(ld?.description, 400) ?? clean(meta.get("og:description"), 400) ?? clean(meta.get("description"), 400);
  // A tagline is the first sentence, kept short.
  const tagline = description ? clean(description.split(/(?<=[.!?])\s/)[0], 160) : null;
  const theme = meta.get("theme-color")?.trim();
  const xSite = meta.get("twitter:site") ?? meta.get("twitter:creator");
  return {
    url,
    name: clean(ld?.name, 120) ?? clean(titleName, 120),
    // The bit after "|" in a title is often the organiser ("… | Guaranty Trust Bank"), but a one-word tail is
    // usually a place ("… | Lagos"), so it's left out.
    organiser: clean(nameOf(ld?.organizer), 120) ?? clean(meta.get("og:site_name"), 120) ?? (titleRest && titleRest.trim().split(/\s+/).length >= 2 ? clean(titleRest, 120) : null),
    tagline,
    venue: clean(placeOf(ld?.location), 160) ?? findVenue(text),
    startDay,
    endDay,
    logo: findLogo(html, url),
    brandColor: theme && /^#[0-9a-f]{6}$/i.test(theme) && !/^#(?:fff(?:fff)?|000(?:000)?)$/i.test(theme) ? theme.toLowerCase() : null,
    xHandle: xSite ? xSite.replace(/^@/, "").trim().slice(0, 16) || null : null,
    image: (() => {
      const v = nameOf(ld?.image) ?? (typeof ld?.image === "string" ? ld.image : null) ?? meta.get("og:image");
      try {
        return v ? new URL(v, url).toString() : null;
      } catch {
        return null;
      }
    })(),
  };
}
