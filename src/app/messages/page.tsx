import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listConversations } from "@/lib/services/messaging";
import { timeAgo } from "@/lib/time";
import { Avatar, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { user } = await requireProfile("/messages");
  const db = await getDb();
  const conversations = await listConversations(db, user.id);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Messages" subtitle="You can message people once they've accepted your connection request." />
      {conversations.length === 0 ? (
        <EmptyState icon={<MessageCircle size={32} />} title="No conversations yet" action={<LinkButton href="/discover">Discover people</LinkButton>}>
          When a connection request is accepted, a conversation appears here.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.conv.id}>
              <Link href={`/messages/${c.conv.id}`} className="block">
                <Card className="flex items-center gap-3 p-3 transition-colors hover:border-accent/40">
                  <Avatar name={c.profile.name} src={c.profile.avatarUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={c.unread ? "font-semibold" : "font-medium"}>{c.profile.name}</p>
                      {c.lastMessage && <span className="shrink-0 text-xs text-muted">{timeAgo(c.lastMessage.createdAt)}</span>}
                    </div>
                    <p className={`truncate text-sm ${c.unread ? "text-ink" : "text-muted"}`}>
                      {c.lastMessage ? `${c.lastMessage.senderId === user.id ? "You: " : ""}${c.lastMessage.body}` : "Connected — say hello"}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                      {c.unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
