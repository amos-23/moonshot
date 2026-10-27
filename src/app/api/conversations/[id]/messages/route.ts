import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listMessages, markRead } from "@/lib/services/messaging";
import { AppError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

// Polled by the chat view every few seconds. Returns only messages newer than `after`.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : undefined;
  if (after && Number.isNaN(after.getTime())) return NextResponse.json({ error: "bad after" }, { status: 400 });
  try {
    const db = await getDb();
    const messages = await listMessages(db, user.id, id, after);
    if (messages.some((m) => m.senderId !== user.id)) await markRead(db, user.id, id);
    return NextResponse.json(
      { messages: messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
