import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/me";
import { adminEntry, AdminKeyPage } from "@/components/admin-gate";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

// The admin moved to /adminx (one admin for Event Connect and AdsSim). Old links land in the right place there;
// to everyone else it stays a 404 (or the key form, until ADMIN_ENTRY is set), as before.
export default async function OldAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; event?: string }> }) {
  if (!(await isAdmin())) {
    if (adminEntry()) notFound();
    return <AdminKeyPage />;
  }
  const { tab, event } = await searchParams;
  const to: Record<string, string> = {
    moments: event ? `/adminx/connect/events/${event}?tab=moments` : "/adminx/connect/events",
    people: event ? `/adminx/connect/events/${event}?tab=people` : "/adminx/connect/events",
    accounts: "/adminx/connect/people",
    events: "/adminx/connect/events",
  };
  redirect((tab && to[tab]) || (event ? `/adminx/connect/events/${event}` : "/adminx/connect"));
}
