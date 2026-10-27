import { AtSign, ExternalLink, Globe, Mail, MessageCircle, UserRound } from "lucide-react";
import type { Person, SocialPost } from "@/lib/db/schema";
import { OFFERS, WANTS, labelFor } from "@/lib/constants";
import { detectMentions } from "@/lib/social/x-url";
import { timeAgo } from "@/lib/time";
import { ReportLink } from "./client";
import { Avatar, Card, Tag } from "./ui";

const HELLO = "Hi! Found you on Moonshot Connect — would love to meet at Moonshot.";

function contact(p: Person) {
  if (p.whatsapp) return { label: "WhatsApp", href: `https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(HELLO)}`, icon: MessageCircle };
  if (p.xHandle) return { label: `@${p.xHandle}`, href: `https://x.com/${p.xHandle}`, icon: AtSign };
  if (p.linkedinUrl) return { label: "LinkedIn", href: p.linkedinUrl, icon: UserRound };
  if (p.email) return { label: "Email", href: `mailto:${p.email}?subject=${encodeURIComponent("Meeting at Moonshot")}&body=${encodeURIComponent(HELLO)}`, icon: Mail };
  if (p.websiteUrl) return { label: "Website", href: p.websiteUrl, icon: Globe };
  return null;
}

function Shell({ avatar, title, sub, children, action, badge }: { avatar: string; title: string; sub: string; children?: React.ReactNode; action: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={avatar} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold leading-tight">
            {title} {badge}
          </p>
          <p className="truncate text-sm text-muted">{sub}</p>
        </div>
      </div>
      {children}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">{action}</div>
    </Card>
  );
}

export function PersonCard({ person: p, reasons = [] }: { person: Person; reasons?: string[] }) {
  const c = contact(p);
  const tags = [...p.wants.map((w) => `Wants: ${labelFor(WANTS, w)}`), ...p.offers.map((o) => `Offers: ${labelFor(OFFERS, o)}`)];
  return (
    <Shell
      avatar={p.name}
      title={p.name}
      sub={`${p.headline}${p.company ? ` · ${p.company}` : ""}`}
      action={
        <>
          {c && (
            <a href={c.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-flame-700 px-4 text-sm font-semibold text-white hover:bg-flame">
              <c.icon size={15} aria-hidden /> {c.label}
            </a>
          )}
          <ReportLink type="person" id={p.id} />
        </>
      }
    >
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}
      {reasons[0] && <p className="rounded-2xl bg-flame-50 px-3 py-2 text-sm text-flame-700">{reasons[0]}</p>}
    </Shell>
  );
}

export function XCard({ post }: { post: SocialPost }) {
  const mentions = detectMentions(post.content);
  const name = post.authorName ?? `@${post.authorHandle}`;
  return (
    <Shell
      avatar={name}
      title={name}
      sub={`@${post.authorHandle}${post.postedAt ? ` · ${timeAgo(post.postedAt)}` : ""}`}
      badge={<Tag tone="sun">From X</Tag>}
      action={
        <>
          <a href={post.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black">
            View post <ExternalLink size={13} aria-hidden />
          </a>
          <ReportLink type="post" id={post.id} />
        </>
      }
    >
      {post.content && <p className="line-clamp-4 whitespace-pre-line text-sm">{post.content}</p>}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentions.map((m) => (
            <Tag key={m}>{m}</Tag>
          ))}
        </div>
      )}
    </Shell>
  );
}
