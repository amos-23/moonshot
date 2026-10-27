import { z } from "zod";
import { INTERESTS, OFFERS, WANTS, values } from "./constants";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const optional = (max: number) =>
  text(max)
    .optional()
    .transform((v) => v || null);
const pick = (opts: [string, ...string[]], max: number) =>
  z
    .array(z.enum(opts))
    .max(max, `Pick up to ${max}`)
    .transform((a) => Array.from(new Set(a)));

const url = (hostCheck?: (host: string) => boolean, message = "Enter a full link starting with https://") =>
  z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      try {
        const u = new URL(withProto);
        if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".") || (hostCheck && !hostCheck(u.hostname))) throw new Error();
        return u.toString();
      } catch {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
    });

export const cardSchema = z
  .object({
    name: text(60).min(1, "Add your name"),
    headline: text(80).min(2, "Say what you do, e.g. “Founder, Paystack-for-X”"),
    company: optional(80),
    bio: text(280).default(""),
    wants: pick(values(WANTS), 3),
    offers: pick(values(OFFERS), 3),
    interests: pick(values(INTERESTS), 5),
    attendance: z.enum(["in_person", "remote"]),
    xHandle: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").split(/[/?]/)[0] : null))
      .refine((v) => v === null || /^[A-Za-z0-9_]{1,15}$/.test(v), "Enter a valid X handle"),
    linkedinUrl: url((h) => /(^|\.)linkedin\.com$/i.test(h), "Enter your LinkedIn profile link"),
    whatsapp: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/[^\d+]/g, "") : null))
      .refine((v) => v === null || /^\+?\d{8,15}$/.test(v), "Enter a phone number with country code, e.g. +234…"),
    email: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email"),
    websiteUrl: url(),
  })
  .refine((c) => c.xHandle || c.linkedinUrl || c.whatsapp || c.email || c.websiteUrl, {
    message: "Add at least one way for people to reach you",
    path: ["contact"],
  });

export type CardInput = z.infer<typeof cardSchema>;

export const hangoutSchema = z.object({
  title: text(80).min(3, "Give it a short title"),
  details: text(400).default(""),
  startsAt: z.date({ error: "Pick a time" }),
  place: text(120).min(2, "Where should people go? e.g. “By the main stage” or a Zoom link"),
  capacity: z.coerce.number().int().min(2).max(200),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "_form");
    out[k] ??= i.message;
  }
  return out;
}
