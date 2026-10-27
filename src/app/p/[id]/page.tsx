import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getMe } from "@/lib/me";
import { isHereNow } from "@/lib/data";
import { scoreMatch } from "@/lib/matching";
import { INTERESTS, OFFERS, WANTS, labelFor } from "@/lib/constants";
import { ContactButtons, HereNow } from "@/components/person";
import { CopyButton, ReportLink, SaveButton } from "@/components/client";
import { Avatar, Card, LinkButton, Tag } from "@/components/ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const db = await getDb();
  return (await db.query.people.findFirst({ where: and(eq(schema.people.id, id), eq(schema.people.hidden, false)) })) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  return p ? { title: p.name, description: `${p.headline} — meet them at Moonshot 2026` } : { title: "Not found" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(id);
  if (!p) notFound();
  const me = await getMe();
  const isMe = me?.id === p.id;
  const match = me && !isMe ? scoreMatch(me, p) : null;

  const section = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <span key={i} className="rounded-full border border-line bg-canvas px-3 py-1 text-sm">
              {i}
            </span>
          ))}
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card className="overflow-hidden">
        <div className="h-20 bg-flame bg-[radial-gradient(circle_at_50%_160%,#f6a821_45%,transparent_46%)]" />
        <div className="space-y-5 p-6 pt-0">
          <div className="-mt-9 flex items-end justify-between gap-3">
            <span className="rounded-full ring-4 ring-white">
              <Avatar name={p.name} size={80} />
            </span>
            <SaveButton id={p.id} name={p.name} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold">{p.name}</h1>
            <p className="text-muted">
              {p.headline}
              {p.company ? ` · ${p.company}` : ""}
            </p>
            <div className="mt-2">{p.attendance === "in_person" ? <Tag tone="flame">At the venue</Tag> : <Tag>Following online</Tag>}</div>
          </div>
          {isHereNow(p) && <HereNow person={p} />}
          {p.bio && <p className="text-lg">{p.bio}</p>}
          {match && match.reasons.length > 0 && (
            <div className="rounded-2xl border border-flame/15 bg-flame-50 p-4">
              <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-flame-700">
                <Sparkles size={12} aria-hidden /> Why you should meet
              </p>
              <ul className="space-y-0.5 text-sm">
                {match.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {section("Looking for", p.wants.map((w) => labelFor(WANTS, w)))}
          {section("Can help with", p.offers.map((o) => labelFor(OFFERS, o)))}
          {section("Topics", p.interests.map((i) => labelFor(INTERESTS, i)))}
          <div className="border-t border-line pt-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Reach {p.name.split(" ")[0]}</h2>
            <ContactButtons person={p} size="md" />
          </div>
        </div>
      </Card>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <CopyButton text={`/p/${p.id}`} label="Copy card link" />
        {isMe ? (
          <LinkButton href="/card" variant="secondary" size="sm">
            Edit my card
          </LinkButton>
        ) : (
          <ReportLink type="person" id={p.id} />
        )}
      </div>
      {!me && (
        <Card className="mt-6 p-5 text-center">
          <p className="font-bold">Want people to find you too?</p>
          <LinkButton href="/card" className="mt-3">
            Make my card — 30 seconds
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
