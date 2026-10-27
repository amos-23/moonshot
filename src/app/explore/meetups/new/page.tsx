import { requireProfile } from "@/lib/auth";
import { MeetupForm } from "@/components/explore-forms";
import { Card, PageHeader } from "@/components/ui";
import { toLagosInput } from "@/lib/time";

export const metadata = { title: "Propose a meetup" };

export default async function NewMeetupPage() {
  await requireProfile("/explore/meetups/new");
  const start = toLagosInput(new Date(Math.max(Date.now() + 2 * 3600_000, Date.UTC(2026, 9, 28, 11, 0))));
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader title="Propose a meetup" subtitle="Bring people together around a topic you care about." />
      <Card className="p-5 sm:p-6">
        <MeetupForm defaultStart={start} />
      </Card>
    </div>
  );
}
