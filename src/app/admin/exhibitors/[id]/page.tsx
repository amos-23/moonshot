import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getExhibitor } from "@/lib/services/exhibitors";
import { ExhibitorForm } from "@/components/admin-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function EditExhibitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getExhibitor(await getDb(), id, true);
  if (!e) notFound();
  return (
    <>
      <PageHeader title={`Edit ${e.name}`} action={<Link href="/admin/exhibitors" className="text-sm text-accent hover:underline">Back</Link>} />
      <Card className="p-5">
        <ExhibitorForm exhibitor={e} />
      </Card>
    </>
  );
}
