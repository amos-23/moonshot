import { z } from "zod";
import { OFFERS, WANTS, values } from "./constants";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const pick = (opts: [string, ...string[]], max: number) =>
  z
    .array(z.enum(opts))
    .max(max, `Pick up to ${max}`)
    .transform((a) => Array.from(new Set(a)));

export type Contact = { xHandle: string | null; whatsapp: string | null; email: string | null; linkedinUrl: string | null; websiteUrl: string | null };
const NO_CONTACT: Contact = { xHandle: null, whatsapp: null, email: null, linkedinUrl: null, websiteUrl: null };

/** One box for "how to reach you": works out whether it's an X handle, phone, email, LinkedIn or website. */
export function parseContact(raw: string): Contact | null {
  const v = raw.trim();
  if (!v) return null;
  // "@ada", or "ada" (a bare handle needs a letter, so phone numbers aren't mistaken for handles).
  const x = v.match(/^@([A-Za-z0-9_]{1,15})$/) ?? v.match(/^(?=\w*[A-Za-z])([A-Za-z0-9_]{1,15})$/) ?? v.match(/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?(?:\?.*)?$/i);
  if (x) return { ...NO_CONTACT, xHandle: x[1] };
  if (/^\+?[\d\s()-]{8,20}$/.test(v)) {
    const digits = v.replace(/[^\d+]/g, "");
    return /^\+?\d{8,15}$/.test(digits) ? { ...NO_CONTACT, whatsapp: digits } : null;
  }
  if (z.email().safeParse(v).success) return { ...NO_CONTACT, email: v.toLowerCase() };
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return /(^|\.)linkedin\.com$/i.test(u.hostname) ? { ...NO_CONTACT, linkedinUrl: u.toString() } : { ...NO_CONTACT, websiteUrl: u.toString() };
  } catch {
    return null;
  }
}

export const cardSchema = z
  .object({
    name: text(60).min(1, "Add your name"),
    headline: text(80).min(2, "Say what you do"),
    wants: pick(values(WANTS), 3),
    offers: pick(values(OFFERS), 3),
    company: text(80)
      .optional()
      .transform((v) => v || null),
    contact: z.string().max(300).default(""),
  })
  .transform((c, ctx) => {
    const contact = parseContact(c.contact);
    if (!contact) {
      ctx.addIssue({ code: "custom", path: ["contact"], message: c.contact.trim() ? "Try @yourhandle, a phone number, an email or a link" : "Add your X handle (or another way to reach you)" });
      return z.NEVER;
    }
    const { contact: _raw, ...rest } = c;
    void _raw;
    return { ...rest, ...contact };
  });

export type CardInput = z.infer<typeof cardSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "_form")] ??= i.message;
  return out;
}

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("That email doesn't look right")),
  name: text(60).transform((v) => v || null),
  about: text(100).transform((v) => v || null),
});
