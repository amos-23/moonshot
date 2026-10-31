import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getMe } from "@/lib/me";
import { listMoments, momentPeople, reactionCounts } from "@/lib/data";
import { pickFeatured } from "@/lib/featured";
import { refreshMoments } from "@/lib/social/live";
import { toMomentView } from "@/components/moment";
import { MomentsGallery } from "@/components/moments-gallery";
import { XLogo } from "@/components/share";
import { withUtm, xIntent } from "@/lib/share";
import { eventTag, getEvent } from "@/lib/events";
import { siteOrigin } from "@/lib/site";

type Params = { params: Promise<{ event: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const e = await getEvent(await getDb(), (await params).event);
  if (!e) return {};
  const image = { url: `/og/moments?e=${e.slug}`, width: 1200, height: 630, alt: `Moments from ${e.name}` };
  const description = `Photos and highlights from ${e.name}, shared by the people who were there.`;
  return {
    title: "Moments",
    description,
    // No referrer, so images and videos hosted by X load the same way X's own embed loads them.
    referrer: "no-referrer",
    openGraph: { title: `Moments · ${e.name}`, description, images: [image] },
    twitter: { card: "summary_large_image", title: `Moments · ${e.name}`, images: [image] },
  };
}

const PAGE = 60;

export default async function MomentsPage({ params, searchParams }: Params & { searchParams: Promise<{ posted?: string; before?: string; share?: string; m?: string; story?: string }> }) {
  const sp = await searchParams;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const db = await getDb();
  const event = await getEvent(db, (await params).event);
  if (!event) notFound();
  const [me, items, [{ total }], featured] = await Promise.all([
    getMe(event.id),
    listMoments(db, event.id, { limit: PAGE, before }),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.moments).where(and(eq(schema.moments.eventId, event.id), eq(schema.moments.hidden, false))),
    before ? Promise.resolve(null) : pickFeatured(db, event.id),
  ]);
  // Keep likes and replies fresh for Featured, after the page has been sent.
  after(() => refreshMoments(db).catch((err) => console.error("moment stats refresh failed", err)));
  const origin = await siteOrigin();
  const shown = featured ? [...featured.list, ...items] : items;
  const [people, reacts] = await Promise.all([momentPeople(db, event.id, shown), reactionCounts(db, shown.map((i) => i.moment.id))]);
  const last = items.at(-1);

  return (
    <div data-dark-page className="-mb-12 min-h-dvh bg-[#121116] text-white">
      {sp.posted && (
        <div role="status" className="moment-fade sticky top-16 z-20 mx-auto flex w-fit max-w-[calc(100%-2rem)] translate-y-3 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg">
          <span>Posted — thanks for sharing ✨</span>
          {sp.m && /^[0-9a-f-]{36}$/i.test(sp.m) && (
            <a href={xIntent(`Just shared a moment from ${eventTag(event) || event.name} 📸`, withUtm(`${origin}/m/${sp.m}`, "x", "posted"))} target="_blank" rel="noopener noreferrer" data-track="posted_share_x" data-track-id={sp.m} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-ink hover:bg-white/90">
              <XLogo size={12} /> Post it on X
            </a>
          )}
        </div>
      )}
      <MomentsGallery event={{ slug: event.slug, short: event.short, name: event.name, tag: eventTag(event), dates: event.dates, venue: event.venue }} moments={items.map((i) => toMomentView(i, people.get(i.moment.id), event.slug))} featured={featured ? featured.list.map((i) => toMomentView(i, people.get(i.moment.id), event.slug)) : []} myName={me?.name ?? null} shareOpen={Boolean(sp.share)} posted={sp.posted} total={total} origin={origin} storyOpen={Boolean(sp.story)} reactionCounts={Object.fromEntries(reacts)} />
      {items.length === PAGE && last && (
        <div className="-mt-16 pb-16 text-center">
          <Link href={`/${event.slug}/moments?before=${encodeURIComponent(last.moment.createdAt.toISOString())}`} className="inline-flex h-11 items-center rounded-full bg-white/10 px-6 font-semibold text-white hover:bg-white/20">
            Older moments
          </Link>
        </div>
      )}
    </div>
  );
}
