import { getDb } from "@/lib/db";
import { EVENTS, metrics } from "@/lib/services/analytics";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Metrics · Admin" };

export default async function MetricsPage() {
  const m = await metrics(await getDb(), 30);
  const max = Math.max(1, ...m.daily.map((d) => d.n));
  return (
    <>
      <PageHeader title="Metrics" subtitle="Our north star is meaningful connections facilitated — not sign-ups." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Accepted connections", m.totals.accepted, "All time"],
          ["Two-way conversations", m.totals.conversationsBothWays, "Both people replied"],
          ["Confirmed meetings", m.totals.confirmedMeetings, "Both agreed a time"],
          ["Meetup sign-ups", m.totals.meetupJoins, "All time"],
          ["Profiles", m.totals.profiles, `${m.totals.users} accounts`],
          ["Pending requests", m.totals.pending, "Awaiting reply"],
          [
            "Acceptance rate",
            m.counts.connection_request_sent?.n ? `${Math.round(((m.counts.connection_request_accepted?.n ?? 0) / m.counts.connection_request_sent.n) * 100)}%` : "—",
            "Last 30 days",
          ],
        ].map(([label, n, sub]) => (
          <Card key={label as string} className="p-4">
            <p className="text-2xl font-semibold">{n}</p>
            <p className="text-sm">{label}</p>
            <p className="text-xs text-muted">{sub}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold">Connections accepted per day (30 days)</h2>
        {m.daily.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No accepted connections yet.</p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {m.daily.map((d) => (
              <li key={d.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 tabular-nums text-muted">{d.day}</span>
                <span className="h-3 rounded bg-accent" style={{ width: `${(d.n / max) * 100}%`, minWidth: 4 }} aria-hidden />
                <span className="tabular-nums">{d.n}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 overflow-x-auto p-5">
        <h2 className="font-semibold">Tracked events (30 days)</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">Event</th>
              <th className="py-1 text-right font-medium">Count</th>
              <th className="py-1 text-right font-medium">Unique users</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {EVENTS.map((e) => (
              <tr key={e}>
                <td className="py-1.5">{e.replace(/_/g, " ")}</td>
                <td className="py-1.5 text-right tabular-nums">{m.counts[e]?.n ?? 0}</td>
                <td className="py-1.5 text-right tabular-nums">{m.counts[e]?.users ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
