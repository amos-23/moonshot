"use client";

import {
  importPostsAction,
  saveEventInfoAction,
  saveExhibitorAction,
  saveSearchQueriesAction,
  updatePostAction,
} from "@/lib/actions/admin";
import type { Exhibitor, SocialPost } from "@/lib/db/schema";
import type { ImportRowResult } from "@/lib/services/social";
import type { EventInfo } from "@/lib/validation";
import { EXHIBITOR_CATEGORIES, INDUSTRIES, POST_THEMES } from "@/lib/constants";
import { ChipGroup, FormStatus, SubmitButton, useForm } from "./forms";
import { Badge, Field, inputClass } from "./ui";

export function ImportPostsForm() {
  const { state, pending, onSubmit } = useForm(importPostsAction, { refresh: true });
  const rows = state?.ok ? (state.data as ImportRowResult[] | undefined) : undefined;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        label="Public X post URLs or JSON records"
        htmlFor="records"
        hint='One URL per line (x.com/<handle>/status/<id>), or a JSON array like [{"url": "...", "content": "...", "authorName": "...", "postedAt": "2026-10-20T09:00:00Z", "themes": ["networking"]}]'
      >
        <textarea id="records" name="records" rows={6} className={`${inputClass} font-mono text-xs`} placeholder="https://x.com/someone/status/1234567890123456789" />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="enrich" defaultChecked className="mt-0.5" />
        <span>
          Fetch post text and author name from X&apos;s public oEmbed endpoint when not provided
          <span className="block text-xs text-muted">Timestamps are derived from the post ID when not supplied.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending}>Import posts</SubmitButton>
        <FormStatus state={state} />
      </div>
      {rows && rows.length > 0 && (
        <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-canvas p-3 text-xs">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <Badge tone={r.status === "imported" ? "success" : r.status === "duplicate" ? "neutral" : "danger"}>{r.status}</Badge>
              <span className="break-all">{r.input}</span>
              {r.message && <span className="text-red-600">— {r.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function SearchQueriesForm({ queries }: { queries: string[] }) {
  const { state, pending, onSubmit } = useForm(saveSearchQueriesAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Search phrases (one per line)" htmlFor="queries" hint="Used for live X API searches and shown as suggestions on the Conversation page.">
        <textarea id="queries" name="queries" rows={6} defaultValue={queries.join("\n")} className={`${inputClass} font-mono text-xs`} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} variant="secondary">
          Save phrases
        </SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function EditPostForm({ post }: { post: SocialPost }) {
  const { state, pending, onSubmit } = useForm(updatePostAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={post.id} />
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="Author name" htmlFor={`an-${post.id}`} optional>
          <input id={`an-${post.id}`} name="authorName" defaultValue={post.authorName ?? ""} className={inputClass} />
        </Field>
        <Field label="Post text (as published)" htmlFor={`c-${post.id}`} optional>
          <textarea id={`c-${post.id}`} name="content" rows={2} defaultValue={post.content ?? ""} className={inputClass} />
        </Field>
      </div>
      <ChipGroup name="themes" legend="Themes" options={POST_THEMES} defaultValue={post.themes} />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} size="sm" variant="secondary">
          Save
        </SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function EventInfoForm({ info }: { info: EventInfo }) {
  const { state, pending, onSubmit, err } = useForm(saveEventInfoAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name" htmlFor="name" error={err("name")}>
          <input id="name" name="name" defaultValue={info.name} className={inputClass} />
        </Field>
        <Field label="Dates" htmlFor="dates" error={err("dates")}>
          <input id="dates" name="dates" defaultValue={info.dates} className={inputClass} />
        </Field>
        <Field label="City" htmlFor="city" error={err("city")}>
          <input id="city" name="city" defaultValue={info.city} className={inputClass} />
        </Field>
        <Field label="Venue" htmlFor="venue" optional hint="Only from official sources" error={err("venue")}>
          <input id="venue" name="venue" defaultValue={info.venue} className={inputClass} />
        </Field>
        <Field label="Official website" htmlFor="officialUrl" optional error={err("officialUrl")}>
          <input id="officialUrl" name="officialUrl" type="url" defaultValue={info.officialUrl ?? ""} className={inputClass} />
        </Field>
        <Field label="Hashtags" htmlFor="hashtags" optional hint="Space-separated, e.g. #Moonshot2026 — only ones you've confirmed are in use" error={err("hashtags")}>
          <input id="hashtags" name="hashtags" defaultValue={info.hashtags} className={inputClass} />
        </Field>
      </div>
      <Field label="Summary" htmlFor="summary" optional error={err("summary")}>
        <textarea id="summary" name="summary" rows={3} defaultValue={info.summary} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Save event info</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ExhibitorForm({ exhibitor }: { exhibitor?: Exhibitor }) {
  const { state, pending, onSubmit, err } = useForm(saveExhibitorAction, { refresh: true });
  const e = exhibitor;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="ex-name" error={err("name")}>
          <input id="ex-name" name="name" defaultValue={e?.name} className={inputClass} />
        </Field>
        <Field label="Tagline" htmlFor="ex-tagline" optional error={err("tagline")}>
          <input id="ex-tagline" name="tagline" defaultValue={e?.tagline} className={inputClass} />
        </Field>
        <Field label="Category" htmlFor="ex-category">
          <select id="ex-category" name="category" defaultValue={e?.category ?? "startup"} className={inputClass}>
            {EXHIBITOR_CATEGORIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Industry" htmlFor="ex-industry" optional>
          <select id="ex-industry" name="industry" defaultValue={e?.industry ?? ""} className={inputClass}>
            <option value="">—</option>
            {INDUSTRIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Website" htmlFor="ex-web" optional error={err("websiteUrl")}>
          <input id="ex-web" name="websiteUrl" type="url" defaultValue={e?.websiteUrl ?? ""} className={inputClass} />
        </Field>
        <Field label="Booth location" htmlFor="ex-booth" optional error={err("boothLocation")}>
          <input id="ex-booth" name="boothLocation" defaultValue={e?.boothLocation ?? ""} className={inputClass} placeholder="e.g. Hall B, Stand 12" />
        </Field>
      </div>
      <Field label="Description" htmlFor="ex-desc" optional error={err("description")}>
        <textarea id="ex-desc" name="description" rows={4} defaultValue={e?.description} className={inputClass} />
      </Field>
      <input type="hidden" name="logoUrl" value={e?.logoUrl ?? ""} />
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="boothVerified" defaultChecked={e?.boothVerified} /> Booth location verified from an official source
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={e?.published ?? true} /> Published
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDemo" defaultChecked={e?.isDemo} /> Demo / fictional entry
        </label>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>{e ? "Save exhibitor" : "Add exhibitor"}</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
