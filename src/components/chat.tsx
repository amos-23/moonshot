"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { sendMessageAction } from "@/lib/actions/messages";
import { cx, inputClass } from "./ui";

export type ChatMessage = { id: string; senderId: string; body: string; createdAt: string };

const POLL_MS = 4000;

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso));
}

/**
 * Persistent messaging with lightweight polling: the view fetches new messages every 4 seconds
 * while the tab is visible, and immediately after sending.
 */
export function Chat({
  conversationId,
  viewerId,
  otherName,
  initial,
  canSend,
}: {
  conversationId: string;
  viewerId: string;
  otherName: string;
  initial: ChatMessage[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | undefined>(initial.at(-1)?.createdAt);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      lastRef.current = next.at(-1)?.createdAt;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const qs = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
      const res = await fetch(`/api/conversations/${conversationId}/messages${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { messages: ChatMessage[] };
      merge(json.messages);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [conversationId, merge]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await sendMessageAction(conversationId, body);
      if (r.ok) {
        setDraft("");
        merge([r.data as ChatMessage]);
      } else setError(r.error);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-4" aria-live="polite" aria-label={`Conversation with ${otherName}`}>
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello to {otherName.split(" ")[0]} 👋</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === viewerId;
          return (
            <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md border border-line bg-white")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cx("mt-0.5 text-[10px]", mine ? "text-white/70" : "text-muted")}>{fmt(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {offline && <p className="px-1 text-xs text-amber-700">Having trouble reaching the server — retrying…</p>}
      {canSend ? (
        <form
          className="sticky bottom-16 flex items-end gap-2 border-t border-line bg-canvas py-3 md:bottom-0"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${otherName.split(" ")[0]}`}
            className={cx(inputClass, "max-h-32 resize-none")}
          />
          <button type="submit" disabled={pending || !draft.trim()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50" aria-label="Send message">
            {pending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
          </button>
        </form>
      ) : (
        <p className="border-t border-line py-3 text-center text-sm text-muted">You can no longer message each other in this conversation.</p>
      )}
      {error && (
        <p role="alert" className="pb-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
