"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reactAction } from "@/lib/actions";
import type { ReactionCounts, ReactionKind } from "@/lib/data";
import { cx } from "./ui";

export const REACTION_EMOJI: Record<ReactionKind, string> = { fire: "🔥", love: "❤️", clap: "👏" };
const KINDS = Object.keys(REACTION_EMOJI) as ReactionKind[];
const empty = (): ReactionCounts => ({ fire: 0, love: 0, clap: 0 });

/** This browser's random id for reactions (only its hash is stored), made on first use. */
function reactorId(): string {
  const make = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  try {
    let id = localStorage.getItem("mc_rid");
    if (!id) localStorage.setItem("mc_rid", (id = make()));
    return id;
  } catch {
    return ((window as unknown as { __mcRid?: string }).__mcRid ??= make());
  }
}

/** Reaction counts for the whole gallery, what this browser reacted with, and a toggle that updates at once. */
export function useReactions(initial: Record<string, ReactionCounts>) {
  const [counts, setCounts] = useState(initial);
  const [mine, setMine] = useState<Set<string>>(new Set());
  // Fresh numbers from the server (after a refresh) win.
  useEffect(() => setCounts((c) => ({ ...c, ...initial })), [initial]);
  useEffect(() => {
    try {
      setMine(new Set(JSON.parse(localStorage.getItem("mc_reacted") ?? "[]") as string[]));
    } catch {}
  }, []);
  const remember = (next: Set<string>) => {
    try {
      localStorage.setItem("mc_reacted", JSON.stringify([...next].slice(-500)));
    } catch {}
  };

  const toggle = useCallback(
    async (id: string, kind: ReactionKind) => {
      const key = `${id}:${kind}`;
      const was = mine.has(key);
      const bump = (c: ReactionCounts | undefined, d: number) => ({ ...(c ?? empty()), [kind]: Math.max(0, (c ?? empty())[kind] + d) });
      // Show it straight away; the server's answer settles the exact numbers.
      setCounts((c) => ({ ...c, [id]: bump(c[id], was ? -1 : 1) }));
      setMine((m) => {
        const n = new Set(m);
        if (was) n.delete(key);
        else n.add(key);
        remember(n);
        return n;
      });
      const r = await reactAction(id, kind, reactorId()).catch(() => null);
      if (r?.ok && r.counts) {
        setCounts((c) => ({ ...c, [id]: r.counts! }));
        setMine((m) => {
          const n = new Set(m);
          if (r.on) n.add(key);
          else n.delete(key);
          remember(n);
          return n;
        });
      } else {
        setCounts((c) => ({ ...c, [id]: bump(c[id], was ? 1 : -1) }));
        setMine((m) => {
          const n = new Set(m);
          if (was) n.add(key);
          else n.delete(key);
          remember(n);
          return n;
        });
      }
    },
    [mine],
  );
  return { counts, mine, toggle };
}

export type Reactions = ReturnType<typeof useReactions>;

export const totalReactions = (c: ReactionCounts | undefined) => (c ? c.fire + c.love + c.clap : 0);

/**
 * 🔥 ❤️ 👏 buttons with counts. Reacting sends up a little burst of the emoji.
 * "row" sits under a moment; "rail" stacks down the side of the story view.
 */
export function ReactionBar({ id, reactions, variant = "row" }: { id: string; reactions: Reactions; variant?: "row" | "rail" }) {
  const c = reactions.counts[id] ?? empty();
  const [bursts, setBursts] = useState<{ key: number; emoji: string; dx: number; delay: number; x: number; y: number }[]>([]);
  const seq = useRef(0);
  const press = (kind: ReactionKind, from: HTMLElement) => {
    if (!reactions.mine.has(`${id}:${kind}`)) {
      // Rise from the button that was tapped.
      const x = from.offsetLeft + from.offsetWidth / 2;
      const y = from.offsetTop + from.offsetHeight / 2;
      const added = Array.from({ length: 7 }, (_, i) => ({ key: ++seq.current, emoji: REACTION_EMOJI[kind], dx: Math.round((Math.random() - 0.5) * 80), delay: i * 70, x, y }));
      setBursts((b) => [...b, ...added]);
      setTimeout(() => setBursts((b) => b.filter((x) => !added.includes(x))), 1400);
    }
    void reactions.toggle(id, kind);
  };
  return (
    <div className={cx("relative flex", variant === "rail" ? "flex-col gap-3" : "flex-wrap gap-2")} role="group" aria-label="React">
      {KINDS.map((kind) => {
        const on = reactions.mine.has(`${id}:${kind}`);
        return (
          <button
            key={kind}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              press(kind, e.currentTarget);
            }}
            aria-pressed={on}
            aria-label={`${REACTION_EMOJI[kind]} ${c[kind]}${on ? ", you reacted" : ""}`}
            data-track={`react_${kind}`}
            data-track-id={id}
            className={cx(
              "relative inline-flex items-center justify-center font-semibold tabular-nums transition active:scale-90",
              variant === "rail" ? "h-14 w-14 flex-col rounded-full text-[11px]" : "h-10 gap-1.5 rounded-full px-3.5 text-sm",
              on ? "bg-white text-ink shadow-[0_0_0_2px_rgba(246,168,33,0.9)]" : variant === "rail" ? "bg-black/35 text-white backdrop-blur-md hover:bg-black/50" : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            <span className={cx("leading-none", variant === "rail" ? "text-2xl" : "text-lg", on && "react-bump")} key={on ? "on" : "off"} aria-hidden>
              {REACTION_EMOJI[kind]}
            </span>
            <span>{c[kind] > 0 ? c[kind].toLocaleString() : ""}</span>
          </button>
        );
      })}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
        {bursts.map((b) => (
          <span key={b.key} className="react-float absolute text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" style={{ left: b.x, top: b.y, "--dx": `${b.dx}px`, animationDelay: `${b.delay}ms` } as React.CSSProperties}>
            {b.emoji}
          </span>
        ))}
      </span>
    </div>
  );
}
