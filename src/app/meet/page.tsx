import Link from "next/link";
import { cookies } from "next/headers";
import { Clock, MapPin } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { listCheckins } from "@/lib/data";
import { endCheckinAction } from "@/lib/actions";
import { formatTime, timeAgo } from "@/lib/time";
import { contact } from "@/components/person";
import { CheckinForm } from "@/components/forms";
import { ActionButton, ReportLink } from "@/components/client";
import { Avatar, Card, Empty, Notice, PageTitle, cx } from "@/components/ui";

export const metadata = { title: "Meet up", description: "Who's around at Moonshot right now, and where to find them." };

export default async function MeetPage({ searchParams }: { searchParams: Promise<{ checked?: string }> }) {
  const { checked } = await searchParams;
  const db = await getDb();
  const [me, checkins] = await Promise.all([getMe(), listCheckins(db)]);
  const myCheckinId = (await cookies()).get("mc_checkin")?.value;
  const isMine = (c: (typeof checkins)[number]) => (me ? c.personId === me.id : c.id === myCheckinId);
  const mine = checkins.find(isMine);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageTitle title="📍 Meet up" sub="Who's around right now and where to find them. Check in so people can come and meet you." />
      {checked && (
        <div className="mb-4">
          <Notice tone="success">You&apos;re on the board! People can see where you are and reach you.</Notice>
        </div>
      )}

      <Card className="mb-8 p-5 sm:p-6">
        {mine ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">You&apos;re checked in at {mine.place}</p>
              <p className="text-sm text-muted">Until {formatTime(mine.expiresAt)}. Moving? Check in again below, or let people know you&apos;ve left.</p>
            </div>
            <ActionButton action={endCheckinAction} variant="secondary" size="md">
              <span data-track="checkin_end">I&apos;ve left</span>
            </ActionButton>
          </div>
        ) : null}
        <details open={!mine} className={cx(mine && "mt-4 border-t border-line pt-4")}>
          <summary className={cx("cursor-pointer text-sm font-semibold", !mine && "sr-only")}>{mine ? "Check in somewhere else" : "Check in"}</summary>
          <div className={mine ? "mt-4" : ""}>
            <CheckinForm me={me ? { name: me.name } : null} />
          </div>
        </details>
      </Card>

      <h2 className="mb-3 text-lg font-extrabold uppercase">
        Around now <span className="text-muted">· {checkins.length}</span>
      </h2>
      {checkins.length === 0 ? (
        <Empty title="No one's checked in yet">Be the first — say where you are and what you&apos;re up for, and people can come find you.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {checkins.map((c) => {
            const reach = contact(c, `Hi ${c.name.split(" ")[0]}! Saw on Moonshot Connect you're at ${c.place} — can I come say hi?`);
            return (
              <li key={c.id}>
                <Card className={cx("flex h-full flex-col gap-3 p-4", isMine(c) && "border-flame/40 bg-flame-50")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">
                        {c.personId ? (
                          <Link href={`/?q=${encodeURIComponent(c.name)}`} className="hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                        {isMine(c) && <span className="ml-2 text-xs font-semibold text-flame-700">You</span>}
                      </p>
                      {c.headline && <p className="truncate text-sm text-muted">{c.headline}</p>}
                    </div>
                  </div>
                  <p className="flex items-start gap-1.5 rounded-2xl bg-sun-100 px-3 py-2 font-semibold text-[#5c3a00]">
                    <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden /> {c.place}
                  </p>
                  {c.note && <p className="text-sm">{c.note}</p>}
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Clock size={12} aria-hidden /> Checked in {timeAgo(c.createdAt)} · here until {formatTime(c.expiresAt)}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    {reach && !isMine(c) ? (
                      <a href={reach.href} target="_blank" rel="noopener noreferrer nofollow" data-track="checkin_contact" data-track-id={c.id} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-flame-700 px-4 text-sm font-semibold text-white hover:bg-flame">
                        <reach.icon size={15} aria-hidden /> {reach.kind === "whatsapp" ? "WhatsApp" : reach.label}
                      </a>
                    ) : (
                      <span />
                    )}
                    {!isMine(c) && <ReportLink type="checkin" id={c.id} />}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
