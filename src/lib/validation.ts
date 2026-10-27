import { z } from "zod";
import {
  ATTENDANCE,
  CONTACT_PREFS,
  EXHIBITOR_CATEGORIES,
  GOALS,
  INDUSTRIES,
  INTERESTS,
  MEETUP_TOPICS,
  NETWORKING_STYLES,
  OFFERS,
  POST_THEMES,
  ROLES,
  VISIBILITY,
  values,
} from "./constants";

const trimmed = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : null));

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full URL starting with https://");

const optionalUrl = z
  .union([z.literal(""), httpUrl])
  .optional()
  .transform((v) => (v ? v : null));

const multi = (opts: [string, ...string[]], min = 0, max = 20) =>
  z.array(z.enum(opts)).min(min).max(max).transform((a) => Array.from(new Set(a)));

export const profileSchema = z.object({
  name: trimmed(80).min(1, "Tell people your name"),
  headline: trimmed(100).min(2, "Add your job title or role"),
  roleCategory: z.enum(values(ROLES)),
  company: optionalText(100),
  industry: z
    .union([z.literal(""), z.enum(values(INDUSTRIES))])
    .optional()
    .transform((v) => (v ? v : null)),
  bio: trimmed(600).min(10, "Write at least a sentence about yourself"),
  location: optionalText(80),
  interests: multi(values(INTERESTS), 1, 10).refine((a) => a.length > 0, "Pick at least one interest"),
  goals: multi(values(GOALS), 1, 10),
  offers: multi(values(OFFERS), 0, 8),
  lookingFor: trimmed(300).default(""),
  canOffer: trimmed(300).default(""),
  attendance: z.enum(values(ATTENDANCE)),
  networkingStyle: z.enum(values(NETWORKING_STYLES)),
  visibility: z.enum(values(VISIBILITY)),
  contactPreference: z.enum(values(CONTACT_PREFS)),
  xHandle: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .refine((v) => v === "" || /^[A-Za-z0-9_]{1,15}$/.test(v), "Enter a valid X handle")
    .optional()
    .transform((v) => (v ? v : null)),
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
  shareLinksWithConnections: z.boolean().default(true),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const connectionRequestSchema = z.object({
  recipientId: z.uuid(),
  message: trimmed(300).default(""),
});

export const messageSchema = z.object({
  conversationId: z.uuid(),
  body: z.string().trim().min(1, "Message can't be empty").max(2000, "Messages are limited to 2000 characters"),
});

export const meetingSchema = z.object({
  inviteeId: z.uuid(),
  startsAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), "Pick a valid time"),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  location: trimmed(200).min(2, "Add a location or meeting point"),
  note: trimmed(300).default(""),
});

export const reportSchema = z.object({
  targetType: z.enum(["user", "message", "meetup", "post"]),
  targetId: z.string().trim().min(1).max(100),
  reason: z.enum(["spam", "harassment", "impersonation", "inappropriate", "other"]),
  details: trimmed(1000).default(""),
});

export const meetupSchema = z
  .object({
    title: trimmed(100).min(3, "Give your meetup a title"),
    description: trimmed(1000).default(""),
    topic: z.enum(values(MEETUP_TOPICS)),
    startsAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), "Pick a valid time"),
    location: optionalText(200),
    onlineUrl: optionalUrl,
    capacity: z.coerce.number().int().min(2).max(500),
  })
  .refine((m) => m.location || m.onlineUrl, { message: "Add a meeting point or an online link", path: ["location"] });

export const exhibitorSchema = z.object({
  name: trimmed(120).min(2),
  tagline: trimmed(160).default(""),
  description: trimmed(2000).default(""),
  industry: z
    .union([z.literal(""), z.enum(values(INDUSTRIES))])
    .optional()
    .transform((v) => (v ? v : null)),
  category: z.enum(values(EXHIBITOR_CATEGORIES)),
  websiteUrl: optionalUrl,
  logoUrl: optionalUrl,
  boothLocation: optionalText(80),
  boothVerified: z.boolean().default(false),
  isDemo: z.boolean().default(false),
  published: z.boolean().default(true),
});

export const inquirySchema = z.object({
  exhibitorId: z.uuid(),
  kind: z.enum(["question", "introduction"]),
  body: trimmed(1000).min(5, "Add a little more detail"),
});

export const postThemesSchema = z.array(z.enum(values(POST_THEMES))).max(6);

export const eventInfoSchema = z.object({
  name: trimmed(120).min(2),
  dates: trimmed(120).min(2),
  city: trimmed(120).min(2),
  venue: trimmed(200).default(""),
  officialUrl: optionalUrl,
  summary: trimmed(1000).default(""),
  hashtags: trimmed(300).default(""),
});
export type EventInfo = z.infer<typeof eventInfoSchema>;

/** Flatten zod issues into a { field: message } map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
