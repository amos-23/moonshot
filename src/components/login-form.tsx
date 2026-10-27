"use client";

import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";
import { signInAction } from "@/lib/actions/auth";
import { Button, Field, Notice, inputClass } from "./ui";

export function LoginForm({ next, mode }: { next?: string; mode: "supabase" | "demo" | "none" }) {
  const [state, action, pending] = useActionState(signInAction, null);
  if (state?.ok) {
    return (
      <Notice tone="success" title="Check your inbox">
        {state.message}
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email address" htmlFor="email" error={state && !state.ok ? state.error : undefined}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          className={inputClass}
          aria-invalid={state && !state.ok ? true : undefined}
          disabled={mode === "none"}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending || mode === "none"}>
        {pending ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Mail size={18} aria-hidden />}
        {mode === "supabase" ? "Email me a sign-in link" : "Continue"}
      </Button>
    </form>
  );
}
