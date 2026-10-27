"use client";

import { createHangoutAction, importPostsAction, saveCardAction, setWhereAction, adminLoginAction } from "@/lib/actions";
import type { Person } from "@/lib/db/schema";
import { INTERESTS, OFFERS, WANTS } from "@/lib/constants";
import type { ImportResult } from "@/lib/data";
import { Chips, Status, Submit, useForm } from "./client";
import { Field, Tag, cx, inputClass } from "./ui";

export function CardForm({ person }: { person: Person | null }) {
  const { state, pending, onSubmit, err } = useForm(saveCardAction, { refresh: true });
  const p = person;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={err("name")}>
          <input id="name" name="name" autoComplete="name" defaultValue={p?.name} maxLength={60} className={inputClass} aria-invalid={!!err("name")} />
        </Field>
        <Field label="What you do" htmlFor="headline" error={err("headline")} hint="e.g. Founder at a payments startup">
          <input id="headline" name="headline" defaultValue={p?.headline} maxLength={80} className={inputClass} aria-invalid={!!err("headline")} />
        </Field>
        <Field label="Company or project" htmlFor="company" optional error={err("company")}>
          <input id="company" name="company" autoComplete="organization" defaultValue={p?.company ?? ""} maxLength={80} className={inputClass} />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">Where are you?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["in_person", "At the venue"],
              ["remote", "Online"],
            ].map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-white px-3 py-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                <input type="radio" name="attendance" value={v} defaultChecked={(p?.attendance ?? "in_person") === v} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <Chips name="wants" legend="I'm looking for" options={WANTS} initial={p?.wants} max={3} />
      <Chips name="offers" legend="I can help with" options={OFFERS} initial={p?.offers} max={3} />
      <Chips name="interests" legend="Topics I care about" options={INTERESTS} initial={p?.interests} max={5} />

      <Field label="One line about you" htmlFor="bio" optional error={err("bio")} hint="What should people come and talk to you about?">
        <textarea id="bio" name="bio" rows={2} maxLength={280} defaultValue={p?.bio} className={inputClass} />
      </Field>

      <div className="space-y-3 rounded-3xl bg-sun-100 p-4 sm:p-5">
        <div>
          <p className="font-semibold">How should people reach you?</p>
          <p className="text-xs text-[#6b4a10]">Add at least one. Anything you add here is shown publicly on your card, so only share what you&apos;re happy for anyone to see.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="X handle" htmlFor="xHandle" error={err("xHandle")}>
            <input id="xHandle" name="xHandle" defaultValue={p?.xHandle ?? ""} placeholder="@yourhandle" className={inputClass} />
          </Field>
          <Field label="LinkedIn" htmlFor="linkedinUrl" error={err("linkedinUrl")}>
            <input id="linkedinUrl" name="linkedinUrl" defaultValue={p?.linkedinUrl ?? ""} placeholder="linkedin.com/in/you" className={inputClass} />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" error={err("whatsapp")}>
            <input id="whatsapp" name="whatsapp" type="tel" defaultValue={p?.whatsapp ?? ""} placeholder="+234…" className={inputClass} />
          </Field>
          <Field label="Email" htmlFor="email" error={err("email")}>
            <input id="email" name="email" type="email" defaultValue={p?.email ?? ""} className={inputClass} />
          </Field>
          <Field label="Website" htmlFor="websiteUrl" error={err("websiteUrl")}>
            <input id="websiteUrl" name="websiteUrl" defaultValue={p?.websiteUrl ?? ""} placeholder="yourcompany.com" className={inputClass} />
          </Field>
        </div>
        {err("contact") && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {err("contact")}
          </p>
        )}
      </div>

      <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-2xl border border-line bg-white/95 p-2 backdrop-blur md:bottom-4">
        <Submit pending={pending} size="lg" className="shrink-0">
          {p ? "Save my card" : "Create my card"}
        </Submit>
        <div className="min-w-0 text-sm leading-tight">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

export function WhereForm({ current, fresh }: { current: string | null; fresh: boolean }) {
  const { state, pending, onSubmit } = useForm(setWhereAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="where" className="block text-sm font-semibold">
        Find me at… <span className="font-normal text-muted">(shown for 3 hours)</span>
      </label>
      <div className="flex gap-2">
        <input id="where" name="where" maxLength={100} defaultValue={fresh ? current ?? "" : ""} placeholder="e.g. Coffee stand by the main hall until 2pm" className={inputClass} />
        <Submit pending={pending} variant="dark">
          Update
        </Submit>
      </div>
      <Status state={state} />
    </form>
  );
}

export function HangoutForm({ defaultStart }: { defaultStart: string }) {
  const { state, pending, onSubmit, err } = useForm(createHangoutAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="What's it about?" htmlFor="title" error={err("title")}>
        <input id="title" name="title" maxLength={80} placeholder="e.g. Fintech founders coffee" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="When (Lagos time)" htmlFor="startsAt" error={err("startsAt")}>
          <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaultStart} className={inputClass} />
        </Field>
        <Field label="Where" htmlFor="place" error={err("place")}>
          <input id="place" name="place" maxLength={120} placeholder="By the main stage" className={inputClass} />
        </Field>
        <Field label="Max people" htmlFor="capacity" error={err("capacity")}>
          <input id="capacity" name="capacity" type="number" min={2} max={200} defaultValue={12} className={inputClass} />
        </Field>
      </div>
      <Field label="Details" htmlFor="details" optional>
        <textarea id="details" name="details" rows={2} maxLength={400} className={inputClass} placeholder="Who should come? How will they find you?" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit pending={pending}>Start hangout</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AdminLogin() {
  const { state, pending, onSubmit } = useForm(adminLoginAction);
  return (
    <form onSubmit={onSubmit} className="flex max-w-md gap-2">
      <label htmlFor="key" className="sr-only">
        Admin key
      </label>
      <input id="key" name="key" type="password" placeholder="Admin key" className={inputClass} />
      <Submit pending={pending} variant="dark">
        Enter
      </Submit>
      <Status state={state} />
    </form>
  );
}

export function ImportForm() {
  const { state, pending, onSubmit } = useForm(importPostsAction, { refresh: true });
  const rows = state?.ok ? (state.data as ImportResult[]) : [];
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Public X post links" htmlFor="records" hint='One per line, or JSON: [{"url": "...", "content": "...", "authorName": "..."}]'>
        <textarea id="records" name="records" rows={5} className={cx(inputClass, "font-mono text-xs")} placeholder="https://x.com/someone/status/1234567890123456789" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enrich" defaultChecked /> Fill in post text from X&apos;s public embed when missing
      </label>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="dark">
          Add posts
        </Submit>
        <Status state={state} />
      </div>
      {rows.length > 0 && (
        <ul className="space-y-1 text-xs">
          {rows.map((r, i) => (
            <li key={i} className="flex gap-2">
              <Tag tone={r.status === "added" ? "green" : r.status === "invalid" ? "flame" : "neutral"}>{r.status}</Tag>
              <span className="break-all">{r.input}</span>
              {r.message && <span className="text-red-600">{r.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
