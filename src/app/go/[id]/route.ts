import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// Redirects only to URLs stored in our database (validated x.com links), so this isn't an open redirect.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const post = await (await getDb()).query.socialPosts.findFirst({ where: eq(schema.socialPosts.id, id) });
  if (!post) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(post.url);
}
