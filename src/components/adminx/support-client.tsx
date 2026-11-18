"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replySupportAction, setSupportStatusAction } from "@/lib/support-actions";

/** Re-reads the page every few seconds while it's on screen, and shows the unread count in the tab title. */
export function LiveRefresh({ every = 8000, unread }: { every?: number; unread?: number }) {
  const router = useRouter();
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread ? `(${unread}) ${base}` : base;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => {
      clearInterval(id);
      document.title = base;
    };
  }, [router, every, unread]);
  return null;
}

export function ReplyForm({ threadId, canEmail }: { threadId: string; canEmail: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const send = () => {
    if (!text.trim()) return;
    start(async () => {
      const r = await replySupportAction(threadId, text);
      if (r.ok) {
        setText("");
        setError(null);
        router.refresh();
        box.current?.focus();
      } else setError(r.error);
    });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="mt-4"
    >
      <label htmlFor="reply" className="sr-only">Your reply</label>
      <textarea
        id="reply"
        ref={box}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        rows={3}
        maxLength={2000}
        placeholder="Write a reply…  (Ctrl/⌘ + Enter to send)"
        className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink/40"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !text.trim()} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
          {pending ? "Sending…" : "Send reply"}
        </button>
        <span className="text-xs text-muted">{canEmail ? "They'll also get an email if they're not in the chat." : "They didn't leave an email, so they'll see this next time they open the chat."}</span>
        {error && <span role="alert" className="text-sm font-semibold text-red-700">{error}</span>}
      </div>
    </form>
  );
}

export function StatusButton({ threadId, status }: { threadId: string; status: "open" | "closed" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setSupportStatusAction(threadId, status === "open" ? "closed" : "open");
          router.refresh();
        })
      }
      className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-ink/30 disabled:opacity-50"
    >
      {status === "open" ? "Mark as done" : "Reopen"}
    </button>
  );
}
