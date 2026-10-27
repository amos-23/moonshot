import Link from "next/link";
import { getDb } from "@/lib/db";
import { listExhibitors, listInquiries } from "@/lib/services/exhibitors";
import { deleteExhibitorAction, setInquiryStatusAction } from "@/lib/actions/admin";
import { timeAgo } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { ExhibitorForm } from "@/components/admin-forms";
import { Badge, Card, DemoBadge, EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Exhibitors · Admin" };

export default async function AdminExhibitorsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const db = await getDb();
  const [rows, inquiries] = await Promise.all([listExhibitors(db, null, { includeUnpublished: true }), listInquiries(db)]);
  return (
    <>
      <PageHeader title="Exhibitors" subtitle="Only add real exhibitors from verified sources. Mark anything fictional as demo data." />
      {created && (
        <div className="mb-4">
          <Notice tone="success">Exhibitor added.</Notice>
        </div>
      )}
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-semibold">Add exhibitor</h2>
        <ExhibitorForm />
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No exhibitors yet" />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ exhibitor: e }) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3">
                <span className="flex flex-1 flex-wrap items-center gap-2 font-medium">
                  {e.name}
                  {e.isDemo && <DemoBadge />}
                  {!e.published && <Badge tone="neutral">unpublished</Badge>}
                  {e.boothVerified ? <Badge tone="success">booth {e.boothLocation}</Badge> : <Badge>booth TBC</Badge>}
                </span>
                <Link href={`/admin/exhibitors/${e.id}`} className="text-sm text-accent hover:underline">
                  Edit
                </Link>
                <ActionButton action={deleteExhibitorAction.bind(null, e.id)} variant="ghost" confirm={`Delete ${e.name}?`}>
                  Delete
                </ActionButton>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Questions & introduction requests</h2>
      {inquiries.length === 0 ? (
        <EmptyState title="No requests yet" />
      ) : (
        <ul className="space-y-2">
          {inquiries.map(({ inquiry: i, exhibitor, profile, email }) => (
            <li key={i.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={i.status === "open" ? "pending" : "neutral"}>{i.status}</Badge>
                  <Badge>{i.kind}</Badge>
                  <span className="font-medium">{exhibitor.name}</span>
                  <span className="text-muted">
                    from {profile?.name ?? "?"} ({email}) · {timeAgo(i.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm">{i.body}</p>
                <div className="mt-2 flex gap-2">
                  {i.status !== "forwarded" && (
                    <ActionButton action={setInquiryStatusAction.bind(null, i.id, "forwarded")} variant="ghost">
                      Mark forwarded
                    </ActionButton>
                  )}
                  {i.status !== "closed" && (
                    <ActionButton action={setInquiryStatusAction.bind(null, i.id, "closed")} variant="ghost">
                      Close
                    </ActionButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
