import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import type { MomentItem } from "@/lib/data";
import { timeAgo } from "@/lib/time";
import { ReportLink } from "./client";
import { Avatar, Card, Tag, cx } from "./ui";

/** Who shared the moment (for an X post: who posted it on X). */
export function momentWho({ moment: m, author }: MomentItem) {
  if (m.xPostUrl) return m.xAuthorName ?? (m.xAuthorHandle ? `@${m.xAuthorHandle}` : "On X");
  return author?.name ?? (m.xHandle ? `@${m.xHandle}` : m.name ?? "Someone at Moonshot");
}

/** First image of a moment, if any. */
export function momentImage({ moment: m }: MomentItem) {
  if (m.hasPhoto) return `/moment-photo/${m.id}`;
  return m.xMedia[0] ?? null;
}

export function MomentCard({ item }: { item: MomentItem }) {
  const { moment: m, author } = item;
  const who = momentWho(item);
  const fromX = Boolean(m.xPostUrl);
  const images = m.hasPhoto ? [`/moment-photo/${m.id}`] : m.xMedia;
  const text = m.body || m.xText;
  const imgLink = m.hasPhoto ? `/moment-photo/${m.id}` : m.xPostUrl!;
  return (
    <Card className="overflow-hidden">
      {images.length > 0 && (
        <a href={imgLink} target="_blank" rel="noopener noreferrer nofollow" data-track={fromX ? "moment_x_open" : "moment_photo"} data-track-id={m.id} className={cx("grid gap-0.5", images.length > 1 && "grid-cols-2")}>
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={i === 0 ? (text ? text.slice(0, 120) : `Photo from ${who}`) : ""}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className={cx("w-full bg-canvas object-cover", images.length === 1 ? "max-h-[520px]" : "aspect-square")}
            />
          ))}
        </a>
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
