import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { getMe } from "@/lib/me";
import { eventPhase, getEvent } from "@/lib/events";
import { SIGNUP_COOKIE } from "@/lib/constants";
import { isAdmin } from "@/lib/me";
import { EventFooter, EventHeader } from "@/components/chrome";

type Params = { params: Promise<{ event: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const e = await getEvent(await getDb(), (await params).event);
  if (!e) return {};
  const phase = eventPhase(e);
  const where = [e.dates, e.venue].filter(Boolean).join(", ");
  const image = { url: `/og/site?e=${e.slug}`, width: 1200, height: 630, alt: `${e.short} Connect` };
  return {
    title: {
      default: phase === "after" ? `${e.short} Connect — find the people you met at ${e.name}` : `${e.short} Connect — meet the right people at ${e.name}`,
      template: `%s · ${e.short} Connect`,
    },
    description:
      phase === "after"
        ? `Find and follow up with the people you met at ${e.name}${where ? ` (${where})` : ""}. No sign-up.`
        : `See who's going to ${e.name}${where ? ` (${where})` : ""} and reach the people worth meeting. No sign-up.`,
    openGraph: { images: [image], siteName: `${e.short} Connect` },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function EventLayout({ children, params }: Params & { children: React.ReactNode }) {
  const event = await getEvent(await getDb(), (await params).event);
  // Hidden events are drafts: only admins can open them.
  if (!event || (event.hidden && !(await isAdmin()))) notFound();
  const [me, jar] = await Promise.all([getMe(event.id).catch(() => null), cookies()]);
  return (
    <>
      <EventHeader event={event} phase={eventPhase(event)} hasCard={Boolean(me)} signedUp={jar.get(SIGNUP_COOKIE)?.value === "1"} />
      <main id="main" className="pb-12">
        {children}
      </main>
      <EventFooter event={event} />
    </>
  );
}
