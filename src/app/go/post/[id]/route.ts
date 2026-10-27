import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { track } from "@/lib/services/analytics";

const UUID = /^[0-9a-f-]{36}$/i;

// Records an "X post opened" event, then sends the user to the original post.
// Only redirects to URLs stored in our database (validated x.com URLs), so this is not an open redirect.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.redirect(new URL("/conversation", req.url));
  const db = await getDb();
  const post = await db.query.socialPosts.findFirst({ where: eq(schema.socialPosts.id, id) });
  if (!post) return NextResponse.redirect(new URL("/conversation", req.url));
  const user = await getSessionUser().catch(() => null);
  await track(db, "x_post_opened", user?.id ?? null, { postId: id });
  return NextResponse.redirect(post.url);
}
