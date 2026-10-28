import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// Serves a card's photo. URLs carry ?v=<updated time>, so they can be cached for a long time.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const db = await getDb();
  const [row] = await db
    .select({ mime: schema.photos.mime, data: schema.photos.data })
    .from(schema.photos)
    .innerJoin(schema.people, eq(schema.people.id, schema.photos.personId))
    .where(and(eq(schema.photos.personId, id), eq(schema.people.hidden, false)))
    .limit(1);
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": req.nextUrl.searchParams.has("v") ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
