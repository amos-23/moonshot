"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { Button } from "./ui";

/** A button that runs a bound server action, shows progress, and surfaces errors inline. */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "sm",
  className,
  successText,
  ariaLabel,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  successText?: string;
  ariaLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        aria-label={ariaLabel}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setResult(r);
            if (r.ok) router.refresh();
          });
        }}
      >
        {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
        {children}
      </Button>
      {result && !result.ok && (
        <span role="alert" className="text-xs text-red-600">
          {result.error}
        </span>
      )}
      {result?.ok && successText && (
        <span role="status" className="text-xs text-emerald-700">
          {successText}
        </span>
      )}
    </span>
  );
}
