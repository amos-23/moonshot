import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { listMoments } from "@/lib/data";
import { MomentForm } from "@/components/forms";
import { MomentCard } from "@/components/moment";
import { Disclosure } from "@/components/client";
import { Empty, Notice, PageTitle } from "@/components/ui";

export const metadata = { title: "Moments", description: "Photos and updates from Moonshot 2026, shared by the people there." };

export default async function MomentsPage({ searchParams }: { searchParams: Promise<{ posted?: string; before?: string }> }) {
  const sp = await searchParams;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const db = await getDb();
  const [me, items] = await Promise.all([getMe(), listMoments(db, { limit: 60, before })]);
  const last = items.at(-1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageTitle title="📸 Moments" sub="Photos, updates and X posts from the people at Moonshot." />
      {sp.posted && (
        <div className="mb-4">
          <Notice tone="success">Posted! Thanks for sharing.</Notice>
        </div>
      )}
      {!before && (
        <Disclosure
          initialOpen={items.length === 0}
          className="group mb-6 rounded-3xl border border-line bg-surface open:p-5 sm:open:p-6"
          summaryClassName="flex cursor-pointer list-none items-center gap-2 rounded-3xl px-4 py-3 font-semibold group-open:mb-4 group-open:p-0 [&::-webkit-details-marker]:hidden"
          summary={
            <>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-flame text-white">
                <Plus size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">Share a photo, update or X post</span>
              <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </>
          }
        >
          <MomentForm myName={me?.name ?? null} />
        </Disclosure>
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
