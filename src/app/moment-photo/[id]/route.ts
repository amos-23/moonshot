import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// Serves a moment's photo. Moment photos never change, so they can be cached for a long time.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const [row] = await (await getDb())
    .select({ mime: schema.momentPhotos.mime, data: schema.momentPhotos.data })
    .from(schema.momentPhotos)
    .innerJoin(schema.moments, eq(schema.moments.id, schema.momentPhotos.momentId))
    .where(and(eq(schema.momentPhotos.momentId, id), eq(schema.moments.hidden, false)))
    .limit(1);
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(row.data, "base64"), {
    headers: { "Content-Type": row.mime, "Cache-Control": "public, max-age=600", "X-Content-Type-Options": "nosniff" },
  });
}
