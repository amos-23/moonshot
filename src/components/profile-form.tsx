"use client";

import { useState } from "react";
import { saveProfileAction } from "@/lib/actions/profile";
import type { Profile } from "@/lib/db/schema";
import {
  ATTENDANCE,
  CONTACT_PREFS,
  GOALS,
  INDUSTRIES,
  INTERESTS,
  NETWORKING_STYLES,
  OFFERS,
  ROLES,
  VISIBILITY,
} from "@/lib/constants";
import { ChipGroup, FormStatus, RadioCards, SubmitButton, useForm } from "./forms";
import { Avatar, Card, Field, inputClass } from "./ui";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

export function ProfileForm({ profile, onboarding }: { profile: Profile | null; onboarding?: boolean }) {
  const { state, pending, onSubmit, err } = useForm(saveProfileAction, { refresh: true });
  const [preview, setPreview] = useState<string | null>(profile?.avatarUrl ?? null);
  const p = profile;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate encType="multipart/form-data">
      <Section title="About you" description="This is what people see on your card.">
        <div className="flex items-center gap-4">
          <Avatar name={p?.name ?? "You"} src={preview} size={64} />
          <Field label="Profile photo" htmlFor="photo" optional error={err("photo")} hint="JPEG, PNG or WebP.">
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-50 file:px-3 file:py-1.5 file:text-accent"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : p?.avatarUrl ?? null);
              }}
            />
            {p?.avatarUrl && (
              <label className="mt-1 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="removePhoto" /> Remove current photo
              </label>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={err("name")}>
            <input id="name" name="name" required maxLength={80} defaultValue={p?.name} className={inputClass} autoComplete="name" aria-invalid={!!err("name")} />
          </Field>
          <Field label="Job title or role" htmlFor="headline" error={err("headline")}>
            <input id="headline" name="headline" required maxLength={100} defaultValue={p?.headline} placeholder="e.g. Co-founder & CEO" className={inputClass} aria-invalid={!!err("headline")} />
          </Field>
          <Field label="Which best describes you?" htmlFor="roleCategory">
            <select id="roleCategory" name="roleCategory" defaultValue={p?.roleCategory ?? "founder"} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company or project" htmlFor="company" optional error={err("company")}>
            <input id="company" name="company" maxLength={100} defaultValue={p?.company ?? ""} className={inputClass} autoComplete="organization" />
          </Field>
          <Field label="Industry" htmlFor="industry" optional>
            <select id="industry" name="industry" defaultValue={p?.industry ?? ""} className={inputClass}>
              <option value="">—</option>
              {INDUSTRIES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location" htmlFor="location" optional error={err("location")}>
            <input id="location" name="location" maxLength={80} defaultValue={p?.location ?? ""} placeholder="e.g. Lagos" className={inputClass} />
          </Field>
        </div>
        <Field label="Short bio" htmlFor="bio" error={err("bio")} hint="A couple of sentences. Max 600 characters.">
          <textarea id="bio" name="bio" required rows={3} maxLength={600} defaultValue={p?.bio} className={inputClass} aria-invalid={!!err("bio")} />
        </Field>
      </Section>

      <Section title="What you're here for" description="Used to recommend people. Every match comes with a clear reason.">
        <ChipGroup name="interests" legend="Areas of interest" options={INTERESTS} defaultValue={p?.interests} max={10} error={err("interests")} hint="Pick up to 10." />
        <ChipGroup name="goals" legend="What do you want from Moonshot?" options={GOALS} defaultValue={p?.goals} error={err("goals")} hint="Select all that apply." />
        <Field label="In your own words: what are you looking for?" htmlFor="lookingFor" optional error={err("lookingFor")}>
          <textarea id="lookingFor" name="lookingFor" rows={2} maxLength={300} defaultValue={p?.lookingFor} placeholder="e.g. Distribution partners for our SME payments app in Ghana" className={inputClass} />
        </Field>
        <ChipGroup name="offers" legend="What can you offer other attendees?" options={OFFERS} defaultValue={p?.offers} max={8} error={err("offers")} />
        <Field label="Anything else you can help with?" htmlFor="canOffer" optional error={err("canOffer")}>
          <textarea id="canOffer" name="canOffer" rows={2} maxLength={300} defaultValue={p?.canOffer} placeholder="e.g. Happy to review pitch decks and share go-to-market lessons" className={inputClass} />
        </Field>
      </Section>

      <Section title="At the event">
        <RadioCards name="attendance" legend="Are you attending?" options={ATTENDANCE} defaultValue={p?.attendance ?? "in_person"} columns={3} />
        <p className="-mt-2 text-xs text-muted">This is self-reported. We don&apos;t verify tickets.</p>
        <RadioCards name="networkingStyle" legend="Preferred networking style" options={NETWORKING_STYLES} defaultValue={p?.networkingStyle ?? "both"} columns={3} />
      </Section>

      <Section title="Privacy & contact" description="You're in control of who sees you and who can reach you.">
        <RadioCards name="visibility" legend="Profile visibility" options={VISIBILITY} defaultValue={p?.visibility ?? "members"} />
        <RadioCards name="contactPreference" legend="Who can send you connection requests?" options={CONTACT_PREFS} defaultValue={p?.contactPreference ?? "everyone"} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="X handle" htmlFor="xHandle" optional error={err("xHandle")}>
            <input id="xHandle" name="xHandle" defaultValue={p?.xHandle ?? ""} placeholder="@handle" className={inputClass} />
          </Field>
          <Field label="LinkedIn URL" htmlFor="linkedinUrl" optional error={err("linkedinUrl")}>
            <input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={p?.linkedinUrl ?? ""} className={inputClass} />
          </Field>
          <Field label="Website" htmlFor="websiteUrl" optional error={err("websiteUrl")}>
            <input id="websiteUrl" name="websiteUrl" type="url" defaultValue={p?.websiteUrl ?? ""} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="shareLinksWithConnections" defaultChecked={p?.shareLinksWithConnections ?? true} className="mt-0.5" />
          <span>
            Share these links with people I&apos;ve accepted as connections.
            <span className="block text-xs text-muted">Links are never shown publicly, and your email is never shown to anyone.</span>
          </span>
        </label>
      </Section>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 backdrop-blur md:bottom-4">
        <SubmitButton pending={pending} size="lg">
          {onboarding ? "Create my profile" : "Save changes"}
        </SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
