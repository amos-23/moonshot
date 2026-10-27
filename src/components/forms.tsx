"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import type { Option } from "@/lib/constants";
import { Button, cx } from "./ui";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * Wraps useActionState but submits via onSubmit so React doesn't reset the form after an error,
 * keeping what the user typed.
 */
export function useForm(action: Action, opts: { resetOnSuccess?: boolean; refresh?: boolean } = {}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (opts.resetOnSuccess) ref.current?.reset();
      if (opts.refresh) router.refresh();
    }
  }, [state, opts.resetOnSuccess, opts.refresh, router]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  const err = (field: string) => (state && !state.ok ? state.fieldErrors?.[field] : undefined);
  return { state, pending, onSubmit, ref, err };
}

export function FormStatus({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cx("text-sm", state.ok ? "text-emerald-700" : "text-red-600")}>
      {state.ok ? state.message ?? "Saved." : state.error}
    </p>
  );
}

export function SubmitButton({ pending, children, ...rest }: { pending: boolean; children: ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Multi-select rendered as toggle chips backed by real checkboxes (keyboard + screen-reader friendly). */
export function ChipGroup({
  name,
  legend,
  options,
  defaultValue = [],
  max,
  error,
  hint,
}: {
  name: string;
  legend: string;
  options: Option[];
  defaultValue?: string[];
  max?: number;
  error?: string;
  hint?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const toggle = (v: string) =>
    setSelected((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : max && cur.length >= max ? cur : [...cur, v]));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className={cx(
                "cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
                on ? "border-accent bg-accent text-white" : "border-line bg-white text-ink hover:border-accent/40",
              )}
            >
              <input type="checkbox" name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function RadioCards({
  name,
  legend,
  options,
  defaultValue,
  columns = 1,
}: {
  name: string;
  legend: string;
  options: Option[];
  defaultValue: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className={cx("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-50"
          >
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="accent-[var(--color-accent)]" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
