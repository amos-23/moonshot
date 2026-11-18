import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { getDb } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminShell } from "@/components/adminx/shell";
import { LiveRefresh, ReplyForm, StatusButton } from "@/components/adminx/support-client";
import { cx } from "@/components/ui";
import { timeAgo } from "@/lib/time";
import { PROJECT_NAMES, getThreadForAdmin, markThreadRead, unreadCount } from "@/lib/support";

export const metadata = { title: "Support chat · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SupportThread({ params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const db = await getDb();
  const thread = await getThreadForAdmin(db, (await params).id);
  if (!thread) notFound();
  await markThreadRead(db, thread.id);
  const unread = await unreadCount(db);
  const who = thread.name || thread.email || "Anonymous visitor";

  return (
    <AdminShell project="support" section="support">
      <LiveRefresh every={5000} unread={unread} />
      <Link href="/adminx/support" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> All messages
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
            {who} <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold">{PROJECT_NAMES[thread.project]}</span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {thread.email && (
              <a href={`mailto:${thread.email}`} className="inline-flex items-center gap-1 hover:text-ink">
                <Mail size={14} aria-hidden /> {thread.email}
              </a>
            )}
            {thread.page && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={14} aria-hidden /> was on: {thread.page}
              </span>
            )}
            <span>Started {timeAgo(new Date(thread.createdAt))}</span>
          </p>
        </div>
        <StatusButton threadId={thread.id} status={thread.status} />
      </div>

      <ol className="space-y-3 rounded-3xl border border-line bg-surface p-4 sm:p-5" aria-label="Conversation">
        {thread.messages.map((m) => (
          <li key={m.id} className={cx("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.sender === "admin" ? "bg-ink text-white" : "bg-white ring-1 ring-line")}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cx("mt-1 text-[11px]", m.sender === "admin" ? "text-white/60" : "text-muted")}>{m.sender === "admin" ? "You" : who} · {timeAgo(new Date(m.at))}</p>
            </div>
          </li>
        ))}
      </ol>
      <ReplyForm threadId={thread.id} canEmail={Boolean(thread.email)} />
    </AdminShell>
  );
}
