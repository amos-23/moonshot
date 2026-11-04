import { notFound, redirect } from "next/navigation";
import { adminEntry } from "@/components/admin-gate";

export const metadata = { title: "Not found", robots: { index: false, follow: false } };

// The admin moved to /adminx: an old secret address (/admin/<it>) goes to the new one. Anything else is a 404.
export default async function OldAdminEntry({ params }: { params: Promise<{ entry: string }> }) {
  const { entry } = await params;
  const secret = adminEntry();
  if (!secret || entry !== secret) notFound();
  redirect(`/adminx/${secret}`);
}
