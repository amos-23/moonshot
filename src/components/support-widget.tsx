"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, Mail, MessageCircle, Send, X } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_LABEL, mailLink, whatsappLink } from "@/lib/support-contact";
import { cx } from "@/components/ui";

// "Help" button on every page: chat with the team, or reach them on WhatsApp or email. Talks to /api/support/*.
// The chat is tied to a random token kept in this browser, so no account is needed.

type Msg = { id: number; sender: "user" | "admin"; body: string; at: string };

const K = { token: "support:token", seen: "support:seen:connect", name: "support:name", email: "support:email" };
const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage blocked: the chat still works for this visit */
  }
};
const newToken = () => {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? "That didn't work. Please try again.");
  return data as T;
}

export function SupportWidget({ account }: { account?: { email: string; name?: string | null } | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "chat">("menu");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const token = useRef<string | null>(null);
  const last = useRef(0);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    token.current = get(K.token);
    setName(get(K.name) ?? account?.name ?? "");
    setEmail(get(K.email) ?? account?.email ?? "");
  }, [account?.email, account?.name]);

  const poll = useCallback(async () => {
    if (!token.current) return;
    try {
      const r = await api<{ messages: Msg[] }>("/api/support/thread", { project: "connect", token: token.current, after: last.current });
      if (!r.messages.length) return;
      last.current = r.messages[r.messages.length - 1].id;
      setMsgs((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
      if (r.messages.some((x) => x.sender === "admin")) {
        if (open && view === "chat") put(K.seen, String(last.current));
        else if (last.current > Number(get(K.seen) ?? 0)) setUnread(true);
      }
    } catch {
      /* offline or server busy: try again on the next tick */
    }
  }, [open, view]);

  // While the chat is open, check every 4 seconds; otherwise once a minute for a reply (only if they've ever written).
  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), open && view === "chat" ? 4000 : 60_000);
    return () => clearInterval(id);
  }, [poll, open, view]);

  useEffect(() => {
    if (open && view === "chat") {
      setUnread(false);
      put(K.seen, String(last.current));
      end.current?.scrollIntoView({ block: "end" });
    }
  }, [open, view, msgs]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!token.current) {
        token.current = newToken();
        put(K.token, token.current);
      }
      put(K.name, name);
      put(K.email, email);
      const r = await api<{ message: Msg }>("/api/support/message", { project: "connect", token: token.current, body, name: name.trim() || undefined, email: email.trim() || undefined, page: path });
      last.current = Math.max(last.current, r.message.id);
      setMsgs((m) => [...m, r.message]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const context = `Event Connect — page: ${path}`;
  const openPanel = () => {
    setOpen((o) => !o);
    if (!open && msgs.length) setView("chat");
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      {open && (
        <div role="dialog" aria-label="Help" className="mb-3 flex max-h-[min(34rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <b className="text-sm">{view === "chat" ? "Chat with us" : "How can we help?"}</b>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="rounded-full p-1 hover:bg-white/10">
              <X size={16} aria-hidden />
            </button>
          </div>

          {view === "menu" ? (
            <div className="space-y-2 p-3">
              <button type="button" onClick={() => setView("chat")} className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-3 text-left hover:border-ink/30">
                <MessageCircle size={20} aria-hidden className="shrink-0 text-flame" />
                <span>
                  <b className="block text-sm">Chat with us</b>
                  <span className="text-xs text-muted">Ask here. We reply as soon as we can.</span>
                </span>
              </button>
              <a href={whatsappLink(`Hi, I need help with Event Connect.\n(${context})`)} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-2xl border border-line px-3 py-3 hover:border-ink/30">
                <Send size={20} aria-hidden className="shrink-0 text-emerald-600" />
                <span>
                  <b className="block text-sm">WhatsApp</b>
                  <span className="text-xs text-muted">{SUPPORT_WHATSAPP_LABEL}</span>
                </span>
              </a>
              <a href={mailLink("Event Connect help", `Hi,\n\nI need help with:\n\n\n(${context})`)} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-3 hover:border-ink/30">
                <Mail size={20} aria-hidden className="shrink-0 text-sky-600" />
                <span>
                  <b className="block text-sm">Email</b>
                  <span className="break-all text-xs text-muted">{SUPPORT_EMAIL}</span>
                </span>
              </a>
            </div>
          ) : (
            <>
              <div className="min-h-40 flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
                {msgs.length === 0 && <p className="rounded-2xl bg-canvas p-3 text-sm text-muted">Hi! Tell us what you need help with. If you leave your email below, we can also reply there.</p>}
                {msgs.map((m) => (
                  <div key={m.id} className={cx("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                    <p className={cx("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm", m.sender === "user" ? "bg-ink text-white" : "bg-canvas ring-1 ring-line")}>{m.body}</p>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="space-y-2 border-t border-line p-3"
              >
                {msgs.length === 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name (optional)" aria-label="Your name" className="h-9 rounded-xl border border-line px-3 text-sm" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={254} placeholder="Email (optional)" aria-label="Your email" className="h-9 rounded-xl border border-line px-3 text-sm" />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    maxLength={2000}
                    placeholder="Write a message…"
                    aria-label="Your message"
                    className="min-h-10 flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
                    <Send size={16} aria-hidden />
                  </button>
                </div>
                {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
                <button type="button" onClick={() => setView("menu")} className="text-xs font-semibold text-muted hover:text-ink">← Other ways to reach us</button>
              </form>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={openPanel}
        aria-expanded={open}
        className="relative ml-auto flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-lg hover:bg-black"
      >
        <LifeBuoy size={18} aria-hidden /> Help
        {unread && <span aria-label="New reply" className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-flame" />}
      </button>
    </div>
  );
}
