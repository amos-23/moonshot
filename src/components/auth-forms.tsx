"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPasswordAction, magicLinkAction, signInAction, signUpAction, updateAccountAction, updatePasswordAction, verifyCodeAction } from "@/lib/auth-actions";
import { Status, Submit, useForm } from "./client";
import { Field, cx, inputClass } from "./ui";

function EmailField({ id, err, defaultValue, onChange }: { id: string; err?: string; defaultValue?: string; onChange?: (v: string) => void }) {
  return (
    <Field label="Email" htmlFor={id} error={err}>
      <input id={id} name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={defaultValue} onChange={onChange && ((e) => onChange(e.target.value))} className={inputClass} aria-invalid={!!err} />
    </Field>
  );
}

function PasswordField({ id, err, label = "Password", autoComplete }: { id: string; err?: string; label?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={id} error={err}>
      <div className="relative">
        <input id={id} name="password" type={show ? "text" : "password"} autoComplete={autoComplete} required className={cx(inputClass, "pr-16")} aria-invalid={!!err} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-ink">
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

/** After an email goes out: type the code from it, for when the link opens on another device or has stopped working. */
function CodeForm({ email, next }: { email: string; next: string }) {
  const { state, pending, onSubmit, err } = useForm(verifyCodeAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-2xl border border-line bg-canvas p-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Field label="Code from the email" htmlFor="otp-code" error={err("token")}>
        <input id="otp-code" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} placeholder="123456" className={cx(inputClass, "tracking-[0.3em]")} aria-invalid={!!err("token")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} variant="dark" size="sm">
          Continue
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

export function SignUpForm({ next, supabase = false }: { next: string; supabase?: boolean }) {
  const { state, pending, onSubmit, err } = useForm(signUpAction);
  const [mail, setMail] = useState("");
  if (state?.ok)
    return (
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p className="text-lg font-bold">Almost there 📬</p>
          <p className="text-sm text-muted">{state.message}</p>
        </div>
        {supabase && <CodeForm email={mail} next={next} />}
      </div>
    );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Name" htmlFor="su-name" optional error={err("name")}>
        <input id="su-name" name="name" maxLength={60} autoComplete="name" className={inputClass} />
      </Field>
      <EmailField id="su-email" err={err("email")} onChange={setMail} />
      <PasswordField id="su-password" err={err("password")} autoComplete="new-password" />
      <p className="-mt-2 text-xs text-muted">At least 8 characters.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="optIn" defaultChecked className="mt-0.5 h-4 w-4 accent-[var(--color-flame-700)]" />
        <span>Email me about new events (now and then, never shared)</span>
      </label>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="dark" data-track="signup_submit">
          Create account
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
      <p className="text-sm text-muted">
        Have an account?{" "}
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="font-semibold text-flame-700 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Sign in with a password; with Supabase also by email link, and a "forgot password" link. */
export function SignInForm({ next, supabase, start = "password" }: { next: string; supabase: boolean; start?: "password" | "link" }) {
  const [mode, setMode] = useState<"password" | "link" | "forgot">(supabase ? start : "password");
  const [mail, setMail] = useState("");
  const pw = useForm(signInAction);
  const link = useForm(magicLinkAction);
  const forgot = useForm(forgotPasswordAction);
  const tab = (m: typeof mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cx("flex-1 rounded-full px-3 py-1.5 text-sm font-semibold", mode === m ? "bg-ink text-white" : "text-muted hover:text-ink")}>
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      {supabase && mode !== "forgot" && (
        <div role="tablist" aria-label="How to sign in" className="flex rounded-full border border-line bg-white p-1">
          {tab("password", "Password")}
          {tab("link", "Email me a link")}
        </div>
      )}
      {mode === "password" && (
        <form onSubmit={pw.onSubmit} noValidate className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <EmailField id="si-email" err={pw.err("email")} />
          <PasswordField id="si-password" err={pw.err("password")} autoComplete="current-password" />
          <div className="flex flex-wrap items-center gap-3">
            <Submit pending={pw.pending} variant="dark" data-track="signin_submit">
              Sign in
            </Submit>
            {supabase && (
              <button type="button" onClick={() => setMode("forgot")} className="text-sm font-semibold text-muted underline hover:text-ink">
                Forgot password?
              </button>
            )}
            <div className="min-w-0 text-sm">
              <Status state={pw.state} />
            </div>
          </div>
        </form>
      )}
      {mode === "link" && (
        <form onSubmit={link.onSubmit} noValidate className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <EmailField id="ml-email" err={link.err("email")} onChange={setMail} />
          <p className="-mt-2 text-xs text-muted">We&apos;ll email you a one-time link and code. No password needed.</p>
          <div className="flex items-center gap-3">
            <Submit pending={link.pending} variant="dark">
              Send link
            </Submit>
            <div className="min-w-0 text-sm">
              <Status state={link.state} />
            </div>
          </div>
        </form>
      )}
      {mode === "link" && link.state?.ok && <CodeForm email={mail} next={next} />}
      {mode === "forgot" && (
        <form onSubmit={forgot.onSubmit} noValidate className="space-y-4">
          <p className="text-sm text-muted">Enter your email and we&apos;ll send a link to set a new password.</p>
          <EmailField id="fp-email" err={forgot.err("email")} />
          <div className="flex flex-wrap items-center gap-3">
            <Submit pending={forgot.pending} variant="dark">
              Send reset link
            </Submit>
            <button type="button" onClick={() => setMode("password")} className="text-sm font-semibold text-muted underline hover:text-ink">
              Back to sign in
            </button>
            <div className="min-w-0 text-sm">
              <Status state={forgot.state} />
            </div>
          </div>
        </form>
      )}
      <p className="text-sm text-muted">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-flame-700 underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function AccountForm({ name, optIn }: { name: string; optIn: boolean }) {
  const { state, pending, onSubmit } = useForm(updateAccountAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name" htmlFor="acc-name" optional>
        <input id="acc-name" name="name" maxLength={60} defaultValue={name} autoComplete="name" className={inputClass} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="optIn" defaultChecked={optIn} className="mt-0.5 h-4 w-4 accent-[var(--color-flame-700)]" />
        <span>Email me about new events</span>
      </label>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="secondary" size="sm">
          Save
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { state, pending, onSubmit, err } = useForm(updatePasswordAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField id="np-password" label="New password" err={err("password")} autoComplete="new-password" />
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="dark" size="sm">
          Save password
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}
