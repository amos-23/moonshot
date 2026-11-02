import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { signOut } from "@/lib/ads";
import { bearer, preflight, reply } from "@/lib/ads-route";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (token) await signOut(await getDb(), token);
  return reply(req, null, 204);
}
