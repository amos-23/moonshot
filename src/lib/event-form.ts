import { RESERVED_SLUGS, cleanColor } from "@/lib/events";

// Reading an event's details from a form, shared by admin and by people creating their own events.

/** "2026-11-27" → that day's start (or end) in Lagos time (UTC+1). */
export function lagosDay(value: string, end: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+01:00`);
  if (Number.isNaN(d.getTime())) return null;
  return end ? new Date(d.getTime() + 86_400_000) : d;
}

/** "26 November 2026", "28–29 October 2026", "30 October – 2 November 2026". */
export function formatDates(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const opts = { timeZone: "Africa/Lagos" } as const;
  const last = end ? new Date(end.getTime() - 1) : start;
  const part = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...opts, ...o });
  const [d1, m1, y1] = [part(start, { day: "numeric" }), part(start, { month: "long" }), part(start, { year: "numeric" })];
  const [d2, m2, y2] = [part(last, { day: "numeric" }), part(last, { month: "long" }), part(last, { year: "numeric" })];
  if (`${d1}${m1}${y1}` === `${d2}${m2}${y2}`) return `${d1} ${m1} ${y1}`;
  if (m1 === m2 && y1 === y2) return `${d1}–${d2} ${m1} ${y1}`;
  if (y1 === y2) return `${d1} ${m1} – ${d2} ${m2} ${y1}`;
  return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
}

export { slugify } from "@/lib/event-form-client";
import { slugify } from "@/lib/event-form-client";

export type EventValues = {
  name: string;
  slug: string;
  short: string;
  organiser: string | null;
  tagline: string | null;
  dates: string | null;
  venue: string | null;
  url: string | null;
  xHandle: string | null;
  hashtag: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  brandColor: string | null;
};

export type Parsed = { ok: true; values: EventValues } | { ok: false; error: string; fields?: Record<string, string> };

/** Checks and tidies an event form. The address defaults to one made from the name; dates text from the days. */
export function parseEventForm(form: FormData): Parsed {
  const str = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max) || null;
  const name = str("name", 120);
  if (!name) return { ok: false, error: "Give the event a name.", fields: { name: "Required" } };
  const slug = (String(form.get("slug") ?? "").trim().toLowerCase() || slugify(name)).replace(/^\/+/, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 60) return { ok: false, error: "The address can use lowercase letters, numbers and dashes.", fields: { slug: "e.g. growth-summit-2026" } };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "That address is used by the site. Pick another.", fields: { slug: "Taken by the site" } };
  const startDay = String(form.get("startDay") ?? "");
  const endDay = String(form.get("endDay") ?? "") || startDay;
  const startsAt = startDay ? lagosDay(startDay, false) : null;
  const endsAt = endDay ? lagosDay(endDay, true) : null;
  if ((startDay && !startsAt) || (endDay && !endsAt)) return { ok: false, error: "Check the dates." };
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: "The event has to end after it starts.", fields: { endDay: "After the start" } };
  const rawColor = str("brandColor", 9);
  const brandColor = cleanColor(rawColor);
  if (rawColor && !brandColor) return { ok: false, error: "Pick a colour like #5b3df5.", fields: { brandColor: "e.g. #5b3df5" } };
  let url = str("url", 300);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url) {
    try {
      new URL(url);
    } catch {
      return { ok: false, error: "That website address doesn't look right.", fields: { url: "e.g. https://myevent.com" } };
    }
  }
  const hashtag = str("hashtag", 40);
  return {
    ok: true,
    values: {
      name,
      slug,
      short: str("short", 30) ?? name.split(/\s+/).slice(0, 2).join(" "),
      organiser: str("organiser", 120),
      tagline: str("tagline", 160),
      dates: str("dates", 80) ?? formatDates(startsAt, endsAt),
      venue: str("venue", 160),
      url,
      xHandle: str("xHandle", 16)?.replace(/^@/, "") ?? null,
      hashtag: hashtag ? (hashtag.startsWith("#") ? hashtag : `#${hashtag}`) : null,
      startsAt,
      endsAt,
      brandColor,
    },
  };
}
