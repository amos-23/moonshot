"use client";

import { startTransition, useActionState, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Flag, Loader2 } from "lucide-react";
import type { Result } from "@/lib/actions";
import { reportAction } from "@/lib/actions";
import type { Option } from "@/lib/constants";
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

export function Chips({ name, legend, options, initial = [], max, hint }: { name: string; legend: string; options: Option[]; initial?: string[]; max: number; hint?: string }) {
  const [sel, setSel] = useState(initial);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">
        {legend} <span className="font-normal text-muted">· up to {max}</span>
      </legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = sel.includes(o.value);
          const full = !on && sel.length >= max;
          return (
            <label
              key={o.value}
              className={cx(
                "cursor-pointer select-none rounded-full border px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-flame/20",
                on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40",
                full && "opacity-40",
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={on}
                disabled={full}
                onChange={() => setSel((c) => (on ? c.filter((x) => x !== o.value) : [...c, o.value]))}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
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

export function ReportLink({ type, id }: { type: "person" | "post"; id: string }) {
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

