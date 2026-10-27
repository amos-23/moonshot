import Link from "next/link";
import { AtSign, Globe, Mail, MapPin, MessageCircle, Sparkles, UserRound } from "lucide-react";
import type { Person } from "@/lib/db/schema";
import { INTERESTS, OFFERS, WANTS, labelFor } from "@/lib/constants";
import { timeAgo } from "@/lib/time";
import { SaveButton } from "./client";
import { Avatar, Card, Tag, cx } from "./ui";

const HELLO = "Hi! I found you on Moonshot Connect — would love to meet at Moonshot.";

export function contactLinks(p: Person) {
  const links: { label: string; href: string; icon: typeof Mail }[] = [];
  if (p.whatsapp) links.push({ label: "WhatsApp", href: `https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(HELLO)}`, icon: MessageCircle });
  if (p.xHandle) links.push({ label: `@${p.xHandle}`, href: `https://x.com/${p.xHandle}`, icon: AtSign });
  if (p.linkedinUrl) links.push({ label: "LinkedIn", href: p.linkedinUrl, icon: UserRound });
  if (p.email) links.push({ label: "Email", href: `mailto:${p.email}?subject=${encodeURIComponent("Meeting at Moonshot")}&body=${encodeURIComponent(HELLO)}`, icon: Mail });
  if (p.websiteUrl) links.push({ label: "Website", href: p.websiteUrl, icon: Globe });
  return links;
}

export function ContactButtons({ person, size = "sm" }: { person: Person; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {contactLinks(person).map((l, i) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors",
            size === "md" ? "h-11 px-5 text-sm" : "h-9 px-3 text-sm",
            i === 0 ? "bg-flame-700 text-white hover:bg-flame" : "border border-line bg-white hover:border-ink/30",
          )}
        >
          <l.icon size={15} aria-hidden /> {l.label}
        </a>
      ))}
    </div>
  );
}

export function HereNow({ person }: { person: Person }) {
  return (
    <p className="flex items-start gap-1.5 rounded-2xl bg-sun-100 px-3 py-2 text-sm text-[#5c3a00]">
      <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">{person.whereNote}</span>
        {person.whereUpdatedAt && <span className="text-xs opacity-80"> · {timeAgo(person.whereUpdatedAt)}</span>}
      </span>
    </p>
  );
}

export function PersonCard({ person: p, reasons = [], here }: { person: Person; reasons?: string[]; here?: boolean }) {
  const lists = [
    ["Looking for", p.wants.map((w) => labelFor(WANTS, w))],
    ["Can help with", p.offers.map((o) => labelFor(OFFERS, o))],
  ] as const;
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} size={52} />
        <div className="min-w-0 flex-1">
          <Link href={`/p/${p.id}`} className="text-lg font-bold leading-tight hover:underline">
            {p.name}
          </Link>
          <p className="text-sm text-muted">
            {p.headline}
            {p.company ? ` · ${p.company}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {p.attendance === "in_person" ? <Tag tone="flame">At the venue</Tag> : <Tag>Online</Tag>}
            {p.interests.slice(0, 2).map((i) => (
              <Tag key={i}>{labelFor(INTERESTS, i)}</Tag>
            ))}
          </div>
        </div>
      </div>
      {here && <HereNow person={p} />}
      <dl className="space-y-1 text-sm">
        {lists.map(([k, v]) =>
          v.length ? (
            <div key={k}>
              <dt className="inline font-semibold">{k}: </dt>
              <dd className="inline text-muted">{v.join(" · ")}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {reasons.length > 0 && (
        <div className="rounded-2xl border border-flame/15 bg-flame-50 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-flame-700">
            <Sparkles size={12} aria-hidden /> Why meet
          </p>
          <ul className="space-y-0.5">
            {reasons.slice(0, 2).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <ContactButtons person={p} />
        <SaveButton id={p.id} name={p.name} compact />
      </div>
    </Card>
  );
}
