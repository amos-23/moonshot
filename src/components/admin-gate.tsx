import "server-only";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/me";
import { AdminLogin } from "@/components/forms";
import { PageTitle } from "@/components/ui";

/** The secret address of the admin key form, e.g. ADMIN_ENTRY=k7q2-door gives /admin/k7q2-door. */
export const adminEntry = () => process.env.ADMIN_ENTRY?.trim() || null;

/**
 * For admin pages: nothing for admins (show the page). Everyone else gets a plain 404, so /admin looks like
 * it doesn't exist. Admins get in by signing in with an ADMIN_EMAILS account, or with the key at the secret
 * address. Until ADMIN_ENTRY is set, the key form stays on /admin so nobody is locked out.
 */
export async function adminGate(): Promise<React.ReactNode | null> {
  if (await isAdmin()) return null;
  if (adminEntry()) notFound();
  return <AdminKeyPage />;
}

export function AdminKeyPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <PageTitle title="Admin" />
      <AdminLogin />
    </div>
  );
}
