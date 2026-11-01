"use client";

import { useState } from "react";
import { createEventAction, updateOwnEventAction } from "@/lib/event-actions";
import type { EventSpace } from "@/lib/db/schema";
import { slugify } from "@/lib/event-form-client";
import { Status, Submit, useForm } from "./client";
import { Field, cx, inputClass } from "./ui";

const lagosDate = (d: Date | null, end = false) => (d ? new Date(new Date(d).getTime() + 3600_000 - (end ? 1 : 0)).toISOString().slice(0, 10) : "");
const SWATCHES = ["#5b3df5", "#0b8cb0", "#178a2d", "#c23f1c", "#d9467a", "#171834", "#e0a100", "#0f766e"];

/** For organisers: create an event, or edit one they own. Only the name is required. */
export function OrganiserEventForm({ event, origin }: { event?: EventSpace; origin: string }) {
  const { state, pending, onSubmit, err } = useForm(event ? updateOwnEventAction : createEventAction, { refresh: !!event });
  const [name, setName] = useState(event?.name ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!event);
  const [color, setColor] = useState(event?.brandColor ?? "#5b3df5");
  const shownSlug = slugTouched ? slug : slugify(name);
  const host = origin.replace(/^https?:\/\//, "");
  const input = (id: string, label: string, o: { name?: string; value?: string | null; placeholder?: string; hint?: string; type?: string; required?: boolean; max?: number } = {}) => (
    <Field label={label} htmlFor={id} optional={!o.required} hint={o.hint} error={err(o.name ?? id)}>
      <input id={id} name={o.name ?? id} type={o.type ?? "text"} defaultValue={o.value ?? ""} placeholder={o.placeholder} maxLength={o.max} className={inputClass} aria-invalid={!!err(o.name ?? id)} />
    </Field>
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {event && <input type="hidden" name="id" value={event.id} />}
      <Field label="Event name" htmlFor="ev-name" error={err("name")}>
        <input id="ev-name" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lagos Product Meetup 2027" className={inputClass} aria-invalid={!!err("name")} />
      </Field>
      <Field label="Address" htmlFor="ev-slug" error={err("slug")} hint={`${host}/${shownSlug || "your-event"}`}>
        <input
          id="ev-slug"
          name="slug"
          maxLength={60}
          value={shownSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
          }}
          placeholder="lagos-product-meetup"
          className={inputClass}
          aria-invalid={!!err("slug")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {input("ev-start", "First day", { name: "startDay", type: "date", value: lagosDate(event?.startsAt ?? null) })}
        {input("ev-end", "Last day", { name: "endDay", type: "date", value: lagosDate(event?.endsAt ?? null, true), hint: "Leave empty for a one-day event" })}
      </div>
      {input("ev-venue", "Venue", { name: "venue", value: event?.venue, placeholder: "Landmark Centre, Victoria Island, Lagos", max: 160 })}
      {input("ev-tagline", "Tagline", { name: "tagline", value: event?.tagline, placeholder: "Builders, designers and founders, one evening", max: 160 })}
      <div className="grid gap-4 sm:grid-cols-2">
        {input("ev-url", "Event website", { name: "url", value: event?.url, placeholder: "https://…", max: 300 })}
        {input("ev-organiser", "Organiser", { name: "organiser", value: event?.organiser, placeholder: "Your company or community", max: 120 })}
        {input("ev-hashtag", "Hashtag", { name: "hashtag", value: event?.hashtag, placeholder: "#LagosProduct", max: 40 })}
        {input("ev-x", "X handle", { name: "xHandle", value: event?.xHandle, placeholder: "@yourevent", max: 16 })}
      </div>
      <Field label="Brand colour" htmlFor="ev-color" optional error={err("brandColor")} hint="Used for your event's buttons and page.">
        <div className="flex flex-wrap items-center gap-2">
          <input id="ev-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-white p-1" aria-label="Pick a colour" />
          <input name="brandColor" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} className={cx(inputClass, "w-28 font-mono")} aria-label="Colour code" />
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Use ${c}`} className={cx("h-8 w-8 rounded-full ring-offset-2", color === c && "ring-2 ring-ink")} style={{ background: c }} />
          ))}
        </div>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} variant="dark" data-track={event ? "event_save" : "event_create"}>
          {event ? "Save changes" : "Create event"}
        </Submit>
        <div className="min-w-0 text-sm">
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}
