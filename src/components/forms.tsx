"use client";

import { useEffect, useRef } from "react";
import { addCommentAction, addXPostAction, adminLoginAction, checkInAction, importPostsAction, postMomentAction, saveCardAction, saveUpdateAction } from "@/lib/actions";
import type { Person } from "@/lib/db/schema";
import { OFFERS, WANTS } from "@/lib/constants";
import type { ImportResult } from "@/lib/data";
import { MultiSelect, PhotoPicker, Status, Submit, useForm } from "./client";
import { Field, Tag, cx, inputClass } from "./ui";

const contactOf = (p: Person | null) => (p ? (p.xHandle ? `@${p.xHandle}` : p.whatsapp ?? p.email ?? p.linkedinUrl ?? p.websiteUrl ?? "") : "");

export function CardForm({ person }: { person: Person | null }) {
  const { state, pending, onSubmit, err } = useForm(saveCardAction, { refresh: true });
  const p = person;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="Name" htmlFor="name" error={err("name")}>
        <input id="name" name="name" autoComplete="name" defaultValue={p?.name} maxLength={60} className={inputClass} aria-invalid={!!err("name")} />
      </Field>
      <Field label="What you do" htmlFor="headline" error={err("headline")}>
        <input id="headline" name="headline" defaultValue={p?.headline} maxLength={80} placeholder="Founder at a payments startup" className={inputClass} aria-invalid={!!err("headline")} />
      </Field>
      <Field label="Looking to meet" htmlFor="wants">
        <MultiSelect id="wants" name="wants" options={WANTS} initial={p?.wants} max={3} placeholder="Choose up to 3" />
      </Field>
      <Field label="Your X handle" htmlFor="contact" error={err("contact")} hint="That's enough for people to reach you. No X? A WhatsApp number, email or LinkedIn link works too. It shows on your card.">
        <input id="contact" name="contact" defaultValue={contactOf(p)} placeholder="@yourhandle" autoCapitalize="none" autoCorrect="off" className={inputClass} aria-invalid={!!err("contact")} />
      </Field>
      <details className="group" open={Boolean(p?.offers.length || p?.company)}>
        <summary className="cursor-pointer text-sm font-semibold text-muted">More (optional)</summary>
        <div className="mt-4 space-y-5">
          <Field label="I can help with" htmlFor="offers">
            <MultiSelect id="offers" name="offers" options={OFFERS} initial={p?.offers} max={3} placeholder="Choose up to 3" />
          </Field>
          <Field label="Company" htmlFor="company">
            <input id="company" name="company" defaultValue={p?.company ?? ""} maxLength={80} className={inputClass} />
          </Field>
        </div>
      </details>
      <div className="flex items-center gap-3">
        <Submit pending={pending} size="lg" className="shrink-0" data-track={p ? "save_card" : "add_me"}>
          {p ? "Save" : "Add me"}
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

export function XPostForm() {
  const { state, pending, onSubmit } = useForm(addXPostAction);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="url" className="block text-sm font-semibold">
        Link to your post about Moonshot
      </label>
      <div className="flex gap-2">
        <input id="url" name="url" inputMode="url" placeholder="x.com/you/status/…" className={inputClass} />
        <Submit pending={pending} variant="dark" data-track="add_x_post">
          Add
        </Submit>
      </div>
      <Status state={state} />
    </form>
  );
}

export function AdminLogin() {
  const { state, pending, onSubmit } = useForm(adminLoginAction);
  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-wrap gap-2">
      <label htmlFor="key" className="sr-only">
        Admin key
      </label>
      <input id="key" name="key" type="password" placeholder="Admin key" className={cx(inputClass, "flex-1")} />
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
      <Field label="X post links" htmlFor="records" hint="One per line. Text and author are filled in from X's public embed.">
        <textarea id="records" name="records" rows={4} className={cx(inputClass, "font-mono text-xs")} placeholder="https://x.com/someone/status/1234567890123456789" />
      </Field>
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

export function CommentForm({ postId, myName }: { postId: string; myName: string | null }) {
  const { state, pending, onSubmit } = useForm(addCommentAction, { refresh: true });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.querySelector<HTMLInputElement>("input[name=body]")?.form?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      {!myName && (
        <>
          <label htmlFor={`cn-${postId}`} className="sr-only">
            Your name
          </label>
          <input id={`cn-${postId}`} name="name" maxLength={40} placeholder="Your name" className={cx(inputClass, "py-2")} />
        </>
      )}
      <div className="flex gap-2">
        <label htmlFor={`cb-${postId}`} className="sr-only">
          Comment
        </label>
        <input id={`cb-${postId}`} name="body" maxLength={280} placeholder={myName ? `Comment as ${myName}` : "Say hi or ask to meet"} className={cx(inputClass, "py-2")} />
        <Submit pending={pending} variant="dark" size="sm" className="h-auto" data-track="comment" data-track-id={postId}>
          Post
        </Submit>
      </div>
      {state && !state.ok && <Status state={state} />}
    </form>
  );
}

