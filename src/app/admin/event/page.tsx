import { getDb } from "@/lib/db";
import { getEventInfo } from "@/lib/services/settings";
import { EventInfoForm } from "@/components/admin-forms";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Event info · Admin" };

export default async function EventInfoPage() {
  const info = await getEventInfo(await getDb());
  return (
    <>
      <PageHeader title="Event information" subtitle="Shown on the landing page. Only enter details confirmed by official sources." />
      <Card className="p-5">
        <EventInfoForm info={info} />
      </Card>
    </>
  );
}
