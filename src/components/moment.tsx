import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import type { MomentItem, MomentPerson } from "@/lib/data";
import { timeAgo } from "@/lib/time";
import { ReportLink } from "./client";
import { Avatar, Card, Tag, cx } from "./ui";

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

export function MomentCard({ item, people = [] }: { item: MomentItem; people?: MomentPerson[] }) {
  const { moment: m, author } = item;
  const who = momentWho(item);
  const fromX = Boolean(m.xPostUrl);
  const uploaded = momentPhotos(m);
  const images = uploaded.length ? uploaded : m.xMedia;
  const text = m.body || m.xText;
  return (
    <Card className="overflow-hidden">
      {images.length > 0 && (
        <div className={cx("grid gap-0.5", images.length > 1 && "grid-cols-2")}>
          {images.map((src, i) => (
            <a
              key={src}
              href={uploaded.length ? src : m.xPostUrl!}
              target="_blank"
              rel="noopener noreferrer nofollow"
              data-track={uploaded.length ? "moment_photo" : "moment_x_open"}
              data-track-id={m.id}
              className={cx(images.length === 3 && i === 0 && "col-span-2")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i === 0 ? (text ? text.slice(0, 120) : `Photo from ${who}`) : `Photo ${i + 1} from ${who}`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className={cx("w-full bg-canvas object-cover", images.length === 1 ? "max-h-[520px]" : images.length === 3 && i === 0 ? "aspect-[2/1]" : "aspect-square")}
              />
            </a>
          ))}
        </div>
      )}
      <div className="space-y-2 p-4">
        {m.body && fromX && <p className="text-sm font-medium">{m.body}</p>}
        {(fromX ? m.xText : m.body) && <p className={cx("line-clamp-[8] whitespace-pre-line", images.length ? "text-sm" : "text-lg font-medium", fromX && m.body && "text-muted")}>{fromX ? m.xText : m.body}</p>}
        <div className="flex items-center gap-2 text-sm">
          {fromX && m.xAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.xAvatarUrl} alt="" width={24} height={24} loading="lazy" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <Avatar name={who} size={24} />
          )}
          <span className="min-w-0 flex-1 truncate">
            {fromX ? (
              <span className="font-semibold">{who}</span>
            ) : author ? (
              <Link href={`/?q=${encodeURIComponent(author.name)}`} className="font-semibold hover:underline" data-track="moment_author" data-track-id={author.id}>
                {who}
              </Link>
            ) : m.xHandle ? (
              <a href={`https://x.com/${m.xHandle}`} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold hover:underline">
                {who}
              </a>
            ) : (
              <span className="font-semibold">{who}</span>
            )}
            <span className="text-muted"> · {timeAgo(m.xPostedAt ?? m.createdAt)}</span>
          </span>
          {fromX && <Tag tone="sun">From X</Tag>}
        </div>
        {people.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-flame-50 px-3 py-2 text-sm">
            <span className="font-semibold text-flame-700">👋 Follow up:</span>
            {people.map((p) => (
              <Link key={p.key} href={`/?q=${encodeURIComponent(p.q)}`} data-track="moment_person" data-track-id={m.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold hover:underline">
                <Avatar name={p.name} size={18} /> {p.name}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-3">
            {fromX && (
              <a href={m.xPostUrl!} target="_blank" rel="noopener noreferrer nofollow" data-track="moment_x_open" data-track-id={m.id} className="inline-flex items-center gap-1 text-sm font-semibold text-flame-700 hover:underline">
                View on X <ExternalLink size={13} aria-hidden />
              </a>
            )}
            {m.place && (
              <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted">
                <MapPin size={12} aria-hidden /> {m.place}
              </span>
            )}
          </span>
          <ReportLink type="moment" id={m.id} />
        </div>
      </div>
    </Card>
  );
}
