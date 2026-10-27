import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canMessage, getConversationFor, listMessages, markRead } from "@/lib/services/messaging";
import { getProfile } from "@/lib/services/people";
import { AppError } from "@/lib/services/errors";
import { Chat } from "@/components/chat";
import { ReportForm } from "@/components/people-forms";
import { Avatar } from "@/components/ui";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireProfile(`/messages/${id}`);
  const db = await getDb();
  let otherId: string;
  try {
    ({ otherId } = await getConversationFor(db, user.id, id));
  } catch (err) {
    if (err instanceof AppError) notFound();
    throw err;
  }
  const [other, messages, allowed] = await Promise.all([getProfile(db, otherId), listMessages(db, user.id, id), canMessage(db, user.id, otherId)]);
  await markRead(db, user.id, id);
  const name = other?.name ?? "Former member";
  const lastFromThem = [...messages].reverse().find((m) => m.senderId !== user.id);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-4 pt-4">
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <Link href="/messages" className="rounded-lg p-1 hover:bg-black/5" aria-label="Back to messages">
          <ChevronLeft size={20} />
        </Link>
        <Avatar name={name} src={other?.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          {other ? (
            <Link href={`/people/${otherId}`} className="font-semibold hover:underline">
              {name}
            </Link>
          ) : (
            <span className="font-semibold">{name}</span>
          )}
          {other && <p className="truncate text-xs text-muted">{other.headline}</p>}
        </div>
        {lastFromThem && <ReportForm targetType="message" targetId={lastFromThem.id} />}
      </div>
      <Chat
        conversationId={id}
        viewerId={user.id}
        otherName={name}
        canSend={allowed}
        initial={messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() }))}
      />
    </div>
  );
}
