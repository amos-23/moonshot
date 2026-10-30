import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { GoTo } from "@/components/share-landing";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await (await getDb())
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, id), eq(schema.people.hidden, false)))
    .limit(1);
  return p ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await load(id);
  if (!p) return {};
  const title = `${p.name} · Moonshot Connect`;
  const description = `${p.headline}${p.company ? ` at ${p.company}` : ""}. Find ${p.name.split(" ")[0]} and others from Moonshot 2026, and reach out directly.`;
  const image = { url: `/og/person/${id}`, width: 1200, height: 630, alt: `${p.name}, ${p.headline}` };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "profile" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

// A shared card: shows its preview to X and WhatsApp, and sends people on to the card.
export default async function SharedCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(id);
  if (!p) redirect("/");
  const to = `/?q=${encodeURIComponent(p.xHandle ?? p.name)}`;
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <GoTo path={to} />
      <div>
        <p className="text-2xl font-bold">{p.name}</p>
        <p className="text-muted">{p.headline}</p>
        <Link href={to} className="mt-5 inline-flex h-11 items-center rounded-full bg-flame-700 px-6 font-semibold text-white">
          See {p.name.split(" ")[0]}&apos;s card
        </Link>
      </div>
    </div>
  );
}
