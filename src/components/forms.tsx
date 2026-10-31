"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addCommentAction, addXPostAction, adminLoginAction, checkInAction, importMomentsAction, importPostsAction, postMomentAction, saveEventAction, saveTopAccountsAction, signUpAction, saveCardAction, saveUpdateAction } from "@/lib/actions";
import type { EventSpace, Person } from "@/lib/db/schema";
import { MAX_MOMENT_PHOTOS, OFFERS, WANTS } from "@/lib/constants";
import type { ImportResult } from "@/lib/data";
import { MultiPhotoPicker, MultiSelect, PhotoPicker, Status, Submit, useForm } from "./client";
import { Field, Tag, cx, inputClass } from "./ui";

const contactOf = (p: Person | null) => (p ? (p.xHandle ? `@${p.xHandle}` : p.whatsapp ?? p.email ?? p.linkedinUrl ?? p.websiteUrl ?? "") : "");

export function CardForm({ person, event }: { person: Person | null; event: string }) {
  const { state, pending, onSubmit, err } = useForm(saveCardAction, { refresh: true });
  const p = person;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="event" value={event} />
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

export function XPostForm({ event }: { event: string }) {
  const { state, pending, onSubmit } = useForm(addXPostAction);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="event" value={event} />
      <label htmlFor="url" className="block text-sm font-semibold">
        Link to your post about the event
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

export function ImportForm({ event }: { event: string }) {
  const { state, pending, onSubmit } = useForm(importPostsAction, { refresh: true });
  const rows = state?.ok ? (state.data as ImportResult[]) : [];
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="event" value={event} />
      <Field label="X post links" htmlFor="records" hint="One per line. Text and author are filled in from X's public embed.">
        <textarea id="records" name="records" rows={4} className={cx(inputClass, "font-mono text-xs")} placeholder="https://x.com/someone/status/1234567890123456789" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="dark">
          Add posts
        </Submit>
        <Status state={state} />
      </div>
      <ImportResults rows={rows} />
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

export function UpdateForm({ person, event }: { person: Person; event: string }) {
  const { state, pending, onSubmit, err } = useForm(saveUpdateAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="event" value={event} />
      <PhotoPicker current={person.photoUpdatedAt ? `/photo/${person.id}?v=${person.photoUpdatedAt.getTime()}` : null} error={err("photo")} />
      <p className="text-xs text-muted">A picture of you on your card helps people recognise you at the event.</p>
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

export function MomentForm({ myName, event }: { myName: string | null; event: string }) {
  const { state, pending, onSubmit, err } = useForm(postMomentAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="event" value={event} />
      <MultiPhotoPicker max={MAX_MOMENT_PHOTOS} error={err("photo")} />
      <Field label="…or share an X post" htmlFor="xUrl" optional error={err("xUrl")} hint="Paste a link to a public post. Its text and images are shown with a link back to X.">
        <input id="xUrl" name="xUrl" inputMode="url" placeholder="x.com/name/status/…" className={inputClass} />
      </Field>
      <Field label="What's happening?" htmlFor="body" optional error={err("body")}>
        <textarea id="body" name="body" rows={2} maxLength={280} placeholder="My best moment… (tag people with @handle)" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where?" htmlFor="place" optional error={err("place")}>
          <input id="place" name="place" maxLength={100} placeholder="Main hall" className={inputClass} />
        </Field>
        {myName ? (
          <p className="self-end pb-3 text-sm text-muted">
            Posting as <span className="font-semibold text-ink">{myName}</span>
          </p>
        ) : (
          <Field label="Your name or @handle" htmlFor="mname" optional>
            <input id="mname" name="name" maxLength={40} placeholder="@yourhandle" autoCapitalize="none" className={inputClass} />
          </Field>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={pending} size="lg" className="shrink-0" data-track="post_moment">
          Post
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

function ImportResults({ rows }: { rows: ImportResult[] }) {
  if (!rows.length) return null;
  return (
    <ul className="space-y-1 text-xs">
      {rows.map((r, i) => (
        <li key={i} className="flex gap-2">
          <Tag tone={r.status === "added" ? "green" : r.status === "invalid" ? "flame" : "neutral"}>{r.status}</Tag>
          <span className="break-all">{r.input}</span>
          {r.message && <span className="text-red-600">{r.message}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Admin: X post links are all it takes, many at once. A photo or written update sits under "Or add…". */
export function AdminMomentForm({ event }: { event: string }) {
  const links = useForm(importMomentsAction, { refresh: true });
  const { state, pending, onSubmit, err } = useForm(postMomentAction);
  const linksForm = useRef<HTMLFormElement>(null);
  // Every batch's results, newest first, so a run of pastes reads as one list.
  const [log, setLog] = useState<ImportResult[]>([]);
  useEffect(() => {
    const st = links.state;
    if (!st?.ok) return;
    setLog((l) => [...(st.data as ImportResult[]), ...l].slice(0, 100));
    const box = linksForm.current?.elements.namedItem("links") as HTMLTextAreaElement | null;
    if (box) box.value = "";
  }, [links.state]);
  return (
    <div className="space-y-3">
      <form ref={linksForm} onSubmit={links.onSubmit} noValidate className="space-y-2">
      <input type="hidden" name="event" value={event} />
        <label htmlFor="admin-links" className="sr-only">
          X post links for Moments
        </label>
        <textarea
          id="admin-links"
          name="links"
          rows={3}
          placeholder={"Paste an X post link — it's added right away\nhttps://x.com/someone/status/…"}
          className={cx(inputClass, "font-mono text-xs")}
          // Pasting a post link adds it at once; typed links still use the button.
          onPaste={(e) => {
            if (!/\/status\/\d+/.test(e.clipboardData.getData("text"))) return;
            setTimeout(() => !links.pending && linksForm.current?.requestSubmit(), 0);
          }}
        />
        <div className="flex items-center gap-3">
          <Submit pending={links.pending} className="shrink-0" data-track="admin_import_moments">
            {links.pending ? "Adding…" : "Add"}
          </Submit>
          <div className="min-w-0 text-sm">
            <Status state={links.state} />
          </div>
        </div>
        <ImportResults rows={log} />
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Or add a photo or update instead</summary>
        <form onSubmit={onSubmit} noValidate className="mt-3 space-y-3">
      <input type="hidden" name="event" value={event} />
          <input type="hidden" name="from" value="admin" />
          <MultiPhotoPicker max={MAX_MOMENT_PHOTOS} error={err("photo")} />
          <Field label="What's happening?" htmlFor="admin-body" optional error={err("body")}>
            <textarea id="admin-body" name="body" rows={2} maxLength={280} className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Where?" htmlFor="admin-place" optional error={err("place")}>
              <input id="admin-place" name="place" maxLength={100} className={inputClass} />
            </Field>
            <Field label="Credit" htmlFor="admin-mname" optional hint="A name or @handle. X posts are credited to their author.">
              <input id="admin-mname" name="name" maxLength={40} autoCapitalize="none" className={inputClass} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Submit pending={pending} className="shrink-0" data-track="admin_post_moment">
              Post
            </Submit>
            <div className="min-w-0 text-sm">
              <Status state={state} />
            </div>
          </div>
        </form>
      </details>
    </div>
  );
}

const DURATIONS = [
  ["1", "1 hour"],
  ["2", "2 hours"],
  ["4", "4 hours"],
  ["day", "Rest of today"],
] as const;

export function CheckinForm({ me, event }: { me: { name: string } | null; event: string }) {
  const { state, pending, onSubmit, err } = useForm(checkInAction);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <input type="hidden" name="event" value={event} />
      <div className={cx("grid gap-3", me ? "sm:grid-cols-[1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]")}>
        <div>
          <label htmlFor="place" className="sr-only">
            Where are you?
          </label>
          <input id="place" name="place" maxLength={100} placeholder="Where are you? e.g. Booth 14, Hall B" className={inputClass} aria-invalid={!!err("place")} aria-label="Where are you?" />
          {err("place") && <p className="mt-1 text-xs text-red-600">{err("place")}</p>}
        </div>
        {!me && (
          <div>
            <label htmlFor="ci-contact" className="sr-only">
              Your X handle
            </label>
            <input id="ci-contact" name="contact" placeholder="Your X handle, e.g. @you" autoCapitalize="none" className={inputClass} aria-invalid={!!err("contact")} aria-label="Your X handle" />
            {err("contact") && <p className="mt-1 text-xs text-red-600">{err("contact")}</p>}
          </div>
        )}
        <Submit pending={pending} size="lg" className="shrink-0" data-track="checkin">
          📍 I&apos;m here
        </Submit>
      </div>
      {(err("name") || (state && !state.ok && !err("place") && !err("contact"))) && (
        <p role="alert" className="text-sm text-red-600">
          {err("name") ?? (state && !state.ok ? state.error : "")}
        </p>
      )}
      <details className="text-sm" open={Boolean(err("name"))}>
        <summary className="cursor-pointer text-muted">
          {me ? (
            <>
              Checking in as <span className="font-semibold text-ink">{me.name}</span> · more options
            </>
          ) : (
            "More options (name, what you're up for, how long)"
          )}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {!me && (
            <Field label="Your name" htmlFor="ci-name" optional hint="Needed if you used a phone number or email above.">
              <input id="ci-name" name="name" maxLength={60} autoComplete="name" className={inputClass} />
            </Field>
          )}
          <Field label="Up for…" htmlFor="note" optional error={err("note")}>
            <input id="note" name="note" maxLength={140} placeholder="Coffee and a chat about fintech" className={inputClass} />
          </Field>
          {!me && (
            <Field label="What you do" htmlFor="ci-headline" optional>
              <input id="ci-headline" name="headline" maxLength={80} placeholder="Founder, payments startup" className={inputClass} />
            </Field>
          )}
          <Field label="For how long?" htmlFor="ci-for">
            <select id="ci-for" name="for" defaultValue="2" className={inputClass}>
              {DURATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </details>
    </form>
  );
}

export function SignupForm({ name, about, event }: { name: string; about: string; event?: string }) {
  const { state, pending, onSubmit, err } = useForm(signUpAction);
  if (state?.ok)
    return (
      <div className="space-y-2 text-center">
        <p className="text-lg font-bold">You&apos;re signed up 🎉</p>
        <p className="text-sm text-muted">We&apos;ll be in touch when there&apos;s something new.</p>
        <Link href="/" className="inline-block pt-2 text-sm font-semibold text-flame-700 underline">
          Back to the site
        </Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {event && <input type="hidden" name="event" value={event} />}
      <Field label="Email" htmlFor="su-email" error={err("email")}>
        <input id="su-email" name="email" type="email" inputMode="email" autoComplete="email" required className={inputClass} aria-invalid={!!err("email")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="su-name" optional error={err("name")}>
          <input id="su-name" name="name" maxLength={60} autoComplete="name" defaultValue={name} className={inputClass} />
        </Field>
        <Field label="What do you do?" htmlFor="su-about" optional error={err("about")}>
          <input id="su-about" name="about" maxLength={100} defaultValue={about} placeholder="Founder, engineer, investor…" className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="dark" data-track="signup_submit">
          Sign up
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

export function TopAccountsForm({ current, event }: { current: string; event: string }) {
  const { state, pending, onSubmit } = useForm(saveTopAccountsAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="event" value={event} />
      <Field label="Top accounts" htmlFor="top-accounts" hint="X handles whose posts get a strong boost for Featured (e.g. organisers, speakers, well-known founders). Separate with spaces or new lines.">
        <textarea id="top-accounts" name="handles" rows={2} defaultValue={current} placeholder="@techcabal @someone" className={cx(inputClass, "font-mono text-xs")} />
      </Field>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="secondary" size="sm">
          Save
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

/** "2026-11-27" (Lagos) for a date input, from a stored start, or the day an end falls in. */
function lagosDate(d: Date | null, end = false): string {
  if (!d) return "";
  return new Date(d.getTime() + 3600_000 - (end ? 1 : 0)).toISOString().slice(0, 10);
}

/** Admin: one event's details (or a blank form to add one). */
export function EventForm({ event }: { event: EventSpace | null }) {
  const { state, pending, onSubmit, err } = useForm(saveEventAction, { refresh: true });
  const k = event?.id ?? "new";
  const f = (name: string, label: string, opts: { value?: string | null; placeholder?: string; hint?: string; type?: string; optional?: boolean } = {}) => (
    <Field label={label} htmlFor={`${k}-${name}`} optional={opts.optional ?? true} hint={opts.hint} error={err(name)}>
      <input id={`${k}-${name}`} name={name} type={opts.type ?? "text"} defaultValue={opts.value ?? ""} placeholder={opts.placeholder} className={inputClass} />
    </Field>
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {event && <input type="hidden" name="id" value={event.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {f("name", "Name", { value: event?.name, placeholder: "Ogun Digital Summit 2026", optional: false })}
        {f("slug", "Address", { value: event?.slug, placeholder: "ogun-digital-summit", hint: "The site address: /your-address", optional: false })}
        {f("short", "Short name", { value: event?.short, placeholder: "Ogun Digital", hint: "For the logo: “OGUN DIGITAL CONNECT”" })}
        {f("organiser", "Organiser", { value: event?.organiser })}
        {f("dates", "Dates (as shown)", { value: event?.dates, placeholder: "26 November 2026" })}
        {f("venue", "Venue", { value: event?.venue, placeholder: "June 12 Cultural Centre, Abeokuta" })}
        {f("startDay", "First day", { value: lagosDate(event?.startsAt ?? null), type: "date", hint: "Before it: “Who's going”" })}
        {f("endDay", "Last day", { value: lagosDate(event?.endsAt ?? null, true), type: "date", hint: "After it: “Find the people you met”" })}
        {f("tagline", "Tagline", { value: event?.tagline })}
        {f("url", "Official site", { value: event?.url, placeholder: "https://…" })}
        {f("hashtag", "Hashtag", { value: event?.hashtag, placeholder: "#OgunDigitalSummit" })}
        {f("xHandle", "X handle", { value: event?.xHandle, placeholder: "@organiser" })}
        {f("position", "Order on the homepage", { value: String(event?.position ?? 100), type: "number" })}
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" name="hidden" defaultChecked={event?.hidden ?? false} className="h-4 w-4 accent-[var(--color-flame-700)]" /> Hidden (a draft only admins can open)
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={pending} variant="dark" size="sm">
          {event ? "Save" : "Add event"}
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}
