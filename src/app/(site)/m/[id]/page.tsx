import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cleanPostText } from "@/lib/share";
import { clip } from "@/lib/og";
import { GoTo } from "@/components/share-landing";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await (await getDb())
    .select({ m: schema.moments, author: schema.people.name, event: schema.eventSpaces })
    .from(schema.moments)
    .innerJoin(schema.eventSpaces, eq(schema.eventSpaces.id, schema.moments.eventId))
    .leftJoin(schema.people, eq(schema.people.id, schema.moments.personId))
    .where(and(eq(schema.moments.id, id), eq(schema.moments.hidden, false)))
    .limit(1);
  if (!row) return null;
  const m = row.m;
  const who = (m.xPostUrl ? (m.xAuthorName ?? `@${m.xAuthorHandle}`) : (row.author ?? (m.xHandle ? `@${m.xHandle}` : m.name))) ?? `Someone at ${row.event.short}`;
  return { m, who, event: row.event, text: cleanPostText(m.body || m.xText) };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await load(id);
  if (!d) return { title: "Moments" };
  const title = `${d.who} at ${d.event.name}`;
  const description = clip(d.text, 180) || `A moment from ${d.event.hashtag || d.event.name}, shared on ${d.event.short} Connect.`;
  const image = { url: `/og/moment/${id}`, width: 1200, height: 630, alt: description };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

// A shared moment: shows its preview to X and WhatsApp, and sends people on to it in Moments.
export default async function SharedMoment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await load(id);
  if (!d) redirect("/");
  return (
    <div data-dark-page className="-mb-12 grid min-h-dvh place-items-center bg-[#121116] px-4 text-center text-white">
      <GoTo path={`/${d.event.slug}/moments`} hash={`m-${id}`} />
      <div className="max-w-lg">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-sun">Moments · {d.event.name}</p>
        <p className="mt-4 text-2xl font-semibold">{clip(d.text, 200) || "A moment from {d.event.name}"}</p>
        <p className="mt-2 text-white/60">{d.who}</p>
        <Link href={`/${d.event.slug}/moments#m-${id}`} className="mt-6 inline-flex h-11 items-center rounded-full bg-sun px-6 font-bold text-ink">
          Open in Moments
        </Link>
      </div>
    </div>
  );
}
