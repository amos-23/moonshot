import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// Serves a moment's photo (?n=1… for the 2nd to 4th). Moment photos never change, so they can be cached.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(new URL(req.url).searchParams.get("n") ?? 0);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(n) || n < 0 || n > 9) return new NextResponse(null, { status: 404 });
  const [row] = await (await getDb())
    .select({ mime: schema.momentPhotos.mime, data: schema.momentPhotos.data })
    .from(schema.momentPhotos)
    .innerJoin(schema.moments, eq(schema.moments.id, schema.momentPhotos.momentId))
    .where(and(eq(schema.momentPhotos.momentId, id), eq(schema.momentPhotos.position, n), eq(schema.moments.hidden, false)))
    .limit(1);
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(row.data, "base64"), {
    headers: { "Content-Type": row.mime, "Cache-Control": "public, max-age=600", "X-Content-Type-Options": "nosniff" },
  });
}
