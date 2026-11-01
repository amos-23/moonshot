import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/me";
import { AdminKeyPage, adminEntry } from "@/components/admin-gate";

export const metadata = { title: "Not found", robots: { index: false, follow: false } };

// The admin key form, at a secret address only (ADMIN_ENTRY). Any other /admin/… address is a 404.
export default async function AdminEntryPage({ params }: { params: Promise<{ entry: string }> }) {
  const { entry } = await params;
  const secret = adminEntry();
  if (!secret || entry !== secret) notFound();
  if (await isAdmin()) redirect("/admin");
  return <AdminKeyPage />;
}