export function UpdateForm({ person }: { person: Person }) {
  const { state, pending, onSubmit, err } = useForm(saveUpdateAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <PhotoPicker current={person.photoUpdatedAt ? `/photo/${person.id}?v=${person.photoUpdatedAt.getTime()}` : null} error={err("photo")} />
      <p className="text-xs text-muted">A picture of you at Moonshot on your card helps people recognise you.</p>
      <div className="flex items-center gap-3">
        <Submit pending={pending} size="lg" className="shrink-0" data-track="post_update">
          Save photo
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

export function MomentForm({ myName, admin }: { myName: string | null; admin?: boolean }) {
  const { state, pending, onSubmit, err } = useForm(postMomentAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {admin && <input type="hidden" name="from" value="admin" />}
      <PhotoPicker current={null} maxSide={1080} addLabel="Add a photo" wide error={err("photo")} />
      <Field label="…or share an X post" htmlFor={admin ? "admin-xUrl" : "xUrl"} optional error={err("xUrl")} hint="Paste a link to a public post. Its text and images are shown with a link back to X.">
        <input id={admin ? "admin-xUrl" : "xUrl"} name="xUrl" inputMode="url" placeholder="x.com/name/status/…" className={inputClass} />
      </Field>
      <Field label="What's happening?" htmlFor={admin ? "admin-body" : "body"} optional error={err("body")}>
        <textarea id={admin ? "admin-body" : "body"} name="body" rows={2} maxLength={280} placeholder="The fintech panel is packed 🔥" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where?" htmlFor={admin ? "admin-place" : "place"} optional error={err("place")}>
          <input id={admin ? "admin-place" : "place"} name="place" maxLength={100} placeholder="Main hall" className={inputClass} />
        </Field>
        {myName && !admin ? (
          <p className="self-end pb-3 text-sm text-muted">
            Posting as <span className="font-semibold text-ink">{myName}</span>
          </p>
        ) : (
          <Field label={admin ? "Credit" : "Your name or @handle"} htmlFor={admin ? "admin-mname" : "mname"} optional>
            <input id={admin ? "admin-mname" : "mname"} name="name" maxLength={40} defaultValue={admin ? "Moonshot Connect" : undefined} placeholder="@yourhandle" autoCapitalize="none" className={inputClass} />
          </Field>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={pending} size="lg" className="shrink-0" data-track={admin ? "admin_post_moment" : "post_moment"}>
          Post
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

const DURATIONS = [
  ["1", "1 hour"],
  ["2", "2 hours"],
  ["4", "4 hours"],
  ["day", "Rest of today"],
] as const;

export function CheckinForm({ me }: { me: { name: string } | null }) {
  const { state, pending, onSubmit, err } = useForm(checkInAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Where are you?" htmlFor="place" error={err("place")}>
        <input id="place" name="place" maxLength={100} placeholder="Booth 14, Hall B · coffee stand · main hall front row" className={inputClass} aria-invalid={!!err("place")} />
      </Field>
      <Field label="Up for…" htmlFor="note" optional error={err("note")}>
        <input id="note" name="note" maxLength={140} placeholder="Coffee and a chat about fintech · meeting founders · come say hi" className={inputClass} />
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold">For how long?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DURATIONS.map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-white px-3 py-2.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-flame/20">
              <input type="radio" name="for" value={value} defaultChecked={value === "2"} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {me ? (
        <p className="text-sm text-muted">
          Checking in as <span className="font-semibold text-ink">{me.name}</span>, with the contact on your card.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="ci-name" error={err("name")}>
            <input id="ci-name" name="name" maxLength={60} autoComplete="name" className={inputClass} aria-invalid={!!err("name")} />
          </Field>
          <Field label="How to reach you" htmlFor="ci-contact" error={err("contact")} hint="Your X handle, WhatsApp number or email. Shown on the board.">
            <input id="ci-contact" name="contact" placeholder="@yourhandle or +234…" autoCapitalize="none" className={inputClass} aria-invalid={!!err("contact")} />
          </Field>
          <Field label="What you do" htmlFor="ci-headline" optional>
            <input id="ci-headline" name="headline" maxLength={80} placeholder="Founder, payments startup" className={inputClass} />
          </Field>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Submit pending={pending} size="lg" className="shrink-0" data-track="checkin">
          📍 Check in
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}
