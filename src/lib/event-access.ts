import "server-only";
import { getAccount } from "@/lib/auth";
import { isAdmin } from "@/lib/me";
import type { EventSpace } from "@/lib/db/schema";

/** Event owners (who created it) and admins can edit an event and moderate what's posted in it. */
export async function canManageEvent(event: Pick<EventSpace, "ownerId">): Promise<boolean> {
  const account = await getAccount();
  if (account && event.ownerId && event.ownerId === account.id) return true;
  return isAdmin();
}
