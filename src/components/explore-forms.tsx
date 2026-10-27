"use client";

import { createMeetupAction, inquiryAction } from "@/lib/actions/explore";
import { MEETUP_TOPICS } from "@/lib/constants";
import { FormStatus, SubmitButton, useForm } from "./forms";
import { Field, Notice, inputClass } from "./ui";

export function InquiryForm({ exhibitorId }: { exhibitorId: string }) {
  const { state, pending, onSubmit, ref } = useForm(inquiryAction, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="exhibitorId" value={exhibitorId} />
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 text-sm font-medium">I&apos;d like to…</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="question" defaultChecked /> Ask a question
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="introduction" /> Request an introduction
        </label>
      </fieldset>
      <Field label="Message" htmlFor="inq-body">
        <textarea id="inq-body" name="body" rows={3} maxLength={1000} required className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending}>Send</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function MeetupForm({ defaultStart }: { defaultStart: string }) {
  const { state, pending, onSubmit, err } = useForm(createMeetupAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Title" htmlFor="title" error={err("title")}>
        <input id="title" name="title" required maxLength={100} placeholder="e.g. Breakfast for AI agent builders" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic" htmlFor="topic" error={err("topic")}>
          <select id="topic" name="topic" className={inputClass} defaultValue="ai_agents">
            {MEETUP_TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Proposed time (Lagos, WAT)" htmlFor="startsAt" error={err("startsAt")}>
          <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={defaultStart} className={inputClass} />
        </Field>
        <Field label="Meeting point" htmlFor="location" optional error={err("location")} hint="A physical spot at or near the venue">
          <input id="location" name="location" maxLength={200} className={inputClass} />
        </Field>
        <Field label="Online link" htmlFor="onlineUrl" optional error={err("onlineUrl")} hint="For remote attendees">
          <input id="onlineUrl" name="onlineUrl" type="url" className={inputClass} placeholder="https://" />
        </Field>
        <Field label="Participant limit" htmlFor="capacity" error={err("capacity")}>
          <input id="capacity" name="capacity" type="number" min={2} max={500} defaultValue={10} className={inputClass} />
        </Field>
      </div>
      <Field label="Description" htmlFor="description" optional error={err("description")}>
        <textarea id="description" name="description" rows={4} maxLength={1000} className={inputClass} placeholder="What will you talk about? Who should come?" />
      </Field>
      <Notice tone="pending">New meetups start as <strong>Proposed</strong>. Mark it confirmed once you&apos;ve settled the time and place.</Notice>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} size="lg">
          Propose meetup
        </SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
