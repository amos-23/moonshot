// Central place for reading configuration. Never import secret values into client components.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type AuthMode = "supabase" | "demo" | "none";

export function authMode(): AuthMode {
  if (supabaseUrl && supabaseAnonKey) return "supabase";
  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_AUTH === "true") return "demo";
  return "none";
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
