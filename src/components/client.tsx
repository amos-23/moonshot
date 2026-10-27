"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Flag, Loader2 } from "lucide-react";
import type { Result } from "@/lib/actions";
import { reportAction } from "@/lib/actions";
import { Button, cx } from "./ui";

type FormAction = (prev: Result | null, form: FormData) => Promise<Result>;

/** Submits via onSubmit so typed values survive validation errors. */
export function useForm(action: FormAction, opts: { refresh?: boolean } = {}) {
  const [state, run, pending] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && opts.refresh) router.refresh();
  }, [state, opts.refresh, router]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
  const err = (k: string) => (state && !state.ok ? state.fields?.[k] : undefined);
  return { state, pending, onSubmit, err };
}

export function Status({ state }: { state: Result | null }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cx("text-sm", state.ok ? "text-emerald-700" : "text-red-600")}>
      {state.ok ? state.message ?? "Done." : state.error}
    </p>
  );
}

export function Submit({ pending, children, ...rest }: { pending: boolean; children: ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function ActionButton({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "sm",
  className,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "dark" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setRes(r);
            if (r.ok) router.refresh();
          });
        }}
      >
        {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
        {children}
      </Button>
      {res && !res.ok && (
        <span role="alert" className="max-w-xs text-xs text-red-600">
          {res.error}
        </span>
      )}
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text.startsWith("/") ? window.location.origin + text : text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {done ? "Copied" : label}
    </Button>
  );
}

export function ReportLink({ type, id }: { type: "person" | "post" | "comment"; id: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <span className="text-xs text-muted">{msg}</span>;
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-700"
      onClick={() => {
        const reason = window.prompt("What's wrong? (spam, fake, abusive…)");
        if (reason === null) return;
        start(async () => {
          const r = await reportAction(type, id, reason);
          setMsg(r.ok ? r.message ?? "Reported." : r.error);
        });
      }}
    >
      <Flag size={12} aria-hidden /> Report
    </button>
  );
}


/** A <details> whose open state belongs to the user, so refreshing data never collapses it. */
export function Disclosure({ initialOpen, summary, children, className, summaryClassName }: { initialOpen: boolean; summary: ReactNode; children: ReactNode; className?: string; summaryClassName?: string }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}

/**
 * Compact multi-select: one line that opens a tick-list. Real checkboxes, so it submits with
 * the form and works with the keyboard.
 */
export function MultiSelect({ id, name, options, initial = [], max, placeholder }: { id: string; name: string; options: { value: string; label: string }[]; initial?: string[]; max: number; placeholder: string }) {
  const [sel, setSel] = useState<string[]>(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const labels = options.filter((o) => sel.includes(o.value)).map((o) => o.label);
  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-left text-base sm:text-sm"
      >
        <span className={cx("truncate", !labels.length && "text-muted/70")}>{labels.length ? labels.join(", ") : placeholder}</span>
        <ChevronDown size={16} className={cx("shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div hidden={!open} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-line bg-white p-1 shadow-lg">
        <p className="px-3 py-1.5 text-xs text-muted">Choose up to {max}</p>
        {options.map((o) => {
          const on = sel.includes(o.value);
          const full = !on && sel.length >= max;
          return (
            <label key={o.value} className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-canvas", full && "cursor-not-allowed opacity-40")}>
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={on}
                disabled={full}
                onChange={() => setSel((c) => (on ? c.filter((x) => x !== o.value) : [...c, o.value]))}
                className="h-4 w-4 accent-[var(--color-flame-700)]"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
