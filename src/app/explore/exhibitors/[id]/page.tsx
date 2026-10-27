import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, BookmarkCheck, ChevronLeft, ExternalLink, MapPin } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getExhibitor } from "@/lib/services/exhibitors";
import { toggleExhibitorSaveAction } from "@/lib/actions/explore";
import { EXHIBITOR_CATEGORIES, INDUSTRIES, labelFor } from "@/lib/constants";
import { ActionButton } from "@/components/action-button";
import { InquiryForm } from "@/components/explore-forms";
import { Badge, Card, DemoBadge, LinkButton, Notice } from "@/components/ui";

export const metadata = { title: "Exhibitor" };

export default async function ExhibitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const e = await getExhibitor(db, id);
  if (!e) notFound();
  const viewer = await getViewer();
  const saved = viewer
    ? Boolean(await db.query.savedExhibitors.findFirst({ where: and(eq(schema.savedExhibitors.userId, viewer.user.id), eq(schema.savedExhibitors.exhibitorId, id)) }))
    : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/explore" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> All exhibitors
      </Link>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{e.name}</h1>
          {e.isDemo && <DemoBadge />}
        </div>
        {e.tagline && <p className="mt-1 text-muted">{e.tagline}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge>{labelFor(EXHIBITOR_CATEGORIES, e.category)}</Badge>
          {e.industry && <Badge>{labelFor(INDUSTRIES, e.industry)}</Badge>}
        </div>
        {e.isDemo && (
          <div className="mt-4">
            <Notice tone="pending">This is a fictional demo entry used to show how the directory works. It is not a real Moonshot exhibitor.</Notice>
          </div>
        )}
        {e.description && <p className="mt-4 whitespace-pre-line">{e.description}</p>}
        <div className="mt-4 rounded-xl bg-canvas p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <MapPin size={16} aria-hidden /> Booth
          </p>
          <p className="text-muted">
            {e.boothLocation && e.boothVerified ? e.boothLocation : "Booth location hasn't been confirmed yet. We only show locations from verified sources."}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {viewer && (
            <ActionButton action={toggleExhibitorSaveAction.bind(null, e.id, !saved)} size="md">
              {saved ? <BookmarkCheck size={16} className="text-accent" aria-hidden /> : <Bookmark size={16} aria-hidden />}
              {saved ? "Saved to My Moonshot" : "Save to My Moonshot"}
            </ActionButton>
          )}
          {e.websiteUrl && (
            <a href={e.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-1 rounded-xl px-4 text-sm font-medium text-accent hover:bg-accent-50">
              Website <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </div>
      </Card>
      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="mb-3 font-semibold">Questions or introductions</h2>
        {viewer?.profile ? (
          <InquiryForm exhibitorId={e.id} />
        ) : (
          <div>
            <p className="text-sm text-muted">Sign in and create a profile to send a question or request an introduction.</p>
            <LinkButton href={`/login?next=/explore/exhibitors/${e.id}`} className="mt-3" size="sm">
              Sign in
            </LinkButton>
          </div>
        )}
      </Card>
    </div>
  );
}
