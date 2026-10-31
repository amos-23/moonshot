import type { MomentItem, MomentPerson } from "@/lib/data";
import { timeAgo } from "@/lib/time";
import { cleanPostText } from "@/lib/share";

/** Who shared the moment (for an X post: who posted it on X). */
export function momentWho({ moment: m, author }: MomentItem) {
  if (m.xPostUrl) return m.xAuthorName ?? (m.xAuthorHandle ? `@${m.xAuthorHandle}` : "On X");
  return author?.name ?? (m.xHandle ? `@${m.xHandle}` : m.name ?? "Someone at the event");
}

/** Photos uploaded with a moment (up to 4), as URLs. */
export function momentPhotos(m: MomentItem["moment"]) {
  const count = m.photoCount || (m.hasPhoto ? 1 : 0);
  return Array.from({ length: count }, (_, i) => `/moment-photo/${m.id}${i ? `?n=${i}` : ""}`);
}

/** First image of a moment, if any. */
export function momentImage({ moment: m }: MomentItem) {
  return momentPhotos(m)[0] ?? m.xMedia[0] ?? null;
}

/** Everything the Moments gallery shows for one moment, as plain data for the client. */
export type MomentView = {
  id: string;
  images: string[];
  fromXImages: boolean; // images hosted by X (sent without a referrer)
  text: string | null; // what the moment says (the poster's words, or the X post's text)
  note: string | null; // the sharer's own words on top of an X post
  who: string;
  whoHref: string | null;
  avatar: string | null;
  xUrl: string | null;
  place: string | null;
  ago: string;
  people: MomentPerson[];
  video: { src: string; small: string; gif: boolean } | null; // an X post's video/GIF (plays over the first image)
  likes: number; // on X
  replies: number;
};

export function toMomentView(item: MomentItem, people: MomentPerson[] = [], eventSlug: string): MomentView {
  const { moment: m, author } = item;
  const uploaded = momentPhotos(m);
  const fromX = Boolean(m.xPostUrl);
  return {
    id: m.id,
    images: uploaded.length ? uploaded : m.xMedia,
    fromXImages: !uploaded.length,
    text: cleanPostText(fromX ? m.xText : m.body) || null,
    note: fromX && m.body ? cleanPostText(m.body) || null : null,
    who: momentWho(item),
    whoHref: fromX && m.xAuthorHandle ? `https://x.com/${m.xAuthorHandle}` : author ? `/${eventSlug}?q=${encodeURIComponent(author.xHandle ?? author.name)}` : m.xHandle ? `https://x.com/${m.xHandle}` : null,
    avatar: fromX ? m.xAvatarUrl : null,
    xUrl: m.xPostUrl,
    place: m.place,
    ago: timeAgo(m.xPostedAt ?? m.createdAt),
    people,
    video: !uploaded.length && m.xVideo ? { src: m.xVideo, small: m.xVideoSmall ?? m.xVideo, gif: m.xVideoGif } : null,
    likes: fromX ? m.xLikes : 0,
    replies: fromX ? m.xReplies : 0,
  };
}

/** Big quote text that shrinks as the words get longer, so any length fits on screen. */
export function quoteSize(text: string | null, where: "story" | "viewer"): string {
  const n = text?.length ?? 0;
  const steps = where === "story" ? ["text-3xl sm:text-5xl", "text-2xl sm:text-4xl", "text-xl sm:text-3xl", "text-lg sm:text-2xl"] : ["text-2xl sm:text-4xl", "text-xl sm:text-3xl", "text-lg sm:text-2xl", "text-base sm:text-xl"];
  return steps[n <= 80 ? 0 : n <= 180 ? 1 : n <= 320 ? 2 : 3];
}

/** Long words for a big quote, cut at a word boundary with "…" (the full text stays in the viewer). */
export function quoteText(text: string | null, max = 220): string {
  const t = text ?? "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}
