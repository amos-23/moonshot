import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getMe } from "@/lib/me";
import { listMoments, momentPeople } from "@/lib/data";
import { pickFeatured } from "@/lib/featured";
import { refreshMoments } from "@/lib/social/live";
import { toMomentView } from "@/components/moment";
import { MomentsGallery } from "@/components/moments-gallery";
import { XLogo } from "@/components/share";
import { HASHTAG, withUtm, xIntent } from "@/lib/share";
import { siteOrigin } from "@/lib/site";

// No referrer, so images and videos hosted by X load the same way X's own embed loads them.
const image = { url: "/og/moments", width: 1200, height: 630, alt: "Moments from Moonshot 2026" };
export const metadata: Metadata = {
  title: "Moments",
  description: "Photos and highlights from Moonshot 2026, shared by the people who were there.",
  referrer: "no-referrer",
  openGraph: { title: "Moments · Moonshot 2026", description: "Photos and highlights from Moonshot 2026, shared by the people who were there.", images: [image] },
  twitter: { card: "summary_large_image", title: "Moments · Moonshot 2026", images: [image] },
};

const PAGE = 60;

export default async function MomentsPage({ searchParams }: { searchParams: Promise<{ posted?: string; before?: string; share?: string; m?: string }> }) {
  const sp = await searchParams;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const db = await getDb();
  const [me, items, [{ total }], featured] = await Promise.all([
    getMe(),
    listMoments(db, { limit: PAGE, before }),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.moments).where(eq(schema.moments.hidden, false)),
    before ? Promise.resolve(null) : pickFeatured(db),
  ]);
  // Keep likes and replies fresh for Featured, after the page has been sent.
  after(() => refreshMoments(db).catch((err) => console.error("moment stats refresh failed", err)));
  const origin = await siteOrigin();
  const people = await momentPeople(db, featured ? [...featured.list, ...items] : items);
  const last = items.at(-1);

  return (
    <div data-dark-page className="-mb-12 min-h-dvh bg-[#121116] text-white">
      {sp.posted && (
        <div role="status" className="moment-fade sticky top-16 z-20 mx-auto flex w-fit max-w-[calc(100%-2rem)] translate-y-3 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg">
          <span>Posted — thanks for sharing ✨</span>
          {sp.m && /^[0-9a-f-]{36}$/i.test(sp.m) && (
            <a href={xIntent(`Just shared a moment from ${HASHTAG} 📸`, withUtm(`${origin}/m/${sp.m}`, "x", "posted"))} target="_blank" rel="noopener noreferrer" data-track="posted_share_x" data-track-id={sp.m} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-ink hover:bg-white/90">
              <XLogo size={12} /> Post it on X
            </a>
          )}
        </div>
      )}
      <MomentsGallery moments={items.map((i) => toMomentView(i, people.get(i.moment.id)))} featured={featured ? featured.list.map((i) => toMomentView(i, people.get(i.moment.id))) : []} myName={me?.name ?? null} shareOpen={Boolean(sp.share) || (!before && items.length === 0)} posted={sp.posted} total={total} origin={origin} />
      {items.length === PAGE && last && (
        <div className="-mt-16 pb-16 text-center">
          <Link href={`/moments?before=${encodeURIComponent(last.moment.createdAt.toISOString())}`} className="inline-flex h-11 items-center rounded-full bg-white/10 px-6 font-semibold text-white hover:bg-white/20">
            Older moments
          </Link>
        </div>
      )}
    </div>
  );
}
