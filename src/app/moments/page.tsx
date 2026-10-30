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

// No referrer, so images and videos hosted by X load the same way X's own embed loads them.
export const metadata: Metadata = { title: "Moments", description: "Photos and highlights from Moonshot 2026, shared by the people who were there.", referrer: "no-referrer" };

const PAGE = 60;

export default async function MomentsPage({ searchParams }: { searchParams: Promise<{ posted?: string; before?: string; share?: string }> }) {
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
  const people = await momentPeople(db, featured ? [...featured.list, ...items] : items);
  const last = items.at(-1);

  return (
    <div data-dark-page className="-mb-12 min-h-dvh bg-[#121116] text-white">
      {sp.posted && (
        <p role="status" className="moment-fade sticky top-16 z-20 mx-auto w-fit translate-y-3 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg">
          Posted — thanks for sharing ✨
        </p>
      )}
      <MomentsGallery moments={items.map((i) => toMomentView(i, people.get(i.moment.id)))} featured={featured ? featured.list.map((i) => toMomentView(i, people.get(i.moment.id))) : []} myName={me?.name ?? null} shareOpen={Boolean(sp.share) || (!before && items.length === 0)} posted={sp.posted} total={total} />
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
