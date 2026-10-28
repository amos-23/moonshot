import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isAdmin } from "@/lib/me";

// Admins can see any moment's photo, including hidden ones they're reviewing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const [row] = await (await getDb()).select().from(schema.momentPhotos).where(eq(schema.momentPhotos.momentId, id)).limit(1);
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(row.data, "base64"), { headers: { "Content-Type": row.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
