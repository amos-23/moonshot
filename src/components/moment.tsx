import type { MomentItem, MomentPerson } from "@/lib/data";
import { timeAgo } from "@/lib/time";

/** Who shared the moment (for an X post: who posted it on X). */
export function momentWho({ moment: m, author }: MomentItem) {
  if (m.xPostUrl) return m.xAuthorName ?? (m.xAuthorHandle ? `@${m.xAuthorHandle}` : "On X");
  return author?.name ?? (m.xHandle ? `@${m.xHandle}` : m.name ?? "Someone at Moonshot");
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
};

export function toMomentView(item: MomentItem, people: MomentPerson[] = []): MomentView {
  const { moment: m, author } = item;
  const uploaded = momentPhotos(m);
  const fromX = Boolean(m.xPostUrl);
  return {
    id: m.id,
    images: uploaded.length ? uploaded : m.xMedia,
    fromXImages: !uploaded.length,
    text: (fromX ? m.xText : m.body) || null,
    note: fromX && m.body ? m.body : null,
    who: momentWho(item),
    whoHref: fromX && m.xAuthorHandle ? `https://x.com/${m.xAuthorHandle}` : author ? `/?q=${encodeURIComponent(author.xHandle ?? author.name)}` : m.xHandle ? `https://x.com/${m.xHandle}` : null,
    avatar: fromX ? m.xAvatarUrl : null,
    xUrl: m.xPostUrl,
    place: m.place,
    ago: timeAgo(m.xPostedAt ?? m.createdAt),
    people,
  };
}
