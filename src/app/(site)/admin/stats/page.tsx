import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/me";
import { adminEntry } from "@/components/admin-gate";

// Stats moved into the admin at /adminx. To anyone who isn't an admin, this stays a 404 like the rest.
export default async function OldStats({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await isAdmin()) && adminEntry()) notFound();
  const { days } = await searchParams;
  redirect(`/adminx/connect/stats${days ? `?days=${encodeURIComponent(days)}` : ""}`);
}
