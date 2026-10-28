import Link from "next/link";
import { MapPin } from "lucide-react";
import type { MomentItem } from "@/lib/data";
import { timeAgo } from "@/lib/time";
import { ReportLink } from "./client";
import { Avatar, Card } from "./ui";

export function MomentCard({ item: { moment: m, author } }: { item: MomentItem }) {
  const who = author?.name ?? (m.xHandle ? `@${m.xHandle}` : m.name ?? "Someone at Moonshot");
  return (
    <Card className="overflow-hidden">
      {m.hasPhoto && (
        <a href={`/moment-photo/${m.id}`} target="_blank" rel="noopener" data-track="moment_photo" data-track-id={m.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/moment-photo/${m.id}`} alt={m.body ? m.body.slice(0, 120) : `Photo from ${who}`} loading="lazy" decoding="async" className="max-h-[520px] w-full bg-canvas object-cover" />
        </a>
      )}
      <div className="space-y-2 p-4">
        {m.body && <p className={m.hasPhoto ? "whitespace-pre-line text-sm" : "whitespace-pre-line text-lg font-medium"}>{m.body}</p>}
        <div className="flex items-center gap-2 text-sm">
          <Avatar name={who} size={24} />
          <span className="min-w-0 flex-1 truncate">
            {author ? (
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
            <span className="text-muted"> · {timeAgo(m.createdAt)}</span>
          </span>
          <ReportLink type="moment" id={m.id} />
        </div>
        {m.place && (
          <p className="inline-flex items-center gap-1 rounded-full bg-sun-100 px-2.5 py-0.5 text-xs text-[#5c3a00]">
            <MapPin size={12} aria-hidden /> {m.place}
          </p>
        )}
      </div>
    </Card>
  );
}
