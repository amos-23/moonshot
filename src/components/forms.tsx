"use client";

import { useEffect, useRef } from "react";
import { addCommentAction, addXPostAction, adminLoginAction, importPostsAction, saveCardAction, setWhereAction } from "@/lib/actions";
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
      {/* On My card this is edited in its own quick box at the top. */}
      {p ? (
        <input type="hidden" name="where" value={p.whereNote ?? ""} />
      ) : (
        <Field label="Catch me at" htmlFor="where" optional error={err("where")} hint="Where people can find you at the event today, e.g. “Booth 14, Hall B until 3pm”.">
          <input id="where" name="where" maxLength={100} placeholder="Booth 14, Hall B until 3pm" className={inputClass} />
        </Field>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">
          Photo from today <span className="font-normal text-muted">(optional)</span>
        </p>
        <PhotoPicker current={p?.photoUpdatedAt ? `/photo/${p.id}?v=${p.photoUpdatedAt.getTime()}` : null} error={err("photo")} />
        <p className="text-xs text-muted">A picture of you at Moonshot helps people recognise you.</p>
      </div>
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

export function WhereForm({ current }: { current: string | null }) {
  const { state, pending, onSubmit } = useForm(setWhereAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="where-quick" className="block text-sm font-semibold">
        📍 Catch me at…
      </label>
      <div className="flex gap-2">
        <input id="where-quick" name="where" maxLength={100} defaultValue={current ?? ""} placeholder="Booth 14, Hall B until 3pm" className={inputClass} />
        <Submit pending={pending} variant="dark" data-track="where_update">
          Update
        </Submit>
      </div>
      <Status state={state} />
    </form>
  );
}
