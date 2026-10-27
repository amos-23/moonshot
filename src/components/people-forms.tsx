"use client";

import { Flag } from "lucide-react";
import { proposeMeetingAction, reportAction, saveNoteAction, sendRequestAction } from "@/lib/actions/people";
import { FormStatus, SubmitButton, useForm } from "./forms";
import { Field, Notice, inputClass } from "./ui";

export function ConnectForm({ recipientId, name }: { recipientId: string; name: string }) {
  const { state, pending, onSubmit } = useForm(sendRequestAction, { refresh: true });
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="recipientId" value={recipientId} />
      <Field label={`Add a note for ${name.split(" ")[0]}`} htmlFor="message" optional hint="A short, personal note makes acceptance much more likely. Max 300 characters.">
        <textarea id="message" name="message" rows={3} maxLength={300} className={inputClass} placeholder="Hi! I saw we're both into fintech — would love to compare notes at Moonshot." />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Send connection request</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function MeetingForm({ inviteeId, defaultStart }: { inviteeId: string; defaultStart: string }) {
  const { state, pending, onSubmit, ref } = useForm(proposeMeetingAction, { refresh: true, resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="inviteeId" value={inviteeId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Time (Lagos, WAT)" htmlFor="startsAt">
          <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={defaultStart} className={inputClass} />
        </Field>
        <Field label="Duration" htmlFor="durationMinutes">
          <select id="durationMinutes" name="durationMinutes" defaultValue="30" className={inputClass}>
            {[15, 20, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Location or meeting point" htmlFor="location" hint="e.g. 'Main entrance' or a video call link">
        <input id="location" name="location" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="Note" htmlFor="note" optional>
        <input id="note" name="note" maxLength={300} className={inputClass} placeholder="What would you like to talk about?" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending}>Propose meeting</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function NoteForm({ subjectId, initial }: { subjectId: string; initial: string }) {
  const { state, pending, onSubmit } = useForm(saveNoteAction);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="subjectId" value={subjectId} />
      <label htmlFor="note-body" className="sr-only">
        Private follow-up note
      </label>
      <textarea id="note-body" name="body" rows={3} maxLength={2000} defaultValue={initial} className={inputClass} placeholder="Only you can see this. e.g. 'Follow up about the pilot in November'" />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} size="sm" variant="secondary">
          Save note
        </SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ReportForm({ targetType, targetId, allowBlock }: { targetType: "user" | "message" | "meetup" | "post"; targetId: string; allowBlock?: boolean }) {
  const { state, pending, onSubmit } = useForm(reportAction, { refresh: true });
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted hover:text-red-700">
        <Flag size={14} aria-hidden /> Report
      </summary>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <Field label="Reason" htmlFor={`reason-${targetId}`}>
          <select id={`reason-${targetId}`} name="reason" className={inputClass} defaultValue="">
            <option value="" disabled>
              Choose a reason
            </option>
            <option value="spam">Spam or scam</option>
            <option value="harassment">Harassment or abuse</option>
            <option value="impersonation">Impersonation</option>
            <option value="inappropriate">Inappropriate content</option>
            <option value="other">Something else</option>
          </select>
        </Field>
        <Field label="Details" htmlFor={`details-${targetId}`} optional>
          <textarea id={`details-${targetId}`} name="details" rows={2} maxLength={1000} className={inputClass} />
        </Field>
        {allowBlock && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="alsoBlock" /> Also block this person
          </label>
        )}
        <div className="flex items-center gap-3">
          <SubmitButton pending={pending} variant="danger" size="sm">
            Send report
          </SubmitButton>
          <FormStatus state={state} />
        </div>
      </form>
    </details>
  );
}
