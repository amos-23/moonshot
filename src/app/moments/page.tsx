import Link from "next/link";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { listMoments } from "@/lib/data";
import { MomentForm } from "@/components/forms";
import { MomentCard } from "@/components/moment";
import { Card, Empty, Notice, PageTitle } from "@/components/ui";

export const metadata = { title: "Moments", description: "Photos and updates from Moonshot 2026, shared by the people there." };

export default async function MomentsPage({ searchParams }: { searchParams: Promise<{ posted?: string; before?: string }> }) {
  const sp = await searchParams;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const db = await getDb();
  const [me, items] = await Promise.all([getMe(), listMoments(db, { limit: 60, before })]);
  const last = items.at(-1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageTitle title="📸 Moments" sub="Photos, updates and X posts from Moonshot, shared by the people there. Anyone can post." />
      {sp.posted && (
        <div className="mb-4">
          <Notice tone="success">Posted! Thanks for sharing.</Notice>
        </div>
      )}
      {!before && (
        <Card className="mb-8 p-5 sm:p-6">
          <MomentForm myName={me?.name ?? null} />
        </Card>
      )}
      {items.length === 0 ? (
        <Empty title={before ? "That's everything" : "No moments yet"}>{before ? "You've reached the first moment." : "Be the first to share what's happening at Moonshot."}</Empty>
      ) : (
        <>
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid">
            {items.map((item) => (
              <li key={item.moment.id}>
                <MomentCard item={item} />
              </li>
            ))}
          </ul>
          {items.length === 60 && last && (
            <div className="mt-4 text-center">
              <Link href={`/moments?before=${encodeURIComponent(last.moment.createdAt.toISOString())}`} className="font-semibold text-flame-700 underline">
                Older moments
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
