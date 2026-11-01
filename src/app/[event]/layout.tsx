import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { MOONSHOT_EVENT_ID } from "@/lib/db/schema";
import { getMe } from "@/lib/me";
import { eventPhase, getEvent } from "@/lib/events";
import { getAccount } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-access";
import { themeKind } from "@/lib/theme";
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
    // Moonshot keeps its sunrise as the tab icon, Ogun Digital its own logo; others use Event Connect's.
    ...(e.id === MOONSHOT_EVENT_ID ? { icons: { icon: "/moonshot-icon.svg" } } : themeKind(e) === "ogun" ? { icons: { icon: "/brands/ogun-digital-summit.svg" } } : {}),
    // Events people created stay out of search engines until an admin approves them.
    ...(!e.listed || e.hidden ? { robots: { index: false, follow: false } } : {}),
    openGraph: { images: [image], siteName: `${e.short} Connect` },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function EventLayout({ children, params }: Params & { children: React.ReactNode }) {
  const event = await getEvent(await getDb(), (await params).event);
  if (!event) notFound();
  // Hidden events are drafts: only their organiser and admins can open them.
  const manage = await canManageEvent(event);
  if (event.hidden && !manage) notFound();
  const [me, account] = await Promise.all([getMe(event.id).catch(() => null), getAccount()]);
  return (
    <>
      <EventHeader event={event} phase={eventPhase(event)} hasCard={Boolean(me)} account={account && { email: account.email, name: account.name }} manage={manage} />
      <main id="main" className="pb-12">
        {children}
      </main>
      <EventFooter event={event} />
    </>
  );
}
