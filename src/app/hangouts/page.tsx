import Link from "next/link";
import { Clock, MapPin, Users } from "lucide-react";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { hangoutMembers, listHangouts } from "@/lib/data";
import { cancelHangoutAction, joinHangoutAction } from "@/lib/actions";
import { formatWhen, toLagosInput } from "@/lib/time";
import { HangoutForm } from "@/components/forms";
import { ActionButton, ReportLink } from "@/components/client";
import { Card, Empty, LinkButton, Notice, PageTitle } from "@/components/ui";

export const metadata = { title: "Hangouts" };

export default async function HangoutsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const db = await getDb();
  const me = await getMe();
  const rows = await listHangouts(db, me?.id ?? null);
  const members = await Promise.all(rows.map((r) => hangoutMembers(db, r.hangout.id)));
  const start = toLagosInput(new Date(Math.max(Date.now() + 3600_000, Date.parse("2026-10-28T10:00:00+01:00"))));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageTitle title="Hangouts" sub="Small, informal meetups at the venue or online. Start one in seconds." />
      {created && <div className="mb-4"><Notice tone="success">Your hangout is live. Share this page so people can join.</Notice></div>}

      <Card className="mb-8 p-5 sm:p-6">
        {me ? (
          <details>
            <summary className="cursor-pointer list-none font-bold">
              <span className="inline-flex h-11 items-center rounded-full bg-flame-700 px-5 text-sm text-white">+ Start a hangout</span>
            </summary>
            <div className="mt-5">
              <HangoutForm defaultStart={start} />
            </div>
          </details>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">Make your card to start or join hangouts — so others know who&apos;s coming.</p>
            <LinkButton href="/card">Make my card</LinkButton>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <Empty title="No hangouts yet">Start the first one — e.g. “AI builders lunch” or “Fintech founders coffee”.</Empty>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ hangout: h, host, going, joined }, i) => {
            const isHost = me?.id === h.hostId;
            const full = going >= h.capacity;
            return (
              <li key={h.id} id={h.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold">{h.title}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {formatWhen(h.startsAt)}</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {h.place}</span>
                        <span className="inline-flex items-center gap-1"><Users size={14} aria-hidden /> {going}/{h.capacity}</span>
                      </p>
                      <p className="mt-1 text-sm">
                        Hosted by{" "}
                        <Link href={`/p/${host.id}`} className="font-semibold hover:underline">
                          {host.name}
                        </Link>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {isHost ? (
                        <ActionButton action={cancelHangoutAction.bind(null, h.id)} variant="ghost" confirm="Cancel this hangout?">
                          Cancel
                        </ActionButton>
                      ) : joined ? (
                        <ActionButton action={joinHangoutAction.bind(null, h.id, false)}>Leave</ActionButton>
                      ) : (
                        <ActionButton action={joinHangoutAction.bind(null, h.id, true)} variant="primary" size="md">
                          {full ? "Full" : "I'm in"}
                        </ActionButton>
                      )}
                    </div>
                  </div>
                  {h.details && <p className="mt-3 whitespace-pre-line text-sm">{h.details}</p>}
                  {members[i].length > 0 && (
                    <p className="mt-3 text-sm text-muted">
                      Going:{" "}
                      {members[i].map((m, j) => (
                        <span key={m.id}>
                          {j > 0 && ", "}
                          <Link href={`/p/${m.id}`} className="text-ink hover:underline">
                            {m.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  {!isHost && (
                    <div className="mt-3">
                      <ReportLink type="hangout" id={h.id} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
