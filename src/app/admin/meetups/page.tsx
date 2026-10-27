import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { adminMeetupStatusAction } from "@/lib/actions/admin";
import { formatWhen } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Meetups · Admin" };

export default async function AdminMeetupsPage() {
  const db = await getDb();
  const rows = await db
    .select({
      meetup: schema.meetups,
      organiser: schema.profiles.name,
      count: sql<number>`(select count(*)::int from meetup_participants mp where mp.meetup_id = ${schema.meetups.id})`,
    })
    .from(schema.meetups)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.meetups.organiserId))
    .orderBy(desc(schema.meetups.startsAt));
  return (
    <>
      <PageHeader title="Meetups" subtitle="Confirm, revert or cancel attendee-organised meetups." />
      {rows.length === 0 ? (
        <EmptyState title="No meetups yet" />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ meetup: m, organiser, count }) => (
            <li key={m.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex-1">
                  <Link href={`/explore/meetups/${m.id}`} className="font-medium hover:underline">
                    {m.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatWhen(m.startsAt)} · by {organiser ?? "?"} · {count}/{m.capacity}
                  </p>
                </div>
                <Badge tone={m.status === "confirmed" ? "success" : m.status === "cancelled" ? "danger" : "pending"}>{m.status}</Badge>
                {m.status !== "confirmed" && (
                  <ActionButton action={adminMeetupStatusAction.bind(null, m.id, "confirmed")} variant="ghost">
                    Confirm
                  </ActionButton>
                )}
                {m.status !== "proposed" && (
                  <ActionButton action={adminMeetupStatusAction.bind(null, m.id, "proposed")} variant="ghost">
                    Set proposed
                  </ActionButton>
                )}
                {m.status !== "cancelled" && (
                  <ActionButton action={adminMeetupStatusAction.bind(null, m.id, "cancelled")} variant="ghost" confirm="Cancel this meetup?">
                    Cancel
                  </ActionButton>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
